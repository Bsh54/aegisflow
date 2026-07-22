"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle, ExternalLink } from "@/components/icons";

interface ThreatList {
  id: string;
  name: string;
  jurisdiction: string;
  count: number;
  addresses_sample: string[];
  status: string;
  required: boolean;
  source_url: string;
  data_url?: string;
}

export default function Sanctions() {
  const [data, setData] = useState<{ total: number; lists: ThreatList[] } | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(addr: string) {
    navigator.clipboard?.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied((c) => (c === addr ? null : c)), 1200);
  }

  useEffect(() => {
    fetch("/api/sanctions", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Threat intelligence</h1>
      <p className="text-mutedfg mb-4">
        The live lists every screening runs against — real data, refreshed
        hourly inside the verifier.
      </p>
      {data && (
        <p className="font-mono text-sm mb-10">
          <span className="text-blocked font-bold text-2xl">{data.total.toLocaleString()}</span>{" "}
          <span className="text-mutedfg">known-bad wallets monitored across {data.lists.length} lists</span>
        </p>
      )}

      {error && <div className="card p-6 !border-blocked/40 text-blocked text-sm">{error}</div>}
      {!data && !error && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-24 w-full" />
          ))}
        </div>
      )}

      <div className="space-y-4">
        {data?.lists.map((l) => (
          <div key={l.id} className="card p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2.5">
                  {l.status === "ok" ? (
                    <span className="text-clear">
                      <ShieldCheck className="w-5 h-5" />
                    </span>
                  ) : (
                    <span className="text-review">
                      <AlertTriangle className="w-5 h-5" />
                    </span>
                  )}
                  <h2 className="font-semibold">{l.name}</h2>
                  {l.required && (
                    <span className="text-[10px] font-mono border border-gold/40 text-gold rounded px-1.5 py-0.5">
                      FAIL-CLOSED
                    </span>
                  )}
                </div>
                <p className="text-xs text-mutedfg mt-1 font-mono">
                  {l.jurisdiction} · id {l.id}
                </p>
              </div>
              <p className="font-mono text-2xl font-bold">
                {l.count.toLocaleString()}
                <span className="text-xs text-mutedfg font-normal ml-1.5">wallets</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-4 mt-4 text-xs font-mono">
              <button
                className="link text-mutedfg"
                onClick={() => setOpen(open === l.id ? null : l.id)}
              >
                {open === l.id ? "hide addresses" : `view addresses (${Math.min(l.count, 100)})`}
              </button>
              {l.data_url && (
                <a
                  className="link text-mutedfg inline-flex items-center gap-1"
                  target="_blank"
                  href={l.data_url}
                >
                  open the full list <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <a
                className="link text-mutedfg inline-flex items-center gap-1"
                target="_blank"
                href={l.source_url}
              >
                official source <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {open === l.id && (
              <div className="mt-4 bg-base border border-edge rounded-xl p-4 max-h-64 overflow-y-auto">
                <p className="text-[10px] text-mutedfg mb-2">
                  click any address to copy it, then paste it into{" "}
                  <a href="/verify" className="link">Verify</a>.
                </p>
                {l.addresses_sample.length === 0 ? (
                  <p className="text-xs text-mutedfg font-mono">empty</p>
                ) : (
                  <ul className="text-xs font-mono space-y-1">
                    {l.addresses_sample.map((a) => (
                      <li key={a}>
                        <button
                          className="text-mutedfg hover:text-fg break-all text-left transition cursor-pointer w-full"
                          onClick={() => copy(a)}
                          title="click to copy"
                        >
                          {a}
                          {copied === a && <span className="text-clear ml-2">copied ✓</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-mutedfg mt-8 leading-relaxed">
        Note: OFAC has publicly sanctioned one XRP address to date — sanctions
        can hit any address at any time, and this verifier picks up new listings
        within the hour, automatically. The additional lists extend coverage to
        state-sponsored hackers, terror financing, and ransomware operations.
      </p>
    </div>
  );
}
