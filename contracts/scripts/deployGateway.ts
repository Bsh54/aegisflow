import { ethers } from "hardhat";

/**
 * Deploys the compliant FXRP minting demo on Coston2:
 *   1. MockFXRP (or reuse real FXRP via FXRP_ADDRESS env)
 *   2. CompliantFXRPGateway pointing at the existing AegisFlowGate
 *   3. Funds the gateway with FXRP liquidity
 *
 * Env:
 *   GATE_ADDRESS   (required) — deployed AegisFlowGate
 *   FXRP_ADDRESS   (optional) — real FXRP token; if unset, deploys MockFXRP
 *   AMOUNT_PER_MINT(optional) — units released per request (default 100 FXRP @6dp)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const gateAddress = process.env.GATE_ADDRESS;
  if (!gateAddress) throw new Error("GATE_ADDRESS env required");

  const amountPerMint = BigInt(process.env.AMOUNT_PER_MINT ?? "100000000"); // 100 FXRP
  const fundAmount = amountPerMint * 20n;

  console.log("Deployer:", deployer.address);

  let fxrpAddress = process.env.FXRP_ADDRESS;
  if (!fxrpAddress) {
    const FXRP = await ethers.getContractFactory("MockFXRP");
    const fxrp = await FXRP.deploy(fundAmount * 10n);
    await fxrp.waitForDeployment();
    fxrpAddress = await fxrp.getAddress();
    console.log("MockFXRP deployed at:", fxrpAddress);
  } else {
    console.log("Using existing FXRP at:", fxrpAddress);
  }

  const Gateway = await ethers.getContractFactory("CompliantFXRPGateway");
  const gateway = await Gateway.deploy(fxrpAddress, gateAddress, amountPerMint);
  await gateway.waitForDeployment();
  const gatewayAddress = await gateway.getAddress();
  console.log("CompliantFXRPGateway deployed at:", gatewayAddress);

  // fund it
  const fxrp = await ethers.getContractAt("MockFXRP", fxrpAddress);
  const bal = await fxrp.balanceOf(deployer.address);
  if (bal >= fundAmount) {
    await (await fxrp.approve(gatewayAddress, fundAmount)).wait();
    await (await gateway.fund(fundAmount)).wait();
    console.log("Funded gateway with", fundAmount.toString(), "FXRP units");
  } else {
    console.log("⚠️ deployer FXRP balance too low to fund; fund manually");
  }

  console.log("\n=== summary ===");
  console.log("FXRP:   ", fxrpAddress);
  console.log("Gateway:", gatewayAddress);
  console.log("Gate:   ", gateAddress);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
