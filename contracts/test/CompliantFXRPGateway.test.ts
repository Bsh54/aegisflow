import { expect } from "chai";
import { ethers } from "hardhat";

const Verdict = { Unknown: 0, Clear: 1, Review: 2, Blocked: 3 };
const ATTEST_BASE = "https://aegisflow.shadrakbessanh.me/attest/";
const AMOUNT = 100_000_000n; // 100 FXRP (6 decimals)

describe("CompliantFXRPGateway", () => {
  async function deploy() {
    const [owner, attestor, user] = await ethers.getSigners();

    const Gate = await ethers.getContractFactory("AegisFlowGate");
    const gate = await Gate.connect(owner).deploy(attestor.address, ATTEST_BASE);
    await gate.waitForDeployment();

    const FXRP = await ethers.getContractFactory("MockFXRP");
    const fxrp = await FXRP.connect(owner).deploy(1_000_000_000_000n); // 1M FXRP
    await fxrp.waitForDeployment();

    const Gateway = await ethers.getContractFactory("CompliantFXRPGateway");
    const gateway = await Gateway.connect(owner).deploy(
      await fxrp.getAddress(),
      await gate.getAddress(),
      AMOUNT
    );
    await gateway.waitForDeployment();

    // fund the gateway
    await fxrp.connect(owner).approve(await gateway.getAddress(), AMOUNT * 5n);
    await gateway.connect(owner).fund(AMOUNT * 5n);

    return { gate, fxrp, gateway, owner, attestor, user };
  }

  const cleanHash = ethers.keccak256(ethers.toUtf8Bytes("rCleanAddress"));
  const badHash = ethers.keccak256(ethers.toUtf8Bytes("rSanctionedAddress"));
  const ev = ethers.keccak256(ethers.toUtf8Bytes("evidence"));

  it("releases FXRP for a CLEAR source", async () => {
    const { gate, fxrp, gateway, attestor, user } = await deploy();
    await gate.connect(attestor).submitVerdict(cleanHash, Verdict.Clear, ev);

    expect(await gateway.canMint(cleanHash)).to.equal(true);
    await expect(gateway.requestMint(cleanHash, user.address))
      .to.emit(gateway, "MintFulfilled")
      .withArgs(user.address, cleanHash, AMOUNT);
    expect(await fxrp.balanceOf(user.address)).to.equal(AMOUNT);
  });

  it("REFUSES the conversion for a BLOCKED source (no FXRP released)", async () => {
    const { gate, fxrp, gateway, attestor, user } = await deploy();
    await gate.connect(attestor).submitVerdict(badHash, Verdict.Blocked, ev);

    expect(await gateway.canMint(badHash)).to.equal(false);
    await expect(
      gateway.requestMint(badHash, user.address)
    ).to.be.revertedWithCustomError(gateway, "NotCompliant");
    expect(await fxrp.balanceOf(user.address)).to.equal(0n);
  });

  it("refuses a never-screened (UNKNOWN) source", async () => {
    const { gateway, user } = await deploy();
    const unknown = ethers.keccak256(ethers.toUtf8Bytes("rNeverSeen"));
    await expect(
      gateway.requestMint(unknown, user.address)
    ).to.be.revertedWithCustomError(gateway, "NotCompliant");
  });

  it("refuses once a CLEAR verdict has expired (TTL)", async () => {
    const { gate, gateway, attestor, user } = await deploy();
    await gate.connect(attestor).submitVerdict(cleanHash, Verdict.Clear, ev);
    await ethers.provider.send("evm_increaseTime", [24 * 3600 + 60]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      gateway.requestMint(cleanHash, user.address)
    ).to.be.revertedWithCustomError(gateway, "NotCompliant");
  });
});
