import type { GenerationClient } from "./client";
import type {
  GenerationJob,
  GenerationRequest,
} from "./types";

const BASE_URL =
    "http://127.0.0.1:8080";

function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

export const realGenerationClient: GenerationClient = {
  async submit(
    request: GenerationRequest
  ): Promise<GenerationJob> {
    const response = await fetch(
      `${BASE_URL}/api/v1/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Generate failed: HTTP ${response.status}`
      );
    }

    const submitted = await response.json();
    const jobId = submitted.jobId as string;

    while (true) {
      const statusResponse = await fetch(
        `${BASE_URL}/api/v1/jobs/${jobId}`
      );

      if (!statusResponse.ok) {
        throw new Error(
          `Status failed: HTTP ${statusResponse.status}`
        );
      }

      const job = await statusResponse.json();
      const status = String(job.status).toUpperCase();

      if (status === "COMPLETED") {
        return {
          jobId,
          status: "finished",
          resultUrl:
            `${BASE_URL}${job.resultUrl}`,
        };
      }

      if (
        status === "FAILED" ||
        status === "CANCELLED" ||
        status === "CANCELED"
      ) {
        throw new Error(
          `Generation ended with status ${status}`
        );
      }

      await sleep(1000);
    }
  },
};
