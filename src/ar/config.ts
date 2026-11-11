// Scene-composition configuration for the three Modul 9 models.
//
// Values are derived from the real bounding boxes of Modul 9's GLB files
// (measured from the accessors + node transforms; all three are Y-up, lie flat and are
// used as authored, so no orientation fix is needed):
//
//   CPU_Processor.glb  0.0873 × 0.0044 × 0.0495
//   Circuit_Board.glb  0.0925 × 0.0181 × 0.0600
//   RAM_Stick.glb      0.1333 × 0.0064 × 0.0395
//
// `targetSize` is the longest side after normalisation. The values keep the real size order
// (RAM stick longest, CPU smallest) while keeping the thin CPU readable.
//
// Arrangement (reads left → right as CPU → Circuit Board → RAM): CPU back-left, circuit board
// front-centre, RAM back-right, as in the Modul 6/7 composition (two behind, one in front).
// The footprints are separated in z (CPU/RAM z = −1.8, board z = +1.3), so nothing overlaps.

export interface ModelLayout {
  /** Display name used for the hotspot label and the top navigation. */
  label: string;
  /** Accent colour for dot, label, leader line and info panel. */
  color: string;
  /** Longest side after orientation correction, in scene units. */
  targetSize: number;
  /** (x, z) of the model centre in the arrangement, before the arrangement is re-centred. */
  cell: [number, number];
  /** Extra rotation about X applied before measuring (radians). */
  rotateX?: number;
}

export const MODEL_LAYOUT: Record<string, ModelLayout> = {
  cpu: {
    label: "CPU",
    color: "#38bdf8",
    targetSize: 2.4,
    cell: [-2.3, -1.8],
  },
  "circuit-board": {
    label: "PAPAN SIRKUIT",
    color: "#34d399",
    targetSize: 2.9,
    cell: [0, 1.3],
  },
  "ram-stick": {
    label: "RAM DDR5",
    color: "#fb923c",
    targetSize: 3.2,
    cell: [2.4, -1.8],
  },
};

/** Tilted "table seen from above" orientation of the whole arrangement in the preview. */
export const HOME_EULER = { x: 0.62, y: -0.42, order: "YXZ" as const };

/** Opacity factor of the models that are not selected (they stay visible). */
export const DIM_OPACITY = 0.35;

/** Per-model manual zoom limits (relative to the model's home scale) and step per click. */
export const PART_SCALE_MIN = 0.25;
export const PART_SCALE_MAX = 4;
export const ZOOM_STEP = 1.15;
