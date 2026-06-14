import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Strong security headers for the entire app (defense in depth).
    // CSP is tuned for Next.js + Sonner + our internal /api/chat SSE streaming.
    // No external script/style sources besides what Next bundles.
    // connect-src 'self' covers the client fetch to our API (LLM calls happen server-side).
    const securityHeaders = [
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js dev + prod requirements; prod can be tightened with nonces if desired
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "connect-src 'self' https://api.groq.com https://api.anthropic.com", // allow our providers if client ever talks direct (currently server-side)
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
      },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'clipboard-write=(self)' },
      // HSTS - only enable in prod with a real domain + HTTPS
      // { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    ];

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // Slightly looser for the streaming chat endpoint if needed (SSE works fine with above)
      {
        source: '/api/chat',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
