import { ShieldCheck, Lock, Link2, ExternalLink } from "@/components/icons";
import { GATE_ADDRESS, EXPLORER } from "@/lib/contract";

export const metadata = { title: "Proof — AegisFlow" };

const PHALA_APP_ID = "8498ab9f2f973abd475e9948aa51c8fdc3674848";

export default function Proof() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Don&apos;t trust us. Verify.</h1>
      <p className="text-mutedfg mb-12">
        Every layer of AegisFlow is independently verifiable — the enclave, the
        consensus, and the contract.
      </p>

      <div className="space-y-6">
        <section className="card p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-flare">
              <Lock className="w-6 h-6" />
            </span>
            <h2 className="text-xl font-bold">1. The enclave (Intel TDX)</h2>
          </div>
          <p className="text-sm text-mutedfg leading-relaxed mb-5">
            The verifier runs inside a Phala Cloud confidential VM. At boot, the
            enclave pulls <span className="font-mono text-fg">tee/app.py</span>{" "}
            straight from the public GitHub repository — so the code you can
            audit is bit-for-bit the code that screens addresses. The hardware
            produces a <strong className="text-fg">remote attestation</strong>:
            a certificate chain (App → Dstack App CA → Dstack KMS CA) proving
            genuine TDX hardware runs that exact workload.
          </p>
          <dl className="text-xs font-mono text-mutedfg space-y-2">
            <div className="flex gap-3">
              <dt className="w-28 shrink-0">app id</dt>
              <dd className="text-fg break-all">{PHALA_APP_ID}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-28 shrink-0">runtime</dt>
              <dd className="text-fg">Phala dstack · Intel TDX</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-28 shrink-0">audit code</dt>
              <dd>
                <a
                  className="link text-fg inline-flex items-center gap-1.5"
                  target="_blank"
                  href="https://github.com/Bsh54/aegisflow/blob/main/tee/app.py"
                >
                  github.com/Bsh54/aegisflow · tee/app.py <ExternalLink />
                </a>
              </dd>
            </div>
          </dl>
        </section>

        <section className="card p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-gold">
              <Link2 className="w-6 h-6" />
            </span>
            <h2 className="text-xl bold font-bold">2. The consensus (Flare Data Connector)</h2>
          </div>
          <p className="text-sm text-mutedfg leading-relaxed mb-5">
            A verdict only enters the chain through an FDC{" "}
            <span className="font-mono text-fg">Web2Json</span> attestation:
            ~100 independent Flare data providers each fetch the deterministic{" "}
            <span className="font-mono text-fg">/attest/&lt;address&gt;</span>{" "}
            endpoint, agree on the response, and the voting round produces a{" "}
            <strong className="text-fg">Merkle consensus proof</strong>. The
            gate contract rejects anything else — including us. Verdicts marked{" "}
            <span className="text-clear font-mono">FDC ✓</span> in the dashboard
            carry this proof.
          </p>
          <dl className="text-xs font-mono text-mutedfg space-y-2">
            <div className="flex gap-3">
              <dt className="w-28 shrink-0">attestation</dt>
              <dd className="text-fg">Web2Json · PublicWeb2 · Coston2</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-28 shrink-0">pinned URL</dt>
              <dd className="text-fg break-all">
                https://aegisflow.shadrakbessanh.me/attest/&lt;address&gt;
              </dd>
            </div>
          </dl>
        </section>

        <section className="card p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-clear">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <h2 className="text-xl font-bold">3. The contract (on-chain enforcement)</h2>
          </div>
          <p className="text-sm text-mutedfg leading-relaxed mb-5">
            <span className="font-mono text-fg">AegisFlowGate</span> verifies
            each Merkle proof against Flare&apos;s FDC verification contract,
            checks the attested URL is pinned to the AegisFlow verifier, and
            stores the verdict. A CLEAR verdict{" "}
            <strong className="text-fg">expires after 24 hours</strong> —
            sanctions lists change daily, so compliance must be re-proven, not
            granted forever. Anyone can read the state or replay the checks.
          </p>
          <dl className="text-xs font-mono text-mutedfg space-y-2">
            <div className="flex gap-3">
              <dt className="w-28 shrink-0">contract</dt>
              <dd>
                <a
                  className="link text-fg inline-flex items-center gap-1.5 break-all"
                  target="_blank"
                  href={`${EXPLORER}/address/${GATE_ADDRESS}`}
                >
                  {GATE_ADDRESS} <ExternalLink />
                </a>
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-28 shrink-0">data source</dt>
              <dd className="text-fg">
                OFAC SDN (XRP) · 2 channels, cross-checked · fail-closed
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
