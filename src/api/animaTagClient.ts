import { RemoteApiError } from "./realClient";

const BASE_URL = "https://andromeda.tailbb20c1.ts.net";

export type AnimaTagResult = {
  tag: string;
  usageCount: number;
  aliases: string;
  sourceCategory: string;
  category: string;
};

export type AnimaTagPayload = {
  query: string;
  category: string | null;
  categories: string[];
  results: AnimaTagResult[];
};

export async function searchAnimaTags(
  query: string,
  category: string | null,
  limit = 30
): Promise<AnimaTagPayload> {
  const params = [
    `q=${encodeURIComponent(query)}`,
    `limit=${limit}`,
  ];
  if (category) {
    params.push(`category=${encodeURIComponent(category)}`);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api/v1/anima/tags?${params.join("&")}`);
  } catch (error) {
    console.error("Anima tag search failed:", error);
    throw new RemoteApiError(
      "Cannot reach the Anima tag compendium. Check Tailscale and LGS."
    );
  }

  if (!response.ok) {
    let detail = `Tag compendium failed (HTTP ${response.status}).`;
    try {
      const body = await response.json() as { detail?: unknown };
      if (typeof body.detail === "string" && body.detail.trim()) {
        detail = body.detail.trim();
      }
    } catch {
      // Keep the HTTP fallback.
    }
    throw new RemoteApiError(detail, response.status);
  }

  return await response.json() as AnimaTagPayload;
}
