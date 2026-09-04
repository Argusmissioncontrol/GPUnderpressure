import * as FileSystem from "expo-file-system/legacy";
import type { GenerationProgressCallback } from "./client";
import { RemoteApiError } from "./realClient";
import {
  absoluteLgsUrl,
  fetchLgs,
  lgsBaseCandidates,
  rememberLgsBaseUrl,
} from "./lgsNetwork";
import type { GenerationJob } from "./types";

export type EditWorkflowDefinition = {
  modelKey: string;
  name: string;
  description: string;
  defaults: { steps: number; cfg: number };
  limits: {
    steps: { min: number; max: number };
    cfg: { min: number; max: number };
  };
  capabilities: { singleReference: boolean; mask: boolean; multiReference: boolean };
};

export type EditGenerationRequest = {
  requestId: string;
  prompt: string;
  modelKey: string;
  referenceId: string;
  seed: string;
  steps: number;
  cfg: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function responseDetail(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "detail" in body) {
      const detail = (body as { detail?: unknown }).detail;
      if (typeof detail === "string" && detail.trim()) return detail.trim();
    }
  } catch {
    // Some HTTP failures have no JSON body.
  }
  return null;
}

async function throwForResponse(response: Response, fallback: string): Promise<never> {
  const detail = await responseDetail(response);
  throw new RemoteApiError(detail ?? `${fallback} (HTTP ${response.status}).`, response.status);
}

function mapHostStatus(status: string, onStatus?: GenerationProgressCallback) {
  if (status === "QUEUED") {
    onStatus?.("queued");
    return;
  }
  if (status === "RUNNING" || status === "CANCELING") onStatus?.("running");
}

export async function loadEditWorkflows(): Promise<EditWorkflowDefinition[]> {
  const { response } = await fetchLgs("/api/v1/edit/workflows");
  if (!response.ok) await throwForResponse(response, "Could not load Klein edit workflows");

  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("workflows" in payload) ||
    !Array.isArray((payload as { workflows?: unknown }).workflows)
  ) {
    throw new RemoteApiError("Local Gen Studio returned an invalid edit workflow catalog.");
  }
  return (payload as { workflows: EditWorkflowDefinition[] }).workflows;
}

export async function uploadEditReference(
  uri: string,
  mimeType: string,
  fileName: string
): Promise<string> {
  const failures: string[] = [];

  for (const baseUrl of lgsBaseCandidates()) {
    try {
      const result = await FileSystem.uploadAsync(
        `${baseUrl}/api/v1/edit/reference`,
        uri,
        {
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { "Content-Type": mimeType, "X-LGS-Filename": fileName },
        }
      );

      if (result.status < 200 || result.status >= 300) {
        let detail: string | null = null;
        try {
          const body = JSON.parse(result.body) as { detail?: unknown };
          if (typeof body.detail === "string") detail = body.detail;
        } catch {
          // Keep HTTP fallback.
        }
        throw new RemoteApiError(
          detail ?? `Reference upload failed (HTTP ${result.status}).`,
          result.status
        );
      }

      const body: unknown = JSON.parse(result.body);
      if (typeof body !== "object" || body === null || !("referenceId" in body)) {
        throw new RemoteApiError("Local Gen Studio returned an invalid reference upload response.");
      }

      rememberLgsBaseUrl(baseUrl);
      return String((body as { referenceId: unknown }).referenceId);
    } catch (error) {
      if (error instanceof RemoteApiError && error.status !== null) throw error;
      const detail = error instanceof Error ? error.message : String(error);
      failures.push(`${baseUrl}: ${detail}`);
      console.warn("Edit reference upload candidate failed:", baseUrl, error);
    }
  }

  throw new RemoteApiError(
    `Cannot upload the edit source to Local Gen Studio. Tried HTTPS and tailnet HTTP. ${failures.join(" | ")}`
  );
}

export async function submitEditGeneration(
  request: EditGenerationRequest,
  onStatus?: GenerationProgressCallback
): Promise<GenerationJob> {
  onStatus?.("submitting");
  const submittedCall = await fetchLgs("/api/v1/edit/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const response = submittedCall.response;
  if (!response.ok) await throwForResponse(response, "Klein edit was rejected");

  const submitted: unknown = await response.json();
  if (typeof submitted !== "object" || submitted === null || !("jobId" in submitted)) {
    throw new RemoteApiError("Local Gen Studio returned an invalid edit response.");
  }

  const jobId = String((submitted as { jobId: unknown }).jobId);
  mapHostStatus(String((submitted as { status?: unknown }).status ?? "QUEUED").toUpperCase(), onStatus);

  while (true) {
    const statusCall = await fetchLgs(`/api/v1/jobs/${jobId}`);
    const statusResponse = statusCall.response;
    if (!statusResponse.ok) await throwForResponse(statusResponse, "Could not read edit status");

    const job: unknown = await statusResponse.json();
    if (typeof job !== "object" || job === null || !("status" in job)) {
      throw new RemoteApiError("Local Gen Studio returned an invalid edit job status.");
    }

    const jobData = job as { status: unknown; resultUrl?: unknown };
    const status = String(jobData.status).toUpperCase();
    mapHostStatus(status, onStatus);

    if (status === "COMPLETED") {
      const resultPath = typeof jobData.resultUrl === "string"
        ? jobData.resultUrl
        : `/api/v1/jobs/${jobId}/result`;
      return { jobId, status: "finished", resultUrl: absoluteLgsUrl(resultPath, statusCall.baseUrl) };
    }
    if (status === "FAILED" || status === "CANCELED" || status === "CANCELLED") {
      throw new RemoteApiError(`Host edit ended with status ${status}.`);
    }
    await sleep(1000);
  }
}
