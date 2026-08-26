import type {
  GenerationJob,
  GenerationRequest,
} from "./types";

export interface GenerationClient {
  submit(
    request: GenerationRequest
  ): Promise<GenerationJob>;
}
