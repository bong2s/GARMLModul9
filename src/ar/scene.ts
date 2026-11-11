import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { HOME_EULER, PART_SCALE_MAX, PART_SCALE_MIN, ZOOM_STEP } from "./config";

/**
 * Scene manager for Modul 9 (unchanged from Modul 8).
 *
 * Adapted from the Modul 6 SceneManager (same renderer / light rig / arcball / AR spawn
 * maths / gyro fallback), with these Modul 7 specific additions:
 *
 *   • Every model is a "part" with its own pivot group, so it can be rotated, moved and
 *     zoomed on its own (mode "individual") or together with the others (mode "all",
 *     which transforms `modelRoot`).
 *   • The camera is framed on the *free region* of the screen (between the top controls
 *     and the bottom panels / info sheet) by fitting the real projected geometry,
 *     instead of a fixed bounding-sphere factor.
 */

export type TransformMode = "individual" | "all";

export interface ScenePart {
  id: string;
  /** Pivot group: its origin is the centre of the model's bounding box. */
  group: THREE.Group;
  homePosition: THREE.Vector3;
  homeQuaternion: THREE.Quaternion;
  /** Half extents of the model's box in the pivot group's local space. */
  half: THREE.Vector3;
  /** Manual zoom multiplier (1 = home). */
  scaleMul: number;
}

const BASE_FOV = 42;
const FIT_FILL = 0.95; // fraction of the free region the arrangement may occupy

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly modelRoot: THREE.Group;
  readonly homeQuaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(HOME_EULER.x, HOME_EULER.y, 0, HOME_EULER.order)
  );

  private readonly container: HTMLElement;
  private animationRunning = false;
  private resizeObserver: ResizeObserver | null = null;
  private frameCallback: ((frame?: XRFrame) => void) | null = null;

  private cameraVideo: HTMLVideoElement | null = null;
  private cameraStream: MediaStream | null = null;

  // ---- group (modelRoot) zoom ----
  private modelScale = 1;
  private readonly minModelScale = 0.08;
  private readonly maxModelScale = 8;
  private readonly arScaleMin = 0.4;
  private readonly arScaleMax = 3.0;

  // ---- parts (individual models) ----
  readonly parts = new Map<string, ScenePart>();
  private mode: TransformMode = "all";
  private selectedId: string | null = null;
  /** Returns the model id under a client position (raycast), supplied by the viewer. */
  pickProvider: ((clientX: number, clientY: number) => string | null) | null = null;
  /** Called when a drag on an unselected model auto-selects it (individual mode). */
  onAutoSelect: ((id: string) => void) | null = null;
  private partTween: number | null = null;
  private shadowDirty = true;

  // ---- camera framing ----
  private insetTop = 0;
  private insetBottom = 0;
  private insetLeft = 0;
  private insetRight = 0;
  private viewCenter = new THREE.Vector3();
  private viewDistance = 8;
  private viewTween: number | null = null;
  private homePoints: THREE.Vector3[] = [];

  // Pointer state
  private readonly activePointers = new Map<number, THREE.Vector2>();
  private readonly lastSinglePointer = new THREE.Vector2();
  private readonly twoFingerLastMidpoint = new THREE.Vector2();
  private twoFingerLastDistance = 0;
  private twoFingerMode = false;

  // Mouse state
  private mouseRotateActive = false;
  private mousePanActive = false;
  private readonly lastMousePosition = new THREE.Vector2();

  // Virtual trackball (arcball)
  private readonly ballCenter = new THREE.Vector2();
  private ballRadius = 1;
  private readonly ballPrev = new THREE.Vector3();
  private readonly ballCurr = new THREE.Vector3();
  private readonly ballDelta = new THREE.Quaternion();
  private readonly cameraQuat = new THREE.Quaternion();
  private readonly cameraQuatInv = new THREE.Quaternion();
  private readonly projectedCenter = new THREE.Vector3();
  private ballActive = false;

  private readonly panRight = new THREE.Vector3();
  private readonly panUp = new THREE.Vector3();

  private readonly disposers: Array<() => void> = [];

  // ---- AR ----
  /** true while a WebXR session or the gyro fallback is running. */
  arMode = false;
  private baseScale = 1;
  /** y (arrangement-local) of the floor / lowest point, relative to the arrangement centre. */
  floorY = 0;
  placedYaw = 0;
  private fallbackActive = false;
  private deviceOrientationHandler: ((e: DeviceOrientationEvent) => void) | null = null;
  private readonly fallbackCamPos = new THREE.Vector3(0, 1.4, 0);
  private orientQuat = new THREE.Quaternion();
  private screenOrientHandler: (() => void) | null = null;

  /**
   * Initial AR placement (metres / radians), same scheme as Modul 6:
   * distance = camera → centre of the arrangement, elevation clamp relative to the camera
   * horizon, fill = share of the horizontal half-FOV the arrangement may use,
   * width = upper bound of the arrangement width.
   *
   * Deliberate Modul 7 deviation: Modul 6 puts the layout 6–16° ABOVE eye level (so the
   * underside of its boards is easy to see). Modul 7's content faces UP (calculator keypad,
   * CPU lid, chip top), so the layout is placed 16–28° BELOW the camera horizon, like a
   * table in front of the user. Set both values back to +6°/+16° for the Modul 6 behaviour.
   */
  static readonly SPAWN = {
    distance: 0.6,
    minElevation: THREE.MathUtils.degToRad(-28),
    maxElevation: THREE.MathUtils.degToRad(-16),
    fill: 0.9,
    width: 0.5,
  };

  /** Half-extent (x, y, z) of the arrangement at scale 1; set by the viewer after assembly. */
  readonly arHalfExtent = new THREE.Vector3(0.5, 0.05, 0.5);

  computeSpawn(
    camPos: THREE.Vector3,
    camQuat: THREE.Quaternion,
    tanHalfH: number,
    tanHalfV: number
  ): { center: THREE.Vector3; yaw: number; scale: number } {
    const S = SceneManager.SPAWN;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat).normalize();
    const pitch = Math.asin(THREE.MathUtils.clamp(f.y, -1, 1));

    const h = new THREE.Vector3(f.x, 0, f.z);
    if (h.lengthSq() < 0.15) {
      h.set(0, 1, 0).applyQuaternion(camQuat);
      h.y = 0;
    }
    if (h.lengthSq() < 1e-6) h.set(0, 0, -1);
    h.normalize();

    const vHalf = Math.atan(Math.max(tanHalfV, 0.2));
    let elev = THREE.MathUtils.clamp(pitch, S.minElevation, S.maxElevation);
    // always keep the centre inside the vertical field of view
    elev = THREE.MathUtils.clamp(elev, pitch - 0.6 * vHalf, pitch + 0.6 * vHalf);

    const center = new THREE.Vector3(
      camPos.x + h.x * S.distance * Math.cos(elev),
      camPos.y + S.distance * Math.sin(elev),
      camPos.z + h.z * S.distance * Math.cos(elev)
    );
    const yaw = Math.atan2(camPos.x - center.x, camPos.z - center.z);

    const t = Math.tan(S.fill * Math.atan(Math.max(tanHalfH, 0.2)));
    const hx = Math.max(this.arHalfExtent.x, 1e-6);
    const hz = Math.max(this.arHalfExtent.z, 1e-6);
    const fitScale = (t * S.distance) / (hx + t * hz);
    const capScale = S.width / (2 * Math.max(hx, hz));
    return { center, yaw, scale: Math.min(fitScale, capScale) };
  }

  setARBaseScale(scale: number): void {
    if (scale > 0 && Number.isFinite(scale)) this.baseScale = scale;
  }

  placeCenterAt(center: THREE.Vector3, yaw: number, scale: number): void {
    this.setARBaseScale(scale);
    this.placeAt(new THREE.Vector3(center.x, center.y + this.floorY * scale, center.z), yaw);
  }

  private gotOrientation = false;
  private pendingPlace = false;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- lights ----
  private keyLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private readonly lightTarget = new THREE.Object3D();
  private readonly keyOffset = new THREE.Vector3(6, 10, 8);
  private lastLightScale = -1;
  private readonly defaultEnvironment: THREE.Texture;
  private lightEstimating = false;

  constructor(container: HTMLElement) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.modelRoot = new THREE.Group();
    this.scene.add(this.modelRoot);

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    this.camera = new THREE.PerspectiveCamera(BASE_FOV, width / height, 0.01, 400);
    this.camera.position.set(0, 0, 8);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType("local");

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.defaultEnvironment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.defaultEnvironment;
    this.scene.environmentIntensity = 0.6;
    this.renderer.setClearAlpha(0);

    const canvas = this.renderer.domElement;
    canvas.style.position = "relative";
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.background = "transparent";
    canvas.style.touchAction = "none";
    canvas.style.userSelect = "none";
    (canvas.style as CSSStyleDeclaration & { webkitUserSelect: string }).webkitUserSelect = "none";
    canvas.style.zIndex = "1";
    container.appendChild(canvas);

    this.setupLights();
    this.setupPointerControls();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
  }

  // ============================================================
  // LIGHTING (same rig as Modul 6)
  // ============================================================

  private setupLights(): void {
    this.hemiLight = new THREE.HemisphereLight("#fff1dc", "#2b211d", 1.5);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight("#fff8ef", 2.2);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight, this.lightTarget);
    this.keyLight.target = this.lightTarget;

    const fill = new THREE.DirectionalLight("#9fc4e4", 0.8);
    fill.position.set(-7, 5, 2);
    this.scene.add(fill);
  }

  updateLights(): void {
    this.syncShadowMap();
    const k = this.modelRoot.scale.x;
    this.lightTarget.position.copy(this.modelRoot.position);
    this.keyLight.position.copy(this.modelRoot.position).addScaledVector(this.keyOffset, k);

    if (Math.abs(k - this.lastLightScale) > this.lastLightScale * 0.01) {
      this.lastLightScale = k;
      const cam = this.keyLight.shadow.camera;
      const half = 8 * k;
      cam.left = -half;
      cam.right = half;
      cam.top = half;
      cam.bottom = -half;
      cam.near = 0.5 * k;
      cam.far = 40 * k;
      cam.updateProjectionMatrix();
    }
  }

  private readonly shadowSigPos = new THREE.Vector3(NaN, 0, 0);
  private readonly shadowSigQuat = new THREE.Quaternion();
  private shadowSigScale = NaN;

  /** Shadow map is recomputed only when the arrangement or one of its parts changed. */
  private syncShadowMap(): void {
    const m = this.modelRoot;
    const changed =
      this.shadowDirty ||
      Number.isNaN(this.shadowSigScale) ||
      !m.position.equals(this.shadowSigPos) ||
      !m.quaternion.equals(this.shadowSigQuat) ||
      m.scale.x !== this.shadowSigScale;
    if (!changed) return;
    this.shadowDirty = false;
    this.shadowSigPos.copy(m.position);
    this.shadowSigQuat.copy(m.quaternion);
    this.shadowSigScale = m.scale.x;
    this.renderer.shadowMap.needsUpdate = true;
  }

  markShadowDirty(): void {
    this.shadowDirty = true;
  }

  setLightEstimation(active: boolean, environment?: THREE.Texture | null): void {
    this.lightEstimating = active;
    this.hemiLight.intensity = active ? 0.5 : 1.5;
    this.keyLight.intensity = active ? 0.8 : 2.2;
    this.scene.environment = active && environment ? environment : this.defaultEnvironment;
    this.scene.environmentIntensity = active ? 1 : 0.6;
  }

  // ============================================================
  // PARTS / MODE / SELECTION
  // ============================================================

  /** Register a model pivot group; its current pose becomes the home pose. */
  registerPart(id: string, group: THREE.Group, half: THREE.Vector3): void {
    this.parts.set(id, {
      id,
      group,
      half: half.clone(),
      homePosition: group.position.clone(),
      homeQuaternion: group.quaternion.clone(),
      scaleMul: 1,
    });
  }

  setMode(mode: TransformMode): void {
    this.mode = mode;
    this.endAllGestures();
  }
  getMode(): TransformMode {
    return this.mode;
  }
  setSelected(id: string | null): void {
    this.selectedId = id;
    this.endAllGestures();
  }
  getSelected(): string | null {
    return this.selectedId;
  }

  private endAllGestures(): void {
    this.ballActive = false;
    this.twoFingerMode = false;
    this.activePointers.clear();
    this.mouseRotateActive = false;
    this.mousePanActive = false;
  }

  /** Object the gestures / zoom buttons currently act on (null = nothing selected). */
  private activeObject(): THREE.Object3D | null {
    if (this.mode === "all") return this.modelRoot;
    const part = this.selectedId ? this.parts.get(this.selectedId) : undefined;
    return part ? part.group : null;
  }

  hasManipulationTarget(): boolean {
    return this.activeObject() !== null;
  }

  private activePart(): ScenePart | null {
    if (this.mode !== "individual" || !this.selectedId) return null;
    return this.parts.get(this.selectedId) ?? null;
  }

  /** Zoom button: +1 = in, −1 = out. Returns false if there is nothing to act on. */
  zoom(direction: number): boolean {
    if (!this.activeObject()) return false;
    this.scaleModel(direction >= 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    return true;
  }

  private cancelPartTween(): void {
    if (this.partTween !== null) {
      cancelAnimationFrame(this.partTween);
      this.partTween = null;
    }
  }

  /** Return the given parts (all when omitted) to their home pose, optionally animated. */
  resetParts(ids?: string[], animate = true): void {
    this.cancelPartTween();
    const list = [...this.parts.values()].filter((p) => !ids || ids.includes(p.id));
    const starts = list.map((p) => ({
      p,
      pos: p.group.position.clone(),
      quat: p.group.quaternion.clone(),
      scale: p.group.scale.x,
    }));
    const apply = (t: number) => {
      for (const s of starts) {
        s.p.group.position.lerpVectors(s.pos, s.p.homePosition, t);
        s.p.group.quaternion.slerpQuaternions(s.quat, s.p.homeQuaternion, t);
        s.p.group.scale.setScalar(s.scale + (1 - s.scale) * t);
        s.p.scaleMul = s.p.group.scale.x;
      }
      this.markShadowDirty();
    };
    if (!animate) {
      apply(1);
      return;
    }
    const t0 = performance.now();
    const tick = () => {
      const progress = Math.min((performance.now() - t0) / 280, 1);
      apply(1 - Math.pow(1 - progress, 3));
      this.partTween = progress < 1 ? requestAnimationFrame(tick) : null;
    };
    tick();
  }

  /** Reset the group transform (modelRoot). In AR only yaw/scale are restored. */
  resetRoot(): void {
    if (this.arMode) {
      this.resetAR();
      return;
    }
    this.modelScale = 1;
    this.modelRoot.position.set(0, 0, 0);
    this.modelRoot.quaternion.copy(this.homeQuaternion);
    this.modelRoot.scale.setScalar(1);
    this.modelRoot.updateMatrixWorld(true);
    this.markShadowDirty();
  }

  // ============================================================
  // POINTER CONTROLS
  // ============================================================

  private setupPointerControls(): void {
    const canvas = this.renderer.domElement;

    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions
    ) => {
      canvas.addEventListener(type, handler as EventListener, options);
      this.disposers.push(() => canvas.removeEventListener(type, handler as EventListener));
    };

    on(
      "pointerdown",
      (event) => {
        if (this.arMode) return;
        event.preventDefault();
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
        this.cancelPartTween();

        // Individual mode with nothing selected: a drag that starts on a model selects it.
        if (this.mode === "individual" && !this.selectedId && this.pickProvider) {
          const hit = this.pickProvider(event.clientX, event.clientY);
          if (hit) {
            this.selectedId = hit;
            this.onAutoSelect?.(hit);
          }
        }

        this.activePointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));

        if (event.pointerType === "mouse") {
          if (event.button === 0 && !event.shiftKey) {
            this.mouseRotateActive = true;
            this.mousePanActive = false;
            this.beginRotate(event.clientX, event.clientY);
          }
          if (event.button === 2 || (event.button === 0 && event.shiftKey)) {
            this.mouseRotateActive = false;
            this.mousePanActive = true;
          }
          this.lastMousePosition.set(event.clientX, event.clientY);
          return;
        }

        if (this.activePointers.size === 1) {
          this.twoFingerMode = false;
          this.lastSinglePointer.set(event.clientX, event.clientY);
          this.beginRotate(event.clientX, event.clientY);
          return;
        }
        if (this.activePointers.size === 2) {
          this.ballActive = false;
          this.beginTwoFingerGesture();
        }
      },
      { passive: false }
    );

    on(
      "pointermove",
      (event) => {
        if (!this.activePointers.has(event.pointerId)) return;
        if (this.arMode) return;
        event.preventDefault();
        this.activePointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));

        if (event.pointerType === "mouse") {
          const dx = event.clientX - this.lastMousePosition.x;
          const dy = event.clientY - this.lastMousePosition.y;
          if (this.mouseRotateActive) this.rotateArcball(event.clientX, event.clientY);
          if (this.mousePanActive) this.panModel(dx, dy);
          this.lastMousePosition.set(event.clientX, event.clientY);
          return;
        }

        if (this.activePointers.size === 1 && !this.twoFingerMode) {
          this.rotateArcball(event.clientX, event.clientY);
          this.lastSinglePointer.set(event.clientX, event.clientY);
          return;
        }
        if (this.activePointers.size === 2) this.handleTwoFingerGesture();
      },
      { passive: false }
    );

    const endPointer = (event: PointerEvent) => {
      this.activePointers.delete(event.pointerId);

      if (event.pointerType === "mouse") {
        this.mouseRotateActive = false;
        this.mousePanActive = false;
        this.ballActive = false;
      }
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }

      if (this.activePointers.size === 0) {
        this.twoFingerMode = false;
        this.twoFingerLastDistance = 0;
        return;
      }
      if (this.activePointers.size === 1) {
        const remaining = [...this.activePointers.values()][0];
        this.lastSinglePointer.copy(remaining);
        this.beginRotate(remaining.x, remaining.y);
        this.twoFingerMode = false;
        this.twoFingerLastDistance = 0;
      }
    };

    on("pointerup", endPointer);
    on("pointercancel", endPointer);
    on("contextmenu", (event) => event.preventDefault());

    on(
      "wheel",
      (event) => {
        if (this.arMode) return;
        event.preventDefault();
        if (!this.activeObject() && this.mode === "individual" && this.pickProvider) {
          const hit = this.pickProvider(event.clientX, event.clientY);
          if (hit) {
            this.selectedId = hit;
            this.onAutoSelect?.(hit);
          }
        }
        this.scaleModel(Math.exp(-event.deltaY * 0.0015));
      },
      { passive: false }
    );
  }

  private beginTwoFingerGesture(): void {
    const points = [...this.activePointers.values()];
    if (points.length !== 2) return;
    const [a, b] = points;
    this.twoFingerLastMidpoint.set((a.x + b.x) * 0.5, (a.y + b.y) * 0.5);
    this.twoFingerLastDistance = Math.max(a.distanceTo(b), 0.001);
    this.twoFingerMode = true;
  }

  private handleTwoFingerGesture(): void {
    const points = [...this.activePointers.values()];
    if (points.length !== 2) return;
    const [a, b] = points;

    const mx = (a.x + b.x) * 0.5;
    const my = (a.y + b.y) * 0.5;
    const dx = mx - this.twoFingerLastMidpoint.x;
    const dy = my - this.twoFingerLastMidpoint.y;
    if (dx !== 0 || dy !== 0) this.panModel(dx, dy);

    const distance = Math.max(a.distanceTo(b), 0.001);
    if (this.twoFingerLastDistance > 0) this.scaleModel(distance / this.twoFingerLastDistance);

    this.twoFingerLastMidpoint.set(mx, my);
    this.twoFingerLastDistance = distance;
  }

  // ---------------- arcball ----------------

  private mapToBall(clientX: number, clientY: number, out: THREE.Vector3): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = (clientX - rect.left - this.ballCenter.x) / this.ballRadius;
    const y = -(clientY - rect.top - this.ballCenter.y) / this.ballRadius;
    const d2 = x * x + y * y;
    const z = d2 <= 0.5 ? Math.sqrt(1 - d2) : 0.5 / Math.sqrt(d2);
    out.set(x, y, z).normalize();
  }

  private beginRotate(clientX: number, clientY: number): void {
    const target = this.activeObject();
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!target || rect.width <= 0 || rect.height <= 0) {
      this.ballActive = false;
      return;
    }

    target.updateWorldMatrix(true, false);
    target.getWorldPosition(this.projectedCenter);
    this.projectedCenter.project(this.camera);

    this.ballCenter.set(
      (this.projectedCenter.x * 0.5 + 0.5) * rect.width,
      (-this.projectedCenter.y * 0.5 + 0.5) * rect.height
    );
    this.ballRadius = Math.max(Math.min(rect.width, rect.height) * 0.5, 1);

    this.mapToBall(clientX, clientY, this.ballPrev);
    this.ballActive = true;
  }

  private rotateArcball(clientX: number, clientY: number): void {
    const target = this.activeObject();
    if (!target) return;
    if (!this.ballActive) {
      this.beginRotate(clientX, clientY);
      return;
    }
    if (this.arMode) return;

    this.mapToBall(clientX, clientY, this.ballCurr);
    if (this.ballPrev.distanceToSquared(this.ballCurr) < 1e-12) return;

    this.ballDelta.setFromUnitVectors(this.ballPrev, this.ballCurr);
    this.camera.updateMatrixWorld(true);
    this.camera.getWorldQuaternion(this.cameraQuat);
    this.cameraQuatInv.copy(this.cameraQuat).invert();
    // Rotation expressed in WORLD space, about camera-aligned axes.
    this.ballDelta.premultiply(this.cameraQuat).multiply(this.cameraQuatInv);

    this.rotateObjectWorld(target, this.ballDelta);
    this.markShadowDirty();
    this.ballPrev.copy(this.ballCurr);
  }

  private readonly _qa = new THREE.Quaternion();
  private readonly _qb = new THREE.Quaternion();

  private rotateObjectWorld(obj: THREE.Object3D, delta: THREE.Quaternion): void {
    obj.updateWorldMatrix(true, false);
    obj.getWorldQuaternion(this._qa); // current world rotation
    this._qa.premultiply(delta); // new world rotation
    if (obj.parent) {
      obj.parent.getWorldQuaternion(this._qb).invert();
      this._qa.premultiply(this._qb); // → local rotation
    }
    obj.quaternion.copy(this._qa).normalize();
  }

  // ---------------- pan ----------------

  private panModel(dx: number, dy: number): void {
    if (this.arMode) return; // finger gestures never move the arrangement in AR
    const target = this.activeObject();
    if (!target) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const height = Math.max(rect.height, 1);
    const width = Math.max(rect.width, 1);

    const world = target.getWorldPosition(new THREE.Vector3());
    const distance = Math.max(this.camera.position.distanceTo(world), 0.01);
    const visibleWorldHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) * 0.5);
    const visibleWorldWidth = visibleWorldHeight * (width / height);

    this.panRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion).normalize();
    this.panUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion).normalize();

    world.addScaledVector(this.panRight, dx * (visibleWorldWidth / width));
    world.addScaledVector(this.panUp, -dy * (visibleWorldHeight / height));

    if (target.parent) target.position.copy(target.parent.worldToLocal(world));
    else target.position.copy(world);
    this.markShadowDirty();
  }

  // ---------------- scale ----------------

  private scaleModel(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const part = this.activePart();
    if (part) {
      const next = THREE.MathUtils.clamp(part.scaleMul * factor, PART_SCALE_MIN, PART_SCALE_MAX);
      part.scaleMul = next;
      part.group.scale.setScalar(next);
      this.markShadowDirty();
      return;
    }
    if (this.mode !== "all") return;

    const [min, max] = this.arMode
      ? [this.arScaleMin, this.arScaleMax]
      : [this.minModelScale, this.maxModelScale];

    const oldWorldScale = this.modelRoot.scale.x;
    const floorWorldY = this.modelRoot.position.y + this.floorY * oldWorldScale;

    this.modelScale = THREE.MathUtils.clamp(this.modelScale * factor, min, max);
    this.modelRoot.scale.setScalar(this.modelScale * this.baseScale);

    if (this.arMode) {
      this.modelRoot.position.y = floorWorldY - this.floorY * this.modelRoot.scale.x;
    }
  }

  // ============================================================
  // CAMERA BACKGROUND
  // ============================================================

  async startCameraPreview(): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    if (this.cameraStream && this.cameraVideo) return true;

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        audio: false,
      });
    } catch (error) {
      console.warn("MODUL9: tidak dapat mengakses kamera belakang.", error);
      this.cameraStream = null;
      return false;
    }

    const video = document.createElement("video");
    video.className = "ar-camera-bg";
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.srcObject = this.cameraStream;

    if (window.getComputedStyle(this.container).position === "static") {
      this.container.style.position = "relative";
    }
    this.container.prepend(video);
    this.cameraVideo = video;
    this.updateCameraVideoLayout();

    try {
      await video.play();
    } catch (error) {
      console.warn("MODUL9: pemutaran kamera tertunda.", error);
    }
    return true;
  }

  stopCameraPreview(): void {
    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.cameraStream = null;
    if (this.cameraVideo) {
      this.cameraVideo.pause();
      this.cameraVideo.srcObject = null;
      this.cameraVideo.remove();
      this.cameraVideo = null;
    }
  }

  get hasCameraPreview(): boolean {
    return this.cameraVideo !== null;
  }

  private updateCameraVideoLayout(): void {
    if (this.cameraVideo) {
      const s = this.cameraVideo.style;
      s.position = "absolute";
      s.inset = "0";
      s.width = "100%";
      s.height = "100%";
      s.objectFit = "cover";
      s.display = "block";
      s.zIndex = "0";
      s.pointerEvents = "none";
    }
    const cs = this.renderer.domElement.style;
    cs.position = "relative";
    cs.zIndex = "1";
    cs.background = "transparent";
  }

  // ============================================================
  // LOOP
  // ============================================================

  setFrameCallback(callback: (frame?: XRFrame) => void): void {
    this.frameCallback = callback;
  }

  start(): void {
    if (this.animationRunning) return;
    this.animationRunning = true;
    this.renderer.setAnimationLoop((_time, frame) => {
      this.frameCallback?.(frame);
      this.renderer.render(this.scene, this.camera);
    });
  }

  // ============================================================
  // CAMERA FRAMING (preview)
  // ============================================================

  /**
   * Call once after all parts are at their home pose and `modelRoot` is at the home
   * orientation: stores the world-space hull of the home composition used for framing.
   */
  captureHomeHull(): void {
    const savedPos = this.modelRoot.position.clone();
    const savedQuat = this.modelRoot.quaternion.clone();
    const savedScale = this.modelRoot.scale.clone();
    this.modelRoot.position.set(0, 0, 0);
    this.modelRoot.scale.setScalar(1);
    this.modelRoot.quaternion.copy(this.homeQuaternion);
    this.modelRoot.updateMatrixWorld(true);

    // Oriented corners of each model's own box (tighter than a world AABB of a tilted plate).
    const points: THREE.Vector3[] = [];
    for (const part of this.parts.values()) {
      part.group.updateMatrixWorld(true);
      for (let i = 0; i < 8; i++) {
        points.push(
          part.group.localToWorld(
            new THREE.Vector3(
              i & 1 ? part.half.x : -part.half.x,
              i & 2 ? part.half.y : -part.half.y,
              i & 4 ? part.half.z : -part.half.z
            )
          )
        );
      }
    }
    this.homePoints = points;

    this.modelRoot.position.copy(savedPos);
    this.modelRoot.quaternion.copy(savedQuat);
    this.modelRoot.scale.copy(savedScale);
    this.modelRoot.updateMatrixWorld(true);
  }

  /** Distance + look-at centre so that the home hull fills `FIT_FILL` of the free region. */
  private computeFit(
    top: number,
    bottom: number,
    left: number,
    right: number
  ): { center: THREE.Vector3; distance: number } {
    const width = Math.max(this.container.clientWidth - left - right, 160);
    const height = Math.max(this.container.clientHeight, 1);
    const regionH = Math.max(height - top - bottom, 120);
    const center = new THREE.Vector3();
    if (this.homePoints.length === 0) return { center, distance: 8 };

    new THREE.Box3().setFromPoints(this.homePoints).getCenter(center);

    const cam = new THREE.PerspectiveCamera(BASE_FOV, width / regionH, 0.01, 400);
    const fits = (d: number): boolean => {
      cam.position.set(center.x, center.y, center.z + d);
      cam.lookAt(center);
      cam.updateMatrixWorld(true);
      cam.updateProjectionMatrix();
      const v = new THREE.Vector3();
      for (const p of this.homePoints) {
        v.copy(p).project(cam);
        if (v.z > 1 || Math.abs(v.x) > FIT_FILL || Math.abs(v.y) > FIT_FILL) return false;
      }
      return true;
    };

    let lo = 0.5;
    let hi = 250;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    return { center, distance: THREE.MathUtils.clamp(hi, 1, 200) };
  }

  /**
   * Keep the same focal length as a 42° camera over the free region, but render the
   * whole canvas: fov is enlarged and the view is shifted so the free region is centred.
   */
  private applyInsets(top: number, bottom: number, left: number, right: number): void {
    this.insetTop = top;
    this.insetBottom = bottom;
    this.insetLeft = left;
    this.insetRight = right;
    if (this.arMode || this.renderer.xr.isPresenting) return;

    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    const regionH = Math.max(height - top - bottom, 120);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(BASE_FOV) / 2) * (height / regionH);
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanHalf));
    this.camera.aspect = width / height;
    const shiftY = (top - bottom) / 2; // free-region centre minus screen centre (px)
    const shiftX = (left - right) / 2;
    if (Math.abs(shiftY) < 0.5 && Math.abs(shiftX) < 0.5) this.camera.clearViewOffset();
    else this.camera.setViewOffset(width, height, -shiftX, -shiftY, width, height);
    this.camera.updateProjectionMatrix();
  }

  private placeCamera(center: THREE.Vector3, distance: number): void {
    this.viewCenter.copy(center);
    this.viewDistance = distance;
    this.camera.position.set(center.x, center.y, center.z + distance);
    this.camera.lookAt(center);
  }

  private cancelViewTween(): void {
    if (this.viewTween !== null) {
      cancelAnimationFrame(this.viewTween);
      this.viewTween = null;
    }
  }

  /** Free region of the canvas (px from each edge) the models are framed in. */
  setViewInsets(top: number, bottom: number, left = 0, right = 0, animate = true): void {
    if (this.arMode || this.renderer.xr.isPresenting) {
      this.insetTop = top;
      this.insetBottom = bottom;
      this.insetLeft = left;
      this.insetRight = right;
      return;
    }
    this.cancelViewTween();
    const target = this.computeFit(top, bottom, left, right);
    if (!animate) {
      this.applyInsets(top, bottom, left, right);
      this.placeCamera(target.center, target.distance);
      return;
    }
    const from = {
      top: this.insetTop,
      bottom: this.insetBottom,
      left: this.insetLeft,
      right: this.insetRight,
      distance: this.viewDistance,
      center: this.viewCenter.clone(),
    };
    const t0 = performance.now();
    const tick = () => {
      const progress = Math.min((performance.now() - t0) / 350, 1);
      const e = 1 - Math.pow(1 - progress, 3);
      const mix = (a: number, b: number) => a + (b - a) * e;
      this.applyInsets(mix(from.top, top), mix(from.bottom, bottom), mix(from.left, left), mix(from.right, right));
      this.placeCamera(from.center.clone().lerp(target.center, e), mix(from.distance, target.distance));
      this.viewTween = progress < 1 ? requestAnimationFrame(tick) : null;
    };
    tick();
  }

  /** Re-frame with the current insets. */
  refit(animate = true): void {
    this.setViewInsets(this.insetTop, this.insetBottom, this.insetLeft, this.insetRight, animate);
  }

  /** Full view reset: group + parts back to the home composition and camera re-framed. */
  resetView(animate = true): void {
    this.resetParts(undefined, animate);
    if (this.arMode) {
      this.resetAR();
      return;
    }
    this.resetRoot();
    this.refit(animate);
  }

  // ============================================================
  // AR (WebXR)
  // ============================================================

  get activeCamera(): THREE.PerspectiveCamera {
    return this.renderer.xr.isPresenting
      ? (this.renderer.xr.getCamera() as unknown as THREE.PerspectiveCamera)
      : this.camera;
  }

  get isLightEstimating(): boolean {
    return this.lightEstimating;
  }

  /** Enter AR mode: parts return to the home composition, model ready to be spawned. */
  enterAR(baseScale: number): void {
    this.cancelViewTween();
    this.resetParts(undefined, false);
    this.arMode = true;
    this.baseScale = baseScale;
    this.modelScale = 1;
    this.camera.clearViewOffset();
    this.camera.fov = BASE_FOV;
    this.camera.updateProjectionMatrix();
    this.modelRoot.scale.setScalar(baseScale);
    this.modelRoot.rotation.set(0, 0, 0);
    this.modelRoot.visible = true;
    this.modelRoot.traverse((o) => {
      o.frustumCulled = false;
    });
  }

  placeAt(point: THREE.Vector3, yaw: number): void {
    this.placedYaw = yaw;
    this.modelScale = 1;
    this.modelRoot.scale.setScalar(this.baseScale);
    this.modelRoot.rotation.set(0, yaw, 0);
    this.modelRoot.position.set(point.x, point.y - this.floorY * this.modelRoot.scale.x, point.z);
    this.modelRoot.visible = true;
    this.modelRoot.matrixAutoUpdate = true;
    this.modelRoot.traverse((o) => {
      o.frustumCulled = false;
    });
    this.markShadowDirty();
  }

  /** AR reset: scale and yaw back to the placement values; the world position stays. */
  resetAR(): void {
    const floorWorldY = this.modelRoot.position.y + this.floorY * this.modelRoot.scale.x;
    this.modelScale = 1;
    this.modelRoot.scale.setScalar(this.baseScale);
    this.modelRoot.rotation.set(0, this.placedYaw, 0);
    this.modelRoot.position.y = floorWorldY - this.floorY * this.modelRoot.scale.x;
    this.markShadowDirty();
  }

  exitAR(): void {
    this.stopFallback();
    this.arMode = false;
    this.baseScale = 1;
    this.modelRoot.visible = true;
    this.setLightEstimation(false);
    this.handleResize();
    this.resetParts(undefined, false);
    this.resetRoot();
    this.refit(false);
  }

  // ============================================================
  // GYRO FALLBACK (DeviceOrientation) — NOT world tracked
  // ============================================================

  private static readonly Z_EULER_QUAT = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

  startFallback(baseScale: number): void {
    this.enterAR(baseScale);
    this.fallbackActive = true;
    this.camera.position.copy(this.fallbackCamPos);
    this.camera.up.set(0, 1, 0);
    this.camera.fov = 60;
    this.camera.near = 0.01;
    this.camera.updateProjectionMatrix();

    const applyOrientation = () => {
      const so = window.screen?.orientation?.angle ?? ((window.orientation as number | undefined) ?? 0);
      const screenQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        -THREE.MathUtils.degToRad(so)
      );
      this.camera.quaternion.copy(this.orientQuat).multiply(SceneManager.Z_EULER_QUAT).multiply(screenQuat);
      this.camera.updateMatrixWorld();
    };

    this.gotOrientation = false;
    this.deviceOrientationHandler = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const alpha = e.alpha != null ? THREE.MathUtils.degToRad(e.alpha) : 0;
      const beta = THREE.MathUtils.degToRad(e.beta);
      const gamma = THREE.MathUtils.degToRad(e.gamma);
      this.orientQuat.setFromEuler(new THREE.Euler(beta, alpha, -gamma, "YXZ"));
      applyOrientation();
      if (!this.gotOrientation) {
        this.gotOrientation = true;
        if (this.pendingPlace) {
          this.pendingPlace = false;
          this.fallbackPlace();
        }
      }
    };
    // Only the relative 'deviceorientation' event (the absolute one flips the view).
    window.addEventListener("deviceorientation", this.deviceOrientationHandler, true);

    this.screenOrientHandler = applyOrientation;
    window.screen?.orientation?.addEventListener?.("change", applyOrientation);
    window.addEventListener("orientationchange", applyOrientation);
    applyOrientation();
  }

  fallbackPlace(): void {
    if (!this.gotOrientation) {
      this.modelRoot.visible = false;
      this.pendingPlace = true;
      if (!this.pendingTimer) {
        this.pendingTimer = setTimeout(() => {
          this.pendingTimer = null;
          if (!this.pendingPlace) return;
          this.pendingPlace = false;
          this.gotOrientation = true;
          this.fallbackPlace();
        }, 800);
      }
      return;
    }
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const tanH = tanV * (this.camera.aspect || 1);
    const { center, yaw, scale } = this.computeSpawn(this.fallbackCamPos, this.camera.quaternion, tanH, tanV);
    this.placeCenterAt(center, yaw, scale);
  }

  private stopFallback(): void {
    if (!this.fallbackActive) return;
    this.fallbackActive = false;
    this.pendingPlace = false;
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    this.camera.fov = BASE_FOV;
    this.camera.updateProjectionMatrix();
    if (this.deviceOrientationHandler) {
      window.removeEventListener("deviceorientation", this.deviceOrientationHandler, true);
      this.deviceOrientationHandler = null;
    }
    if (this.screenOrientHandler) {
      window.screen?.orientation?.removeEventListener?.("change", this.screenOrientHandler);
      window.removeEventListener("orientationchange", this.screenOrientHandler);
      this.screenOrientHandler = null;
    }
  }

  get isFallbackActive(): boolean {
    return this.fallbackActive;
  }

  get modelWidthMeters(): number {
    if (!this.arMode) return 0;
    const box = new THREE.Box3().setFromObject(this.modelRoot);
    const size = box.getSize(new THREE.Vector3());
    return Math.max(size.x, size.z);
  }

  // ============================================================
  // RESIZE / DISPOSE
  // ============================================================

  private handleResize(): void {
    if (this.renderer.xr.isPresenting) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width <= 0 || height <= 0) return;

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.updateCameraVideoLayout();

    if (this.arMode) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      return;
    }
    this.camera.aspect = width / height;
    this.refit(false);
  }

  dispose(): void {
    this.stopFallback();
    this.cancelPartTween();
    this.cancelViewTween();
    this.renderer.setAnimationLoop(null);
    this.animationRunning = false;
    this.resizeObserver?.disconnect();
    this.disposers.forEach((fn) => fn());
    this.disposers.length = 0;
    this.stopCameraPreview();
    this.activePointers.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
