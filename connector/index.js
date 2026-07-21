/**
 * AegisFlow connector — the glue between the confidential verifier and the
 * on-chain gate contract.
 *
 * Flow:
 *   1. Ask the TEE verifier to screen an XRPL address (returns a verdict).
 *   2. Submit that verdict on-chain to AegisFlowGate (as the attestor).
 *   3. Read the state back to confirm the gate now reflects the verdict.
 *
 * Env (see .env.example):
 *   RPC_URL, CONTRACT_ADDRESS, PRIVATE_KEY, VERIFIER_URL
 */
import "dotenv/config";
import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL || "https://coston2-api.flare.network/ext/C/rpc";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const VERIFIER_URL = process.env.VERIFIER_URL || "http://localhost:8200";

const ABI = [
  "function submitVerdict(bytes32 xrplAddressHash, uint8 verdict, bytes32 evidenceHash) external",
  "function isCompliant(bytes32 xrplAddressHash) view returns (bool)",
  "function getScreening(bytes32 xrplAddressHash) view returns (uint8 verdict, uint64 timestamp, bytes32 evidenceHash)",
];

const LABELS = ["UNKNOWN", "CLEAR", "REVIEW", "BLOCKED"];

async function screenAddress(xrplAddress) {
  const res = await fetch(`${VERIFIER_URL}/screen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ xrpl_address: xrplAddress }),
  });
  if (!res.ok) throw new Error(`verifier HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const xrplAddress = process.argv[2];
  if (!xrplAddress) {
    console.error("usage: node index.js <xrpl_address>");
    process.exit(2);
  }
  if (!CONTRACT_ADDRESS || !PRIVATE_KEY) {
    console.error("missing CONTRACT_ADDRESS or PRIVATE_KEY in env");
    process.exit(2);
  }

  console.log(`\n1) Screening ${xrplAddress} via verifier ...`);
  const verdict = await screenAddress(xrplAddress);
  console.log(`   verdict: ${verdict.verdict} (${verdict.verdict_label})`);

  // On-chain key = keccak256(address), matching Solidity keccak256(bytes).
  const addressHash = ethers.keccak256(ethers.toUtf8Bytes(xrplAddress));
  const evidenceHash = verdict.evidence_hash;

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const gate = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

  console.log(`2) Submitting verdict on-chain (attestor ${wallet.address}) ...`);
  const tx = await gate.submitVerdict(addressHash, verdict.verdict, evidenceHash);
  console.log(`   tx sent: ${tx.hash}`);
  await tx.wait();
  console.log(`   confirmed.`);

  console.log(`3) Reading back from the gate ...`);
  const [v, ts] = await gate.getScreening(addressHash);
  const compliant = await gate.isCompliant(addressHash);
  console.log(`   on-chain verdict: ${v} (${LABELS[Number(v)]}), ts=${ts}`);
  console.log(`   isCompliant (allowed to mint FXRP): ${compliant}`);
  console.log(
    compliant
      ? "\n✅ RESULT: address is CLEAR — FXRP mint would be authorized."
      : "\n⛔ RESULT: address is NOT clear — FXRP mint blocked."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
