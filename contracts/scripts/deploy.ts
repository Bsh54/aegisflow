import { ethers } from "hardhat";

/**
 * Deploys AegisFlowGate to the configured network (Coston2 by default).
 * The deployer address is used as the initial attestor for Step 1.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AegisFlowGate with account:", deployer.address);

  // Step 1: the deployer doubles as the TEE attestor. Replace later with the
  // real TEE operator address (or the FDC verifier in Step 4).
  const attestor = deployer.address;

  const Gate = await ethers.getContractFactory("AegisFlowGate");
  const gate = await Gate.deploy(attestor);
  await gate.waitForDeployment();

  const address = await gate.getAddress();
  console.log("✅ AegisFlowGate deployed at:", address);
  console.log("   Attestor set to:", attestor);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
