import { ethers } from "ethers";

export const GATE_ADDRESS =
  process.env.NEXT_PUBLIC_GATE_ADDRESS ??
  "0x7d7F06AFd4C178b07E4cE69085d6f79721Cca797";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://coston2-api.flare.network/ext/C/rpc";

export const EXPLORER = "https://coston2-explorer.flare.network";

export const GATE_ABI = [
  "function isCompliant(bytes32 xrplAddressHash) view returns (bool)",
  "function getScreening(bytes32 xrplAddressHash) view returns (uint8 verdict, uint64 timestamp, bytes32 evidenceHash, bool fdcVerified)",
  "event Screened(bytes32 indexed xrplAddressHash, uint8 verdict, uint64 timestamp, bytes32 evidenceHash, bool fdcVerified)",
];

export const VERDICT_LABELS = ["UNKNOWN", "CLEAR", "REVIEW", "BLOCKED"] as const;

export function provider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

export function gate() {
  return new ethers.Contract(GATE_ADDRESS, GATE_ABI, provider());
}

export function addressHash(xrplAddress: string) {
  return ethers.keccak256(ethers.toUtf8Bytes(xrplAddress));
}
