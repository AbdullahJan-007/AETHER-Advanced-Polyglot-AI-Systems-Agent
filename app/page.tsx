"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Paperclip, Brain, Bug, FolderTree, Download, Copy, RefreshCw, X, Play, Settings, Zap, AlertTriangle, Menu } from "lucide-react";
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

export default function AetherAgent() {
  // Core chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "# Welcome to AETHER\n\nI am a hyper-intelligent 2026 polyglot systems architect.\n\nI use elite first-principles reasoning, produce complete production-grade vertical slices, and always select the most advanced correct tools for the job.\n\n**Supported at expert level:**\n- Next.js 16 / React 19 full-stack (RSC, Server Actions, streaming)\n- Flutter + Riverpod + go_router + modern persistence\n- FastAPI / Go / Rust industrial backends\n- Complete projects with tests, Docker, CI, observability, security\n\nChoose a mode, lock a stack (or leave Universal), enable Deep Think for reflection, then describe your goal or paste errors/logs.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null); // for cancel + reliability

  // Responsive / device adaptive state (makes view auto-adjust for phones, tablets, desktops, large screens)
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false); // mobile only slide-out for command pane
  // workspaceOpen is reused: on mobile it triggers the workspace bottom-sheet/full modal instead of side pane

  useEffect(() => {
    const update = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

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

  // Auto scroll chat
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

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

        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

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
                  setMessages((prev) => {
                    const copy = [...prev];
                    const last = copy[copy.length - 1];
                    if (last && last.role === "assistant") {
                      last.content = assistantContent;
                    }
                    return copy;
                  });
                }
              } catch (e: any) {
                if (e.message) throw e;
              }
            }
          }
        }
      } else {
        const data = await res.json();
        assistantContent = data.message || "No response";
        setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);
      }

      const parsed = parseAssistantResponse(assistantContent);

      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          last.content = parsed.clean || assistantContent;
          if (parsed.thinking) last.thinking = parsed.thinking;
          if (parsed.plan) last.plan = parsed.plan;
        }
        return copy;
      });

      if (parsed.files.length) {
        mergeNewFiles(parsed.files);
      }
      if (parsed.plan) {
        applyPlanText(parsed.plan);
      }
    } catch (e: any) {
      const errorMsg = e?.message || "Unknown engine error";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `**Engine error**\n\n${errorMsg}\n\nTip: Check .env keys, try switching provider, or reduce attached file size.`,
        },
      ]);
      toast.error("AETHER encountered an issue", { description: errorMsg });
    } finally {
      setLoading(false);
      setAttachedFiles([]);
      abortControllerRef.current = null;
    }
  }, [input, attachedFiles, loading, messages, provider, mode, stack, deepThink]);

  const cancelCurrentRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
      toast.info("Generation cancelled by user");
    }
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

    const allowed = /\.(txt|md|ts|tsx|js|jsx|json|css|html|py|dart|go|rs|yml|yaml|env|sql|prisma|lock)$/i;
    if (!allowed.test(f.name) && f.size > 180 * 1024) {
      toast.warning("Large binary or image skipped", { description: "Attach source, logs, or small configs for best results" });
      e.target.value = "";
      return;
    }

    const text = await f.text();
    const newAttach: AttachedFile = { name: f.name, content: text.slice(0, 48000) };

    // Immediate client-side secret warning before it even gets sent
    const attachWarn = scanForSecrets(newAttach.content, `attach:${f.name}`);
    if (attachWarn.length) {
      toast.warning("Caution: file may contain secrets", { description: attachWarn[0] + " — will be wrapped as untrusted data." });
    }

    setAttachedFiles((prev) => [...prev, newAttach]);
    toast.success(`Attached ${f.name}`, { description: "Content will be injected into next prompt for deep context" });
    e.target.value = "";
  };

  const removeAttached = (name: string) => {
    setAttachedFiles((prev) => prev.filter((a) => a.name !== name));
  };

  const copyToClipboard = async (text: string, label = "content") => {
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${label}`);
  };

  const loadFileToWorkspace = (path: string, content: string, lang: string) => {
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
  };

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

  const refineFile = (file: WorkspaceFile) => {
    const refinePrompt = `Please review and improve the following file with 2026 best practices, better error handling, security, performance and DX. Keep it complete and copy-paste ready.\n\nFILE: ${file.path}\n\n\`\`\`${file.lang}\n${file.content}\n\`\`\``;
    setInput(refinePrompt);
    setMode("review");
    setTimeout(() => sendMessage(), 30);
  };

  const renderRichMessage = (msg: Message) => {
    const content = msg.content;
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
        <div key={key++} className="my-3 rounded-xl overflow-hidden border border-[#252932] bg-[#0d0f14]">
          <div className="code-header flex items-center justify-between px-3 py-1.5 text-[#8b919d]">
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.5px]">
              {filePath || lang}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => copyToClipboard(code, "code")}
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 hover:bg-[#1f242d] transition text-[10px]"
              >
                <Copy size={12} /> COPY
              </button>
              {filePath && (
                <button
                  onClick={() => loadFileToWorkspace(filePath, code, lang)}
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 hover:bg-[#1f242d] transition text-[10px] text-[#22d3ee]"
                >
                  <FolderTree size={12} /> TO WORKSPACE
                </button>
              )}
              {filePath && (
                <button
                  onClick={() => refineFile({ path: filePath, content: code, lang })}
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
      last = m.index + m[0].length;
    }
    if (last < content.length) {
      parts.push(<div key={key++} className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#c9ccd3]">{content.slice(last)}</div>);
    }
    return <div className="space-y-1 text-[13px]">{parts}</div>;
  };

  const currentConfigLabel = `${provider.toUpperCase()} • ${stack} • ${mode}${deepThink ? " • DEEP" : ""}`;

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

      {/* LEFT — Command & Context (desktop column | mobile slide-in drawer) */}
      <div
        className={`
          ${isMobile 
            ? `fixed inset-y-0 left-0 z-50 w-[86%] max-w-[320px] border-r border-[#252932] bg-[#0a0b0f] flex flex-col overflow-hidden shadow-2xl
               transition-transform duration-200 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
            : `${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-200 border-r border-[#252932] bg-[#0a0b0f] flex flex-col overflow-hidden shrink-0`
          }
        `}
      >
        <div className="p-4 border-b border-[#252932] flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-gradient-to-br from-[#6366f1] to-[#22d3ee] flex items-center justify-center text-[10px] font-bold tracking-[1px] text-black">AE</div>
            <div>
              <div className="font-semibold tracking-[-0.2px]">AETHER</div>
              <div className="text-[10px] text-[#5f6674] -mt-0.5">2026 Systems Architect</div>
            </div>
          </div>
          <div className="ml-auto text-[10px] px-2 py-px rounded bg-[#111318] border border-[#252932] text-[#8b919d]">v2</div>
        </div>

        <div className="p-4 space-y-4 border-b border-[#252932]">
          <div>
            <div className="uppercase text-[10px] tracking-[1px] text-[#5f6674] mb-1.5 flex items-center gap-1.5">
              <Settings size={13} /> PROVIDER + MODEL
            </div>
            <div className="flex gap-1 flex-wrap">
              {(["groq", "anthropic", "google"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`badge px-3 py-1 text-xs transition ${provider === p ? "badge-accent" : "hover:border-[#353a46]"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="uppercase text-[10px] tracking-[1px] text-[#5f6674] mb-1.5">MODE (changes reasoning)</div>
            <div className="grid grid-cols-2 gap-1">
              {MODES.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${mode === m.value ? "border-[#6366f1] bg-[#111318]" : "border-[#252932] hover:bg-[#111318]"}`}
                  >
                    <Icon size={15} className="shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-xs">{m.label}</div>
                      <div className="text-[#5f6674] text-[10px] leading-none mt-px truncate">{m.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="uppercase text-[10px] tracking-[1px] text-[#5f6674] mb-1.5">STACK — ADVANCED TECH ONLY</div>
            <select
              value={stack}
              onChange={(e) => setStack(e.target.value as Stack)}
              className="w-full bg-[#111318] border border-[#252932] rounded-lg px-3 py-2 text-sm focus:border-[#6366f1] outline-none"
            >
              {STACKS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <div className="text-[10px] text-[#5f6674] mt-1 pl-1">{STACKS.find((s) => s.value === stack)?.hint}</div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={deepThink}
              onChange={(e) => setDeepThink(e.target.checked)}
              className="accent-[#6366f1] scale-110"
            />
            <div>
              <span className="font-medium">Deep Think + Self-Critique</span>
              <div className="text-[#5f6674] text-xs leading-none">Second-pass reflection. Slower. Dramatically better.</div>
            </div>
          </label>
        </div>

        <div className="p-4 flex-1 overflow-auto space-y-2">
          <div className="uppercase text-[10px] tracking-[1px] text-[#5f6674] mb-1">SMART START TEMPLATES</div>
          {QUICK_TEMPLATES.map((t, i) => (
            <button
              key={i}
              onClick={() => loadTemplate(t)}
              className="w-full text-left text-xs p-2.5 rounded-lg border border-[#252932] hover:border-[#353a46] hover:bg-[#111318] transition line-clamp-2"
            >
              {t}
            </button>
          ))}

          <div className="pt-3">
            <button onClick={clearWorkspace} className="text-xs flex items-center gap-1.5 text-[#ef4444] hover:text-red-400">
              <X size={13} /> Clear entire workspace &amp; plan
            </button>
          </div>
        </div>

        <div className="p-3 text-[10px] text-[#5f6674] border-t border-[#252932]">Built for production. Think deeper. Ship faster.</div>
      </div>

      {/* CENTER — Chat + Reasoning */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-[#252932]">
        <div className="h-12 shrink-0 border-b border-[#252932] bg-[#0a0b0f] flex items-center px-4 gap-3 justify-between">
          <div className="flex items-center gap-2">
            {/* Prominent hamburger for mobile - opens slide-out command drawer */}
            {isMobile && (
              <button
                onClick={() => setSidebarDrawerOpen(true)}
                className="p-2 -ml-1 rounded-lg hover:bg-[#111318] text-[#8b919d] active:bg-[#252932] min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Open controls drawer"
              >
                <Menu size={19} />
              </button>
            )}
            {!isMobile && (
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded hover:bg-[#111318] text-[#8b919d]">
                <Settings size={16} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              <div className="font-semibold tracking-[-0.1px] text-sm md:text-base">AETHER</div>
              <div className="badge text-[#22d3ee] border-[#22d3ee]/30 hidden sm:inline text-[9px] md:text-[10px]">{currentConfigLabel}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            {!isMobile && (
              <button onClick={() => setShowThinking(!showThinking)} className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#111318] border border-[#252932] hover:border-[#353a46]">
                <Brain size={13} /> {showThinking ? "Hide" : "Show"} Thinking
              </button>
            )}
            <button
              onClick={() => setWorkspaceOpen(!workspaceOpen)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#111318] border border-[#252932] hover:border-[#353a46] min-h-[36px]"
            >
              <FolderTree size={13} /> <span className="hidden sm:inline">Workspace</span>
              {workspaceSizeMB > 0.1 && <span className="text-[10px] text-[#5f6674] hidden md:inline">({workspaceSizeMB.toFixed(1)})</span>}
            </button>

            {/* Summarize long threads - layered enhancement for efficiency */}
            {messages.length > 10 && (
              <button
                onClick={handleSummarizeThread}
                disabled={loading}
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#111318] border border-[#252932] hover:border-[#353a46] disabled:opacity-50 min-h-[36px]"
                title="Generate concise running summary (keeps long context lean)"
              >
                <Brain size={13} /> <span className="hidden md:inline">Summarize</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 bg-[#0a0b0f]">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 mt-0.5 rounded-md bg-gradient-to-br from-[#6366f1] to-[#22d3ee] text-[10px] font-bold flex items-center justify-center text-black shrink-0">A</div>
              )}

              <div className={`max-w-[82%] rounded-2xl px-4 py-3.5 text-[13px] ${msg.role === "user" ? "message-user rounded-br-md" : "message-assistant rounded-bl-md"}`}>
                {msg.role === "assistant" ? (
                  <>
                    {renderRichMessage(msg)}

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
                                <input type="checkbox" checked={step.completed} onChange={() => togglePlanStep(step.id)} className="mt-0.5 accent-[#6366f1]" />
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
          ))}

          <AnimatePresence>
            {loading && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 items-center">
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#6366f1] to-[#22d3ee] flex items-center justify-center text-black text-[10px] font-bold shrink-0 mt-0.5">A</div>
                <div className="panel-elev rounded-2xl px-4 py-3.5 max-w-[70%] flex-1">
                  <div className="flex items-center gap-2 text-[#8b919d] text-xs">
                    <div className="flex gap-1">
                      <div className="w-1 h-1 bg-[#6366f1] rounded-full animate-bounce" />
                      <div className="w-1 h-1 bg-[#6366f1] rounded-full animate-bounce" style={{ animationDelay: "120ms" }} />
                      <div className="w-1 h-1 bg-[#6366f1] rounded-full animate-bounce" style={{ animationDelay: "240ms" }} />
                    </div>
                    <span className="flex-1">
                      AETHER is reasoning — {mode === "plan" ? "architecting phases" : mode === "debug" ? "isolating root cause" : deepThink ? "deep critique pass" : "generating production artifacts"}
                    </span>
                    <button
                      onClick={cancelCurrentRequest}
                      className="ml-3 text-[10px] px-2 py-0.5 rounded bg-[#252932] hover:bg-[#ef4444] hover:text-white transition"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>

        {attachedFiles.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {attachedFiles.map((af) => (
              <div key={af.name} className="inline-flex items-center gap-1.5 text-xs bg-[#111318] border border-[#252932] pl-2.5 pr-1 py-1 rounded-full">
                📎 {af.name}
                <button onClick={() => removeAttached(af.name)} className="text-[#5f6674] hover:text-[#ef4444] px-1"><X size={13} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="shrink-0 border-t border-[#252932] bg-[#0a0b0f] p-4">
          <div className="flex gap-2 items-end max-w-4xl">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleAttach}
              accept=".txt,.md,.ts,.tsx,.js,.jsx,.json,.css,.html,.py,.dart,.go,.rs,.yml,.yaml,.prisma,.sql,.env*"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-2xl bg-[#111318] border border-[#252932] hover:border-[#353a46] text-[#8b919d] hover:text-white transition shrink-0"
              title="Attach source, logs, schemas, pubspec, etc. (actual content sent for context)"
            >
              <Paperclip size={17} />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe goal, paste error + stack, or ask for a full production Flutter + backend system..."
              className="input-modern flex-1 rounded-2xl px-4 py-3.5 min-h-[52px] max-h-40 resize-y text-[13.5px] placeholder:text-[#5f6674]"
              rows={1}
            />

            <button
              onClick={sendMessage}
              disabled={loading || (!input.trim() && !attachedFiles.length)}
              className="bg-[#6366f1] hover:bg-[#5558e0] disabled:bg-[#252932] disabled:text-[#5f6674] transition text-white px-6 h-[52px] rounded-2xl flex items-center gap-2 text-sm font-medium shrink-0 active:scale-[0.985]"
            >
              <Send size={16} /> SEND
            </button>
          </div>
          <div className="text-[10px] text-[#5f6674] pl-1 mt-1.5 flex gap-3">
            <span>Shift+Enter for newline</span>
            <span>•</span>
            <span>Deep Think + plan mode = best long-term results</span>
            <span>•</span>
            <span>Attach real files for god-tier bug fixing</span>
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
              {/* Re-render compact version of command content for the drawer */}
              <div className="p-3 border-b border-[#252932]">
                <div className="uppercase text-[10px] tracking-[1px] text-[#5f6674] mb-1.5">PROVIDER</div>
                <div className="flex gap-1 flex-wrap">
                  {(["groq","anthropic","google"] as const).map(p => (
                    <button key={p} onClick={() => {setProvider(p); setSidebarDrawerOpen(false);}} className={`badge px-2.5 py-0.5 text-xs ${provider===p ? 'badge-accent':''}`}>{p}</button>
                  ))}
                </div>
              </div>
              <div className="p-3">
                <div className="uppercase text-[10px] tracking-[1px] text-[#5f6674] mb-1">MODE</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {MODES.map(m => (
                    <button key={m.value} onClick={() => {setMode(m.value); setSidebarDrawerOpen(false);}} className={`flex gap-1.5 items-center rounded border px-2 py-1.5 ${mode===m.value ? 'border-[#6366f1] bg-[#111318]' : 'border-[#252932]'}`}>
                      <m.icon size={14} /> {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-3 border-t border-[#252932] text-xs">
                <div className="uppercase tracking-widest text-[#5f6674] mb-1">STACK</div>
                <select value={stack} onChange={e=>setStack(e.target.value as any)} className="w-full bg-[#111318] border border-[#252932] rounded px-2 py-1">
                  {STACKS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="p-3 border-t border-[#252932]">
                <label className="flex gap-2 items-center text-xs">
                  <input type="checkbox" checked={deepThink} onChange={e=>setDeepThink(e.target.checked)} className="accent-[#6366f1]" />
                  Deep Think (better but slower)
                </label>
              </div>
              <div className="p-3 text-xs border-t border-[#252932]">
                <div className="uppercase text-[#5f6674] mb-1">TEMPLATES</div>
                {QUICK_TEMPLATES.slice(0,3).map((t,i) => (
                  <button key={i} onClick={() => {loadTemplate(t); setSidebarDrawerOpen(false);}} className="block w-full text-left py-1 text-[#8b919d] hover:text-white truncate">{t}</button>
                ))}
                <button onClick={clearWorkspace} className="mt-2 text-[#ef4444] text-xs">Clear workspace</button>
              </div>
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
