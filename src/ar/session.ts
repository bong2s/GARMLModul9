import * as THREE from "three";
import { XREstimatedLight } from "three/addons/webxr/XREstimatedLight.js";

import type { SceneManager } from "./scene";

export type ARState = "idle" | "starting" | "placing" | "placed";

export interface ARSessionHooks {
  onState: (state: ARState) => void;
  /** Called after the session ended (always, also when it failed to start). */
  onEnded: (error?: string) => void;
  onModeInfo?: (info: { mode: string; reason?: string; widthM: number; note?: string }) => void;
}

/**
 * Markerless AR based on WebXR `immersive-ar` (ported from Modul 6, same behaviour):
 *
 *   • reference space `local`, viewer pose read every frame (6DoF from ARCore);
 *   • the arrangement is spawned `SceneManager.SPAWN.distance` in front of the camera as
 *     soon as tracking is stable (≥ 15 non-emulated frames, or after 4 s) and is then
 *     locked to an XRAnchor — its world transform never comes from the camera pose;
 *   • WebXR hit-testing is NOT used: the arrangement floats in the air at the spawn point.
 *
 * When WebXR is unavailable the session falls back to `SceneManager.startFallback`
 * (camera video + gyroscope). That mode only follows device ROTATION: it is NOT
 * world-tracked and never creates an anchor. `isFallbackActive` lets the UI say so.
 */
export class ARSession {
  state: ARState = "idle";

  private session: XRSession | null = null;
  private fallbackActive = false;
  private placeStartTime = 0;

  private trackedFrames = 0;
  private lastEmulated: boolean | null = null;
  private anchor: XRAnchor | null = null;
  private anchorPending = false;
  private anchorState: "belum" | "aktif" | "tidak didukung" = "belum";
  private placementMethod = "";
  private lastStatusText = "";
  private hasApplied = false;
  private readonly appliedPos = new THREE.Vector3();
  private readonly appliedQuat = new THREE.Quaternion();
  private readonly anchorQuat0 = new THREE.Quaternion();
  private xrLight: XREstimatedLight | null = null;
  private readonly guard: (event: Event) => void;

  constructor(
    private readonly sm: SceneManager,
    private readonly overlayRoot: HTMLElement,
    private readonly getBaseScale: () => number,
    private readonly hooks: ARSessionHooks
  ) {
    // beforexrselect: a tap on UI (buttons, panels, hotspots) must not become an XR select.
    this.guard = (event: Event) => {
      if (this.state !== "placing" && this.state !== "placed") {
        event.preventDefault();
        return;
      }
      const target = event.target as Element | null;
      if (target && target.closest("button, .info-panel, .top-bar, .component-flow, .ar-hud")) {
        event.preventDefault();
      }
    };
  }

  get isFallbackActive(): boolean {
    return this.fallbackActive;
  }

  /** true when the device + browser report support for `immersive-ar`. */
  static async isSupported(): Promise<boolean> {
    try {
      if (!window.isSecureContext || !navigator.xr) return false;
      return await navigator.xr.isSessionSupported("immersive-ar");
    } catch {
      return false;
    }
  }

  private setState(state: ARState): void {
    this.state = state;
    this.hooks.onState(state);
  }

  async start(): Promise<void> {
    if (this.session || this.fallbackActive) return;
    this.setState("starting");

    let xrOk = false;
    let xrError = "";
    if (navigator.xr) {
      try {
        const supported = await navigator.xr.isSessionSupported("immersive-ar");
        if (supported) {
          await this.startWebXR();
          xrOk = true;
        } else {
          xrError = "isSessionSupported=false";
        }
      } catch (error) {
        xrError = String(error instanceof Error ? error.message : error);
        console.warn("MODUL9: WebXR tidak tersedia, beralih ke mode cadangan.", error);
      }
    } else {
      xrError = "navigator.xr undefined";
    }

    if (!xrOk) await this.startFallback(xrError);
  }

  private async startWebXR(): Promise<void> {
    const xr = navigator.xr!;
    this.sm.stopCameraPreview(); // WebXR composites the camera image itself
    const session = await xr.requestSession("immersive-ar", {
      requiredFeatures: [],
      optionalFeatures: ["dom-overlay", "light-estimation", "anchors"],
      domOverlay: { root: this.overlayRoot },
    });

    this.session = session;
    session.addEventListener("end", this.handleEnd);
    this.overlayRoot.addEventListener("beforexrselect", this.guard);

    await this.sm.renderer.xr.setSession(session);

    this.setupLightEstimation(session);

    this.overlayRoot.classList.add("xr-active");
    this.sm.enterAR(this.getBaseScale());
    this.sm.modelRoot.visible = false;
    this.setState("placing");
    this.placeStartTime = performance.now();
    this.emitModeInfo("WebXR");
  }

  private async startFallback(reason?: string): Promise<void> {
    // iOS 13+ needs an explicit permission for device orientation (inside a user gesture).
    try {
      const DOE = (
        window as unknown as {
          DeviceOrientationEvent?: typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
        }
      ).DeviceOrientationEvent;
      if (DOE?.requestPermission) await DOE.requestPermission();
    } catch (error) {
      console.warn("MODUL9: izin orientasi perangkat ditolak.", error);
    }

    // Only enter the fallback when a camera really is available; never pretend to be AR.
    const cameraOk = await this.sm.startCameraPreview();
    if (!cameraOk) {
      this.setState("idle");
      this.hooks.onEnded(
        `izin kamera ditolak atau kamera tidak tersedia${reason ? ` (WebXR: ${reason})` : ""}. Izinkan akses kamera di pengaturan browser lalu coba lagi`
      );
      return;
    }
    this.fallbackActive = true;
    this.sm.startFallback(this.getBaseScale());
    this.setState("placing");
    this.sm.fallbackPlace();
    this.setState("placed");
    const limit = window.isSecureContext
      ? "WebXR AR tidak tersedia di perangkat/browser ini (butuh Android + Chrome + ARCore)"
      : "halaman bukan HTTPS sehingga WebXR AR tidak tersedia";
    this.emitModeInfo("Gyro", reason, `BUKAN tracking AR: ${limit}. Hanya putaran HP terlacak, posisi/langkah tidak`);
  }

  end(): void {
    if (this.session) {
      void this.session.end();
    } else if (this.fallbackActive) {
      this.cleanup();
      this.hooks.onEnded();
    }
  }

  /** Back to placing mode (move the arrangement to where the camera now looks). */
  replace(): void {
    if (this.state !== "placed") return;
    this.sm.modelRoot.visible = false;
    this.releaseAnchor();
    this.trackedFrames = 0;
    this.placementMethod = "";
    this.placeStartTime = performance.now();
    this.setState("placing");
    if (this.fallbackActive) {
      this.sm.fallbackPlace();
      this.setState("placed");
    }
    // WebXR: the spawn happens automatically on the next frames (onFrame).
  }

  /** Fallback mode: re-place in front of the current view direction. */
  fallbackPlace(): void {
    if (!this.fallbackActive) return;
    if (this.state !== "placing" && this.state !== "placed") return;
    this.sm.fallbackPlace();
    this.setState("placed");
  }

  private setupLightEstimation(session: XRSession): void {
    if (!session.enabledFeatures?.includes("light-estimation")) return;
    const light = new XREstimatedLight(this.sm.renderer);
    light.addEventListener("estimationstart", () => {
      this.sm.scene.add(light);
      this.sm.setLightEstimation(true, light.environment);
    });
    light.addEventListener("estimationend", () => {
      this.sm.scene.remove(light);
      this.sm.setLightEstimation(false);
    });
    this.xrLight = light;
  }

  /** Called every frame from the render loop. */
  onFrame(frame?: XRFrame): void {
    if (this.fallbackActive || !frame) return;

    const refSpace = this.sm.renderer.xr.getReferenceSpace();
    const viewerPose = refSpace ? frame.getViewerPose(refSpace) : undefined;

    if (this.state === "placing") {
      if (!viewerPose || !refSpace) return;
      this.trackedFrames = viewerPose.emulatedPosition ? 0 : this.trackedFrames + 1;
      const tracked = this.trackedFrames >= 15;
      const waited = performance.now() - this.placeStartTime;

      if (!(tracked || waited >= 4000) || !this.spawnInFrontOfXRCamera(frame)) {
        this.emitStatus(viewerPose.emulatedPosition);
        return;
      }
      this.placementMethod = tracked ? "pose kamera" : "pose kamera (tracking belum stabil)";
      this.placeStartTime = 0;
      this.createAnchorAtModel(frame);
      this.setState("placed");
      this.lastEmulated = null;
      this.emitStatus(viewerPose.emulatedPosition);
    }

    if (this.state === "placed" && viewerPose) {
      if (this.lastEmulated !== viewerPose.emulatedPosition) {
        this.lastEmulated = viewerPose.emulatedPosition;
        this.emitStatus(viewerPose.emulatedPosition);
      }
    }

    // World lock: follow the anchor (ARCore refines it as its map improves).
    if (this.state === "placed" && refSpace) this.followAnchor(frame, refSpace);
  }

  private spawnInFrontOfXRCamera(frame: XRFrame): boolean {
    const refSpace = this.sm.renderer.xr.getReferenceSpace();
    const pose = refSpace ? frame.getViewerPose(refSpace) : undefined;
    if (!pose) return false;
    const p = pose.transform.position;
    const o = pose.transform.orientation;
    const camPos = new THREE.Vector3(p.x, p.y, p.z);
    const q = new THREE.Quaternion(o.x, o.y, o.z, o.w);

    // Real FOV from the XR projection matrix (depends on device and screen orientation).
    const proj = pose.views[0]?.projectionMatrix;
    const tanH = proj && proj[0] > 0 ? 1 / proj[0] : 0.5;
    const tanV = proj && proj[5] > 0 ? 1 / proj[5] : 0.9;

    const { center, yaw, scale } = this.sm.computeSpawn(camPos, q, tanH, tanV);
    this.sm.placeCenterAt(center, yaw, scale);
    return true;
  }

  private createAnchorAtModel(frame: XRFrame): void {
    const refSpace = this.sm.renderer.xr.getReferenceSpace();
    if (!refSpace || typeof frame.createAnchor !== "function") {
      this.anchorState = "tidak didukung";
      return;
    }
    if (this.anchorPending) return;
    const p = this.sm.modelRoot.position;
    this.anchorPending = true;
    frame
      .createAnchor(new XRRigidTransform({ x: p.x, y: p.y, z: p.z, w: 1 }), refSpace)
      .then((anchor) => {
        this.anchorPending = false;
        if (!this.session || this.state !== "placed") {
          anchor.delete();
          return;
        }
        this.anchor = anchor;
        this.anchorState = "aktif";
        this.anchorQuat0.copy(this.sm.modelRoot.quaternion);
        this.appliedPos.copy(this.sm.modelRoot.position);
        this.appliedQuat.copy(this.sm.modelRoot.quaternion);
        this.hasApplied = true;
        this.emitStatus(this.lastEmulated ?? false);
      })
      .catch(() => {
        this.anchorPending = false;
        this.anchorState = "tidak didukung";
        this.emitStatus(this.lastEmulated ?? false);
      });
  }

  private followAnchor(frame: XRFrame, refSpace: XRReferenceSpace): void {
    if (!this.anchor || !this.hasApplied) return;
    const root = this.sm.modelRoot;

    // The root was moved on purpose (e.g. group zoom keeps the floor level): re-anchor there.
    if (
      root.position.distanceToSquared(this.appliedPos) > 1e-10 ||
      root.quaternion.angleTo(this.appliedQuat) > 1e-5
    ) {
      this.releaseAnchor();
      this.createAnchorAtModel(frame);
      return;
    }

    const anchorPose = frame.getPose(this.anchor.anchorSpace, refSpace);
    if (!anchorPose) return; // temporarily untracked: keep the last world pose
    const t = anchorPose.transform;
    const q = new THREE.Quaternion(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w);
    root.position.set(t.position.x, t.position.y, t.position.z);
    root.quaternion.copy(q).multiply(this.anchorQuat0);
    this.appliedPos.copy(root.position);
    this.appliedQuat.copy(root.quaternion);
  }

  private releaseAnchor(): void {
    try {
      this.anchor?.delete();
    } catch {
      /* ignore */
    }
    this.anchor = null;
    this.hasApplied = false;
    this.anchorPending = false;
    if (this.anchorState === "aktif") this.anchorState = "belum";
  }

  private emitStatus(emulated: boolean): void {
    const tracking = emulated ? "tracking: HILANG (posisi dikira-kira)" : "tracking: 6DoF OK";
    const anchor =
      this.anchorState === "aktif"
        ? "anchor: aktif"
        : this.anchorState === "tidak didukung"
          ? "anchor: tidak didukung"
          : "anchor: -";
    const place = this.placementMethod ? ` · tempat: ${this.placementMethod}` : "";
    const text = `${tracking} · ${anchor}${place}`;
    if (text === this.lastStatusText) return;
    this.lastStatusText = text;
    this.emitModeInfo("WebXR", undefined, text);
  }

  private emitModeInfo(mode: string, reason?: string, note?: string): void {
    this.hooks.onModeInfo?.({ mode, reason, note, widthM: this.sm.modelWidthMeters });
  }

  private readonly handleEnd = (): void => {
    this.cleanup();
    this.hooks.onEnded();
  };

  private cleanup(): void {
    this.overlayRoot.removeEventListener("beforexrselect", this.guard);
    this.overlayRoot.classList.remove("xr-active");

    this.session?.removeEventListener("end", this.handleEnd);
    this.releaseAnchor();
    this.anchorState = "belum";
    this.placementMethod = "";
    this.lastStatusText = "";
    this.trackedFrames = 0;
    this.session = null;
    this.fallbackActive = false;

    if (this.xrLight) {
      this.sm.scene.remove(this.xrLight);
      (this.xrLight as unknown as { dispose?: () => void }).dispose?.(); // exists in newer three.js only
      this.xrLight = null;
    }

    if (this.sm.arMode) this.sm.exitAR();
    this.setState("idle");
  }

  dispose(): void {
    this.end();
  }
}
