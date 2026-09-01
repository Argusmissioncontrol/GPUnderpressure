import type {
  GenerationClient,
} from "./client";

import type {
  GenerationJob,
  GenerationRequest,
} from "./types";


export const mockGenerationClient: GenerationClient = {
  async submit(
    request: GenerationRequest,
    onStatus
  ): Promise<GenerationJob> {
    console.log(
      "GPUnder Pressure mock request:",
      request
    );

    onStatus?.("submitting");

    await new Promise((resolve) =>
      setTimeout(resolve, 250)
    );

    onStatus?.("queued");

    await new Promise((resolve) =>
      setTimeout(resolve, 350)
    );

    onStatus?.("running");

    await new Promise((resolve) =>
      setTimeout(resolve, 600)
    );

    return {
      jobId: request.requestId,
      status: "finished",
    };
  },
};