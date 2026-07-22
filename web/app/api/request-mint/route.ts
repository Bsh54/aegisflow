import { ethers } from "ethers";
import {
  RPC_URL,
  GATEWAY_ADDRESS,
  GATEWAY_ABI,
  FXRP_ADDRESS,
  addressHash,
  EXPLORER,
} from "@/lib/contract";

export const dynamic = "force-dynamic";

const ERC20 = ["function balanceOf(address) view returns (uint256)"];

/**
 * Executes a gated FXRP mint request against the CompliantFXRPGateway.
 * Signed server-side (the web host holds the demo key). Returns the outcome:
 * fulfilled (with tx + amount released) or refused (with the on-chain reason).
 */
export async function POST(req: Request) {
  try {
    const { xrpl_address } = await req.json();
    if (!xrpl_address) {
      return Response.json({ error: "xrpl_address required" }, { status: 400 });
    }

    const pk = process.env.DEMO_PRIVATE_KEY;
    if (!pk) {
      return Response.json({ error: "demo signer not configured" }, { status: 503 });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(pk, provider);
    const recipient = process.env.DEMO_RECIPIENT ?? wallet.address;

    const gateway = new ethers.Contract(GATEWAY_ADDRESS, GATEWAY_ABI, wallet);
    const fxrp = new ethers.Contract(FXRP_ADDRESS, ERC20, provider);
    const hash = addressHash(xrpl_address.trim());

    const before = await fxrp.balanceOf(recipient);

    // Preview first so we can return a clean "refused" without a failed tx.
    const allowed = await gateway.canMint(hash);
    if (!allowed) {
      return Response.json({
        outcome: "refused",
        reason: "Source address is not compliant (NotCompliant) — the FXRP mint is denied.",
        recipient,
      });
    }

    const tx = await gateway.requestMint(hash, recipient);
    const receipt = await tx.wait();
    const after = await fxrp.balanceOf(recipient);
    const released = (after - before).toString();

    return Response.json({
      outcome: "fulfilled",
      txHash: receipt.hash,
      explorerUrl: `${EXPLORER}/tx/${receipt.hash}`,
      released,
      recipient,
    });
  } catch (e: any) {
    // On-chain revert (e.g. verdict changed between preview and send)
    return Response.json(
      { outcome: "refused", reason: e.shortMessage ?? e.message ?? String(e) },
      { status: 200 }
    );
  }
}
