import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Globe, Lock, Users, RefreshCw, PlusCircle, Radio, X, Check, XCircle, CheckCircle2, Trash2, User, Search, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const GREEN = "#20BF6F";
const QUESTION_SECONDS = 20;
const REVEAL_SECONDS = 5;
const AVATAR_COLORS = ["#20BF6F", "#3B82F6", "#F97316", "#A855F7", "#EF4444", "#14B8A6", "#EAB308", "#EC4899"];

function rid(n = 6) {
  return Math.random().toString(36).slice(2, 2 + n).toUpperCase();
}
function colorFor(id = "") {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function subjectName(s) {
  return s?.name || s?.title || s?.label || "";
}
function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function Avatar({ id, name, size = 44 }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, background: colorFor(id), fontSize: size * 0.4 }}>
      {(name || "?").trim().charAt(0).toUpperCase() || <User size={size * 0.5} />}
    </span>
  );
}

function TopBar({ title, onBack, right, icon = "back" }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-4 bg-white px-4 py-4">
      <button onClick={onBack} aria-label="Back" className="text-slate-900">
        {icon === "close" ? <X size={24} /> : <ArrowLeft size={24} />}
      </button>
      <h1 className="flex-1 text-xl font-extrabold text-slate-900">{title}</h1>
      {right}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-semibold text-white shadow-md disabled:opacity-50" style={{ background: GREEN, boxShadow: "0 4px 0 #168a50" }}>
      {children}
    </button>
  );
}

/* ---------------- Lobby directory (presence) ---------------- */
function useLobbyDirectory(enabled) {
  const [lobbies, setLobbies] = useState([]);
  const chanRef = useRef(null);
  useEffect(() => {
    if (!enabled) return;
    const ch = supabase.channel("btr-mp-lobbies", { config: { presence: { key: rid(10) } } });
    chanRef.current = ch;
    const sync = () => {
      const st = ch.presenceState();
      const list = [];
      Object.values(st).forEach((arr) => arr.forEach((p) => p.lobbyId && list.push(p)));
      const map = {};
      list.forEach((l) => (map[l.lobbyId] = l));
      setLobbies(Object.values(map));
    };
    ch.on("presence", { event: "sync" }, sync).subscribe();
    return () => {
      supabase.removeChannel(ch);
      chanRef.current = null;
    };
  }, [enabled]);
  return { lobbies, channel: chanRef };
}

/* ---------------- Game engine ---------------- */
function useGame({ lobbyId, me, isHost, config, questions, announce }) {
  const [players, setPlayers] = useState([]);
  const [state, setState] = useState({ phase: "lobby" });
  const chRef = useRef(null);
  const hostRef = useRef({ answers: {}, scores: {}, index: -1, questions: questions || [] });
  const stateRef = useRef(state);
  stateRef.current = state;

  const broadcast = (s) => {
    setState(s);
    chRef.current?.send({ type: "broadcast", event: "state", payload: s });
  };

  useEffect(() => {
    const ch = supabase.channel(`btr-mp-game-${lobbyId}`, { config: { presence: { key: me.id }, broadcast: { self: false } } });
    chRef.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState();
      const list = Object.values(st).map((arr) => arr[0]).filter(Boolean);
      list.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
      setPlayers(list);
    });
    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      if (!isHost) setState(payload);
    });
    ch.on("broadcast", { event: "sync-request" }, () => {
      if (isHost) ch.send({ type: "broadcast", event: "state", payload: stateRef.current });
    });
    ch.on("broadcast", { event: "answer" }, ({ payload }) => {
      if (isHost) receiveAnswer(payload);
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ id: me.id, name: me.name, host: isHost, joinedAt: Date.now() });
        if (!isHost) ch.send({ type: "broadcast", event: "sync-request", payload: {} });
        else broadcast({ phase: "lobby", config });
      }
    });
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId]);

  // Host: keep the public directory entry fresh
  useEffect(() => {
    if (!isHost || !announce) return;
    announce({ ...config, lobbyId, count: players.length, status: state.phase });
  }, [isHost, players.length, state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function receiveAnswer({ pid, name, choice, at }) {
    const s = stateRef.current;
    if (s.phase !== "question") return;
    hostRef.current.answers[pid] = { choice, at, name };
    const answered = Object.keys(hostRef.current.answers);
    broadcast({ ...s, answered, lastAnswered: name });
  }

  function askQuestion(i) {
    const h = hostRef.current;
    const q = h.questions[i];
    h.index = i;
    h.answers = {};
    h.startedAt = Date.now();
    broadcast({
      phase: "question",
      config,
      index: i,
      total: h.questions.length,
      question: { text: q.question, options: q.options },
      endsAt: Date.now() + QUESTION_SECONDS * 1000,
      answered: [],
      lastAnswered: null,
      scores: h.scores,
    });
  }

  function reveal() {
    const h = hostRef.current;
    const q = h.questions[h.index];
    const gained = {};
    Object.entries(h.answers).forEach(([pid, a]) => {
      if (a.choice === q.correct) {
        const left = Math.max(0, h.startedAt + QUESTION_SECONDS * 1000 - a.at) / 1000;
        gained[pid] = 10 + Math.round((left / QUESTION_SECONDS) * 10);
        h.scores[pid] = (h.scores[pid] || 0) + gained[pid];
      }
    });
    const results = {};
    Object.entries(h.answers).forEach(([pid, a]) => (results[pid] = a.choice === q.correct));
    broadcast({
      phase: "reveal",
      config,
      index: h.index,
      total: h.questions.length,
      correctText: q.options[q.correct],
      explanation: q.explanation || "",
      scores: { ...h.scores },
      gained,
      results,
      endsAt: Date.now() + REVEAL_SECONDS * 1000,
    });
  }

  // Host timer loop
  useEffect(() => {
    if (!isHost) return;
    if (state.phase !== "question" && state.phase !== "reveal") return;
    const tick = setInterval(() => {
      const s = stateRef.current;
      const allAnswered = s.phase === "question" && players.length > 0 && (s.answered || []).length >= players.length;
      if (Date.now() >= s.endsAt || (allAnswered && Date.now() >= s.endsAt - (QUESTION_SECONDS - 2) * 1000 && false)) {
        if (s.phase === "question") reveal();
        else {
          const next = hostRef.current.index + 1;
          if (next < hostRef.current.questions.length) askQuestion(next);
          else broadcast({ phase: "end", config, scores: { ...hostRef.current.scores } });
        }
      }
    }, 300);
    return () => clearInterval(tick);
  }, [isHost, state.phase, state.index, players.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    hostRef.current.scores = {};
    askQuestion(0);
  };
  const sendAnswer = (choice) => {
    const payload = { pid: me.id, name: me.name, choice, at: Date.now() };
    if (isHost) receiveAnswer(payload);
    else chRef.current?.send({ type: "broadcast", event: "answer", payload });
  };
  return { players, state, start, sendAnswer };
}

/* ---------------- Screens ---------------- */
function LobbyList({ lobbies, onBack, onHost, onJoin, onJoinCode }) {
  const [code, setCode] = useState("");
  const open = lobbies.filter((l) => l.visibility === "public" && l.status === "lobby");
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <TopBar title="Play together" onBack={onBack} />
      <div className="flex-1 px-4 pb-32">
        <div className="mt-2 flex items-center justify-between">
          <h2 className="text-2xl font-medium text-slate-900">Online lobbies</h2>
          <RefreshCw size={22} className="text-slate-700" />
        </div>
        <div className="mt-4 space-y-3">
          {open.length === 0 && <p className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500">No open lobbies right now. Host one!</p>}
          {open.map((l) => (
            <button key={l.lobbyId} onClick={() => onJoin(l)} disabled={l.count >= l.max} className="flex w-full items-center gap-4 rounded-3xl border-2 p-4 text-left disabled:opacity-60" style={{ borderColor: "#B7E4CC", background: "#EEF9F3" }}>
              <Avatar id={l.hostId} name={l.hostName} size={56} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-bold text-slate-900">{l.hostName}</div>
                <div className="truncate text-sm text-slate-600">{l.subject} · {l.chapter}</div>
                <div className="mt-1.5 flex gap-2 text-xs font-bold">
                  <span className="rounded-full px-2.5 py-1" style={{ background: "#D3F2E1", color: GREEN }}>Individual</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-800">{l.count}/{l.max}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{l.qCount} Q</span>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-6 rounded-2xl bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-slate-700">Have a private code?</div>
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. 7KQ2PX" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm uppercase outline-none" />
            <button onClick={() => code.trim() && onJoinCode(code.trim())} className="rounded-xl px-4 text-sm font-semibold text-white" style={{ background: GREEN }}>Join</button>
          </div>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 bg-slate-50 px-4 pb-6 pt-3">
        <PrimaryButton onClick={onHost}><PlusCircle size={20} /> Host a game</PrimaryButton>
      </div>
    </div>
  );
}

function HostSetup({ data, me, onBack, onCreate }) {
  const bank = Array.isArray(data?.quizBank) ? data.quizBank : [];
  const subjects = useMemo(() => [...new Set(bank.map((q) => q.subject).filter(Boolean))], [bank]);
  const [name, setName] = useState(me.name || "");
  const [visibility, setVisibility] = useState("public");
  const [max, setMax] = useState(8);
  const [subject, setSubject] = useState(subjects[0] || "");
  const [chapter, setChapter] = useState("");
  const [q, setQ] = useState("");
  const chapters = useMemo(() => {
    const m = {};
    bank.filter((x) => x.subject === subject).forEach((x) => (m[x.chapter || "General"] = (m[x.chapter || "General"] || 0) + 1));
    return Object.entries(m);
  }, [bank, subject]);
  useEffect(() => {
    if (!chapters.find(([c]) => c === chapter)) setChapter(chapters[0]?.[0] || "");
  }, [chapters]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = chapters.filter(([c]) => c.toLowerCase().includes(q.toLowerCase()));
  const create = () => {
    const qs = shuffle(bank.filter((x) => x.subject === subject && (x.chapter || "General") === chapter)).slice(0, 40);
    if (!qs.length || !name.trim()) return;
    onCreate({ name: name.trim(), visibility, max, subject, chapter, questions: qs });
  };
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <TopBar title="Host online game" onBack={onBack} />
      <div className="flex-1 space-y-6 px-4 pb-32">
        <section>
          <h3 className="mb-3 text-xl font-medium text-slate-900">Your name</h3>
          <div className="flex items-center gap-3">
            <Avatar id={me.id} name={name} size={60} />
            <input value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base outline-none" />
          </div>
        </section>
        <section>
          <h3 className="mb-3 text-xl font-medium text-slate-900">Visibility</h3>
          <div className="grid grid-cols-2 gap-3">
            {[["public", "Public", Globe], ["private", "Private", Lock]].map(([k, l, I]) => (
              <button key={k} onClick={() => setVisibility(k)} className="flex items-center justify-center gap-2 rounded-2xl border-2 py-3 font-semibold" style={visibility === k ? { background: GREEN, borderColor: GREEN, color: "#fff" } : { background: "#fff", borderColor: "#E2E8F0", color: "#0F172A" }}>
                <I size={18} /> {l}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h3 className="mb-3 text-xl font-medium text-slate-900">Max players</h3>
          <div className="flex items-center rounded-2xl border-2 border-slate-200 bg-white px-4">
            <select value={max} onChange={(e) => setMax(Number(e.target.value))} className="flex-1 bg-transparent py-3.5 text-base font-bold outline-none">
              {[2, 4, 6, 8, 10, 12, 16, 20].map((n) => <option key={n} value={n}>{n} players</option>)}
            </select>
            <Users size={20} className="text-slate-600" />
          </div>
        </section>
        <section>
          <h3 className="mb-3 text-xl font-medium text-slate-900">Quiz</h3>
          {subjects.length === 0 ? (
            <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">No quiz questions yet. The admin needs to add some first.</p>
          ) : (
            <>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base font-bold outline-none">
                {subjects.map((s) => <option key={s}>{s}</option>)}
              </select>
              <div className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4">
                <Search size={20} className="text-slate-700" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chapter" className="flex-1 bg-transparent py-3 outline-none" />
              </div>
              <div className="mt-3 space-y-2.5">
                {shown.map(([c, n]) => (
                  <button key={c} onClick={() => setChapter(c)} className="flex w-full items-center rounded-2xl border-2 bg-white px-4 py-3 text-left" style={{ borderColor: chapter === c ? GREEN : "#E2E8F0" }}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-medium text-slate-900">{c}</div>
                      <div className="text-sm text-slate-500">{n} questions</div>
                    </div>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border-2" style={{ borderColor: chapter === c ? GREEN : "#CBD5E1" }}>
                      {chapter === c && <span className="h-3 w-3 rounded-full" style={{ background: GREEN }} />}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
      <div className="fixed inset-x-0 bottom-0 bg-slate-50 px-4 pb-6 pt-3">
        <PrimaryButton onClick={create} disabled={!chapter || !name.trim()}><Radio size={20} /> Create lobby</PrimaryButton>
      </div>
    </div>
  );
}

function Scoreboard({ players, scores, results, gained, meId }) {
  const rows = [...players].sort((a, b) => (scores?.[b.id] || 0) - (scores?.[a.id] || 0));
  return (
    <div className="space-y-3">
      {rows.map((p, i) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3">
          <span className="w-8 text-lg text-slate-800">#{i + 1}</span>
          <Avatar id={p.id} name={p.name} size={40} />
          <span className="min-w-0 flex-1 truncate text-base text-slate-900">{p.name}{p.host ? " (host)" : ""}{p.id === meId ? " · you" : ""}</span>
          {results && (results[p.id] ? <CheckCircle2 size={22} className="text-white" fill={GREEN} /> : <XCircle size={22} className="text-white" fill="#EF4444" />)}
          <div className="w-12 text-right">
            <div className="text-xl font-medium text-slate-900">{scores?.[p.id] || 0}</div>
            {gained?.[p.id] ? <div className="text-sm" style={{ color: GREEN }}>+{gained[p.id]}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function GameRoom({ session, me, onLeave, announce }) {
  const { players, state, start, sendAnswer } = useGame({ lobbyId: session.lobbyId, me, isHost: session.isHost, config: session.config, questions: session.questions, announce });
  const [myChoice, setMyChoice] = useState(null);
  useEffect(() => setMyChoice(null), [state.index, state.phase === "question"]);
  const now = useNow(state.phase === "question" || state.phase === "reveal");
  const cfg = state.config || session.config || {};
  const full = !session.isHost && cfg.max && players.length > cfg.max && players[players.length - 1]?.id === me.id;

  if (full) {
    return (
      <div className="min-h-screen bg-slate-50"><TopBar title="Lobby full" onBack={onLeave} />
        <p className="p-6 text-center text-slate-600">This lobby is full. Try another one.</p></div>
    );
  }

  if (state.phase === "lobby" || !state.phase) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <TopBar title="Lobby" onBack={onLeave} />
        <div className="flex-1 px-4 pb-32">
          <div className="rounded-2xl bg-white p-4">
            <div className="text-lg font-bold text-slate-900">{cfg.subject || "Loading…"}</div>
            <div className="text-sm text-slate-500">{cfg.chapter} · {cfg.qCount} questions</div>
            {cfg.visibility === "private" && <div className="mt-3 rounded-xl bg-slate-100 p-3 text-center text-sm">Share code <b className="text-lg tracking-widest">{session.lobbyId}</b></div>}
          </div>
          <h3 className="mb-3 mt-5 text-lg font-medium text-slate-900">Players {players.length}/{cfg.max || "?"}</h3>
          <div className="space-y-2.5">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-white p-3">
                <Avatar id={p.id} name={p.name} size={36} />
                <span className="flex-1 text-slate-900">{p.name}{p.host ? " (host)" : ""}</span>
              </div>
            ))}
          </div>
          {!session.isHost && <p className="mt-6 text-center text-sm text-slate-500">Waiting for the host to start…</p>}
        </div>
        {session.isHost && (
          <div className="fixed inset-x-0 bottom-0 bg-slate-50 px-4 pb-6 pt-3">
            <PrimaryButton onClick={start} disabled={players.length < 1}>Start game</PrimaryButton>
          </div>
        )}
      </div>
    );
  }

  if (state.phase === "question") {
    const left = Math.max(0, Math.ceil((state.endsAt - now) / 1000));
    const pct = Math.max(0, Math.min(100, ((state.endsAt - now) / (QUESTION_SECONDS * 1000)) * 100));
    return (
      <div className="min-h-screen bg-slate-50">
        <TopBar title={`Q${state.index + 1} / ${state.total}`} onBack={onLeave} icon="close" />
        <div className="px-4 pb-10">
          <div className="flex items-center gap-4">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: GREEN }} /></div>
            <span className="text-xl font-medium">{left}s</span>
          </div>
          <div className="mt-3 text-sm text-slate-600">Answers: {(state.answered || []).length}/{players.length}</div>
          {state.lastAnswered && <div className="mt-2 rounded-xl py-2 text-center text-sm font-medium" style={{ background: "#E3F6EC", color: GREEN }}>{state.lastAnswered} answered</div>}
          <h2 className="my-7 text-center text-2xl font-bold leading-snug text-slate-900">{state.question.text}</h2>
          <div className="space-y-3">
            {state.question.options.map((o, i) => {
              const sel = myChoice === i;
              return (
                <button key={i} onClick={() => { setMyChoice(i); sendAnswer(i); }} className="flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-3.5 text-left" style={sel ? { background: "#1BA05E", borderColor: "#1BA05E", color: "#fff" } : { background: "#fff", borderColor: "#E2E8F0", color: "#0F172A" }}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={sel ? { background: "rgba(255,255,255,0.2)" } : { background: "#E3F6EC", color: GREEN }}>{"ABCD"[i]}</span>
                  <span className="flex-1 text-base">{o}</span>
                  {sel && <Check size={22} />}
                </button>
              );
            })}
          </div>
          {myChoice !== null && <p className="mt-5 text-center text-sm text-slate-500">Answer sent · You can still change it before time is up.</p>}
        </div>
      </div>
    );
  }

  if (state.phase === "reveal") {
    const pct = Math.max(0, Math.min(100, ((state.endsAt - now) / (REVEAL_SECONDS * 1000)) * 100));
    return (
      <div className="min-h-screen bg-slate-50">
        <TopBar title={`Q${state.index + 1} / ${state.total}`} onBack={onLeave} icon="close" />
        <div className="px-4 pb-10">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: GREEN }} /></div>
          <div className="mt-4 rounded-2xl border-2 border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-600">Correct answer</div>
            <div className="mt-1 text-2xl" style={{ color: GREEN }}>{state.correctText}</div>
            {state.explanation && <p className="mt-2 text-base text-slate-600">{state.explanation}</p>}
          </div>
          <h3 className="mb-3 mt-6 text-lg text-slate-900">Scores</h3>
          <Scoreboard players={players} scores={state.scores} results={state.results} gained={state.gained} meId={me.id} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar title="Final results" onBack={onLeave} icon="close" />
      <div className="px-4 pb-10">
        <div className="mb-5 flex flex-col items-center rounded-2xl bg-white p-5"><Trophy size={40} style={{ color: "#EAB308" }} /><div className="mt-2 text-lg font-bold">Game over!</div></div>
        <Scoreboard players={players} scores={state.scores} meId={me.id} />
        <div className="mt-6"><PrimaryButton onClick={onLeave}>Back to lobbies</PrimaryButton></div>
      </div>
    </div>
  );
}

export default function MultiplayerScreen({ data, student, onClose }) {
  const me = useMemo(() => ({ id: student?.id ? `${student.id}-${rid(4)}` : rid(10), name: student?.name || "Player" }), [student?.id, student?.name]);
  const [view, setView] = useState("list");
  const [session, setSession] = useState(null);
  const { lobbies, channel } = useLobbyDirectory(true);

  const announce = (entry) => channel.current?.track(entry);
  const leave = () => {
    if (session?.isHost) channel.current?.untrack();
    setSession(null);
    setView("list");
  };

  const create = ({ name, visibility, max, subject, chapter, questions }) => {
    const lobbyId = rid(6);
    const config = { hostName: name, hostId: me.id, visibility, max, subject, chapter, qCount: questions.length };
    setSession({ lobbyId, isHost: true, config, questions, me: { ...me, name } });
    setView("game");
  };
  const join = (lobbyId, config) => {
    setSession({ lobbyId, isHost: false, config, me });
    setView("game");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50">
      {view === "list" && <LobbyList lobbies={lobbies} onBack={onClose} onHost={() => setView("host")} onJoin={(l) => join(l.lobbyId, l)} onJoinCode={(c) => join(c, null)} />}
      {view === "host" && <HostSetup data={data} me={me} onBack={() => setView("list")} onCreate={create} />}
      {view === "game" && session && <GameRoom session={session} me={session.me} onLeave={leave} announce={announce} />}
    </div>
  );
}

/* ---------------- Admin: quiz question bank ---------------- */
export function AdminQuizBank({ data, setData, subjects = [] }) {
  const bank = Array.isArray(data?.quizBank) ? data.quizBank : [];
  const names = subjects.map(subjectName).filter(Boolean);
  const empty = { subject: names[0] || "", chapter: "", question: "", options: ["", "", "", ""], correct: 0, explanation: "" };
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState("");
  const cls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500";
  const save = () => {
    if (!form.subject.trim() || !form.question.trim() || form.options.some((o) => !o.trim())) return alert("Fill subject, question and all 4 options.");
    const item = { ...form, id: rid(10), subject: form.subject.trim(), chapter: form.chapter.trim() || "General" };
    setData((d) => ({ ...d, quizBank: [...(Array.isArray(d.quizBank) ? d.quizBank : []), item] }));
    setForm({ ...empty, subject: form.subject, chapter: form.chapter });
  };
  const remove = (id) => setData((d) => ({ ...d, quizBank: (d.quizBank || []).filter((q) => q.id !== id) }));
  const shown = bank.filter((q) => !filter || q.subject === filter);
  const allSubjects = [...new Set([...names, ...bank.map((q) => q.subject)])];
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="text-sm font-bold text-slate-800">Add a game question</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input list="mp-subjects" className={cls} placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <datalist id="mp-subjects">{allSubjects.map((s) => <option key={s} value={s} />)}</datalist>
          <input className={cls} placeholder="Chapter (e.g. Chapter One)" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} />
        </div>
        <textarea className={cls} rows={2} placeholder="Question" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
        {form.options.map((o, i) => (
          <label key={i} className="flex items-center gap-2">
            <input type="radio" name="mp-correct" checked={form.correct === i} onChange={() => setForm({ ...form, correct: i })} />
            <span className="w-5 text-sm font-bold">{"ABCD"[i]}</span>
            <input className={cls} placeholder={`Option ${"ABCD"[i]}`} value={o} onChange={(e) => { const op = [...form.options]; op[i] = e.target.value; setForm({ ...form, options: op }); }} />
          </label>
        ))}
        <p className="text-xs text-slate-500">Tick the circle next to the correct answer.</p>
        <textarea className={cls} rows={2} placeholder="Explanation (optional)" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
        <button onClick={save} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: GREEN }}>Add question</button>
      </div>
      <div className="flex items-center gap-2">
        <select className={cls + " max-w-xs"} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All subjects ({bank.length})</option>
          {allSubjects.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {shown.length === 0 && <p className="text-sm text-slate-500">No questions yet.</p>}
        {shown.map((q) => (
          <div key={q.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500">{q.subject} · {q.chapter}</div>
              <div className="text-sm font-semibold text-slate-900">{q.question}</div>
              <div className="text-xs" style={{ color: GREEN }}>Answer: {q.options[q.correct]}</div>
            </div>
            <button onClick={() => remove(q.id)} aria-label="Delete" className="text-rose-500"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
