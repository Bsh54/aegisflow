import { ethers } from "ethers";
import { GATE_ADDRESS, GATE_ABI, EXPLORER } from "@/lib/contract";

export const dynamic = "force-dynamic";

/**
 * Screening log, served from the Blockscout explorer API.
 *
 * The Coston2 public RPC caps eth_getLogs at 30 blocks per call, which makes
 * client-side event scanning impractical — the explorer indexes the full
 * history and exposes it without range limits.
 */
export async function GET() {
  try {
    const iface = new ethers.Interface(GATE_ABI);
    const topic0 = iface.getEvent("Screened")!.topicHash;

    const url =
      `${EXPLORER}/api?module=logs&action=getLogs&fromBlock=0&toBlock=latest` +
      `&address=${GATE_ADDRESS}&topic0=${topic0}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`explorer HTTP ${res.status}`);
    const data = await res.json();
    const logs: any[] = Array.isArray(data.result) ? data.result : [];

    const rows = logs
      .map((log) => {
        try {
          const parsed = iface.parseLog({ topics: log.topics.filter(Boolean), data: log.data });
          if (!parsed) return null;
          return {
            addressHash: parsed.args[0] as string,
            verdict: Number(parsed.args[1]),
            timestamp: Number(parsed.args[2]),
            fdcVerified: Boolean(parsed.args[4]),
            tx: log.transactionHash,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse();

    return Response.json({ rows });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 502 });
  }
}
