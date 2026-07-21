import { ethers } from "hardhat";

/**
 * AegisFlow — FDC Web2Json attestation pipeline (Coston2).
 *
 * Flow:
 *   1. prepareRequest on the Flare testnet verifier (Web2Json / PublicWeb2)
 *      targeting our deterministic /attest/<xrplAddress> endpoint.
 *   2. Pay & submit the request to FdcHub.
 *   3. Wait for the voting round to finalize (Relay).
 *   4. Fetch the Merkle proof from the DA layer.
 *   5. Submit the proof to AegisFlowGate.submitVerdictWithProof — trustless.
 *
 * Usage:
 *   GATE_ADDRESS=0x... npx hardhat run scripts/fdcAttest.ts --network coston2 -- <xrplAddress>
 *   (or set XRPL_ADDRESS env var)
 */

const VERIFIER_URL =
  process.env.VERIFIER_URL_TESTNET ?? "https://fdc-verifiers-testnet.flare.network";
const VERIFIER_API_KEY =
  process.env.VERIFIER_API_KEY_TESTNET ?? "00000000-0000-0000-0000-000000000000";
const DA_LAYER_URL =
  process.env.COSTON2_DA_LAYER_URL ?? "https://ctn2-data-availability.flare.network";
const ATTEST_BASE =
  process.env.ATTEST_BASE_URL ?? "https://aegisflow.shadrakbessanh.me/attest/";

// Universal Flare contract registry (same address on every Flare network).
const FLARE_CONTRACT_REGISTRY = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

const REGISTRY_ABI = [
  "function getContractAddressByName(string _name) view returns (address)",
];
const FDC_HUB_ABI = [
  "function requestAttestation(bytes _data) payable",
];
const FEE_CONFIG_ABI = [
  "function getRequestFee(bytes _data) view returns (uint256)",
];
const SYSTEMS_MANAGER_ABI = [
  "function firstVotingRoundStartTs() view returns (uint64)",
  "function votingEpochDurationSeconds() view returns (uint64)",
];
const RELAY_ABI = [
  "function isFinalized(uint256 _protocolId, uint256 _votingRoundId) view returns (bool)",
];
const FDC_VERIFICATION_ABI = [
  "function fdcProtocolId() view returns (uint8)",
];

// IWeb2Json.Response tuple layout (must match the periphery interface).
const RESPONSE_TUPLE =
  "tuple(bytes32 attestationType, bytes32 sourceId, uint64 votingRound, uint64 lowestUsedTimestamp," +
  " tuple(string url, string httpMethod, string headers, string queryParams, string body, string postProcessJq, string abiSignature) requestBody," +
  " tuple(bytes abiEncodedData) responseBody)";

function toUtf8HexString(s: string): string {
  return "0x" + Buffer.from(s, "utf8").toString("hex").padEnd(64, "0");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function prepareRequest(xrplAddress: string) {
  const requestBody = {
    url: `${ATTEST_BASE}${xrplAddress}`,
    httpMethod: "GET",
    headers: "{}",
    queryParams: "{}",
    body: "{}",
    postProcessJq: `{xrplAddress: .address, verdict: .verdict}`,
    abiSignature:
      `{"components": [{"internalType": "string","name": "xrplAddress","type": "string"},` +
      `{"internalType": "uint256","name": "verdict","type": "uint256"}],` +
      `"name": "dto","type": "tuple"}`,
  };

  const res = await fetch(`${VERIFIER_URL}/verifier/web2/Web2Json/prepareRequest`, {
    method: "POST",
    headers: { "X-API-KEY": VERIFIER_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      attestationType: toUtf8HexString("Web2Json"),
      sourceId: toUtf8HexString("PublicWeb2"),
      requestBody,
    }),
  });
  if (!res.ok) throw new Error(`verifier prepareRequest failed: HTTP ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (data.status !== "VALID") throw new Error(`request not VALID: ${JSON.stringify(data)}`);
  return data.abiEncodedRequest as string;
}

async function main() {
  const xrplAddress = process.env.XRPL_ADDRESS ?? process.argv[2];
  const gateAddress = process.env.GATE_ADDRESS;
  if (!xrplAddress) throw new Error("missing XRPL address (arg or XRPL_ADDRESS env)");
  if (!gateAddress) throw new Error("missing GATE_ADDRESS env");

  const [signer] = await ethers.getSigners();
  console.log(`Attesting ${xrplAddress} via FDC as ${signer.address}\n`);

  // Resolve Flare system contracts through the universal registry.
  const registry = new ethers.Contract(FLARE_CONTRACT_REGISTRY, REGISTRY_ABI, signer);
  const [hubAddr, feeAddr, fsmAddr, relayAddr, fdcVerAddr] = await Promise.all([
    registry.getContractAddressByName("FdcHub"),
    registry.getContractAddressByName("FdcRequestFeeConfigurations"),
    registry.getContractAddressByName("FlareSystemsManager"),
    registry.getContractAddressByName("Relay"),
    registry.getContractAddressByName("FdcVerification"),
  ]);
  console.log("FdcHub:", hubAddr);

  // 1) prepare
  console.log("\n1) prepareRequest on verifier ...");
  const abiEncodedRequest = await prepareRequest(xrplAddress);
  console.log("   abiEncodedRequest:", abiEncodedRequest.slice(0, 66), "...");

  // 2) pay + submit
  const feeConfig = new ethers.Contract(feeAddr, FEE_CONFIG_ABI, signer);
  const fee = await feeConfig.getRequestFee(abiEncodedRequest);
  console.log(`\n2) submitting to FdcHub (fee ${ethers.formatEther(fee)} C2FLR) ...`);
  const hub = new ethers.Contract(hubAddr, FDC_HUB_ABI, signer);
  const tx = await hub.requestAttestation(abiEncodedRequest, { value: fee });
  const receipt = await tx.wait();
  console.log("   tx:", receipt.hash);

  // compute round id from block timestamp
  const block = await ethers.provider.getBlock(receipt.blockNumber);
  const fsm = new ethers.Contract(fsmAddr, SYSTEMS_MANAGER_ABI, signer);
  const [t0, dur] = await Promise.all([
    fsm.firstVotingRoundStartTs(),
    fsm.votingEpochDurationSeconds(),
  ]);
  const roundId = Number((BigInt(block!.timestamp) - BigInt(t0)) / BigInt(dur));
  console.log("   voting round:", roundId);

  // 3) wait for finalization
  const fdcVer = new ethers.Contract(fdcVerAddr, FDC_VERIFICATION_ABI, signer);
  const protocolId = await fdcVer.fdcProtocolId();
  const relay = new ethers.Contract(relayAddr, RELAY_ABI, signer);
  process.stdout.write("\n3) waiting for round finalization ");
  while (!(await relay.isFinalized(protocolId, roundId))) {
    process.stdout.write(".");
    await sleep(20000);
  }
  console.log(" finalized!");

  // 4) fetch proof from DA layer
  console.log("\n4) fetching proof from DA layer ...");
  let proof: any;
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${DA_LAYER_URL}/api/v1/fdc/proof-by-request-round-raw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ votingRoundId: roundId, requestBytes: abiEncodedRequest }),
    });
    proof = await res.json();
    if (proof?.response_hex) break;
    await sleep(10000);
  }
  if (!proof?.response_hex) throw new Error(`no proof from DA layer: ${JSON.stringify(proof)}`);
  console.log("   merkle proof entries:", proof.proof.length);

  // 5) submit to the gate
  console.log("\n5) submitting proof to AegisFlowGate ...");
  const decoded = ethers.AbiCoder.defaultAbiCoder().decode([RESPONSE_TUPLE], proof.response_hex)[0];
  const gate = await ethers.getContractAt("AegisFlowGate", gateAddress);
  const tx2 = await gate.submitVerdictWithProof({ merkleProof: proof.proof, data: decoded });
  await tx2.wait();
  console.log("   tx:", tx2.hash);

  const addrHash = ethers.keccak256(ethers.toUtf8Bytes(xrplAddress));
  const [v, ts, , fdcVerified] = await gate.getScreening(addrHash);
  const compliant = await gate.isCompliant(addrHash);
  const LABELS = ["UNKNOWN", "CLEAR", "REVIEW", "BLOCKED"];
  console.log(`\n✅ on-chain: verdict=${v} (${LABELS[Number(v)]}), fdcVerified=${fdcVerified}, ts=${ts}`);
  console.log(`   isCompliant (FXRP mint allowed): ${compliant}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
