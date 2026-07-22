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
 * Executes a gated FXRP mint request against the CompliantFXRPGateway and
 * ALWAYS broadcasts a real transaction — so both outcomes leave an on-chain
 * receipt anyone can open on the explorer:
 *   - compliant source   -> transaction succeeds, FXRP is released
 *   - sanctioned source  -> transaction is mined but REVERTS (status 0)
 * A manual gas limit is set so the revert still produces a mined tx instead of
 * being rejected at estimation time.
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

    // Broadcast with an explicit gas limit so a revert still mines a tx.
    const tx = await gateway.requestMint(hash, recipient, { gasLimit: 300000 });
    const txHash = tx.hash;
    const explorerUrl = `${EXPLORER}/tx/${txHash}`;

    let receipt;
    try {
      receipt = await tx.wait();
    } catch {
      receipt = await provider.getTransactionReceipt(txHash);
    }

    if (receipt && receipt.status === 1) {
      const after = await fxrp.balanceOf(recipient);
      return Response.json({
        outcome: "fulfilled",
        txHash,
        explorerUrl,
        released: (after - before).toString(),
        recipient,
      });
    }

    // status 0 -> the network rejected the conversion on-chain
    return Response.json({
      outcome: "refused",
      txHash,
      explorerUrl,
      reason: "The gateway rejected the conversion on-chain (NotCompliant). No FXRP was released.",
      recipient,
    });
  } catch (e: any) {
    return Response.json(
      { outcome: "error", reason: e.shortMessage ?? e.message ?? String(e) },
      { status: 200 }
    );
  }
}
