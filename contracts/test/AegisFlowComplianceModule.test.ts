import { expect } from "chai";
import { ethers } from "hardhat";

const Verdict = { Unknown: 0, Clear: 1, Review: 2, Blocked: 3 };
const ATTEST_BASE = "https://aegisflow.shadrakbessanh.me/attest/";
const ev = ethers.keccak256(ethers.toUtf8Bytes("evidence"));

describe("AegisFlowComplianceModule (ERC-3643)", () => {
  async function deploy() {
    const [owner, attestor, compliance, alice, bob] = await ethers.getSigners();
    const Gate = await ethers.getContractFactory("AegisFlowGate");
    const gate = await Gate.connect(owner).deploy(attestor.address, ATTEST_BASE);
    await gate.waitForDeployment();

    const Mod = await ethers.getContractFactory("AegisFlowComplianceModule");
    const mod = await Mod.deploy(await gate.getAddress());
    await mod.waitForDeployment();

    return { gate, mod, owner, attestor, compliance, alice, bob };
  }

  it("exposes ERC-3643 module metadata", async () => {
    const { mod } = await deploy();
    expect(await mod.name()).to.equal("AegisFlowComplianceModule");
    expect(await mod.isPlugAndPlay()).to.equal(true);
    expect(await mod.canComplianceBind(ethers.ZeroAddress)).to.equal(true);
  });

  it("binds and unbinds a compliance contract", async () => {
    const { mod, compliance } = await deploy();
    await expect(mod.bindCompliance(compliance.address))
      .to.emit(mod, "ComplianceBound")
      .withArgs(compliance.address);
    expect(await mod.isComplianceBound(compliance.address)).to.equal(true);
    await mod.unbindCompliance(compliance.address);
    expect(await mod.isComplianceBound(compliance.address)).to.equal(false);
  });

  it("moduleCheck ALLOWS a receiver that is CLEAR in the gate", async () => {
    const { gate, mod, attestor, alice, compliance } = await deploy();
    const key = await mod.keyFor(alice.address);
    await gate.connect(attestor).submitVerdict(key, Verdict.Clear, ev);
    expect(await mod.moduleCheck(ethers.ZeroAddress, alice.address, 1n, compliance.address)).to.equal(true);
  });

  it("moduleCheck REJECTS a sanctioned receiver", async () => {
    const { gate, mod, attestor, bob, compliance } = await deploy();
    const key = await mod.keyFor(bob.address);
    await gate.connect(attestor).submitVerdict(key, Verdict.Blocked, ev);
    expect(await mod.moduleCheck(ethers.ZeroAddress, bob.address, 1n, compliance.address)).to.equal(false);
  });

  it("moduleCheck REJECTS an unscreened receiver (fail-closed)", async () => {
    const { mod, alice, compliance } = await deploy();
    expect(await mod.moduleCheck(ethers.ZeroAddress, alice.address, 1n, compliance.address)).to.equal(false);
  });
});
