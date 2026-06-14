"use client";

import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { Send, Paperclip, Brain, Bug, FolderTree, Download, Copy, RefreshCw, X, Play, Settings, Zap, AlertTriangle, Menu, ChevronDown, Image, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { scanForSecrets } from "@/lib/security";

// ============================================
// AETHER — Elite Full-Stack AI Systems Agent
// Modern UI/UX | Advanced Reasoning | Every Tech Stack
// Supports: Next.js 16 / Flutter / FastAPI / Go / Rust / Polyglot
// ============================================

interface Message {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  plan?: string;
}

interface WorkspaceFile {
  path: string;
  content: string;
  lang: string;
}

interface PlanStep {
  id: number;
  text: string;
  completed: boolean;
}

interface AttachedFile {
  name: string;
  content: string;
}

type Provider = "groq" | "anthropic" | "google";
type Mode = "chat" | "plan" | "debug" | "architect" | "review";
type Stack = "universal" | "web-ts" | "flutter" | "python-api" | "go-backend" | "rust" | "full-polyglot";

const STACKS: { value: Stack; label: string; hint: string }[] = [
  { value: "universal", label: "Universal (Best Choice)", hint: "AETHER picks optimal 2026 stack" },
  { value: "web-ts", label: "Web Fullstack TS", hint: "Next 16 + React 19 + Drizzle + tRPC" },
  { value: "flutter", label: "Flutter Mobile", hint: "Riverpod + go_router + Isar + Clean Arch" },
  { value: "python-api", label: "Python Backend", hint: "FastAPI + Pydantic v2 + SQLModel + ARQ" },
  { value: "go-backend", label: "Go Backend", hint: "Fiber/Echo + sqlc + Zap + OTEL" },
  { value: "rust", label: "Rust Systems", hint: "Axum + Tokio + sqlx + tracing" },
  { value: "full-polyglot", label: "Full Polyglot", hint: "Flutter + TS Web + Go/FastAPI" },
];

const MODES: { value: Mode; label: string; icon: any; desc: string }[] = [
  { value: "chat", label: "Chat", icon: Send, desc: "Normal high-quality work" },
  { value: "plan", label: "Smart Plan", icon: Brain, desc: "Deep architecture & roadmap first" },
  { value: "debug", label: "Debug", icon: Bug, desc: "Root cause + minimal safe patch" },
  { value: "architect", label: "Architect", icon: FolderTree, desc: "Diagrams, contracts, scaling" },
  { value: "review", label: "Review", icon: AlertTriangle, desc: "Brutal production audit" },
];

const QUICK_TEMPLATES = [
  "Production SaaS dashboard in Next 16 + tRPC + Drizzle + Clerk + beautiful shadcn UI",
  "Flutter 3.24 e-commerce app with Riverpod, offline-first Isar, Stripe, clean architecture, golden tests",
  "High-performance FastAPI + Pydantic v2 backend for realtime collab + ARQ jobs + OpenTelemetry",
  "Go microservice + sqlc + Fiber + graceful + full OTEL + docker + k8s manifests",
  "Flutter + Rust Axum backend + TS web admin. Full type-safe contracts across all three.",
];

// Accept filters for the modern attach menu (Photo vs Document)
const PHOTO_ACCEPT = "image/*,.heic,.heif"; // all common photo/image formats
const DOC_ACCEPT = ".txt,.md,.markdown,.pdf,.doc,.docx,.xls,.xlsx,.csv,.json,.yaml,.yml,.toml,.xml,.html,.css,.scss,.js,.ts,.tsx,.jsx,.py,.go,.rs,.dart,.sql,.prisma,.env,.ini,.cfg,.log,.zip,.tar,.gz,.lock,.sum"; // any document, code, text, office, archive

/** Advanced modern tech ChoiceSelect with React Portal.
 *  The menu is rendered via createPortal directly to document.body.
 *  This completely isolates the dropdown from the nav/chat tree,
 *  so clicking the controls no longer causes layout/paint thrash or blinking
 *  of the golden watermark in the chat background.
 *
 *  Full list of options is always rendered. Current selection has the left accent + cyan dot.
 */
function ChoiceSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
}: {
  label: string;
  value: T | "";
  onChange: (val: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; minWidth: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click — but NEVER treat clicks inside the portaled menu as "outside".
  // This was the cause of selections not sticking: mousedown on a menu item would close the menu
  // (via the document listener) before or during the item's onClick, so onChange sometimes appeared to do nothing
  // and the displayed value stayed on the old choice (Groq, Chat, etc.).
  useEffect(() => {
    if (!open) return;

    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = !!containerRef.current?.contains(target);
      const insideMenu = !!menuRef.current?.contains(target);
      if (insideTrigger || insideMenu) {
        // Click was on the trigger or inside the open dropdown menu (even though portaled).
        // Do not close; let the menu item onClick (if any) handle selection + explicit close.
        return;
      }
      setOpen(false);
      setMenuPos(null);
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Measure trigger and open the menu (using viewport coords for fixed positioning)
  const toggle = () => {
    if (open) {
      setOpen(false);
      setMenuPos(null);
      return;
    }

    // Measure before setting open so we have the position ready
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 6,
        left: rect.left,
        minWidth: Math.max(rect.width + 20, 200),
      });
    }
    setOpen(true);
  };

  const current = options.find((o) => o.value === value);
  const display = current ? current.label : placeholder;

  // The actual menu content (full list, always rendered when open).
  // We attach menuRef so the outside-click guard can see clicks inside the portal.
  const MenuList = (
    <div
      ref={menuRef}
      className="overflow-hidden rounded-2xl border border-[#252932] bg-[#0b0d14] shadow-[0_12px_48px_-12px_rgb(0,0,0,0.65)] py-1 flex flex-col"
      style={{
        position: "fixed",
        top: menuPos?.top ?? 0,
        left: menuPos?.left ?? 0,
        minWidth: menuPos?.minWidth ?? 200,
        zIndex: 999999,
      }}
      role="listbox"
      onMouseDown={(e) => {
        // Extra safety: stop the native mousedown from reaching the document listener at all.
        // Combined with the ref.contains check above, clicks on options are guaranteed to reach their onClick.
        e.stopPropagation();
      }}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => {
              onChange(opt.value);
              setOpen(false);
              setMenuPos(null);
            }}
            className={`group w-full text-left px-3.5 py-[6px] text-sm transition flex items-center gap-3
              ${isActive
                ? "bg-[#161a22] text-white"
                : "text-[#d1d5db] hover:bg-[#161a22] hover:text-white"}`}
            role="option"
            aria-selected={isActive}
          >
            <div className={`h-4 w-[3px] rounded-full flex-shrink-0 transition ${isActive ? "bg-[#6366f1]" : "bg-white/10 group-hover:bg-white/25"}`} />
            <span className={`${isActive ? "font-medium" : ""}`}>{opt.label}</span>
            {isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[#22d3ee]" />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex items-center gap-2 relative" ref={containerRef}>
      <div className="text-[10px] uppercase tracking-[1.5px] text-[#5f6674] font-medium shrink-0">{label}</div>

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={toggle}
          className="group flex h-9 min-w-[118px] items-center justify-between gap-2 rounded-[18px] border border-[#252932] bg-[#0c0e14] px-3 text-sm text-left transition-all hover:border-[#353a46] focus:outline-none focus-visible:border-[#6366f1]/60 active:scale-[0.985]"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="truncate text-[#c9ccd3] group-hover:text-white">{display}</span>
          <ChevronDown size={15} className={`text-[#8b919d] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {/* Portaled menu — lives in document.body so it can never be clipped by the chat area
            and does not cause re-paint side effects on the golden watermark when opening/closing. */}
        {open && menuPos && createPortal(MenuList, document.body)}
      </div>
    </div>
  );
}

// Memoized so the expensive dropdown buttons don't re-render on every streaming token / parent update.
const MemoizedChoiceSelect = memo(ChoiceSelect) as typeof ChoiceSelect;

/** Extremely cheap golden watermark.
 *  Previously this giant rotated bg-clip-text was inside the updating chat tree and caused
 *  noticeable jank/lag on every token during "loading". Now it's a pure memoized leaf
 *  with aggressive GPU/compositor hints and content-visibility so the browser can ignore it
 *  while the live response bubble is updating.
 */
const Watermark = memo(function Watermark() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
      style={{
        transform: 'translateZ(0)',
        willChange: 'transform, opacity',
        backfaceVisibility: 'hidden',
        contentVisibility: 'auto' as any,
      }}
    >
      <div
        className="flex flex-col items-center opacity-[0.045]"
        style={{ transform: 'rotate(-6.5deg) translateZ(0)' }}
      >
        {/* Reduced max sizes — still very visible as a subtle brand watermark but far cheaper to paint */}
        <div className="text-[48px] sm:text-[58px] md:text-[66px] lg:text-[72px] font-semibold tracking-[-4.5px] leading-[0.78] bg-gradient-to-br from-[#facc15] via-[#fbbf24] to-[#b45309] bg-clip-text text-transparent">
          AETHER
        </div>
        <div className="text-[13px] sm:text-[15px] md:text-[17px] lg:text-[19px] font-medium tracking-[2.8px] -mt-1 bg-gradient-to-br from-[#facc15] via-[#fbbf24] to-[#b45309] bg-clip-text text-transparent">
          Advanced Polyglot AI Agent
        </div>
      </div>
    </div>
  );
});

/** Fast path for code blocks during historical render.
 *  Memoized on the raw code + filePath so we don't re-parse or re-create buttons on parent re-renders.
 */
const MemoizedCodeBlock = memo(function MemoizedCodeBlock({
  lang,
  filePath,
  code,
  onCopy,
  onToWorkspace,
  onRefine,
}: {
  lang: string;
  filePath: string;
  code: string;
  onCopy: (text: string, label?: string) => void;
  onToWorkspace: (path: string, content: string, lang: string) => void;
  onRefine: (file: { path: string; content: string; lang: string }) => void;
}) {
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[#252932] bg-[#0d0f14]">
      <div className="code-header flex items-center justify-between px-3 py-1.5 text-[#8b919d]">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.5px]">
          {filePath || lang}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => onCopy(code, "code")}
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 hover:bg-[#1f242d] transition text-[10px]"
          >
            <Copy size={12} /> COPY
          </button>
          {filePath && (
            <button
              onClick={() => onToWorkspace(filePath, code, lang)}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 hover:bg-[#1f242d] transition text-[10px] text-[#22d3ee]"
            >
              <FolderTree size={12} /> TO WORKSPACE
            </button>
          )}
          {filePath && (
            <button
              onClick={() => onRefine({ path: filePath, content: code, lang })}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 hover:bg-[#1f242d] transition text-[10px] text-[#f472b6]"
            >
              <RefreshCw size={12} /> REFINE
            </button>
          )}
        </div>
      </div>
      <pre className="code-block p-4 text-[12.5px] leading-[1.45] overflow-auto text-[#c9d0dc]"><code>{code}</code></pre>
    </div>
  );
});

/** Memoized rich message renderer for a single assistant historical message.
 *  The expensive regex + React tree for code blocks + action buttons only runs when THIS message's content actually changes.
 */
const RichMessage = memo(function RichMessage({
  content,
  onCopy,
  onToWorkspace,
  onRefine,
}: {
  content: string;
  onCopy: (text: string, label?: string) => void;
  onToWorkspace: (path: string, content: string, lang: string) => void;
  onRefine: (file: { path: string; content: string; lang: string }) => void;
}) {
  const parts: React.ReactNode[] = [];
  const codeRegex = /```([\w-]+)?(?::([^\n]+))?\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = codeRegex.exec(content)) !== null) {
    if (m.index > last) {
      parts.push(<div key={key++} className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#c9ccd3]">{content.slice(last, m.index)}</div>);
    }
    const lang = (m[1] || "text").trim();
    const filePath = (m[2] || "").trim();
    const code = m[3].trim();

    parts.push(
      <MemoizedCodeBlock
        key={key++}
        lang={lang}
        filePath={filePath}
        code={code}
        onCopy={onCopy}
        onToWorkspace={onToWorkspace}
        onRefine={onRefine}
      />
    );
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    parts.push(<div key={key++} className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#c9ccd3]">{content.slice(last)}</div>);
  }
  return <div className="space-y-1 text-[13px]">{parts}</div>;
});

/** One chat row (user or assistant). Memoized so that when the parent re-renders for streaming tokens,
 *  input typing, showThinking toggle, plan checkbox elsewhere, etc., rows whose props are referentially equal bail out completely.
 */
const ChatMessage = memo(function ChatMessage({
  msg,
  idx,
  showThinking,
  planSteps,
  onTogglePlanStep,
  onCopy,
  onToWorkspace,
  onRefine,
}: {
  msg: Message;
  idx: number;
  showThinking: boolean;
  planSteps: PlanStep[];
  onTogglePlanStep: (id: number) => void;
  onCopy: (text: string, label?: string) => void;
  onToWorkspace: (path: string, content: string, lang: string) => void;
  onRefine: (file: { path: string; content: string; lang: string }) => void;
}) {
  const isAssistant = msg.role === "assistant";
  const hideAvatar = isAssistant && idx === 0; // welcome message has no A badge

  return (
    <div className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
      {isAssistant && !hideAvatar && (
        <div className="w-7 h-7 mt-0.5 rounded-md bg-gradient-to-br from-[#6366f1] to-[#22d3ee] text-[10px] font-bold flex items-center justify-center text-black shrink-0">A</div>
      )}

      <div className={`max-w-[82%] rounded-2xl px-4 py-3.5 text-[13px] ${msg.role === "user" ? "message-user rounded-br-md" : "message-assistant rounded-bl-md"}`}>
        {isAssistant ? (
          <>
            <RichMessage content={msg.content} onCopy={onCopy} onToWorkspace={onToWorkspace} onRefine={onRefine} />

            {showThinking && msg.thinking && (
              <details className="thinking-block mt-4 pl-3 pr-2 py-2 rounded text-xs text-[#a1a6b0] cursor-pointer" open>
                <summary className="font-medium text-[#6366f1] select-none">AETHER Thinking (first principles + critique)</summary>
                <div className="mt-2 whitespace-pre-wrap leading-relaxed">{msg.thinking}</div>
              </details>
            )}

            {msg.plan && (
              <div className="mt-4 border border-[#252932] rounded-xl p-3 bg-[#0a0b0f]">
                <div className="uppercase tracking-widest text-[10px] text-[#6366f1] mb-2">EXECUTION PLAN — check progress</div>
                {planSteps.length > 0 ? (
                  <div className="space-y-1.5">
                    {planSteps.map((step) => (
                      <label key={step.id} className={`plan-step flex items-start gap-2 text-xs cursor-pointer ${step.completed ? "completed" : ""}`}>
                        <input type="checkbox" checked={step.completed} onChange={() => onTogglePlanStep(step.id)} className="mt-0.5 accent-[#6366f1]" />
                        <span>{step.text}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-[#8b919d] text-xs whitespace-pre-wrap">{msg.plan}</div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="whitespace-pre-wrap">{msg.content}</div>
        )}
      </div>

      {msg.role === "user" && (
        <div className="w-7 h-7 mt-0.5 rounded-md bg-[#252932] text-[10px] font-bold flex items-center justify-center shrink-0">ME</div>
      )}
    </div>
  );
});

export default function AetherAgent() {
  // Core chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "I'm AETHER\n\nWhat would you like to build today?",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  // === STREAMING OPTIMIZATION: keep live token accumulation OUTSIDE the messages array ===
  // Historical messages stay completely stable (no re-renders) while the model is emitting tokens.
  // Only this one "live" bubble updates during generation → dramatically less jank/lag.
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingThinking, setStreamingThinking] = useState<string | undefined>(undefined);

  // Powerful controls
  const [provider, setProvider] = useState<Provider>("groq");
  const [mode, setMode] = useState<Mode>("chat");
  const [stack, setStack] = useState<Stack>("universal");
  const [deepThink, setDeepThink] = useState(false);

  // UI chrome
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [showThinking, setShowThinking] = useState(true);

  // Workspace — real full project power
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([]);

  // Refs
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatScrollerRef = useRef<HTMLDivElement>(null); // the actual overflow-y-auto viewport — for instant bottom-pinning during streaming (critical for no "up and down" jitter)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null); // for cancel + reliability
  const attachMenuRef = useRef<HTMLDivElement>(null); // for photo/doc attach menu outside-click handling
  const streamRafRef = useRef<number>(0); // for cancelling any pending rAF during streaming so we don't setState after unmount/cancel

  // Responsive / device adaptive state (makes view auto-adjust for phones, tablets, desktops, large screens)
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false); // mobile only slide-out for command pane
  const [showAttachMenu, setShowAttachMenu] = useState(false); // photo vs document chooser for the add-file button
  // workspaceOpen is reused: on mobile it triggers the workspace bottom-sheet/full modal instead of side pane

  useEffect(() => {
    const update = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Close the Photo/Doc attach menu when clicking outside
  useEffect(() => {
    if (!showAttachMenu) return;
    const onOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [showAttachMenu]);

  // Derived
  const activeFile = useMemo(
    () => workspaceFiles.find((f) => f.path === activeFilePath) || null,
    [workspaceFiles, activeFilePath]
  );

  const fileTree = useMemo(() => {
    return [...workspaceFiles].sort((a, b) => a.path.localeCompare(b.path));
  }, [workspaceFiles]);

  // Live workspace size (used in header badge + export button + mobile sheet)
  // Matches the "1.5 MB warning" and quota UX described in the project docs.
  const workspaceSizeMB = useMemo(() => {
    if (!workspaceFiles?.length) return 0;
    const totalBytes = workspaceFiles.reduce((acc, f) => acc + (f.content?.length || 0), 0);
    return totalBytes / (1024 * 1024);
  }, [workspaceFiles]);

  // Auto-scroll for chat.
  // CRITICAL for "loading ke waqt up and down" fix:
  // - While the model is actively streaming (loading || streamingContent), we do DIRECT instant
  //   scrollTop assignment on the real scroller. No smooth animation. Smooth + rapid content growth
  //   + status row appearing is what causes the visible bounce/jitter in one place.
  // - Only after a full turn is committed (messages array changed, streaming over) we do a pleasant smooth scroll.
  // We also guard with the scroller ref so we can manipulate the viewport directly.
  useEffect(() => {
    const scroller = chatScrollerRef.current;
    const isActivelyStreaming = !!(loading || streamingContent);

    if (isActivelyStreaming && scroller) {
      // Instant pin — no animation fighting the live text growth. This stops the "up and down".
      // We use scrollHeight directly; it's the cheapest and most reliable way to stay at bottom.
      scroller.scrollTop = scroller.scrollHeight;
    } else if (!isActivelyStreaming) {
      // Nice smooth only between complete turns.
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, loading, streamingContent]);

  // Stable status label for the live streaming bubble (avoids re-computing the long ternary on every token flush)
  const liveStatus = useMemo(() => {
    if (mode === "plan") return "Architecting phases";
    if (mode === "debug") return "Isolating root cause";
    if (deepThink) return "Deep critique pass";
    return "Generating production artifacts";
  }, [mode, deepThink]);

  // Persist workspace safely (versioned, corruption-proof) — critical for reliability
  const WORKSPACE_STORAGE_KEY = "aether_workspace_v2";
  const WORKSPACE_VERSION = 2;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.version === WORKSPACE_VERSION) {
          if (Array.isArray(parsed.files)) setWorkspaceFiles(parsed.files);
          if (Array.isArray(parsed.plan)) setPlanSteps(parsed.plan);
        } else {
          // old format or corrupt — start clean but don't crash
          localStorage.removeItem(WORKSPACE_STORAGE_KEY);
        }
      }
    } catch {
      // corrupted storage — gracefully ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify({ version: WORKSPACE_VERSION, files: workspaceFiles, plan: planSteps })
      );
    } catch {
      // storage full or blocked — non-fatal
    }
  }, [workspaceFiles, planSteps]);

  // ============ SMART PARSING — extract thinking, plan, files from AETHER responses ============
  function parseAssistantResponse(raw: string): { clean: string; thinking?: string; plan?: string; files: WorkspaceFile[] } {
    let thinking: string | undefined;
    let plan: string | undefined;

    // <thinking>...</thinking>
    const thinkMatch = raw.match(/<thinking>([\s\S]*?)<\/thinking>/i);
    if (thinkMatch) {
      thinking = thinkMatch[1].trim();
    }

    // <plan>...</plan>
    const planMatch = raw.match(/<plan>([\s\S]*?)<\/plan>/i);
    if (planMatch) {
      plan = planMatch[1].trim();
    }

    // Extract code files: ```lang:path\n ... ``` or ```path\n ...
    const files: WorkspaceFile[] = [];
    const codeBlockRegex = /```(?:([\w-]+):)?([^\n`]+)?\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = codeBlockRegex.exec(raw)) !== null) {
      const lang = (match[1] || "text").toLowerCase();
      let path = (match[2] || `untitled-${files.length + 1}.${lang === "dart" ? "dart" : "ts"}`).trim();
      const content = match[3].trim();

      // Clean common prefixes
      path = path.replace(/^FILE:\s*/i, "").replace(/^app\//, "app/").replace(/^\//, "");
      if (!path.includes(".")) {
        path = `${path}.${lang === "typescript" || lang === "ts" ? "ts" : lang === "dart" ? "dart" : "txt"}`;
      }
      files.push({ path, content, lang });
    }

    // Clean visible markers from display content for beauty
    let clean = raw
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
      .replace(/<plan>[\s\S]*?<\/plan>/gi, "")
      .replace(/<architecture>[\s\S]*?<\/architecture>/gi, "")
      .replace(/<risks>[\s\S]*?<\/risks>/gi, "")
      .replace(/\*\*FILE:[^*]+\*\*/gi, "")
      .trim();

    return { clean, thinking, plan, files };
  }

  function mergeNewFiles(newFiles: WorkspaceFile[]) {
    if (!newFiles.length) return;

    // Security: lightly scan AI-generated files for accidental secret emission (rare but valuable)
    newFiles.forEach((f) => {
      const warnings = scanForSecrets(f.content, `generated:${f.path}`);
      if (warnings.length) {
        toast.warning("Review generated file for secrets", { description: `${f.path} — AETHER tries hard to avoid this, but double-check before commit.` });
      }
    });

    setWorkspaceFiles((prev) => {
      const map = new Map(prev.map((f) => [f.path, f]));
      for (const nf of newFiles) {
        map.set(nf.path, nf);
      }
      const merged = Array.from(map.values());
      if (!activeFilePath || !merged.some((m) => m.path === activeFilePath)) {
        setActiveFilePath(merged[0]?.path || null);
      }
      return merged;
    });
    toast.success(`${newFiles.length} file(s) synced to workspace`, { description: "Production-ready artifacts ready for export or iteration" });
  }

  function applyPlanText(planText?: string) {
    if (!planText) return;
    const lines = planText.split("\n").filter((l) => /^\d+[\.\)]/.test(l.trim()) || /^[-*]\s/.test(l.trim()));
    if (!lines.length) return;

    const steps: PlanStep[] = lines.map((line, idx) => ({
      id: idx + 1,
      text: line.replace(/^\d+[\.\)]\s*|^[-*]\s*/, "").trim(),
      completed: false,
    }));
    setPlanSteps(steps);
    setMode("plan");
    toast("Smart Plan loaded", { description: `${steps.length} phases. Check items as you complete vertical slices.` });
  }

  // Toggle plan step + give feedback to agent (smart loop)
  const togglePlanStep = useCallback(
    (id: number) => {
      setPlanSteps((prev) =>
        prev.map((step) => (step.id === id ? { ...step, completed: !step.completed } : step))
      );

      const step = planSteps.find((s) => s.id === id);
      if (!step) return;

      const newState = !step.completed ? "COMPLETED" : "RE-OPENED";
      toast.info(`Phase #${id} ${newState.toLowerCase()}`, { description: "AETHER will respect this in the next turn" });
    },
    [planSteps]
  );

  // ============ POWERFUL SEND — streaming + all controls + file context + error handling + cancel + guards ============
  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if ((!trimmed && attachedFiles.length === 0) || loading) return;

    // === CLIENT-SIDE SECURITY & RELIABILITY GUARDS (before network) ===
    const totalAttach = attachedFiles.reduce((sum, f) => sum + f.content.length, 0);
    if (totalAttach > 110_000) {
      toast.error("Attachments too large", { description: "Keep total under ~110k chars for speed, cost, and reliability." });
      return;
    }

    // Secret scan on what the user is about to send (defense + UX)
    const attachWarnings: string[] = [];
    attachedFiles.forEach((f) => {
      attachWarnings.push(...scanForSecrets(f.content, `attachment:${f.name}`));
    });
    if (attachWarnings.length) {
      toast.warning("Potential secrets in attachments", {
        description: attachWarnings[0] + " — AETHER will treat as untrusted data only.",
      });
    }

    const userContent = trimmed || (attachedFiles.length ? `(Attached ${attachedFiles.length} file(s) for context)` : "");

    const userMessage: Message = { role: "user", content: userContent };
    const updatedMessages = [...messages, userMessage];

    // Cancel any previous in-flight request (great for UX + resource efficiency)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    // Reset any previous streaming state + pending rAF before a new generation starts
    if (streamRafRef.current) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = 0;
    }
    setStreamingContent("");
    setStreamingThinking(undefined);

    const payload = {
      messages: updatedMessages,
      provider,
      mode,
      stack,
      deepThink,
      attachedFiles: attachedFiles.length ? attachedFiles : undefined,
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }

      const contentType = res.headers.get("content-type") || "";
      let assistantContent = "";

      if (contentType.includes("text/event-stream")) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // IMPORTANT: Do NOT append to messages here. We use dedicated streaming state
        // so that the entire previous conversation + historical bubbles are 100% stable
        // and do not re-render or re-run rich parsing on every token.
        setStreamingContent("");
        setStreamingThinking(undefined);

        // === RAFT + SAFETY THROTTLE for ultra-smooth streaming on fast providers (Groq etc) ===
        // We batch visual updates to rAF (screen refresh) so the browser can coalesce paints.
        // We also keep a hard safety flush every ~80ms so the user always sees progress even on very bursty streams.
        let pending = "";
        let lastSafetyFlush = Date.now();
        const SAFETY_MS = 80;

        const flush = () => {
          streamRafRef.current = 0;
          setStreamingContent(pending);
          lastSafetyFlush = Date.now();
        };

        const scheduleFlush = (force = false) => {
          const now = Date.now();
          if (force || now - lastSafetyFlush > SAFETY_MS) {
            if (streamRafRef.current) cancelAnimationFrame(streamRafRef.current);
            flush();
            return;
          }
          if (!streamRafRef.current) {
            streamRafRef.current = requestAnimationFrame(flush);
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (part.startsWith("data: ")) {
              const data = part.slice(6);
              if (data === "[DONE]") continue;
              try {
                const json = JSON.parse(data);
                if (json.error) throw new Error(json.error);
                const delta: string = json.delta || "";
                if (delta) {
                  assistantContent += delta;
                  pending = assistantContent;
                  scheduleFlush();
                }
              } catch (e: any) {
                if (e.message) throw e;
              }
            }
          }
        }

        // Final hard commit of whatever we have (guarantees the last tokens appear even if rAF was pending)
        if (streamRafRef.current) {
          cancelAnimationFrame(streamRafRef.current);
          streamRafRef.current = 0;
        }
        if (assistantContent) {
          setStreamingContent(assistantContent);
        }
      } else {
        const data = await res.json();
        assistantContent = data.message || "No response";
        // Non-streaming path: commit directly (rare now)
        setStreamingContent(assistantContent);
      }

      const parsed = parseAssistantResponse(assistantContent);

      // Final single commit of the completed assistant turn into the stable messages list.
      // After this, streaming* states are cleared so the live bubble disappears and the
      // rich (code blocks, thinking, plan) version appears in the historical list.
      const finalAssistant: Message = {
        role: "assistant",
        content: parsed.clean || assistantContent,
        ...(parsed.thinking ? { thinking: parsed.thinking } : {}),
        ...(parsed.plan ? { plan: parsed.plan } : {}),
      };

      setMessages((prev) => [...prev, finalAssistant]);

      // Clear the live streaming UI state so only the committed historical message remains.
      setStreamingContent("");
      setStreamingThinking(undefined);

      if (parsed.files.length) {
        mergeNewFiles(parsed.files);
      }
      if (parsed.plan) {
        applyPlanText(parsed.plan);
      }
    } catch (e: any) {
      const errorMsg = e?.message || "Unknown engine error";
      // On hard error we still want to show something in history and stop the live bubble
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `**Engine error**\n\n${errorMsg}\n\nTip: Check .env keys, try switching provider, or reduce attached file size.`,
        },
      ]);
      setStreamingContent("");
      setStreamingThinking(undefined);
      toast.error("AETHER encountered an issue", { description: errorMsg });
    } finally {
      if (streamRafRef.current) {
        cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = 0;
      }
      setLoading(false);
      setAttachedFiles([]);
      abortControllerRef.current = null;

      // Always clear any residual streaming UI state
      setStreamingContent("");
      setStreamingThinking(undefined);
    }
  }, [input, attachedFiles, loading, messages, provider, mode, stack, deepThink]);

  const cancelCurrentRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (streamRafRef.current) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = 0;
    }
    setLoading(false);
    setStreamingContent("");
    setStreamingThinking(undefined);
    toast.info("Generation cancelled by user");
  }, []);

  // Long conversation helper - keeps context lean & efficient (non-destructive)
  const handleSummarizeThread = useCallback(async () => {
    if (messages.length < 8) return;
    const summaryUserPrompt = `Produce a concise, high-signal RUNNING SUMMARY of the full conversation history below.

Focus on:
- Original goal(s)
- Key decisions + chosen stack(s) with rationale
- Major phases / plan items
- Important generated files (path + one-line purpose)
- Bugs/errors discussed + resolutions
- Current project state

Output ONLY clean markdown:

## Conversation Summary

**Goal:** ...
**Stack & Rationale:** ...
**Progress / Phases:** ...
**Key Files:** ...
**Notes / Open Items:** ...

Under 320 words. Factual only.

Full history:
${messages.slice(0, 30).map(m => `${m.role.toUpperCase()}: ${m.content.slice(0, 900)}`).join('\n\n---\n\n')}`;

    try {
      setLoading(true);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: summaryUserPrompt }],
          provider,
          mode: 'chat',
          stack,
          deepThink: false,
        }),
      });
      const data = await res.json();
      const summary = (data.message || '').trim();
      if (!summary) throw new Error('Empty summary');

      const summaryNote = `## Conversation Summary (auto-generated to keep context efficient)\n\n${summary}\n\n---\n*This is a non-destructive note. The full history remains above. Ask me to "continue from summary" if needed.*`;

      setMessages(prev => {
        // Remove previous auto-summary if present to avoid stacking
        const cleaned = prev.filter(m => !m.content.includes('## Conversation Summary (auto-generated'));
        return [{ role: 'assistant', content: summaryNote }, ...cleaned];
      });
      toast.success('Thread summarized', { description: 'Summary note added at top. Long context remains efficient.' });
    } catch (e) {
      toast.error('Could not generate summary right now');
    } finally {
      setLoading(false);
    }
  }, [messages, provider, stack]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === "Escape") {
      if (loading) {
        cancelCurrentRequest();
      } else {
        setInput("");
        setAttachedFiles([]);
      }
    }
  };

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const isImage = /^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|svg|heic|heif|bmp|ico)$/i.test(f.name);

    // For images we accept them (user picked via Photo option) but we don't send raw pixels as text.
    // We attach a lightweight note so the model knows a visual was provided.
    if (isImage) {
      const sizeKB = Math.round(f.size / 1024);
      const note = `[IMAGE ATTACHED: ${f.name} — ${sizeKB} KB photo/screenshot. The user uploaded a visual. Ask for analysis or describe what you need from it.]`;
      const newAttach: AttachedFile = { name: f.name, content: note };
      setAttachedFiles((prev) => [...prev, newAttach]);
      toast.success(`Attached photo: ${f.name}`, { description: "Image noted for context (filename + size). For pixel-level vision, use a vision-capable provider." });
      e.target.value = "";
      return;
    }

    // Documents / code / text files — existing flow
    const allowed = /\.(txt|md|ts|tsx|js|jsx|json|css|html|py|dart|go|rs|yml|yaml|env|sql|prisma|lock|pdf|docx?|xlsx?|csv|toml|xml|zip|tar|gz)$/i;
    if (!allowed.test(f.name) && f.size > 200 * 1024) {
      toast.warning("Large binary skipped", { description: "Prefer source, configs, logs, small PDFs or docs." });
      e.target.value = "";
      return;
    }

    const text = await f.text();
    const newAttach: AttachedFile = { name: f.name, content: text.slice(0, 48000) };

    const attachWarn = scanForSecrets(newAttach.content, `attach:${f.name}`);
    if (attachWarn.length) {
      toast.warning("Caution: file may contain secrets", { description: attachWarn[0] + " — will be wrapped as untrusted data." });
    }

    setAttachedFiles((prev) => [...prev, newAttach]);
    toast.success(`Attached ${f.name}`, { description: "Content will be injected into next prompt for deep context" });
    e.target.value = "";
  };

  // Opens the OS file picker filtered for the chosen category (Photo or Document)
  const openAttachPicker = useCallback((accept: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
    setShowAttachMenu(false);
  }, []);

  const removeAttached = useCallback((name: string) => {
    setAttachedFiles((prev) => prev.filter((a) => a.name !== name));
  }, []);

  const copyToClipboard = useCallback(async (text: string, label = "content") => {
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${label}`);
  }, []);

  const loadFileToWorkspace = useCallback((path: string, content: string, lang: string) => {
    setWorkspaceFiles((prev) => {
      const idx = prev.findIndex((f) => f.path === path);
      const nf = { path, content, lang };
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = nf;
        return copy;
      }
      return [...prev, nf];
    });
    setActiveFilePath(path);
    toast("File in workspace", { description: path });
  }, []);

  const updateActiveFileContent = (newContent: string) => {
    if (!activeFilePath) return;
    setWorkspaceFiles((prev) =>
      prev.map((f) => (f.path === activeFilePath ? { ...f, content: newContent } : f))
    );
  };

  const removeFileFromWorkspace = (path: string) => {
    setWorkspaceFiles((prev) => prev.filter((f) => f.path !== path));
    if (activeFilePath === path) {
      setActiveFilePath(workspaceFiles[0]?.path || null);
    }
  };

  const exportProjectZip = async () => {
    if (!workspaceFiles.length) {
      toast.error("Workspace empty", { description: "Generate or load files first" });
      return;
    }
    const zip = new JSZip();
    const root = zip.folder("aether-project")!;

    workspaceFiles.forEach((file) => {
      root.file(file.path, file.content);
    });

    root.file(
      "AETHER-MANIFEST.md",
      `# Generated by AETHER — ${new Date().toISOString()}\n\nStack: ${stack}\nMode: ${mode}\nDeepThink: ${deepThink}\nProvider: ${provider}\n\nFiles: ${workspaceFiles.length}\n\nThis is a complete, production-intent artifact. Review, test, and ship.\n`
    );

    const blob = await zip.generateAsync({ type: "blob" });
    const name = `aether-${stack}-${Date.now()}.zip`;
    saveAs(blob, name);
    toast.success("Project exported", { description: `${workspaceFiles.length} files • ${name}` });
  };

  const clearWorkspace = () => {
    setWorkspaceFiles([]);
    setActiveFilePath(null);
    setPlanSteps([]);
    localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    toast("Workspace cleared");
  };

  const loadTemplate = (template: string) => {
    setInput(template);
    setMode("plan");
    setStack("universal");
    setDeepThink(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
    toast("Template loaded — Deep Plan mode engaged", { description: "AETHER will produce superior phased architecture first" });
  };

  const refineFile = useCallback((file: WorkspaceFile) => {
    const refinePrompt = `Please review and improve the following file with 2026 best practices, better error handling, security, performance and DX. Keep it complete and copy-paste ready.\n\nFILE: ${file.path}\n\n\`\`\`${file.lang}\n${file.content}\n\`\`\``;
    setInput(refinePrompt);
    setMode("review");
    setTimeout(() => sendMessage(), 30);
  }, [sendMessage]);

  // Old renderRichMessage removed — logic lives in the top-level memoized RichMessage + MemoizedCodeBlock components.
  // This eliminates repeated regex + element creation for every historical message on every parent re-render.

  // Auto-close side panels the first time we detect mobile for a clean phone-first experience
  // (user can still open them via header buttons; drawers will slide in)
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
      setWorkspaceOpen(false);
    }
  }, [isMobile]);

  // Backdrop for mobile drawers (closes both panels on tap outside)
  const MobileDrawerBackdrop = isMobile && (sidebarOpen || workspaceOpen) ? (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
      onClick={() => { setSidebarOpen(false); setWorkspaceOpen(false); }}
    />
  ) : null;

  return (
    <>
      <div className="flex h-dvh lg:h-screen aether-container overflow-hidden text-sm touch-manipulation">
      {MobileDrawerBackdrop}

      {/* CENTER — Chat + Reasoning (full width, single clean top control bar) */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-[#252932]">
        {/* ==================== SINGLE CLEAN TOP NAVIGATION BAR ==================== */}
        {/* All controls (Provider, Mode, Stack, Deep Think) + Templates now live here in one clean modern nav bar */}
        {/* This replaces the old left sidebar completely — chat area is now much larger */}
        <div className="shrink-0 border-b border-[#252932] bg-[#0a0b0f]/95 backdrop-blur-md px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 max-w-[1600px] mx-auto">
            
            {/* Built by attribution — inside the nav bar on the left, same row as Provider controls (stylish & subtle) */}
            <div className="hidden md:flex items-center pr-4 mr-2 border-r border-[#252932] text-[10px] tracking-[0.8px] text-[#5f6674] font-light select-none whitespace-nowrap">
              Built by <span className="ml-1 text-[#b8bdc7] font-medium tracking-[0.4px]">Abdullah Jan</span>
            </div>

            {/* PROVIDER — colorful visible Choice Selection */}
            <MemoizedChoiceSelect
              label="Provider"
              value={provider}
              onChange={(v) => setProvider(v)}
              options={[
                { value: "groq", label: "Groq" },
                { value: "anthropic", label: "Anthropic" },
                { value: "google", label: "Google" },
              ]}
            />

            {/* MODE — colorful visible Choice Selection */}
            <MemoizedChoiceSelect
              label="Mode"
              value={mode}
              onChange={(v) => setMode(v)}
              options={MODES.map(m => ({ value: m.value, label: m.label }))}
            />

            {/* STACK — colorful visible Choice Selection + Deep Think toggle */}
            <div className="flex items-center gap-4">
              <MemoizedChoiceSelect
                label="Stack"
                value={stack}
                onChange={(v) => setStack(v)}
                options={STACKS.map(s => ({ value: s.value, label: s.label }))}
              />

              {/* Deep Think compact toggle (kept as nice switch) */}
              <div onClick={() => setDeepThink(!deepThink)} className="flex items-center gap-2 cursor-pointer select-none text-xs">
                <div className="text-[10px] uppercase tracking-[1.5px] text-[#5f6674] font-medium">Deep Think</div>
                <div className={`relative w-9 h-5 rounded-full transition ${deepThink ? "bg-[#6366f1]" : "bg-[#252932]"}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${deepThink ? "translate-x-[15px]" : ""}`} />
                </div>
              </div>
            </div>

            {/* TEMPLATES — colorful visible Choice Selection (action style) */}
            <MemoizedChoiceSelect
              label="Templates"
              value=""
              onChange={(fullTemplate) => loadTemplate(fullTemplate)}
              options={[
                { value: QUICK_TEMPLATES[0], label: "SaaS Dashboard" },
                { value: QUICK_TEMPLATES[1], label: "Flutter E-com" },
                { value: QUICK_TEMPLATES[2], label: "FastAPI Backend" },
                { value: QUICK_TEMPLATES[3], label: "Go Microservice" },
                { value: QUICK_TEMPLATES[4], label: "Polyglot Stack" },
              ]}
              placeholder="Select template..."
            />

            {/* Right side actions — only instance now (old thin header + duplicate buttons fully removed) */}
            <div className="flex items-center gap-1.5 ml-auto pl-3 border-l border-[#252932]">
              {!isMobile && (
                <button
                  onClick={() => setShowThinking(!showThinking)}
                  className="px-2.5 py-1 rounded-xl bg-[#111318] border border-[#252932] hover:border-[#353a46] text-xs transition active:scale-[0.985]"
                >
                  <Brain size={13} className="inline mr-1" />
                  {showThinking ? "Hide" : "Show"} Thinking
                </button>
              )}
              <button
                onClick={() => setWorkspaceOpen(!workspaceOpen)}
                className="px-2.5 py-1 rounded-xl bg-[#111318] border border-[#252932] hover:border-[#353a46] text-xs transition active:scale-[0.985]"
              >
                <FolderTree size={13} className="inline mr-1" />
                Workspace
              </button>
              {messages.length > 10 && (
                <button
                  onClick={handleSummarizeThread}
                  disabled={loading}
                  className="px-2.5 py-1 rounded-xl bg-[#111318] border border-[#252932] hover:border-[#353a46] text-xs transition active:scale-[0.985] disabled:opacity-50"
                >
                  <Brain size={13} className="inline mr-1" />
                  Summarize
                </button>
              )}
            </div>

          </div>
        </div>
        {/* ==================== END TOP NAV ==================== */}

        {/* The chat viewport now has paint containment + its own stacking context.
            Combined with the portaled dropdowns, clicking anything in the nav bar should no longer
            cause visible blinking/repaint flashes on the golden watermark background.
            We also attach chatScrollerRef here so we can do cheap instant scrollTop=scrollHeight
            during streaming (the only way to kill the "up and down" bounce while tokens arrive). */}
        <div ref={chatScrollerRef} className="flex-1 overflow-y-auto px-5 py-6 bg-[#0a0b0f] relative [contain:paint] [isolation:isolate]">
          {/* ===== GOLDEN WATERMARK (background of chat area) ===== */}
          {/* Heavily optimized:
              - Much smaller font caps (110px was a massive paint/composite cost).
              - Own compositing layer (translateZ + will-change + backface-visibility).
              - content-visibility: auto so the browser can skip work when it's offscreen or during heavy updates.
              - Memoized via a tiny component below so parent re-renders (streaming tokens etc.) don't even consider this subtree.
              This used to be one of the biggest sources of "loading lag / jank" because the giant rotated gradient text was being considered on every state update in the chat tree. */}
          <Watermark />

          {/* All chat content (messages + thinking loader) lives above the watermark.
              overflowAnchor:none tells the browser not to try to "helpfully" keep scroll position anchored
              to some element while the live response is growing — another source of up/down jitter. */}
          <div className="relative z-10 space-y-6" style={{ overflowAnchor: 'none' as any }}>
            {/* Historical messages — these are now 100% stable during a generation.
                They only change when a full turn is committed (after streaming finishes).
                Wrapped in memoized ChatMessage + RichMessage so that input typing, nav toggles, plan checkbox clicks elsewhere,
                or other parent state changes cause almost zero work for past turns. This is critical for perceived smoothness. */}
            {messages.map((msg, idx) => (
              <ChatMessage
                key={idx}
                msg={msg}
                idx={idx}
                showThinking={showThinking}
                planSteps={planSteps}
                onTogglePlanStep={togglePlanStep}
                onCopy={copyToClipboard}
                onToWorkspace={loadFileToWorkspace}
                onRefine={refineFile}
              />
            ))}
          </div> {/* close the historical messages space-y-6 wrapper */}

          {/* LIVE STREAMING BUBBLE — rendered OUTSIDE the historical space-y-6.
              This + the always-present status row + instant (non-smooth) bottom pinning is the final fix for
              "loading ke waqt aik hi jagha up and down ho raha ha".

              Key stabilizations:
              - mt-6 explicit instead of participating in space-y (prevents sibling spacing recalcs on growth).
              - Status row is ALWAYS mounted the moment the live bubble appears (no sudden +height jump when the first tokens arrive).
              - Top text area has min-h so first paint footprint is close to final.
              - The text uses break-words + the panel has min-w-0 for proper flex containment.
              - During streaming the parent effect does direct scrollTop (no smooth animation). */}
          {(loading || streamingContent) && (
            <div className="relative z-10 mt-6">
              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#6366f1] to-[#22d3ee] flex items-center justify-center text-black text-[10px] font-bold shrink-0 mt-0.5">A</div>

                <div className="panel-elev rounded-2xl px-4 py-3.5 max-w-[82%] flex-1 min-w-0">
                  {/* Accumulating response (plain + fast during stream).
                      min-h keeps the box from collapsing on the very first paint and reduces reflow when we switch from "thinking" to real text. */}
                  <div className="min-h-[20px] whitespace-pre-wrap text-[13px] leading-relaxed text-[#c9ccd3] break-words">
                    {streamingContent ? (
                      <>
                        {streamingContent}
                        {/* subtle streaming caret */}
                        <span className="inline-block w-[2px] h-[1.1em] align-[-0.15em] ml-0.5 bg-[#22d3ee] animate-pulse" />
                      </>
                    ) : (
                      "AETHER is thinking…"
                    )}
                  </div>

                  {/* Status row is ALWAYS present while the live bubble exists.
                      This is the #1 layout-shift killer: previously the mt-3 bar appeared after the first tokens,
                      causing the whole bottom area (and thus scroll position) to jump "up and down". */}
                  <div className="mt-3 flex items-center gap-2 text-[#8b919d] text-xs border-t border-white/10 pt-2.5">
                    <div className="flex gap-1">
                      <div className="w-1 h-1 bg-[#6366f1] rounded-full animate-bounce" />
                      <div className="w-1 h-1 bg-[#6366f1] rounded-full animate-bounce" style={{ animationDelay: "120ms" }} />
                      <div className="w-1 h-1 bg-[#6366f1] rounded-full animate-bounce" style={{ animationDelay: "240ms" }} />
                    </div>
                    <span className="flex-1 truncate">{liveStatus}</span>
                    <button
                      onClick={cancelCurrentRequest}
                      className="ml-2 text-[10px] px-2 py-0.5 rounded bg-[#252932] hover:bg-[#ef4444] hover:text-white active:scale-[0.985] transition"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div> {/* chat viewport */}

        {attachedFiles.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {attachedFiles.map((af) => (
              <div key={af.name} className="inline-flex items-center gap-1.5 text-xs bg-[#111318] border border-[#252932] pl-2.5 pr-1 py-1 rounded-full hover:border-[#353a46]">
                📎 {af.name}
                <button onClick={() => removeAttached(af.name)} className="text-[#5f6674] hover:text-[#ef4444] px-1 transition"><X size={13} /></button>
              </div>
            ))}
          </div>
        )}

        {/* ==================== ADVANCED MODERN COMMAND BAR ==================== */}
        {/* 2026 premium AI input — deep layered depth, sophisticated color accents, unified focus glow */}
        <div className="shrink-0 border-t border-[#252932] bg-[#0a0b0f] p-4">
          <div className="flex items-center gap-3 max-w-4xl mx-auto">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleAttach}
            />

            {/* ==================== ADVANCED TECH ATTACH CONTROL ==================== */}
            {/* High-tech squircle control with layered depth, cyan holo ring, active state */}
            <div className="relative" ref={attachMenuRef}>
              <button
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                className={`group relative flex h-[56px] w-12 items-center justify-center rounded-[18px] border transition-all duration-200 active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b0f] shrink-0
                  ${showAttachMenu 
                    ? 'border-[#22d3ee] bg-[#0c0e14] text-[#22d3ee] shadow-[0_0_0_1px_#22d3ee,0_4px_16px_-4px_rgba(34,211,238,0.3)]' 
                    : 'border-[#252932] bg-[#0c0e14] text-[#8b919d] hover:border-[#22d3ee]/50 hover:text-[#22d3ee] hover:shadow-[0_0_0_1px_rgba(34,211,238,0.15)]'}`}
                title="Add file — Photo (images) or Document (any code, text, PDF, logs...)"
                aria-haspopup="menu"
                aria-expanded={showAttachMenu}
              >
                {/* Outer tech ring (subtle always, stronger on hover/active) */}
                <div className="absolute inset-0 rounded-[14px] ring-1 ring-inset ring-white/5 group-hover:ring-[#22d3ee]/20 transition" />
                {/* Inner bevel for premium machined look */}
                <div className="absolute inset-[1.5px] rounded-[11px] border border-white/[0.035] pointer-events-none" />
                <Paperclip size={17} className="relative z-10 transition-transform duration-200 group-hover:-rotate-12" />
              </button>

              {/* Advanced Photo / Doc menu — tech menu style */}
              {showAttachMenu && (
                <div
                  className="absolute bottom-full left-0 mb-2 z-[80] min-w-[182px] overflow-hidden rounded-2xl border border-[#252932] bg-[#0b0d14] shadow-[0_12px_48px_-12px_rgb(0,0,0,0.65)] py-1"
                  role="menu"
                >
                  <button
                    onClick={() => openAttachPicker(PHOTO_ACCEPT)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-white/[0.022] active:bg-white/[0.04] text-[#c9ccd3] hover:text-white transition group"
                    role="menuitem"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#22d3ee]/10 text-[#22d3ee] ring-1 ring-inset ring-[#22d3ee]/20 group-hover:ring-[#22d3ee]/40 transition">
                      <Image size={15} />
                    </div>
                    <div className="leading-tight">
                      <div className="font-medium tracking-[-0.1px]">Photo / Image</div>
                      <div className="text-[10px] text-[#5f6674] -mt-px">All images • PNG, JPG, HEIC, WebP, SVG…</div>
                    </div>
                  </button>

                  <div className="mx-3 my-px h-px bg-white/10" />

                  <button
                    onClick={() => openAttachPicker(DOC_ACCEPT)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-white/[0.022] active:bg-white/[0.04] text-[#c9ccd3] hover:text-white transition group"
                    role="menuitem"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#6366f1]/10 text-[#6366f1] ring-1 ring-inset ring-[#6366f1]/20 group-hover:ring-[#6366f1]/40 transition">
                      <FileText size={15} />
                    </div>
                    <div className="leading-tight">
                      <div className="font-medium tracking-[-0.1px]">Document / Code / File</div>
                      <div className="text-[10px] text-[#5f6674] -mt-px">PDF, MD, JSON, source, logs, archives…</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* ==================== ADVANCED TECH INPUT SHELL ==================== */}
            {/* Command-line style capsule with left tech accent strip + premium multi-layer focus glow.
               Height matched to the attach + SEND buttons for perfect row alignment. */}
            <div className="group/input flex-1">
              {/* Thin gradient border wrapper for high-tech frame */}
              <div className="rounded-[28px] p-[1px] min-h-[56px] bg-gradient-to-r from-[#6366f1]/70 via-[#22d3ee]/50 to-[#6366f1]/70 transition-all duration-200 group-focus-within/input:from-[#8183f3] group-focus-within/input:via-[#67e8f9] group-focus-within/input:to-[#8183f3]">
                <div className="flex items-center rounded-[26px] bg-[#0a0c13] border border-white/[0.035] pl-1 pr-2 py-1.5 transition-all duration-200 group-focus-within/input:border-white/5 group-focus-within/input:shadow-[0_0_0_7px_rgba(99,102,241,0.07),0_0_0_2px_#22d3ee,0_0_0_1px_#6366f1] min-h-[54px]">
                  
                  {/* Left tech accent strip — always visible, glows on focus (very "AI terminal" / modern agent) */}
                  <div className="ml-1.5 mr-1.5 flex h-7 w-[3px] self-center rounded-full bg-gradient-to-b from-[#6366f1] via-[#22d3ee] to-[#6366f1] opacity-70 group-focus-within/input:opacity-100 transition" />

                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe goal, paste error + stack, or ask for a full production Flutter + backend system..."
                    className="flex-1 bg-transparent px-3 py-2.5 min-h-[44px] max-h-40 resize-y text-[14.5px] placeholder:text-[#5f6674] text-[#e6e9f2] focus:outline-none leading-[1.35] tracking-[-0.1px]"
                    rows={1}
                  />
                </div>
              </div>
            </div>

            {/* Ultra-premium SEND — rich multi-stop gradient, strong depth, luxurious hover */}
            <button
              onClick={sendMessage}
              disabled={loading || (!input.trim() && !attachedFiles.length)}
              className="group relative h-[56px] rounded-[22px] px-8 flex items-center gap-2.5 text-sm font-semibold tracking-[0.8px] text-black active:scale-[0.985] transition-all duration-150 disabled:text-[#5f6674] disabled:bg-[#252932] disabled:shadow-none shadow-[0_6px_24px_-6px_rgba(99,102,241,0.5)] overflow-hidden bg-[linear-gradient(135deg,#6366f1_0%,#8183f3_45%,#22d3ee_100%)] hover:bg-[linear-gradient(135deg,#8183f3_0%,#67e8f9_45%,#67e8f9_100%)]"
            >
              {/* delicate top rim light for 3D premium feel */}
              <div className="absolute inset-x-0 top-0 h-px bg-white/40" />
              <Send size={18} className="relative z-10 -ml-0.5 group-enabled:group-hover:-translate-y-[1px] group-enabled:group-hover:translate-x-[1px] transition-transform" />
              <span className="relative z-10 font-semibold">SEND</span>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT — Live Workspace (desktop/tablet only; on phones we open a full modal instead when workspaceOpen) */}
      <div className={`hidden lg:flex ${workspaceOpen ? "w-96" : "w-0"} transition-all duration-200 flex flex-col bg-[#0a0b0f] border-l border-[#252932] overflow-hidden shrink-0`}>
        <div className="h-12 border-b border-[#252932] flex items-center px-4 justify-between shrink-0">
          <div className="font-semibold flex items-center gap-2">
            <FolderTree size={16} /> WORKSPACE
            <span className="text-[10px] text-[#5f6674] font-normal">({workspaceFiles.length})</span>
          </div>
          <div className="flex gap-1">
            <button onClick={exportProjectZip} disabled={!workspaceFiles.length} className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-[#111318] border border-[#252932] hover:border-[#353a46] disabled:opacity-40">
              <Download size={13} /> ZIP
            </button>
            <button onClick={() => setWorkspaceOpen(false)} className="text-[#5f6674] hover:text-white px-1"><X size={15} /></button>
          </div>
        </div>

        <div className="p-2 text-xs border-b border-[#252932] overflow-auto max-h-[140px]">
          {fileTree.length === 0 && (
            <div className="text-[#5f6674] p-3 text-center">No files yet. Ask AETHER to build — files will appear here automatically.</div>
          )}
          {fileTree.map((f) => (
            <div
              key={f.path}
              onClick={() => setActiveFilePath(f.path)}
              className={`file-tree-item flex items-center justify-between gap-2 px-2 py-1.5 rounded cursor-pointer font-mono text-[11px] ${activeFilePath === f.path ? "active" : ""}`}
            >
              <span className="truncate">{f.path}</span>
              <button onClick={(e) => { e.stopPropagation(); removeFileFromWorkspace(f.path); }} className="text-[#5f6674] hover:text-[#ef4444]"><X size={12} /></button>
            </div>
          ))}
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {activeFile ? (
            <>
              <div className="px-3 py-2 text-[10px] border-b border-[#252932] flex items-center justify-between font-mono bg-[#111318]">
                <div className="truncate text-[#22d3ee]">{activeFile.path}</div>
                <div className="flex gap-1">
                  <button onClick={() => copyToClipboard(activeFile.content, "file")} className="px-2 py-0.5 rounded hover:bg-[#1f242d]"><Copy size={13} /></button>
                  <button onClick={() => refineFile(activeFile)} className="px-2 py-0.5 rounded hover:bg-[#1f242d] text-[#f472b6]"><RefreshCw size={13} /></button>
                </div>
              </div>
              <textarea
                value={activeFile.content}
                onChange={(e) => updateActiveFileContent(e.target.value)}
                className="flex-1 bg-[#0d0f14] p-3 font-mono text-[12px] leading-[1.5] resize-none outline-none"
                spellCheck={false}
              />
              <div className="p-2 text-[10px] text-[#5f6674] border-t border-[#252932] flex justify-between">
                <div>Live edit — changes stay in memory until export</div>
                <button onClick={() => loadFileToWorkspace(activeFile.path, activeFile.content, activeFile.lang)} className="text-[#22d3ee]">RE-SYNC</button>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-[#5f6674] text-xs">Select a file from the tree above.<br />Or generate a project — it will populate here with full source.</div>
          )}
        </div>

        {planSteps.length > 0 && (
          <div className="p-3 border-t border-[#252932] text-xs bg-[#111318]">
            <div className="mb-1.5 text-[#6366f1] tracking-wider text-[10px]">PLAN PROGRESS</div>
            <div className="space-y-1 max-h-28 overflow-auto pr-1">
              {planSteps.map((s) => (
                <label key={s.id} className={`flex gap-2 items-start cursor-pointer ${s.completed ? "line-through opacity-60" : ""}`}>
                  <input type="checkbox" checked={s.completed} onChange={() => togglePlanStep(s.id)} className="mt-0.5" />
                  <span>{s.text}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="p-3 border-t border-[#252932] text-[10px] text-center text-[#5f6674]">
          Export the complete runnable project anytime. AETHER produces only production-intent code.
        </div>
      </div>
    </div>

      {/* ========== MOBILE RESPONSIVE OVERLAYS (phones & small tablets) ========== */}
      {/* Slide-out drawer for Command/Sidebar (triggered by hamburger) */}
      {isMobile && sidebarDrawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-[60]"
            onClick={() => setSidebarDrawerOpen(false)}
          />
          <motion.div
            className="fixed inset-y-0 left-0 w-[78%] max-w-[280px] bg-[#0a0b0f] border-r border-[#252932] z-[65] flex flex-col overflow-hidden"
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: "spring", bounce: 0.1 }}
            drag="x"
            dragConstraints={{ left: -200, right: 20 }}
            onDragEnd={(_, info) => { if (info.offset.x < -60) setSidebarDrawerOpen(false); }}
          >
            <div className="h-11 flex items-center justify-between px-3 border-b border-[#252932] shrink-0">
              <div className="text-xs uppercase tracking-widest text-[#5f6674]">Controls</div>
              <button onClick={() => setSidebarDrawerOpen(false)} className="p-2 -mr-1"><X size={18} /></button>
            </div>
            <div className="overflow-auto flex-1 text-sm">
              {/* Compact modern drawer version */}
              <div className="p-3 border-b border-[#252932]">
                <div className="uppercase text-[10px] tracking-[2px] text-[#5f6674] mb-2">PROVIDER</div>
                <div className="flex gap-1.5 flex-wrap">
                  {(["groq","anthropic","google"] as const).map(p => {
                    const active = provider === p;
                    return (
                      <button 
                        key={p} 
                        onClick={() => {setProvider(p); setSidebarDrawerOpen(false);}} 
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition ${active ? "bg-[#6366f1] text-white border-[#6366f1]" : "border-[#252932] text-[#c9ccd3]"}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3">
                <div className="uppercase text-[10px] tracking-[2px] text-[#5f6674] mb-2">MODE</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {MODES.map(m => {
                    const active = mode === m.value;
                    return (
                      <button 
                        key={m.value} 
                        onClick={() => {setMode(m.value); setSidebarDrawerOpen(false);}} 
                        className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left ${active ? "border-[#6366f1] bg-[#111318]" : "border-[#252932]"}`}
                      >
                        <m.icon size={14} /> {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 border-t border-[#252932] text-xs">
                <div className="uppercase tracking-[2px] text-[#5f6674] mb-1.5">STACK</div>
                <select value={stack} onChange={e=>setStack(e.target.value as any)} className="w-full bg-[#111318] border border-[#252932] rounded-xl px-3 py-2">
                  {STACKS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div className="p-3 border-t border-[#252932]">
                <div onClick={() => setDeepThink(!deepThink)} className="flex items-center justify-between cursor-pointer text-xs">
                  <span>Deep Think + Self-Critique</span>
                  <div className={`relative w-9 h-5 rounded-full transition ${deepThink ? "bg-[#6366f1]" : "bg-[#252932]"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${deepThink ? "translate-x-[17px]" : "translate-x-0.5"}`} />
                  </div>
                </div>
              </div>

              {/* Templates section removed from drawer as well for clean sidebar */}
            </div>
          </motion.div>
        </>
      )}

      {/* Mobile Workspace as full accessible modal / sheet (when workspaceOpen on phones) */}
      {isMobile && workspaceOpen && (
        <div className="fixed inset-0 z-[70] bg-[#0a0b0f] flex flex-col" role="dialog" aria-modal="true">
          <div className="h-12 border-b flex items-center px-3 gap-2 shrink-0">
            <div className="font-semibold flex-1 text-sm truncate">WORKSPACE {activeFile ? `• ${activeFile.path.split('/').pop()}` : ''}</div>
            <div className="flex gap-1 text-xs">
              {activeFile && <button onClick={() => copyToClipboard(activeFile.content,'file')} className="px-3 py-1 border border-[#252932] rounded">Copy</button>}
              {activeFile && <button onClick={() => refineFile(activeFile)} className="px-3 py-1 border border-[#252932] rounded text-[#f472b6]">Refine</button>}
              <button onClick={() => setWorkspaceOpen(false)} className="px-4 py-1 bg-[#252932] rounded text-white">Done</button>
            </div>
          </div>

          <div className="p-2 border-b overflow-x-auto text-xs whitespace-nowrap">
            {fileTree.length === 0 && <span className="px-2 text-[#5f6674]">No files yet</span>}
            {fileTree.map(f => (
              <button key={f.path} onClick={() => setActiveFilePath(f.path)} className={`mr-1 px-2 py-1 rounded border ${activeFilePath===f.path ? 'bg-[#6366f1] border-[#6366f1] text-white' : 'border-[#252932]'}`}>
                {f.path.split('/').pop()}
              </button>
            ))}
          </div>

          <div className="flex-1 p-2 overflow-auto">
            {activeFile ? (
              <textarea value={activeFile.content} onChange={e => updateActiveFileContent(e.target.value)} className="w-full h-full bg-[#0d0f14] font-mono text-[12.5px] p-3 border border-[#252932] rounded resize-none" spellCheck={false} />
            ) : <div className="text-center text-[#5f6674] pt-8 text-sm">Select a file above or generate a project with AETHER.</div>}
          </div>

          <div className="p-3 border-t flex gap-2">
            <button onClick={exportProjectZip} disabled={!workspaceFiles.length} className="flex-1 py-2.5 rounded-2xl bg-[#111318] border border-[#252932] text-sm">Export ZIP ({workspaceSizeMB.toFixed(1)} MB)</button>
            <button onClick={clearWorkspace} className="px-5 py-2.5 rounded-2xl border border-[#ef4444] text-[#ef4444] text-sm">Clear</button>
          </div>

          {planSteps.length > 0 && (
            <div className="px-3 pb-3 text-xs border-t bg-[#111318] max-h-[110px] overflow-auto">
              {planSteps.map(s => <label key={s.id} className={`flex gap-1.5 py-0.5 ${s.completed?'line-through opacity-60':''}`}><input type="checkbox" checked={s.completed} onChange={()=>togglePlanStep(s.id)} />{s.text}</label>)}
            </div>
          )}
        </div>
      )}
  </>
  );
}
