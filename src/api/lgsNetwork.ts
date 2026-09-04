import { RemoteApiError } from "./realClient";

const PRIMARY_BASE_URL = "https://andromeda.tailbb20c1.ts.net";
const TAILNET_HTTP_BASE_URL = "http://andromeda.tailbb20c1.ts.net:8080";

let preferredBaseUrl = PRIMARY_BASE_URL;

export function lgsBaseCandidates(): string[] {
  return Array.from(
    new Set([preferredBaseUrl, PRIMARY_BASE_URL, TAILNET_HTTP_BASE_URL])
  );
}

export function rememberLgsBaseUrl(baseUrl: string) {
  preferredBaseUrl = baseUrl;
}

export function absoluteLgsUrl(path: string, baseUrl = preferredBaseUrl): string {
  return `${baseUrl}${path}`;
}

export async function fetchLgs(
  path: string,
  init?: RequestInit
): Promise<{ response: Response; baseUrl: string }> {
  const failures: string[] = [];

  for (const baseUrl of lgsBaseCandidates()) {
    try {
      const response = await fetch(`${baseUrl}${path}`, init);
      rememberLgsBaseUrl(baseUrl);
      return { response, baseUrl };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      failures.push(`${baseUrl}: ${detail}`);
      console.warn("LGS network candidate failed:", baseUrl, error);
    }
  }

  throw new RemoteApiError(
    `Cannot reach Local Gen Studio from Android. Tried HTTPS and the encrypted Tailscale HTTP route. ${failures.join(" | ")}`
  );
}
