import { proxyJson } from "@/lib/verifier";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  return proxyJson("/screen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
