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
