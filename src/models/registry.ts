// Model registry — paths to the three GLB files of Modul 9 in public/models/.
// Model IDs and learning-topic IDs are intentionally separate.
// The mapping below is an explicit configuration, not derived from geometry.

import { MODULE_TOPICS, type LessonTopic } from "../content/lessons";

export interface ModelEntry {
  id: string;
  label: string;
  url: string;
}

const BASE = import.meta.env.BASE_URL;

// Order = layout in the scene: CPU → Circuit Board → RAM.
export const MODELS: ModelEntry[] = [
  { id: "cpu", label: "CPU Processor", url: `${BASE}models/CPU_Processor.glb` },
  { id: "circuit-board", label: "Circuit Board", url: `${BASE}models/Circuit_Board.glb` },
  { id: "ram-stick", label: "RAM Stick", url: `${BASE}models/RAM_Stick.glb` },
];

// Models of each topic (topic id → model ids). The FIRST model is the primary one: it becomes
// the manipulation target when the topic is opened; the others are shown at full opacity as
// related models. Configured by the course author; not inferred from 3D geometry.
export const TOPIC_MODELS: Record<string, string[]> = {
  "organisasi-prosesor": ["cpu"],
  "organisasi-register": ["cpu", "ram-stick"],
  "siklus-instruksi": ["cpu", "circuit-board"],
  "pipeline-instruksi": ["circuit-board", "cpu"],
  "karakteristik-risc": ["cpu"],
  "optimasi-register": ["cpu", "ram-stick"],
  "risc-vs-cisc": ["cpu"],
  "motorola-88000": ["cpu"],
  "mips-r4000": ["cpu"],
};

// Extra panels shown as tabs for a model (none in Modul 9; kept from Modul 8's mechanism).
const MODEL_CONTEXT: Record<string, LessonTopic[]> = {};

/** All model ids of a topic; the first is the primary one. */
export function getModelsForTopic(topicId: string): string[] {
  return TOPIC_MODELS[topicId] ?? [];
}

/** Primary model of a topic (the one selected when the topic is opened). */
export function getPrimaryModel(topicId: string): string | null {
  return getModelsForTopic(topicId)[0] ?? null;
}

/** Topics in which the model takes part (used for the pill counter and the tabs). */
export function getOwnTopicsForModel(modelId: string): LessonTopic[] {
  return MODULE_TOPICS.filter((t) => getModelsForTopic(t.id).includes(modelId));
}

/** All tabs shown in the info panel of a model. */
export function getTopicsForModel(modelId: string): LessonTopic[] {
  return [...(MODEL_CONTEXT[modelId] ?? []), ...getOwnTopicsForModel(modelId)];
}
