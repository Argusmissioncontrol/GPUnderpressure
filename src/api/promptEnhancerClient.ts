const BASE_URL = "https://andromeda.tailbb20c1.ts.net";

export type PromptEnhancerFormat = {
  key: string;
  label: string;
};

export type PromptEnhancerOption = {
  id: string;
  label: string;
  promptText: string;
};

export type PromptEnhancerGroup = {
  key: string;
  label: string;
  description: string;
  exclusive: boolean;
  options: PromptEnhancerOption[];
};

export type PromptEnhancerCatalog = {
  promptFormats: PromptEnhancerFormat[];
  groups: PromptEnhancerGroup[];
};

export type PromptTag = {
  tag: string;
  usageCount: number;
  aliases: string;
  sourceCategory: string;
  category: string;
};

export type PromptTagPayload = {
  query: string;
  category: string | null;
  categories: string[];
  results: PromptTag[];
};

export type PromptComposePayload = {
  modelKey: string;
  freeformPrompt: string;
  promptFormat: string;
  tags: string[];
  presetIds: string[];
};

export type PromptComposeResult = PromptComposePayload & {
  promptFormatSummary: string;
  effectivePrompt: string;
};

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, init);
  } catch (error) {
    console.error("Prompt Enhancer request failed:", error);
    throw new Error("Cannot reach the LGS Prompt Enhancer. Check Tailscale and LGS.");
  }

  if (!response.ok) {
    let detail = `Prompt Enhancer failed (HTTP ${response.status}).`;
    try {
      const body = await response.json() as { detail?: unknown };
      if (typeof body.detail === "string" && body.detail.trim()) {
        detail = body.detail.trim();
      }
    } catch {
      // Keep HTTP fallback.
    }
    throw new Error(detail);
  }

  return await response.json() as T;
}

export function fetchPromptEnhancerCatalog(): Promise<PromptEnhancerCatalog> {
  return jsonRequest<PromptEnhancerCatalog>("/api/v1/prompt-enhancer");
}

export function searchPromptEnhancerTags(
  query: string,
  category: string | null,
  limit = 30,
): Promise<PromptTagPayload> {
  const params = [`q=${encodeURIComponent(query)}`, `limit=${limit}`];
  if (category) {
    params.push(`category=${encodeURIComponent(category)}`);
  }
  return jsonRequest<PromptTagPayload>(`/api/v1/prompt-enhancer/tags?${params.join("&")}`);
}

export function composeEnhancedPrompt(
  payload: PromptComposePayload,
): Promise<PromptComposeResult> {
  return jsonRequest<PromptComposeResult>("/api/v1/prompt-enhancer/compose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
