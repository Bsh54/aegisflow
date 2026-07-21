import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AegisFlow — Confidential Compliance for FXRP",
  description:
    "Privacy-preserving AML firewall for FXRP inflows on Flare. Real OFAC data, FDC-verified verdicts, TEE confidentiality.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="border-b border-edge">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <span className="text-flare">🛡️</span> AegisFlow
            </Link>
            <div className="flex gap-6 text-sm text-slate-400">
              <Link href="/verify" className="hover:text-white transition">Verify</Link>
              <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
              <a
                href="https://github.com/Bsh54/aegisflow"
                target="_blank"
                className="hover:text-white transition"
              >
                GitHub
              </a>
            </div>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
        <footer className="border-t border-edge mt-16">
          <div className="max-w-5xl mx-auto px-6 py-6 text-xs text-slate-500 flex justify-between">
            <span>AegisFlow — Flare Summer Signal 2026</span>
            <span>Coston2 testnet · real OFAC SDN data</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
