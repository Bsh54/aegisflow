import { ethers } from "ethers";
import { verifierFetch } from "@/lib/verifier";
import { RPC_URL, GATE_ADDRESS, GATE_ABI, addressHash } from "@/lib/contract";

export const dynamic = "force-dynamic";

/**
 * Screens an address in the enclave AND records the verdict on-chain (attestor
 * path) so it is always fresh. Because verdicts expire after 24h, recording on
 * every screen keeps the demo robust: "Request FXRP" right after always reflects
 * a current verdict, with no stale pre-seeding.
 *
 * The trustless FDC path still exists separately (scripts/fdcAttest.ts, shown on
 * /proof); records made here are flagged fdcVerified=false (attestor).
 */
export async function POST(req: Request) {
  const body = await req.text();
  const { res, source } = await verifierFetch("/screen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const data = await res.json();

  try {
    const pk = process.env.DEMO_PRIVATE_KEY;
    const addr = JSON.parse(body).xrpl_address?.trim();
    if (pk && addr && data?.verdict) {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const wallet = new ethers.Wallet(pk, provider);
      const gate = new ethers.Contract(GATE_ADDRESS, GATE_ABI, wallet);
      const evidence =
        typeof data.evidence_hash === "string" && data.evidence_hash.length === 66
          ? data.evidence_hash
          : ethers.ZeroHash;
      const tx = await gate.submitVerdict(addressHash(addr), data.verdict, evidence);
      await tx.wait();
      data.recorded_tx = tx.hash;
    }
  } catch {
    /* recording is best-effort — the screening result still stands */
  }

  return Response.json(data, {
    status: res.status,
    headers: { "x-aegis-verifier": source },
  });
}
