import React, { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { askStudyHelper } from "@/lib/ai-helper.functions";

const SUGGESTIONS = [
  "Summarize this chapter simply",
  "Give me 3 practice questions",
  "Explain this like I'm a beginner",
];

export default function NotesAiHelper({ subject }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy, open]);

  const send = async (raw) => {
    const question = (raw ?? input).trim();
    if (!question || busy) return;
    const next = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setError("");
    setBusy(true);
    try {
      const res = await askStudyHelper({ data: { messages: next, subject: subject || null } });
      const text = (res?.text || "").trim();
      setMessages([
        ...next,
        { role: "assistant", content: text || "I couldn't come up with an answer. Try asking in another way." },
      ]);
    } catch (e) {
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open study helper"
          className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg shadow-blue-500/30 transition active:scale-95"
          style={{ background: "linear-gradient(135deg, #0EA5E9, #2563EB)" }}
        >
          <Sparkles size={24} />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
          <div className="flex h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:h-[70vh] sm:rounded-3xl">
            <div
              className="flex items-center gap-3 px-4 py-3.5 text-white"
              style={{ background: "linear-gradient(135deg, #0EA5E9, #2563EB)" }}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                <Sparkles size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">Study helper</div>
                <div className="truncate text-[11px] text-white/80">
                  {subject ? `Helping with ${subject}` : "Ask anything about your notes"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close study helper"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20"
              >
                <X size={16} />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
              {messages.length === 0 && (
                <div>
                  <p className="text-sm text-slate-500">
                    Hi! Ask me to explain a topic, summarize a note, or quiz you.
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-slate-700"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-blue-600 px-3.5 py-2.5 text-sm text-white"
                        : "max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800"
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 size={16} className="animate-spin" /> Thinking…
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600">
                  {error}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your question…"
                className="min-w-0 flex-1 rounded-full bg-slate-100 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #0EA5E9, #2563EB)" }}
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
