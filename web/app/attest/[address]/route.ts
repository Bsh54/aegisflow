import { proxyJson } from "@/lib/verifier";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { address: string } }
) {
  return proxyJson(`/attest/${encodeURIComponent(params.address)}`);
}
