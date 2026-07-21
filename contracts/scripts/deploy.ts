import { ethers } from "hardhat";

/**
 * Deploys AegisFlowGate to the configured network (Coston2 by default).
 * The deployer address is used as the initial attestor for Step 1.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AegisFlowGate with account:", deployer.address);

  // The deployer doubles as the dev attestor; the real path is FDC proofs.
  const attestor = deployer.address;
  // Deterministic endpoint the FDC Web2Json attestation must target.
  const attestBaseUrl =
    process.env.ATTEST_BASE_URL ?? "https://aegisflow.shadrakbessanh.me/attest/";

  const Gate = await ethers.getContractFactory("AegisFlowGate");
  const gate = await Gate.deploy(attestor, attestBaseUrl);
  await gate.waitForDeployment();

  const address = await gate.getAddress();
  console.log("✅ AegisFlowGate deployed at:", address);
  console.log("   Attestor set to:", attestor);
  console.log("   Attest base URL:", attestBaseUrl);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
