/**
 * Server-side proxy to the AML verifier with automatic failover.
 *
 * Tries the Phala TEE enclave first (authoritative, confidential); if the
 * enclave is stopped/unreachable, falls back to the local verifier — same
 * code, same OFAC dataset, so verdicts are identical. This lets us keep the
 * CVM powered off outside demo/judging windows without breaking the site.
 */
export const TEE_URL =
  process.env.TEE_VERIFIER_URL ??
  "https://8498ab9f2f973abd475e9948aa51c8fdc3674848-8000.dstack-pha-prod5.phala.network";
export const LOCAL_URL =
  process.env.LOCAL_VERIFIER_URL ?? "http://127.0.0.1:8200";

const TEE_TIMEOUT_MS = 3500;

export async function verifierFetch(
  path: string,
  init?: RequestInit
): Promise<{ res: Response; source: "tee" | "local" }> {
  try {
    const res = await fetch(`${TEE_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(TEE_TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.ok) return { res, source: "tee" };
    throw new Error(`tee HTTP ${res.status}`);
  } catch {
    const res = await fetch(`${LOCAL_URL}${path}`, { ...init, cache: "no-store" });
    return { res, source: "local" };
  }
}

export async function proxyJson(path: string, init?: RequestInit) {
  const { res, source } = await verifierFetch(path, init);
  const body = await res.json();
  return Response.json(body, {
    status: res.status,
    headers: { "x-aegis-verifier": source },
  });
}
