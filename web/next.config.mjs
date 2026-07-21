/** @type {import('next').NextConfig} */
// Verifier endpoints (/attest, /screen, /health) are served by route handlers
// in app/ with automatic TEE→local failover — see lib/verifier.ts.
const nextConfig = {};

export default nextConfig;
