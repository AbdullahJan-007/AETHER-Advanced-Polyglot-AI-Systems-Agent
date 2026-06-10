"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "# Welcome to Your Personal Full Stack AI Agent\n\nI am your senior full stack architect. I build **production-ready, industrial-grade** applications.\n\n**I can help you with:**\n- Complete Next.js + TypeScript projects\n- Backend APIs + Database schemas\n- Authentication + Payment integration\n- UI/UX with shadcn/ui + Tailwind\n- Debugging + Code review\n\nDescribe your project and I will give you complete, copy-paste ready code.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatMessage = (content: string) => {
    const lines = content.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-bold text-white mt-4 mb-2">{line.replace("# ", "")}</h1>;
      if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-bold text-blue-400 mt-3 mb-1">{line.replace("## ", "")}</h2>;
      if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-semibold text-blue-300 mt-2 mb-1">{line.replace("### ", "")}</h3>;
      if (line.startsWith("**FILE:")) return <div key={i} className="bg-gray-900 border border-blue-500 text-blue-400 px-3 py-1 rounded mt-3 mb-1 font-mono text-sm font-bold">{line.replace(/\*\*/g, "")}</div>;
      if (line.startsWith("```")) return <div key={i} className="bg-gray-950 text-green-400 font-mono text-xs px-2 py-0.5 rounded">{line}</div>;
      if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="text-gray-300 ml-4 list-disc">{line.replace(/^[-*] /, "")}</li>;
      if (line.match(/^\d+\./)) return <li key={i} className="text-gray-300 ml-4 list-decimal">{line.replace(/^\d+\. /, "")}</li>;
      if (line === "") return <br key={i} />;
      const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
      return <p key={i} className="text-gray-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: bold }} />;
    });
  };

  const sendMessage = async () => {
    if ((!input.trim() && !file) || loading) return;
    let userContent = input;
    if (file) userContent += `\n\n[Attached file: ${file.name}]`;
    const userMessage: Message = { role: "user", content: userContent };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setFile(null);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });
      const data = await res.json();
      setMessages([...updatedMessages, { role: "assistant", content: data.message }]);
    } catch {
      setMessages([...updatedMessages, { role: "assistant", content: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">

      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-64" : "w-0"} transition-all duration-300 bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden shrink-0`}>
        <div className="p-5 border-b border-gray-800 shrink-0">
          <h1 className="text-lg font-bold text-white">Built by Abdullah Jan</h1>
          <p className="text-xs text-gray-500 mt-1">Full Stack AI Agent</p>
        </div>
        <div className="p-4 space-y-1">
          {["New Chat", "My Projects", "Code Snippets", "Documentation"].map((item) => (
            <button key={item} className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            >
              ☰
            </button>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="font-semibold text-sm">AI Agent</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0 mt-1">AI</div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-5 py-4 ${msg.role === "user" ? "bg-blue-600 text-white rounded-br-sm" : "bg-gray-900 border border-gray-800 rounded-bl-sm"}`}>
                {msg.role === "assistant" ? (
                  <div className="space-y-1 text-sm">{formatMessage(msg.content)}</div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center text-xs font-bold shrink-0 mt-1">Me</div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">AI</div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl rounded-bl-sm px-5 py-4">
                <div className="flex gap-1 items-center">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  <span className="text-gray-500 text-xs ml-2">Generating code...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* File Preview */}
        {file && (
          <div className="px-6 py-2 shrink-0">
            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 w-fit">
              <span className="text-xs text-blue-400">📎 {file.name}</span>
              <button onClick={() => setFile(null)} className="text-gray-500 hover:text-red-400 text-xs">✕</button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-900 shrink-0">
          <div className="flex gap-3 items-end max-w-5xl mx-auto">
            <input
              type="file"
              ref={fileRef}
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              accept=".txt,.md,.ts,.tsx,.js,.jsx,.json,.css,.html,.py,.png,.jpg,.jpeg"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="p-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-400 hover:text-white transition-colors shrink-0"
              title="Attach file or image"
            >
              📎
            </button>
            <textarea
              className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3 text-sm resize-none outline-none border border-gray-700 focus:border-blue-500 transition-colors min-h-12 max-h-40"
              placeholder="Describe your project, ask for code, or paste an error..."
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || (!input.trim() && !file)}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors shrink-0"
            >
              Send
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}