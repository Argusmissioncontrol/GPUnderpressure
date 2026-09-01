import type {
  GenerationJob,
  GenerationRequest,
} from "./types";

export type GenerationProgressStatus =
  | "submitting"
  | "queued"
  | "running";

export type GenerationProgressCallback = (
  status: GenerationProgressStatus
) => void;

export interface GenerationClient {
  submit(
    request: GenerationRequest,
    onStatus?: GenerationProgressCallback
  ): Promise<GenerationJob>;
}