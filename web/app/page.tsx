import Link from "next/link";
import { Scale, Lock, Link2, ShieldCheck, ExternalLink } from "@/components/icons";
import { LiveStatus, LiveMetrics } from "@/components/live";
import { GATE_ADDRESS, EXPLORER } from "@/lib/contract";

const FEATURES = [
  {
    icon: <Scale className="w-6 h-6" />,
    title: "Legally clean",
    body: "Every XRPL address is screened against the official OFAC SDN sanctions list before FXRP can be minted. Fail-closed by design.",
  },
  {
    icon: <Lock className="w-6 h-6" />,
    title: "Private by architecture",
    body: "Screening runs inside an Intel TDX confidential enclave. Only the verdict goes on-chain — never the client's transaction graph.",
  },
  {
    icon: <Link2 className="w-6 h-6" />,
    title: "Trustless verdicts",
    body: "~100 independent Flare Data Connector providers reach consensus on each verdict. Not even the operator can forge a result.",
  },
];

const STEPS = [
  { n: "01", t: "Screen", d: "The TEE verifier checks the source XRPL address against real OFAC SDN data — sealed inside the enclave." },
  { n: "02", t: "Attest", d: "Flare Data Connector providers independently fetch the verdict and produce a Merkle consensus proof." },
  { n: "03", t: "Enforce", d: "The gate contract verifies the proof on-chain and allows or blocks the FXRP mint. No trusted middleman." },
];

export default function Home() {
  return (
    <div>
      {/* 1. Hero + live status */}
      <section className="grid lg:grid-cols-[1.2fr,1fr] gap-10 items-center py-10 lg:py-16">
        <div>
          <h1 className="text-4xl md:text-[3.4rem] font-bold leading-[1.08] mb-6">
            Use your XRP on Flare.
            <br />
            <span className="text-mutedfg">Legally. Privately.</span>
          </h1>
          <p className="text-mutedfg text-lg leading-relaxed max-w-xl mb-8">
            AegisFlow gates FXRP minting behind a confidential AML check — real
            sanctions data, enclave-side screening, and on-chain verdicts proven
            by the Flare Data Connector.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/verify" className="btn">
              Run a verification
            </Link>
            <Link href="/dashboard" className="btn-ghost">
              Compliance dashboard
            </Link>
          </div>
        </div>
        <LiveStatus />
      </section>

      {/* 2. Key metrics */}
      <LiveMetrics />

      {/* 3. Features */}
      <section className="grid md:grid-cols-3 gap-5 mt-14">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="card p-7 transition duration-200 ease-swift hover:border-white/20 hover:-translate-y-0.5"
          >
            <div className="text-flare mb-4">{f.icon}</div>
            <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-sm text-mutedfg leading-relaxed">{f.body}</p>
          </div>
        ))}
      </section>

      {/* 4. How it works */}
      <section className="mt-20">
        <h2 className="text-2xl font-bold mb-8">How it works</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-7">
              <p className="font-mono text-flare/70 text-sm mb-3">{s.n}</p>
              <h3 className="font-semibold text-lg mb-2">{s.t}</h3>
              <p className="text-sm text-mutedfg leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Trust signals */}
      <section className="card mt-20 p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-gold">
            <ShieldCheck className="w-6 h-6" />
          </span>
          <h2 className="text-xl font-bold">Verifiable by anyone</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 text-sm">
          <div>
            <p className="text-mutedfg mb-1">Gate contract (Coston2)</p>
            <a
              href={`${EXPLORER}/address/${GATE_ADDRESS}`}
              target="_blank"
              className="font-mono text-fg link inline-flex items-center gap-1.5"
            >
              {GATE_ADDRESS.slice(0, 10)}…{GATE_ADDRESS.slice(-6)}
              <ExternalLink />
            </a>
          </div>
          <div>
            <p className="text-mutedfg mb-1">Sanctions source</p>
            <p className="font-mono text-fg">OFAC SDN · refreshed hourly</p>
          </div>
          <div>
            <p className="text-mutedfg mb-1">Enclave</p>
            <p className="font-mono text-fg">Intel TDX · dstack attestation</p>
          </div>
        </div>
      </section>

      {/* 6. Final CTA */}
      <section className="text-center py-20">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">
          See it decide in real time.
        </h2>
        <p className="text-mutedfg mb-8">
          Screen a clean address and a sanctioned one — watch the gate react.
        </p>
        <Link href="/verify" className="btn">
          Run a verification
        </Link>
      </section>
    </div>
  );
}
