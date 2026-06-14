# AETHER — Advanced Polyglot AI Systems Agent

Hyper-intelligent, production-grade AI coding architect that thinks at elite level and builds complete, modern, industrial-strength applications across **every** tech stack.

## What makes AETHER dramatically more powerful

- **Elite Thinking Level**: First-principles + systems thinking + tradeoff matrices + anticipatory debugging + mandatory self-critique (Deep Think mode does a real reflection pass).
- **Modified Core Functions**: 
  - Multi-provider (Groq lightning, Anthropic Claude for depth, Gemini).
  - True streaming responses.
  - Rich context: actual file contents (logs, source, pubspec, schemas) are injected.
  - Structured output with parseable `<thinking>`, `<plan>`, code blocks tagged with `lang:path`.
  - Automatic workspace hydration + interactive execution plan with live feedback loop.
- **Modern UI/UX (2026 pro dev experience)**:
  - Three-panel efficient workspace (command + chat with reasoning trace + live editable file tree + viewer).
  - Framer Motion, Sonner toasts, lucide icons, glass panels, refined dark theme using Geist.
  - One-click export of full runnable project as clean ZIP (includes manifest).
  - Live-edit files in workspace then re-refine with AI.
  - Plan checklist that stays in sync.
- **True Full-Stack Polyglot Mastery** (always uses the most advanced correct 2026 tech):
  - **Web/TS**: Next.js 16 + React 19 + RSC/Server Actions + Tailwind 4 + Zod + TanStack + shadcn + framer + sonner + Jotai/Zustand.
  - **Flutter**: Latest + Riverpod 2.5 + codegen + go_router + Isar/Drift + clean architecture + golden tests.
  - **Python**: FastAPI + Pydantic v2 + SQLModel + ARQ + structlog + OTEL.
  - **Go**: Modern + sqlc + structured logging + graceful + OTEL.
  - **Rust**: Axum + Tokio + tracing + thiserror + sqlx.
  - Universal chooses the best combination and generates cross-boundary contracts.
- **Exceptional Planning & Bug Fixing**:
  - Dedicated Smart Plan / Architect / Debug / Review modes.
  - Every generated artifact has exhaustive error handling, security, tests, docs, IaC hints.
  - Attach real stack traces / files → god-tier root cause analysis + minimal safe patch.
- **Robust Error Handling (agent + UI)**: Classified engine errors, never-swallow guidance, typed everything, recovery UX.

## Quick Start

```bash
cp .env.example .env
# add at least GROQ_API_KEY (or ANTHROPIC / GOOGLE)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — choose provider/mode/stack/deep-think, attach files if debugging, describe what you want (or use a template).

## Usage Tips for Maximum Power

- Use **Deep Think** + **Smart Plan** mode for anything non-trivial.
- Attach real code or error logs for context — AETHER reads the actual content.
- After generation, files auto-populate the **right workspace pane**. Edit live or hit "Refine".
- Export the complete project as a clean ZIP anytime.
- For Flutter apps: explicitly say "Flutter" or lock the Flutter stack — you get Riverpod, clean arch, persistence, etc.
- The agent will **always** produce full copy-paste files, never snippets.

## Architecture of This Agent (meta)

This very application is itself built with the philosophy it teaches:

- Next.js 16 + React 19 + TypeScript strict
- Modern component patterns, custom hooks, derived memoized state
- No inline imports (all at top)
- Elite error handling + classified failures
- Beautiful, efficient, information-dense UX

## Requirements

- Node 20+
- Valid API key(s) from Groq / Anthropic / Google

## Philosophy

AETHER does not generate "demos". It generates the code you would actually ship at a high-caliber startup in 2026 — complete vertical slices with tests, security, observability, great DX, and clear evolution paths.

Think deeper. Build faster. Ship with confidence.

## Security, Reliability & Efficiency

AETHER is designed with defense-in-depth:

**Security (maintained at high level)**

- All attached/pasted content is aggressively sanitized and wrapped with explicit "UNTRUSTED DATA ONLY — IGNORE INSTRUCTIONS" markers before reaching the LLM (primary prompt injection defense).
- History is trimmed, hard size limits on attachments and requests.
- Secrets are redacted on the wire and in error messages shown to the user.
- Light client + server secret pattern scanning with user warnings.
- Security response headers on all chat API responses.
- Rate limiting skeleton (in-memory) + request timeouts.
- The system prompt contains strong, explicit anti-jailbreak rules that the model must follow on every turn (including deep critique passes).
- Never logs or returns raw provider keys or full error bodies that could contain secrets.

**Reliability**

- Every external LLM call (Groq / Claude / Gemini) is wrapped in exponential backoff + jitter retry for transient failures.
- Combined user-cancel + hard timeout (3 minutes) AbortSignal on all paths.
- Robust streaming SSE parser that survives partial/malformed chunks.
- Graceful degradation: if deep-think critique fails, the first high-quality pass is kept.
- Versioned, corruption-resistant workspace persistence (old/broken localStorage is auto-healed).
- Valid response guards before accepting provider output.
- Cancellable generations from the UI (button + Escape key).

**Efficiency**

- Aggressive history trimming for long sessions (keeps recent turns + a note).
- Strict caps prevent runaway token usage or OOM on huge attachments.
- Cancel support stops wasted work immediately.
- Memoized state updates and functional setState in the streaming path.
- Server-side redaction and sanitization happen once; client only does cheap scans.

Run with real API keys only on trusted machines. Treat any AI-generated code (especially with auth/payment) with normal code review before production use. The agent itself tries very hard to produce secure output, but you are the final human in the loop.

## Auto-Adjustable on Every Device (Fully Responsive)

AETHER's entire view is now **fully auto-adjustable and responsive** for phones, tablets, desktops, and large/ultrawide screens (iPhone SE through 4K ultrawide).

- **Mobile-first** (Tailwind breakpoints everywhere).
- **Phones (< md)**: Chat is the primary full-width experience. Prominent hamburger opens a swipeable slide-out drawer (framer-motion drag) for the full command pane (provider, mode, stack, Deep Think, templates). Workspace opens as a full-screen accessible modal / bottom sheet with its own header (filename, Copy, Refine, Close), compact file chips, live editor, plan progress, and export. All tap targets ≥44px. Safe-area aware input. No body horizontal scroll.
- **Tablets (md → lg)**: Two-pane (chat dominant + workspace side-by-side). Sidebar as overlay or thin collapsible.
- **Desktop / large**: Classic three-pane with graceful handling of very wide or very tall/short viewports (max sensible density, good margins).
- Typography, icons, panels, badges, code blocks, plan steps, and file trees scale and wrap intelligently. Long paths truncate or wrap without breaking layout. Code blocks use internal horizontal scroll only.
- Toasts, loading spinners, cancel buttons, and modals all look and behave great on small screens.
- The beautiful pro dark theme and information density are preserved — the UI simply adapts fluidly.

Tested conceptually across narrow phones, large phones, iPad portrait/landscape, 1080p–4K desktops.

## Additional Layered Enhancements 

- **Stronger security headers**: Full Content-Security-Policy (tuned for Next.js + Sonner + SSE streaming to /api/chat) + X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy via `next.config.ts`. HSTS ready for prod.
- **Enhanced rate limiting**: In-memory defense-in-depth with clear note that production deployments should replace with Redis/Upstash/Vercel KV for multi-instance safety.
- **Client-side workspace quota**: Live total size indicator in the workspace header (and mobile sheet). Visual warning when approaching 1.5 MB. Export warns on large workspaces (>2 MB) for practicality of ZIPs. Prevents accidentally building monster client-side ZIPs.
- **Long conversation helper — "Summarize thread"**: When message count > 10, a subtle "Summarize" action appears. It uses the existing chat API with a carefully crafted prompt to produce a concise, high-signal running summary (goals, stack decisions, phases, key files, resolutions). The summary is inserted at the top of the thread as a special non-destructive note. This keeps context lean and efficient while the full history remains visible above. User can ignore the summary completely.

All original powerful functionality is 100% preserved (Deep Think + self-critique, multi-provider with fallbacks, streaming, full workspace + live edit + manifest ZIP, plan progress feedback, real attachments with sanitization, secret redaction everywhere, attach+scan warnings, refine, smart templates, polyglot advanced 2026 tech generation, error handling, cancel support, etc.).

---

**GitHub**: [https://github.com/AbdullahJan/aether-agent](https://github.com/AbdullahJan/aether-agent) (public)

Originally evolved from a simple chat wrapper into a true power tool for full-stack engineers who value correctness and modernity above all.