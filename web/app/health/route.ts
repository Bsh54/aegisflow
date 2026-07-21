import { proxyJson } from "@/lib/verifier";

export const dynamic = "force-dynamic";

export async function GET() {
  return proxyJson("/health");
}
