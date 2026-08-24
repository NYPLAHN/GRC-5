"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Loader2, Bot, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "What are our critical open risks?",
  "Which controls have the lowest maturity?",
  "What remediations are overdue?",
  "Which policies need review?",
];

export default function GrcAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notConfigured, setNotConfigured] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setError("");
    setInput("");
    const nextMessages: Message[] = [...messages, { role: "user", content: q }];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.slice(-12) }),
      });
      const data = await res.json();
      if (data.notConfigured) {
        setNotConfigured(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "The assistant hit an error.");
      setMessages((prev) => [...prev, { role: "assistant", content: data.data.reply }]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Ask the GRC assistant"
        className="flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden text-xs font-semibold sm:inline">Ask</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white dark:bg-gray-900 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b dark:border-gray-800 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950">
                  <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">GRC Assistant</p>
                  <p className="text-[10px] text-gray-400">Answers from your live program data</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="h-5 w-5 dark:text-gray-400" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
              {notConfigured ? (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                    <KeyRound className="h-4 w-4" /> One-time setup needed
                  </p>
                  <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                    Add an Anthropic API key to your <code className="rounded bg-amber-100 dark:bg-amber-900 px-1">.env</code> file:
                  </p>
                  <pre className="mt-2 rounded-lg bg-amber-100 dark:bg-amber-900/60 p-2 text-[11px] text-amber-900 dark:text-amber-200">ANTHROPIC_API_KEY=sk-ant-...</pre>
                  <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-500">
                    Then restart the dev server. Keys come from console.anthropic.com — use an org-approved account.
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ask anything about your controls, risks, remediations, policies, or assessment results.
                  </p>
                  <div className="flex flex-col gap-2">
                    {STARTERS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="rounded-xl border dark:border-gray-700 px-3.5 py-2.5 text-left text-xs text-gray-600 dark:text-gray-300 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                        m.role === "user"
                          ? "bg-indigo-600 text-white rounded-br-md"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md"
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-gray-100 dark:bg-gray-800 px-3.5 py-2.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                    <span className="text-xs text-gray-400">Checking the data...</span>
                  </div>
                </div>
              )}
              {error && (
                <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>

            {/* Input */}
            <div className="border-t dark:border-gray-800 p-4">
              <form
                onSubmit={(e) => { e.preventDefault(); send(input); }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  className="flex-1 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={notConfigured ? "Configure the API key first..." : "Ask about your GRC program..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading || notConfigured}
                />
                <button
                  type="submit"
                  disabled={loading || notConfigured || !input.trim()}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <p className="mt-2 text-center text-[10px] text-gray-400 dark:text-gray-500">
                AI-generated from your platform data — verify important answers against the source pages.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
