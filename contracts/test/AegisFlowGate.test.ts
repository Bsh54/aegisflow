import { expect } from "chai";
import { ethers } from "hardhat";

// Verdict enum mirror (matches the Solidity ordering).
const Verdict = { Unknown: 0, Clear: 1, Review: 2, Blocked: 3 };

describe("AegisFlowGate", () => {
  async function deploy() {
    const [owner, attestor, user] = await ethers.getSigners();
    const Gate = await ethers.getContractFactory("AegisFlowGate");
    const gate = await Gate.connect(owner).deploy(attestor.address);
    await gate.waitForDeployment();
    return { gate, owner, attestor, user };
  }

  const addrHash = ethers.keccak256(ethers.toUtf8Bytes("rCleanXRPLAddressExample"));
  const evidence = ethers.keccak256(ethers.toUtf8Bytes("sealed-audit-report"));

  it("lets the attestor record a Clear verdict and reports compliance", async () => {
    const { gate, attestor } = await deploy();
    await gate.connect(attestor).submitVerdict(addrHash, Verdict.Clear, evidence);
    expect(await gate.isCompliant(addrHash)).to.equal(true);
  });

  it("rejects verdicts from a non-attestor", async () => {
    const { gate, user } = await deploy();
    await expect(
      gate.connect(user).submitVerdict(addrHash, Verdict.Clear, evidence)
    ).to.be.revertedWithCustomError(gate, "NotAttestor");
  });

  it("blocks authorizeMint when the address is not Clear", async () => {
    const { gate, attestor, user } = await deploy();
    await gate.connect(attestor).submitVerdict(addrHash, Verdict.Blocked, evidence);
    await expect(
      gate.authorizeMint(addrHash, user.address)
    ).to.be.revertedWithCustomError(gate, "NotCompliant");
  });

  it("authorizes mint for a Clear address", async () => {
    const { gate, attestor, user } = await deploy();
    await gate.connect(attestor).submitVerdict(addrHash, Verdict.Clear, evidence);
    await expect(gate.authorizeMint(addrHash, user.address))
      .to.emit(gate, "MintAuthorized")
      .withArgs(addrHash, user.address);
  });
});
