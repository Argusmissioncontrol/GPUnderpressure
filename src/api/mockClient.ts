import type { GenerationClient } from "./client";
import type {
  GenerationJob,
  GenerationRequest,
} from "./types";

export const mockGenerationClient: GenerationClient = {
  async submit(
    request: GenerationRequest
  ): Promise<GenerationJob> {
    console.log(
      "GPUnder Pressure mock request:",
      request
    );

    await new Promise((resolve) =>
      setTimeout(resolve, 1200)
    );

    return {
      jobId: request.requestId,
      status: "finished",
    };
  },
};
