export type GenerationMode =
  | "image"
  | "reference";

export const ASPECT_RATIOS = [
  "1:1",
  "16:9",
  "4:3",
  "9:16",
] as const;

export type AspectRatio =
  (typeof ASPECT_RATIOS)[number];

export type GenerationRequest = {
  requestId: string;
  generationType: GenerationMode;
  prompt: string;
  aspectRatio: AspectRatio;
  seed: string;
  referenceUri: string | null;
};

export type GenerationJobStatus =
  | "queued"
  | "generating"
  | "finished"
  | "failed"
  | "rejected"
  | "cancelled";

export type GenerationJob = {
  jobId: string;
  status: GenerationJobStatus;
  queuePosition?: number;
  progress?: number;
  resultUrl?: string;
  error?: string;
};

export type WorkflowDefinition = {
  modelKey: string;
  name: string;
  description: string;
  workingResolution: string;
  promptModes: string[];
  defaults: {
    batchSize: number;
    steps: number;
    cfg: number;
    sampler: string;
    scheduler: string | null;
    negativePrompt: string | null;
    mysticLoraStrength: number | null;
    characterLoraStrength: number | null;
  };
  capabilities: {
    negativePrompt: boolean;
    mysticLora: boolean;
    characterLora: boolean;
  };
  limits: {
    batchSize: { min: number; max: number };
    steps: { min: number; max: number };
    cfg: { min: number; max: number };
    loraStrength: { min: number; max: number };
  };
};

export type WorkflowCatalog = {
  workflows: WorkflowDefinition[];
  aspectRatios: string[];
};

export type WorkflowTuning = {
  modelKey: string;
  promptMode: string;
  batchSize: string;
  steps: string;
  cfg: string;
  sampler: string;
  scheduler: string;
  negativePrompt: string;
  mysticLoraStrength: string;
  characterLoraStrength: string;
};

export type WorkflowGenerationRequest = {
  requestId: string;
  generationType: "image";
  modelKey: string;
  promptMode: string;
  prompt: string;
  aspectRatio: AspectRatio;
  seed: string;
  batchSize: number;
  steps: number;
  cfg: number;
  sampler: string;
  scheduler: string | null;
  negativePrompt?: string;
  mysticLoraStrength?: number;
  characterLoraStrength?: number;
  referenceUri: null;
};
