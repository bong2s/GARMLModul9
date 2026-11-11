// Viewer for GARML Modul 9.
//
// Loads the three existing GLB files, normalises each one from its REAL bounding box,
// arranges them like the Modul 6 composition (two models behind, one in front, whole
// layout centred on the origin), and exposes selection / manipulation / AR handles.
//
// Real, world-tracked AR is only provided by the WebXR path in ./session.ts. The
// preview (3D over an optional camera image) and the gyroscope fallback are NOT
// world-tracked and are labelled as such by the UI.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { MODELS } from "../models/registry";
import { DIM_OPACITY, MODEL_LAYOUT } from "./config";
import { SceneManager, type TransformMode } from "./scene";
import { ARSession, type ARState } from "./session";

export type { TransformMode } from "./scene";
export type { ARState } from "./session";

export interface PartInfo {
  id: string;
  label: string;
  color: string;
  /** Pivot group of the model (moves/rotates/scales with manual manipulation). */
  group: THREE.Group;
  /** Hotspot anchor in the pivot group's local space (top centre of the model). */
  anchor: THREE.Vector3;
  /** Half extents of the model's box in the pivot group's local space. */
  half: THREE.Vector3;
}

export interface ViewerCallbacks {
  onProgress?: (loaded: number, total: number, label: string) => void;
  /** Non-fatal problems (e.g. a GLB that failed to load). */
  onError?: (message: string) => void;
  onReady?: () => void;
  /** A model was tapped in the 3D view. */
  onModelPick?: (modelId: string) => void;
  /** A drag started on an unselected model in individual mode and selected it. */
  onAutoSelect?: (modelId: string) => void;
  /** Once per rendered frame, after lights were updated (drives the hotspot layer). */
  onFrame?: () => void;
  onARState?: (state: ARState) => void;
  onAREnded?: (error?: string) => void;
  onARInfo?: (info: { mode: string; reason?: string; widthM: number; note?: string }) => void;
}

export interface Viewer {
  readonly sm: SceneManager;
  readonly parts: PartInfo[];
  readonly session: ARSession;
  /** Select a model (individual manipulation target + dimming of the others); null = none.
   *  `related` models stay at full opacity but are not manipulated. */
  select(modelId: string | null, related?: string[]): void;
  /** Change only the related (full-opacity) models of the current selection. */
  setRelated(ids: string[]): void;
  getSelected(): string | null;
  setMode(mode: TransformMode): void;
  getMode(): TransformMode;
  /** +1 zoom in, −1 zoom out; false when there is no manipulation target. */
  zoom(direction: number): boolean;
  /** false when nothing is selected. */
  resetSelected(): boolean;
  resetAll(): void;
  resetView(): void;
  setViewInsets(top: number, bottom: number, left: number, right: number, animate?: boolean): void;
  isGestureActive(): boolean;
  isARSupported(): Promise<boolean>;
  startPreviewCamera(): Promise<boolean>;
  dispose(): void;
}

interface MaterialState {
  transparent: boolean;
  opacity: number;
  depthWrite: boolean;
}

export function createViewer(host: HTMLElement, overlayRoot: HTMLElement, cb: ViewerCallbacks = {}): Viewer {
  const sm = new SceneManager(host);

  const parts: PartInfo[] = [];
  const modelMeshes: THREE.Mesh[] = [];
  const meshModel = new Map<THREE.Mesh, string>();
  const materialStates = new Map<THREE.Material, MaterialState>();
  const arrangement = new THREE.Group();
  sm.modelRoot.add(arrangement);

  let arBaseScale = 0.07;
  let selectedId: string | null = null;
  let relatedIds = new Set<string>();
  let disposed = false;

  // ------------------------------------------------------------------
  // loading
  // ------------------------------------------------------------------

  const loader = new GLTFLoader();

  function placeholder(size: number, color: string): THREE.Object3D {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size * 0.4, size),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 })
    );
    const g = new THREE.Group();
    g.add(mesh);
    return g;
  }

  async function loadAll(): Promise<Map<string, THREE.Object3D | null>> {
    const result = new Map<string, THREE.Object3D | null>();
    let done = 0;
    await Promise.all(
      MODELS.map(async (entry) => {
        try {
          const gltf = await loader.loadAsync(entry.url);
          result.set(entry.id, gltf.scene);
        } catch (error) {
          console.warn(`MODUL9: gagal memuat ${entry.url}`, error);
          result.set(entry.id, null);
          cb.onError?.(`Model ${entry.label} gagal dimuat`);
        }
        done++;
        cb.onProgress?.(done, MODELS.length, MODEL_LAYOUT[entry.id]?.label ?? entry.label);
      })
    );
    return result;
  }

  // ------------------------------------------------------------------
  // scene assembly
  // ------------------------------------------------------------------

  function assemble(loaded: Map<string, THREE.Object3D | null>): void {
    for (const entry of MODELS) {
      const layout = MODEL_LAYOUT[entry.id];
      if (!layout) continue;

      const model = loaded.get(entry.id) ?? placeholder(layout.targetSize, layout.color);

      // 1) orientation correction, 2) uniform normalisation from the real bounding box
      if (layout.rotateX) model.rotation.x += layout.rotateX;
      model.updateMatrixWorld(true);
      const rawSize = new THREE.Box3().setFromObject(model, true).getSize(new THREE.Vector3());
      const longest = Math.max(rawSize.x, rawSize.y, rawSize.z, 1e-6);
      model.scale.multiplyScalar(layout.targetSize / longest);
      model.updateMatrixWorld(true);

      // 3) centre the model on the origin of its pivot group (pivot = bbox centre)
      const box = new THREE.Box3().setFromObject(model, true);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      model.position.sub(centre);

      const group = new THREE.Group();
      group.name = `model-${entry.id}`;
      group.add(model);
      // rest on the floor (y = 0) at its cell; cell x/z is the model centre
      group.position.set(layout.cell[0], size.y / 2, layout.cell[1]);
      arrangement.add(group);

      model.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        modelMeshes.push(mesh);
        meshModel.set(mesh, entry.id);
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!materialStates.has(m)) {
            materialStates.set(m, { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite });
          }
        }
      });

      parts.push({
        id: entry.id,
        label: layout.label,
        color: layout.color,
        group,
        anchor: new THREE.Vector3(0, size.y / 2 + 0.02, 0),
        half: size.clone().multiplyScalar(0.5),
      });
    }

    // centre the whole arrangement on the origin (x, y and z)
    sm.modelRoot.updateMatrixWorld(true);
    const rawBox = new THREE.Box3().setFromObject(arrangement, true);
    arrangement.position.sub(rawBox.getCenter(new THREE.Vector3()));
    sm.modelRoot.updateMatrixWorld(true);

    const finalBox = new THREE.Box3().setFromObject(arrangement, true);
    const finalSize = finalBox.getSize(new THREE.Vector3());
    sm.floorY = finalBox.min.y;
    sm.arHalfExtent.copy(finalSize).multiplyScalar(0.5);
    arBaseScale = 0.5 / Math.max(finalSize.x, finalSize.z, 1e-6);

    // soft contact shadow under the composition
    const catcher = new THREE.Mesh(
      new THREE.PlaneGeometry(finalSize.x * 1.15, finalSize.z * 1.15),
      new THREE.ShadowMaterial({ opacity: 0.35 })
    );
    catcher.name = "shadow-catcher";
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = finalBox.min.y - 0.005;
    catcher.receiveShadow = true;
    sm.modelRoot.add(catcher);

    // home pose of the parts, then the home orientation of the whole group
    for (const p of parts) sm.registerPart(p.id, p.group, p.half);
    sm.modelRoot.quaternion.copy(sm.homeQuaternion);
    sm.modelRoot.updateMatrixWorld(true);
    sm.captureHomeHull();
  }

  // ------------------------------------------------------------------
  // selection + dimming (unselected models stay visible at DIM_OPACITY)
  // ------------------------------------------------------------------

  function applyVisibility(): void {
    const dimmed = new Set<THREE.Material>();
    const active = new Set<THREE.Material>();
    for (const mesh of modelMeshes) {
      const id = meshModel.get(mesh);
      const isActive = selectedId === null || id === selectedId || (id !== undefined && relatedIds.has(id));
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => (isActive ? active : dimmed).add(m));
    }
    active.forEach((m) => {
      const original = materialStates.get(m);
      if (!original) return;
      m.transparent = original.transparent;
      m.opacity = original.opacity;
      m.depthWrite = original.depthWrite;
      m.needsUpdate = true;
    });
    dimmed.forEach((m) => {
      const original = materialStates.get(m);
      if (!original) return;
      m.transparent = true;
      m.opacity = original.opacity * DIM_OPACITY;
      m.depthWrite = false;
      m.needsUpdate = true;
    });
  }

  // ------------------------------------------------------------------
  // tap-to-select (raycast) + gesture flag
  // ------------------------------------------------------------------

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function pickAt(clientX: number, clientY: number): string | null {
    const rect = host.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, sm.activeCamera);
    const hit = raycaster.intersectObjects(modelMeshes, false)[0];
    return hit ? (meshModel.get(hit.object as THREE.Mesh) ?? null) : null;
  }
  sm.pickProvider = pickAt;
  sm.onAutoSelect = (id) => {
    viewer.select(id);
    cb.onAutoSelect?.(id);
  };

  let gestureActive = false;
  let gestureTimeout: ReturnType<typeof setTimeout> | null = null;
  const markGesture = () => {
    gestureActive = true;
    if (gestureTimeout) clearTimeout(gestureTimeout);
    gestureTimeout = setTimeout(() => {
      gestureActive = false;
      gestureTimeout = null;
    }, 250);
  };

  const cleanups: Array<() => void> = [];
  let activePointerCount = 0;
  let pointerDown: { id: number; x: number; y: number } | null = null;
  const listen = <K extends keyof HTMLElementEventMap>(
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions
  ) => {
    host.addEventListener(type, handler as EventListener, options);
    cleanups.push(() => host.removeEventListener(type, handler as EventListener));
  };

  listen("pointerdown", (event) => {
    markGesture();
    activePointerCount++;
    pointerDown = activePointerCount === 1 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  });
  listen("pointermove", () => {
    if (activePointerCount > 0) markGesture();
  });
  listen("wheel", () => markGesture(), { passive: true });
  listen("pointerup", (event) => {
    activePointerCount = Math.max(0, activePointerCount - 1);
    if (!pointerDown || pointerDown.id !== event.pointerId) return;
    if (activePointerCount !== 0) {
      pointerDown = null;
      return;
    }
    const movement = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    pointerDown = null;
    if (movement > 8) return; // a drag, not a tap
    const id = pickAt(event.clientX, event.clientY);
    if (id) cb.onModelPick?.(id);
  });
  listen("pointercancel", () => {
    activePointerCount = 0;
    pointerDown = null;
  });

  // ------------------------------------------------------------------
  // AR session
  // ------------------------------------------------------------------

  const session = new ARSession(sm, overlayRoot, () => arBaseScale, {
    onState: (s) => cb.onARState?.(s),
    onEnded: (e) => cb.onAREnded?.(e),
    onModeInfo: (i) => cb.onARInfo?.(i),
  });

  sm.setFrameCallback((frame) => {
    session.onFrame(frame);
    sm.updateLights();
    cb.onFrame?.();
  });

  // ------------------------------------------------------------------
  // public handles
  // ------------------------------------------------------------------

  const viewer: Viewer = {
    sm,
    parts,
    session,
    select(modelId, related = []) {
      selectedId = modelId;
      relatedIds = new Set(related.filter((id) => id !== modelId));
      sm.setSelected(modelId);
      if (modelId) sm.setMode("individual");
      applyVisibility();
    },
    getSelected: () => selectedId,
    setRelated(ids) {
      relatedIds = new Set(ids.filter((id) => id !== selectedId));
      applyVisibility();
    },
    setMode(mode) {
      sm.setMode(mode);
      if (mode === "all") {
        selectedId = null;
        relatedIds.clear();
        sm.setSelected(null);
        applyVisibility();
      }
    },
    getMode: () => sm.getMode(),
    zoom: (direction) => sm.zoom(direction),
    resetSelected() {
      if (!selectedId) return false;
      sm.resetParts([selectedId], true);
      return true;
    },
    resetAll() {
      sm.resetParts(undefined, true);
      sm.resetRoot();
    },
    resetView() {
      sm.resetView(true);
    },
    setViewInsets: (top, bottom, left, right, animate = true) => sm.setViewInsets(top, bottom, left, right, animate),
    isGestureActive: () => gestureActive,
    isARSupported: () => ARSession.isSupported(),
    startPreviewCamera: () => sm.startCameraPreview(),
    dispose() {
      if (disposed) return;
      disposed = true;
      if (gestureTimeout) clearTimeout(gestureTimeout);
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
      session.dispose();
      sm.dispose();
      const textures = new Set<THREE.Texture>();
      for (const mesh of modelMeshes) {
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          for (const value of Object.values(m)) {
            if ((value as THREE.Texture | null)?.isTexture) textures.add(value as THREE.Texture);
          }
          m.dispose();
        }
      }
      textures.forEach((t) => t.dispose());
    },
  };

  // kick off loading; the viewer is usable immediately, models appear when assembled
  void loadAll().then((loaded) => {
    if (disposed) return;
    assemble(loaded);
    sm.refit(false);
    sm.start();
    cb.onReady?.();
  });

  return viewer;
}
