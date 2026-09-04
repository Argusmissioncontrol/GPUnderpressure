import { RemoteApiError } from "./realClient";
import { fetchLgs } from "./lgsNetwork";

export type AnimaCategory = {
  name: string;
  count: number;
};

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
  categories: AnimaCategory[];
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
  results: AnimaTagResult[];
};

export async function searchAnimaTags(
  query: string,
  category: string | null,
  offset = 0,
  limit = 100
): Promise<AnimaTagPayload> {
  const params = [
    `q=${encodeURIComponent(query)}`,
    `offset=${offset}`,
    `limit=${limit}`,
  ];
  if (category) {
    params.push(`category=${encodeURIComponent(category)}`);
  }

  const { response } = await fetchLgs(`/api/v1/anima/tags?${params.join("&")}`);
  if (!response.ok) {
    let detail = `Tag compendium failed (HTTP ${response.status}).`;
    try {
      const body = await response.json() as { detail?: unknown };
      if (typeof body.detail === "string" && body.detail.trim()) {
        detail = body.detail.trim();
      }
    } catch {
      // Keep HTTP fallback.
    }
    throw new RemoteApiError(detail, response.status);
  }
  return await response.json() as AnimaTagPayload;
}
