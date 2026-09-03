import type {
  GenerationProgressCallback,
} from "./client";
import {
  RemoteApiError,
} from "./realClient";
import type {
  GenerationJob,
  WorkflowCatalog,
  WorkflowGenerationRequest,
} from "./types";

const BASE_URL =
  "https://andromeda.tailbb20c1.ts.net";

function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

async function fetchRemote(
  url: string,
  init?: RequestInit
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    console.error(
      "GPUnder Pressure network failure:",
      error
    );

    throw new RemoteApiError(
      "Cannot reach Local Gen Studio. Check Tailscale and make sure the home app is running."
    );
  }
}

async function responseDetail(
  response: Response
): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "detail" in body
    ) {
      const detail = (body as { detail?: unknown }).detail;
      if (typeof detail === "string" && detail.trim()) {
        return detail.trim();
      }
    }
  } catch {
    // Some HTTP failures have no JSON body.
  }

  return null;
}

async function throwForResponse(
  response: Response,
  fallback: string
): Promise<never> {
  const detail = await responseDetail(response);
  throw new RemoteApiError(
    detail ?? `${fallback} (HTTP ${response.status}).`,
    response.status
  );
}

function mapHostStatus(
  status: string,
  onStatus?: GenerationProgressCallback
) {
  if (status === "QUEUED") {
    onStatus?.("queued");
    return;
  }

  if (
    status === "RUNNING" ||
    status === "CANCELING"
  ) {
    onStatus?.("running");
  }
}

export async function loadWorkflowCatalog(): Promise<WorkflowCatalog> {
  const response = await fetchRemote(
    `${BASE_URL}/api/v1/workflows`
  );

  if (!response.ok) {
    await throwForResponse(
      response,
      "Could not load Local Gen Studio workflows"
    );
  }

  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("workflows" in payload) ||
    !Array.isArray((payload as { workflows?: unknown }).workflows)
  ) {
    throw new RemoteApiError(
      "Local Gen Studio returned an invalid workflow catalog."
    );
  }

  return payload as WorkflowCatalog;
}

export async function submitWorkflowGeneration(
  request: WorkflowGenerationRequest,
  onStatus?: GenerationProgressCallback
): Promise<GenerationJob> {
  onStatus?.("submitting");

  const response = await fetchRemote(
    `${BASE_URL}/api/v1/generate/workflow`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    await throwForResponse(
      response,
      "Workflow generation was rejected"
    );
  }

  const submitted: unknown = await response.json();
  if (
    typeof submitted !== "object" ||
    submitted === null ||
    !("jobId" in submitted)
  ) {
    throw new RemoteApiError(
      "Local Gen Studio returned an invalid generation response."
    );
  }

  const submittedJob = submitted as {
    jobId: unknown;
    status?: unknown;
  };

  const jobId = String(submittedJob.jobId);
  mapHostStatus(
    String(submittedJob.status ?? "QUEUED").toUpperCase(),
    onStatus
  );

  while (true) {
    const statusResponse = await fetchRemote(
      `${BASE_URL}/api/v1/jobs/${jobId}`
    );

    if (!statusResponse.ok) {
      await throwForResponse(
        statusResponse,
        "Could not read generation status"
      );
    }

    const job: unknown = await statusResponse.json();
    if (
      typeof job !== "object" ||
      job === null ||
      !("status" in job)
    ) {
      throw new RemoteApiError(
        "Local Gen Studio returned an invalid job-status response."
      );
    }

    const jobData = job as {
      status: unknown;
      resultUrl?: unknown;
    };

    const status = String(jobData.status).toUpperCase();
    mapHostStatus(status, onStatus);

    if (status === "COMPLETED") {
      const resultPath =
        typeof jobData.resultUrl === "string"
          ? jobData.resultUrl
          : `/api/v1/jobs/${jobId}/result`;

      return {
        jobId,
        status: "finished",
        resultUrl: `${BASE_URL}${resultPath}`,
      };
    }

    if (
      status === "FAILED" ||
      status === "CANCELED" ||
      status === "CANCELLED"
    ) {
      throw new RemoteApiError(
        `Host generation ended with status ${status}.`
      );
    }

    await sleep(1000);
  }
}
