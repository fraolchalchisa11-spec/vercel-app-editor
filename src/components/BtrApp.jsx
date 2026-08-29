import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  GraduationCap, Lock, User, Eye, EyeOff, ArrowRight, LayoutDashboard,
  Users, FileText, StickyNote, Plus, Search, Trash2, Pin, PinOff,
  ExternalLink, X, LogOut, Pencil, Calendar, Clock, CheckCircle2,
  AlertCircle, SearchX, BookOpen, Megaphone, Bell, Moon, Sun, ChevronRight,
  Volume2, Inbox, Grid2x2, Atom, FlaskConical, Leaf, Landmark, TrendingUp,
  Globe2, Home, Layers, Settings as SettingsIcon, Camera, ChevronLeft,
  Languages, BellRing, BellOff, Check, Sparkles, Mail, CreditCard,
  CalendarClock, Flame, Target, BarChart3, Circle, ShieldCheck,
  Image as ImageIcon, UploadCloud, Send, Crown, Paperclip,
  Calculator, Briefcase, Code2, Download, MoreVertical, ChevronDown, ArrowLeft,
  BadgePercent, ArrowUp, ArrowDown, Link2, Menu as MenuIcon, SlidersHorizontal, ChevronUp,
  Brain, Cpu, ClipboardCheck, HelpCircle,
} from "lucide-react";
import { getAppState, saveAppState } from "@/lib/app-state.functions";
import { uploadImageFile, uploadHtmlFile } from "@/lib/upload-file";
import btrLogoAsset from "@/assets/btr-logo.png.asset.json";
import btrAuthLogoAsset from "@/assets/btr-auth-logo.png.asset.json";
import btrLogoMainAsset from "@/assets/btr-logo-main.png.asset.json";

const AUTH_LOGO_URL = btrAuthLogoAsset.url;
const AUTH_BLUE = "#123FBE";
const HOME_LOGO_URL = btrLogoMainAsset.url;

// App background uploaded to /public/app-background.png
const APP_BG_URL = "/app-background.png";
const EXAM_NOTES_BG_URL = "/exam-notes-background.png";



/* Real browser localStorage (device-local cache + preferences). */
const memoryStorage = (() => {
  const mem = {};
  const hasLS = () => {
    try { return typeof window !== "undefined" && !!window.localStorage; } catch { return false; }
  };
  return {
    getItem: (k) => { try { return hasLS() ? window.localStorage.getItem(k) : (k in mem ? mem[k] : null); } catch { return null; } },
    setItem: (k, v) => { try { if (hasLS()) window.localStorage.setItem(k, String(v)); else mem[k] = String(v); } catch { mem[k] = String(v); } },
    removeItem: (k) => { try { if (hasLS()) window.localStorage.removeItem(k); delete mem[k]; } catch {} },
  };
})();

/* ---------------------------------------------------------------------
   Persisted sign-in ("stay logged in"): remembers which account was last
   signed in on this device so reloading the app doesn't force a fresh
   login. Only a lightweight pointer is stored (role + student id) —
   never a password — and it's re-validated against real data on load.
--------------------------------------------------------------------- */
const SESSION_STORAGE_KEY = "btr-persisted-session";

function readPersistedSession() {
  try {
    const raw = memoryStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writePersistedSession(session) {
  try {
    if (!session) memoryStorage.removeItem(SESSION_STORAGE_KEY);
    else memoryStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {}
}

/* ---------------------------------------------------------------------
   Google Sign-In (Google Identity Services): decodes the ID token that
   Google returns client-side so we can read the student's email/name.
   Note: this reads the token's payload only — it does NOT cryptographically
   verify the signature. That's fine for a client-only app like this one,
   but if a real backend is added later, verify the token server-side
   before trusting it.
--------------------------------------------------------------------- */
function decodeGoogleCredential(token) {
  try {
    const payload = token.split(".")[1];
    const json = decodeURIComponent(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Loads the Google Identity Services script (once) and renders Google's own
// "Continue with Google" button into the returned ref. Does nothing until a
// Google Client ID has been configured by the admin.
function useGoogleSignInButton(clientId, onCredential, disabled) {
  const btnRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    if (!clientId || disabled) return;
    let cancelled = false;

    const init = () => {
      if (cancelled || !window.google?.accounts?.id || !btnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => onCredentialRef.current?.(resp),
        auto_select: false,
      });
      btnRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(btnRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "pill",
        width: 320,
        text: "continue_with",
      });
    };

    if (window.google?.accounts?.id) {
      init();
    } else {
      let script = document.getElementById("google-identity-script");
      if (!script) {
        script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.id = "google-identity-script";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", init);
      return () => {
        cancelled = true;
        script.removeEventListener("load", init);
      };
    }
    return () => { cancelled = true; };
  }, [clientId, disabled]);

  return btnRef;
}

/* ---------------------------------------------------------------------
   BTR Entrance Exam Preparation — classroom app
   - Admin manages students, exams (with material links), notes (with links)
   - Students log in with Student ID to view their exams & notes
   - Everything persists via localStorage (standalone build)
--------------------------------------------------------------------- */

const NOTE_TYPE_COLORS = {
  "Full Note": "#2563EB",
};

function noteTypeColor(type) {
  return NOTE_TYPE_COLORS[type] || "#64748B";
}

/* ----------------------------- Subjects ----------------------------- */

// Content is organized as a flat list of subjects — there is no department
// grouping anywhere in the app. Everything lives in one bucket.
const NOTES_BUCKET = "all";

const ACCENT_COLOR_PALETTE = [
  "#2563EB", "#7C3AED", "#059669", "#DB2777", "#D97706",
  "#0891B2", "#B45309", "#DC2626", "#16A34A", "#4F46E5",
];

const ACCENT_ICON_PALETTE = [
  Calculator, Briefcase, Megaphone, Code2, BarChart3,
  FlaskConical, Leaf, BookOpen, Globe2, Layers,
];

function accentIndex(key = "") {
  const str = String(key || "");
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum = (sum + str.charCodeAt(i)) % 9973;
  return sum;
}

function accentColor(key) {
  return ACCENT_COLOR_PALETTE[accentIndex(key) % ACCENT_COLOR_PALETTE.length];
}

function accentIcon(key) {
  return ACCENT_ICON_PALETTE[accentIndex(key) % ACCENT_ICON_PALETTE.length] || Layers;
}

function subjectsList(data) {
  const list = data?.subjects?.[NOTES_BUCKET];
  return Array.isArray(list) ? list : [];
}

function notesList(data) {
  const list = data?.noteLinks?.[NOTES_BUCKET];
  return Array.isArray(list) ? list : [];
}

// Notes belonging to a subject. Legacy notes without a subjectId live in the
// "General" bucket (subjectId === null).
function notesForSubject(list, subjectId) {
  return (list || []).filter((n) => (n.subjectId || null) === (subjectId || null));
}

function subjectCounts(list, subjectId) {
  const items = notesForSubject(list, subjectId);
  return {
    notes: items.filter((n) => !!(n.htmlContent || n.htmlUrl)).length,
    resources: items.filter((n) => !(n.htmlContent || n.htmlUrl) && !!n.link).length,
  };
}



/* ----------------------------- Subscription helpers ----------------------------- */

// Roughly estimates the plan's total length in days from a free-text plan type
// like "1 Year" or "6 Months", used only to size the progress ring on the
// subscription screen. Falls back to a sensible default if it can't parse it.
function planTotalDays(planType) {
  if (!planType) return 365;
  const s = planType.toLowerCase();
  const num = parseFloat(s.match(/[\d.]+/)?.[0] || "1");
  if (s.includes("year")) return Math.round(num * 365);
  if (s.includes("month")) return Math.round(num * 30);
  if (s.includes("week")) return Math.round(num * 7);
  if (s.includes("day")) return Math.round(num);
  return 365;
}

// Returns { daysLeft, isExpired, isExpiringSoon, totalDays } for a student's
// admin-set expiration date. `expiresAt` is null when no plan has been set,
// in which case access is treated as unrestricted.
function getSubscriptionStatus(student) {
  if (!student?.expiresAt) {
    return { hasPlan: false, daysLeft: null, isExpired: false, isExpiringSoon: false, totalDays: null };
  }
  const expiry = new Date(student.expiresAt + "T23:59:59");
  const msLeft = expiry.getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  return {
    hasPlan: true,
    daysLeft,
    isExpired: daysLeft < 0,
    isExpiringSoon: daysLeft >= 0 && daysLeft <= 7,
    totalDays: planTotalDays(student.planType),
  };
}

// True only when the student currently has an active, non-expired plan.
// Used to gate Pro-only notes/exams (separate from the whole-app expiry gate).
function isStudentSubscribed(student) {
  const sub = getSubscriptionStatus(student);
  return sub.hasPlan && !sub.isExpired;
}

const TELEGRAM_SUPPORT_URL = "https://t.me/btrtmhrt_support";

// Telebirr account students are told to send payment to before submitting a
// subscription request for admin verification.
const TELEBIRR_PHONE_NUMBER = "0967288042";
const TELEBIRR_ACCOUNT_NAME = "Tsehay Girma";

// Plans shown on the subscription picker screen. `months` is used to compute
// a suggested expiry date when the admin approves a request.
const SUBSCRIPTION_PLAN_OPTIONS = [
  {
    id: "6-month",
    label: "6-Month Plan",
    subtitle: "BTR Premium",
    price: 200,
    months: 6,
    validText: "Valid for 6 Months",
    bestValue: false,
  },
  {
    id: "1-year",
    label: "1-Year Plan",
    subtitle: "BTR Premium",
    price: 300,
    months: 12,
    validText: "Valid for 12 Months",
    bestValue: true,
    savingsText: "Save 100 Birr compared to renewing twice",
  },
];

// Returns a YYYY-MM-DD string `days` days from today — used by the admin's
// quick "Make Pro" action to compute an expiry date from a preset duration.
function addDaysToToday(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Generates the next sequential Student ID in the form "BTR-00001", based on
// the highest existing numeric suffix among current students. Falls back to
// BTR-00001 if no student has a BTR-prefixed numeric ID yet.
function generateStudentId(students) {
  const nums = (students || [])
    .map((s) => (s.studentId || "").match(/^BTR-(\d+)$/i))
    .filter(Boolean)
    .map((m) => parseInt(m[1], 10));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `BTR-${String(next).padStart(5, "0")}`;
}

// The admin-set logo lives in data.branding.logoUrl (so it's part of the
// normal save/export flow), but it's also mirrored into this dedicated
// localStorage key + broadcast via a custom event so <Brand /> and the
// login screen can show it live from anywhere without threading `data`
// through every screen in the tree.
const LOGO_STORAGE_KEY = "btr-logo-url";
const LOGO_STORAGE_KEY_DARK = "btr-logo-url-dark";
const LOGO_EVENT = "btr-logo-updated";
const DEFAULT_LOGO_URL = HOME_LOGO_URL;

// Generic helper: store a light/dark pair of image URLs under two keys and
// broadcast the shared LOGO_EVENT so every <Brand/>-style consumer refreshes.
function makeStoredLogoPair(lightKey, darkKey) {
  return function setStoredLogoPair(lightUrl, darkUrl) {
    try {
      if (lightUrl) memoryStorage.setItem(lightKey, lightUrl);
      else memoryStorage.removeItem(lightKey);
    } catch {}
    try {
      if (darkUrl) memoryStorage.setItem(darkKey, darkUrl);
      else memoryStorage.removeItem(darkKey);
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent(LOGO_EVENT));
    } catch {}
  };
}

// Generic hook: reads a light/dark pair of stored logo URLs and returns
// whichever one matches the current mode, falling back sensibly:
//   dark mode + no dark logo set -> light logo (better than nothing)
//   light mode -> light logo (or the provided default)
function useStoredLogoPair(lightKey, darkKey, fallbackUrl) {
  const read = () => {
    try {
      const light = memoryStorage.getItem(lightKey) || fallbackUrl || null;
      const dark = memoryStorage.getItem(darkKey) || null;
      return { light, dark };
    } catch {
      return { light: fallbackUrl || null, dark: null };
    }
  };
  const [pair, setPair] = useState(read);
  useEffect(() => {
    const refresh = () => setPair(read());
    window.addEventListener(LOGO_EVENT, refresh);
    return () => window.removeEventListener(LOGO_EVENT, refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (darkMode) => (darkMode ? (pair.dark || pair.light) : pair.light);
}

// Detects the OS/browser's dark-mode preference. Used only on screens that
// don't have their own theme toggle yet (like the sign-in screen), so an
// admin-uploaded dark-mode logo still shows up for people whose system is
// set to dark. Guarded throughout: matchMedia isn't available everywhere.
function usePrefersDarkSystem() {
  const [prefersDark, setPrefersDark] = useState(() => {
    try {
      return typeof window !== "undefined" && !!window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : false;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    let mql;
    try {
      if (!window.matchMedia) return;
      mql = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = (e) => setPrefersDark(!!e.matches);
      mql.addEventListener ? mql.addEventListener("change", onChange) : mql.addListener?.(onChange);
      return () => {
        mql.removeEventListener ? mql.removeEventListener("change", onChange) : mql.removeListener?.(onChange);
      };
    } catch {
      return undefined;
    }
  }, []);
  return prefersDark;
}

function setStoredLogo(url, darkUrl) {
  makeStoredLogoPair(LOGO_STORAGE_KEY, LOGO_STORAGE_KEY_DARK)(url, darkUrl);
}

// darkMode defaults to false so existing call sites (that don't know about
// dark mode) keep getting the light logo, exactly like before.
function useLogoUrl(darkMode = false) {
  const pick = useStoredLogoPair(LOGO_STORAGE_KEY, LOGO_STORAGE_KEY_DARK, DEFAULT_LOGO_URL);
  return pick(darkMode);
}

// Sign-in / sign-up screen logo — managed separately from the in-app logo.
const AUTH_LOGO_STORAGE_KEY = "btr-auth-logo-url";
const AUTH_LOGO_STORAGE_KEY_DARK = "btr-auth-logo-url-dark";

function setStoredAuthLogo(url, darkUrl) {
  makeStoredLogoPair(AUTH_LOGO_STORAGE_KEY, AUTH_LOGO_STORAGE_KEY_DARK)(url, darkUrl);
}

function useAuthLogoUrl(darkMode = false) {
  const pick = useStoredLogoPair(AUTH_LOGO_STORAGE_KEY, AUTH_LOGO_STORAGE_KEY_DARK, AUTH_LOGO_URL);
  return pick(darkMode);
}

// Note/exam viewer logo — managed separately from the in-app logo and the
// sign-in logo. Falls back to the main app logo if none is set.
const VIEWER_LOGO_STORAGE_KEY = "btr-viewer-logo-url";
const VIEWER_LOGO_STORAGE_KEY_DARK = "btr-viewer-logo-url-dark";

function setStoredViewerLogo(url, darkUrl) {
  makeStoredLogoPair(VIEWER_LOGO_STORAGE_KEY, VIEWER_LOGO_STORAGE_KEY_DARK)(url, darkUrl);
}

function useViewerLogoUrl(darkMode = false) {
  const read = () => {
    try {
      const light = memoryStorage.getItem(VIEWER_LOGO_STORAGE_KEY) || memoryStorage.getItem(LOGO_STORAGE_KEY) || DEFAULT_LOGO_URL;
      const dark = memoryStorage.getItem(VIEWER_LOGO_STORAGE_KEY_DARK) || memoryStorage.getItem(LOGO_STORAGE_KEY_DARK) || null;
      return { light, dark };
    } catch {
      return { light: DEFAULT_LOGO_URL, dark: null };
    }
  };
  const [pair, setPair] = useState(read);
  useEffect(() => {
    const refresh = () => setPair(read());
    window.addEventListener(LOGO_EVENT, refresh);
    return () => window.removeEventListener(LOGO_EVENT, refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return darkMode ? (pair.dark || pair.light) : pair.light;
}

const DEFAULT_SUPPORT_URL = "https://t.me/btrtmhrt_support";


function getDeviceLabel() {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent || "";
  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
  let os = "";
  if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS/.test(ua)) os = "Mac";
  else if (/Linux/.test(ua)) os = "Linux";
  return [browser, os].filter(Boolean).join(" on ") || "Unknown device";
}

const MAX_ACTIVITY_LOG_ENTRIES = 200;

// Appends an entry to data.activityLog and returns the updated `data` object.
// `actor` defaults to the current admin session's device label, since this
// app uses one shared admin login rather than separate per-person accounts.
function withActivity(data, action, detail, actor) {
  const entry = {
    id: uid("log"),
    at: new Date().toISOString(),
    actor: actor || data?.adminSession?.deviceLabel || "Admin",
    action,
    detail: detail || "",
  };
  return {
    ...data,
    activityLog: [entry, ...(data.activityLog || [])].slice(0, MAX_ACTIVITY_LOG_ENTRIES),
  };
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(iso) {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

/* ----------------------------- Study streak ----------------------------- */

function isoDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function daysAgoBetween(aIso, bIso) {
  const a = new Date(aIso + "T00:00:00");
  const b = new Date(bIso + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

// Tracks a per-student daily study streak on-device (no backend, so this is
// only as reliable as the browser it runs in — see the assistant's notes on
// this app's storage model for the general caveat).
function useStreak(studentId) {
  const storageKey = `btr-streak-${studentId}`;
  const [state, setState] = useState(() => {
    try {
      const raw = memoryStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
    return { streak: 0, lastActiveDate: null, activeDates: [] };
  });

  useEffect(() => {
    const today = isoDateKey();
    setState((prev) => {
      if (prev.lastActiveDate === today) return prev;
      const gap = prev.lastActiveDate ? daysAgoBetween(prev.lastActiveDate, today) : null;
      const streak = gap === 1 ? (prev.streak || 0) + 1 : 1;
      const activeDates = [...(prev.activeDates || []).filter((d) => d !== today), today].slice(-7);
      const next = { streak, lastActiveDate: today, activeDates };
      try {
        memoryStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  return state;
}

function normalizeUrl(url) {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// Many hosts (Google Drive, Docs, YouTube, etc.) block being shown in an iframe
// UNLESS you use their specific embeddable URL format. Convert known share links
// so materials can preview inside the app instead of failing with a CSP block.
function toEmbeddableUrl(url) {
  const href = normalizeUrl(url);
  if (!href) return href;
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "");

    // Google Drive file share -> /preview (embeddable)
    if (host === "drive.google.com") {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
      const idParam = u.searchParams.get("id");
      if (idParam) return `https://drive.google.com/file/d/${idParam}/preview`;
    }

    // Google Docs / Sheets / Slides -> /preview
    if (host === "docs.google.com") {
      const m = u.pathname.match(/\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
      if (m) return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
    }

    // YouTube -> /embed/
    if (host === "youtube.com" && u.pathname === "/watch") {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    return href;
  } catch {
    return href;
  }
}

/* ----------------------------- i18n ----------------------------- */

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "om", label: "Afaan Oromo" },
  { code: "am", label: "አማርኛ" },
];

const STRINGS = {
  en: {
    welcomeBack: "Welcome back",
    exams: "Exams", notes: "Notes", updates: "Updates",
    announcements: "Announcements", recentExamMaterials: "Recent exam materials",
    home: "Home", logout: "Logout",
    noAnnouncements: "No announcements yet.", noExamsTitle: "No exams posted yet.",
    noExamsSub: "Check back later for new materials.",
    profile: "Profile", viewProfile: "View profile", editProfile: "Edit profile",
    uploadPicture: "Upload profile picture", settings: "Settings", theme: "Theme",
    language: "Language", notificationPrefs: "Notification preferences",
    profileSettings: "Profile settings", light: "Light", dark: "Dark",
    newExamAlerts: "New exam alerts", announcementAlerts: "Announcement alerts",
    save: "Save changes", saved: "Saved", cancel: "Cancel", fullName: "Full name",
    email: "Email", grade: "Grade", studentId: "Student ID", notifications: "Notifications",
    noNotifications: "You're all caught up.", markAllRead: "Mark all as read",
    quickActions: "Quick actions", progress: "This week",
  },
  om: {
    welcomeBack: "Baga deebitan",
    exams: "Qormaata", notes: "Yaadannoo", updates: "Odeeffannoo",
    announcements: "Beeksisa", recentExamMaterials: "Meeshaalee qormaataa haaraa",
    home: "Mana", logout: "Bahi",
    noAnnouncements: "Hanga ammaatti beeksisni hin jiru.", noExamsTitle: "Qormaanni hin maxxanfamne.",
    noExamsSub: "Boodarra deebi'ii ilaali.",
    profile: "Piroofaayilii", viewProfile: "Piroofaayilii ilaali", editProfile: "Piroofaayilii gulaali",
    uploadPicture: "Suuraa fe'i", settings: "Qindaa'ina", theme: "Bifa",
    language: "Afaan", notificationPrefs: "Filannoo beeksisaa",
    profileSettings: "Qindaa'ina piroofaayilii", light: "Ifaa", dark: "Dukkanaa'aa",
    newExamAlerts: "Beeksisa qormaata haaraa", announcementAlerts: "Beeksisa oduu",
    save: "Jijjiirama olkaa'i", saved: "Olkaa'ame", cancel: "Dhiisi", fullName: "Maqaa guutuu",
    email: "Imeelii", grade: "Kutaa", studentId: "Lakkoofsa Barataa", notifications: "Beeksisa",
    noNotifications: "Wanti haaraan hin jiru.", markAllRead: "Hunda dubbifame jedhii mallatteessi",
    quickActions: "Tarkaanfii ariifachiisaa", progress: "Torban kana",
  },
  am: {
    welcomeBack: "እንኳን ደህና መጡ",
    exams: "ፈተናዎች", notes: "ማስታወሻዎች", updates: "ማሻሻያዎች",
    announcements: "ማስታወቂያዎች", recentExamMaterials: "የቅርብ ጊዜ የፈተና ቁሳቁሶች",
    home: "ቤት", logout: "ውጣ",
    noAnnouncements: "እስካሁን ምንም ማስታወቂያ የለም።", noExamsTitle: "እስካሁን ምንም ፈተና አልተለጠፈም።",
    noExamsSub: "ለአዳዲስ ቁሳቁሶች በኋላ ይመልከቱ።",
    profile: "መገለጫ", viewProfile: "መገለጫ ይመልከቱ", editProfile: "መገለጫ ያስተካክሉ",
    uploadPicture: "ፎቶ ይስቀሉ", settings: "ቅንብሮች", theme: "ገጽታ",
    language: "ቋንቋ", notificationPrefs: "የማሳወቂያ ምርጫዎች",
    profileSettings: "የመገለጫ ቅንብሮች", light: "ብርሃን", dark: "ጨለማ",
    newExamAlerts: "የአዲስ ፈተና ማንቂያ", announcementAlerts: "የማስታወቂያ ማንቂያ",
    save: "ለውጦችን አስቀምጥ", saved: "ተቀምጧል", cancel: "ይቅር", fullName: "ሙሉ ስም",
    email: "ኢሜይል", grade: "ክፍል", studentId: "የተማሪ መታወቂያ", notifications: "ማሳወቂያዎች",
    noNotifications: "ምንም አዲስ ነገር የለም።", markAllRead: "ሁሉንም እንደተነበበ ምልክት አድርግ",
    quickActions: "ፈጣን ተግባራት", progress: "በዚህ ሳምንት",
  },
};

function t(lang, key) {
  return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
}

/* ----------------------------- Theme tokens (JS-driven, not Tailwind dark: variant) ----------------------------- */

function getTheme(isDark) {
  return isDark
    ? {
        pageBg: "#0B1220",
        headerBg: "#0F172A",
        cardBg: "#1B2537",
        cardBorder: "#334155",
        dashedBorder: "#334155",
        textPrimary: "#F1F5F9",
        textSecondary: "#94A3B8",
        textMuted: "#64748B",
        navBg: "#0F172A",
        chipBg: "#1E293B",
        chipText: "#CBD5E1",
        chipHover: "#334155",
        avatarBg: "#F1F5F9",
        avatarText: "#0B1220",
        sheetBg: "#1E293B",
      }
    : {
        pageBg: "#F8FAFC",
        headerBg: "rgba(255,255,255,0.92)",
        cardBg: "rgba(255,255,255,0.85)",
        cardBorder: "#E2E8F0",
        dashedBorder: "#E2E8F0",
        textPrimary: "#1E293B",
        textSecondary: "#64748B",
        textMuted: "#94A3B8",
        navBg: "rgba(255,255,255,0.92)",
        chipBg: "#F1F5F9",
        chipText: "#475569",
        chipHover: "#E2E8F0",
        avatarBg: "#0F172A",
        avatarText: "#FFFFFF",
        sheetBg: "#FFFFFF",
      };
}

/* ---------------------------------------------------------------------
   Global dark-mode override stylesheet.

   Most of the app already ports its colors through `theme`/`darkMode`
   props (see getTheme above). The admin panel — and a handful of older
   student-side spots — was written before that pattern existed and
   still uses static light-only Tailwind utility classes (bg-white,
   text-slate-900, border-slate-200, ...). Rewriting every one of those
   className strings is a lot of surface area for very little benefit,
   so instead: any subtree wrapped in a `.dark-mode` ancestor class gets
   these utility classes re-pointed to dark-appropriate colors via plain
   CSS. This mirrors what the JS theme tokens already use, so the two
   systems land on the same palette. Rendered once via <GlobalDarkStyles/>.
--------------------------------------------------------------------- */
const DARK_MODE_OVERRIDE_CSS = `
.dark-mode { color-scheme: dark; }
/* Android Chrome tears translucent/blurred layers over a scrolling page in
   dark mode; keep every dark surface opaque and non-blurred. */
.dark-mode * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
.dark-mode .bg-white\/90, .dark-mode .bg-white\/80, .dark-mode .bg-white\/70 { background-color: #1E293B !important; }
.dark-mode input, .dark-mode select, .dark-mode textarea { color-scheme: dark; }

/* Surfaces */
.dark-mode .bg-white { background-color: #1E293B !important; }
.dark-mode .bg-slate-50 { background-color: #0F172A !important; }
.dark-mode .bg-slate-100 { background-color: #1E293B !important; }
.dark-mode .bg-slate-200 { background-color: #334155 !important; }
.dark-mode .hover\\:bg-slate-50:hover { background-color: rgba(148,163,184,0.08) !important; }
.dark-mode .hover\\:bg-slate-100:hover { background-color: #334155 !important; }
.dark-mode .hover\\:bg-slate-200:hover { background-color: #475569 !important; }
.dark-mode .hover\\:bg-white:hover { background-color: #334155 !important; }

/* Primary dark CTA buttons (bg-slate-900 + text-white) invert to a light button in dark mode */
.dark-mode .bg-slate-900.text-white { background-color: #F1F5F9 !important; color: #0B1220 !important; }
.dark-mode .bg-slate-900.text-white:hover { background-color: #E2E8F0 !important; }

/* Text */
.dark-mode .text-slate-900 { color: #F1F5F9 !important; }
.dark-mode .text-slate-800 { color: #E2E8F0 !important; }
.dark-mode .text-slate-700 { color: #CBD5E1 !important; }
.dark-mode .text-slate-600 { color: #B4C0D3 !important; }
.dark-mode .text-slate-500 { color: #94A3B8 !important; }
.dark-mode .text-slate-400 { color: #64748B !important; }
.dark-mode .text-slate-300 { color: #475569 !important; }
.dark-mode .hover\\:text-slate-600:hover { color: #CBD5E1 !important; }
.dark-mode .hover\\:text-slate-700:hover { color: #E2E8F0 !important; }
.dark-mode .placeholder-slate-400::placeholder { color: #64748B !important; }

/* Borders / dividers / rings */
.dark-mode .border-slate-100 { border-color: rgba(148,163,184,0.15) !important; }
.dark-mode .border-slate-200 { border-color: #334155 !important; }
.dark-mode .border-slate-300 { border-color: #475569 !important; }
.dark-mode .divide-slate-100 > * + * { border-color: rgba(148,163,184,0.15) !important; }
.dark-mode .ring-slate-100 { --tw-ring-color: rgba(148,163,184,0.15) !important; }
.dark-mode .ring-white { --tw-ring-color: rgba(11,18,32,0.9) !important; }
.dark-mode .focus\\:ring-sky-100:focus { --tw-ring-color: rgba(56,189,248,0.35) !important; }

/* Accent text (brighten saturated colors that assumed a white backdrop) */
.dark-mode .text-sky-600, .dark-mode .text-sky-700 { color: #7DD3FC !important; }
.dark-mode .text-blue-400, .dark-mode .text-blue-500, .dark-mode .text-blue-600,
.dark-mode .text-blue-700, .dark-mode .text-blue-800 { color: #93C5FD !important; }
.dark-mode .text-amber-500, .dark-mode .text-amber-600, .dark-mode .text-amber-700 { color: #FCD34D !important; }
.dark-mode .hover\\:text-amber-500:hover { color: #FCD34D !important; }
.dark-mode .text-emerald-500, .dark-mode .text-emerald-600, .dark-mode .text-emerald-700 { color: #6EE7B7 !important; }
.dark-mode .text-rose-500, .dark-mode .text-rose-600, .dark-mode .text-rose-700 { color: #FDA4AF !important; }
.dark-mode .hover\\:text-rose-500:hover { color: #FDA4AF !important; }

/* Soft tinted badge / pill backgrounds */
.dark-mode .bg-sky-50 { background-color: rgba(14,165,233,0.15) !important; }
.dark-mode .bg-sky-100 { background-color: rgba(14,165,233,0.2) !important; }
.dark-mode .hover\\:bg-sky-50:hover { background-color: rgba(14,165,233,0.2) !important; }
.dark-mode .bg-blue-50 { background-color: rgba(37,99,235,0.15) !important; }
.dark-mode .bg-blue-100 { background-color: rgba(37,99,235,0.2) !important; }
.dark-mode .bg-rose-50 { background-color: rgba(244,63,94,0.15) !important; }
.dark-mode .bg-rose-100 { background-color: rgba(244,63,94,0.2) !important; }
.dark-mode .hover\\:bg-rose-50:hover { background-color: rgba(244,63,94,0.2) !important; }
.dark-mode .bg-emerald-50 { background-color: rgba(16,185,129,0.15) !important; }
.dark-mode .bg-emerald-100 { background-color: rgba(16,185,129,0.2) !important; }
.dark-mode .bg-amber-50 { background-color: rgba(245,158,11,0.15) !important; }
.dark-mode .bg-amber-100 { background-color: rgba(245,158,11,0.2) !important; }
.dark-mode .hover\\:bg-amber-100:hover { background-color: rgba(245,158,11,0.28) !important; }

/* Tinted borders paired with the soft badges above */
.dark-mode .border-sky-200, .dark-mode .border-sky-400 { border-color: rgba(56,189,248,0.4) !important; }
.dark-mode .hover\\:border-sky-300:hover { border-color: rgba(56,189,248,0.5) !important; }
.dark-mode .focus\\:border-sky-400:focus { border-color: rgba(56,189,248,0.6) !important; }
.dark-mode .border-rose-200 { border-color: rgba(244,63,94,0.4) !important; }
.dark-mode .border-blue-100, .dark-mode .border-blue-200 { border-color: rgba(37,99,235,0.4) !important; }
.dark-mode .hover\\:border-blue-300:hover { border-color: rgba(37,99,235,0.5) !important; }

/* Frosted circular buttons on the home header */
.dark-mode .btr-glass-btn { background-color: #1E293B !important; }

/* Shadows read as murky on dark surfaces — soften them */
.dark-mode .shadow, .dark-mode .shadow-sm, .dark-mode .shadow-md,
.dark-mode .shadow-lg, .dark-mode .shadow-xl, .dark-mode .shadow-2xl {
  box-shadow: 0 8px 24px rgba(0,0,0,0.45) !important;
}
`;

function GlobalDarkStyles() {
  return <style>{DARK_MODE_OVERRIDE_CSS}</style>;
}

/* ----------------------------- Animated count-up ----------------------------- */

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const from = 0;
    const to = Number(target) || 0;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      setValue(Math.round(from + (to - from) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/* ----------------------------- Progress ring ----------------------------- */

function ProgressRing({ value = 0, size = 56, stroke = 6, color = "#2C7BE5", track = "#E2E8F0", label, textColor = "#334155" }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: textColor }}>
        {label !== undefined ? label : `${Math.round(clamped)}%`}
      </div>
    </div>
  );
}

/* ----------------------------- Storage hook (Supabase-synced) ----------------------------- */

const APP_STATE_ID = "main";
const LOCAL_CACHE_KEY = "btr-data";

function makeDefaultData() {
  return {
    branding: { logoUrl: null, logoUrlDark: null, authLogoUrl: null, authLogoUrlDark: null, viewerLogoUrl: null, viewerLogoUrlDark: null, googleClientId: "", brandName: "" },
    adminAccount: null,
    adminSession: null,
    studentSessions: {},
    students: [],
    exams: [],
    notes: [],
    announcements: [],
    noteLinks: {},
    subjects: {},
    examCategories: {
      "Final exam": [],
      "Mid exam": [],
    },
    activityLog: [],
    studentActivity: {},
    subscriptionRequests: [],
    planIcons: {},
    ads: [],
  };
}

function normalizeData(parsed) {
  if (!parsed || typeof parsed !== "object") parsed = makeDefaultData();
  if (!parsed.branding || typeof parsed.branding !== "object") parsed.branding = { logoUrl: null, logoUrlDark: null, authLogoUrl: null, authLogoUrlDark: null, viewerLogoUrl: null, viewerLogoUrlDark: null, googleClientId: "", brandName: "" };
  if (typeof parsed.branding.googleClientId !== "string") parsed.branding.googleClientId = "";
  if (typeof parsed.branding.brandName !== "string") parsed.branding.brandName = "";
  if (parsed.branding.viewerLogoUrl === undefined) parsed.branding.viewerLogoUrl = null;
  if (parsed.branding.logoUrlDark === undefined) parsed.branding.logoUrlDark = null;
  if (parsed.branding.authLogoUrlDark === undefined) parsed.branding.authLogoUrlDark = null;
  if (parsed.branding.viewerLogoUrlDark === undefined) parsed.branding.viewerLogoUrlDark = null;
  if (!("adminSession" in parsed)) parsed.adminSession = null;
  if (!parsed.studentSessions || typeof parsed.studentSessions !== "object") parsed.studentSessions = {};
  if (!parsed.studentActivity || typeof parsed.studentActivity !== "object") parsed.studentActivity = {};
  if (!Array.isArray(parsed.activityLog)) parsed.activityLog = [];
  if (!Array.isArray(parsed.subscriptionRequests)) parsed.subscriptionRequests = [];
  if (!parsed.planIcons || typeof parsed.planIcons !== "object") parsed.planIcons = {};
  if (!Array.isArray(parsed.ads)) parsed.ads = [];
  if (!Array.isArray(parsed.announcements)) parsed.announcements = [];
  if (!Array.isArray(parsed.students)) parsed.students = [];
  if (!parsed.noteLinks || typeof parsed.noteLinks !== "object") parsed.noteLinks = {};
  if (!parsed.subjects || typeof parsed.subjects !== "object") parsed.subjects = {};
  delete parsed.departments;
  // Legacy data was keyed by department name — flatten everything into one bucket.
  {
    const noteKeys = Object.keys(parsed.noteLinks);
    if (noteKeys.length > 1 || (noteKeys.length === 1 && noteKeys[0] !== NOTES_BUCKET)) {
      const merged = [];
      for (const k of noteKeys) if (Array.isArray(parsed.noteLinks[k])) merged.push(...parsed.noteLinks[k]);
      parsed.noteLinks = { [NOTES_BUCKET]: merged };
    }
    const subjKeys = Object.keys(parsed.subjects);
    if (subjKeys.length > 1 || (subjKeys.length === 1 && subjKeys[0] !== NOTES_BUCKET)) {
      const merged = [];
      const seen = new Set();
      for (const k of subjKeys) {
        for (const sub of parsed.subjects[k] || []) {
          const name = String(sub?.name || "").trim();
          if (!name || seen.has(name.toLowerCase())) continue;
          seen.add(name.toLowerCase());
          merged.push(sub);
        }
      }
      parsed.subjects = { [NOTES_BUCKET]: merged };
    }
  }
  if (!parsed.examCategories || typeof parsed.examCategories !== "object") {
    parsed.examCategories = { "Final exam": [], "Mid exam": [] };
  }
  // legacy category names → freshman naming
  if (Array.isArray(parsed.examCategories["Exit exam"])) {
    parsed.examCategories["Final exam"] = [
      ...(parsed.examCategories["Final exam"] || []),
      ...parsed.examCategories["Exit exam"],
    ];
    delete parsed.examCategories["Exit exam"];
  }
  if (Array.isArray(parsed.examCategories["Model exam"])) {
    parsed.examCategories["Mid exam"] = [
      ...(parsed.examCategories["Mid exam"] || []),
      ...parsed.examCategories["Model exam"],
    ];
    delete parsed.examCategories["Model exam"];
  }
  for (const cat of EXAM_CATEGORIES) {
    if (!Array.isArray(parsed.examCategories[cat])) parsed.examCategories[cat] = [];
  }

  return parsed;
}

/* ---- three-way merge so concurrent edits from different browsers don't clobber each other ---- */
const isPlainObject = (v) => v && typeof v === "object" && !Array.isArray(v);
const keyOf = (item) =>
  isPlainObject(item) ? (item.id ?? item.uid ?? item.key ?? item.email ?? null) : null;

function merge3(base, local, remote) {
  if (remote === undefined) return local;
  if (local === undefined) return remote;
  if (JSON.stringify(local) === JSON.stringify(remote)) return local;

  if (Array.isArray(local) && Array.isArray(remote)) {
    const baseArr = Array.isArray(base) ? base : [];
    const keyed = local.every((i) => keyOf(i) != null) && remote.every((i) => keyOf(i) != null);
    if (!keyed) {
      // Non-keyed list: if we didn't change it locally, take the remote version.
      return JSON.stringify(local) === JSON.stringify(baseArr) ? remote : local;
    }
    const baseKeys = new Set(baseArr.map(keyOf));
    const localKeys = new Set(local.map(keyOf));
    const baseByKey = new Map(baseArr.map((i) => [keyOf(i), i]));
    const out = [];
    for (const item of local) {
      const k = keyOf(item);
      const r = remote.find((i) => keyOf(i) === k);
      if (r) {
        out.push(merge3(baseByKey.get(k), item, r));
        continue;
      }
      if (!baseKeys.has(k)) {
        out.push(item); // added locally
        continue;
      }
      // If this browser did not edit the item, respect a deletion made elsewhere.
      if (JSON.stringify(item) !== JSON.stringify(baseByKey.get(k))) out.push(item);
    }
    for (const item of remote) {
      const k = keyOf(item);
      if (localKeys.has(k)) continue;
      // Present remotely and unknown to our base => added by another browser: keep it.
      if (!baseKeys.has(k)) out.push(item);
      // Otherwise it existed in base and we removed it locally => stay removed.
    }
    return out.filter((item, index, arr) => arr.findIndex((i) => keyOf(i) === keyOf(item)) === index);
  }

  if (isPlainObject(local) && isPlainObject(remote)) {
    const baseObj = isPlainObject(base) ? base : {};
    const out = {};
    const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
    for (const k of keys) {
      if (!(k in remote)) {
        if (!(k in baseObj) || JSON.stringify(local[k]) !== JSON.stringify(baseObj[k])) out[k] = local[k];
        continue;
      }
      if (!(k in local)) {
        if (!(k in baseObj)) out[k] = remote[k];
        continue;
      }
      out[k] = merge3(baseObj[k], local[k], remote[k]);
    }
    return out;
  }

  // Scalars: if we never touched it locally, adopt the remote value.
  return JSON.stringify(local) === JSON.stringify(base) ? remote : local;
}

function useStore() {
  const [data, setDataState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const latestRef = useRef(null);
  const baseRef = useRef(null); // last state we know the cloud had
  const lastRemoteRef = useRef(null);
  const saveTimerRef = useRef(null);
  const dirtyRef = useRef(false);
  const pushingRef = useRef(false);

  const applyLocal = (next) => {
    latestRef.current = next;
    setDataState(next);
    try { memoryStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(next)); } catch {}
    if (next.branding?.logoUrl || next.branding?.logoUrlDark) setStoredLogo(next.branding.logoUrl, next.branding.logoUrlDark);
    if (next.branding?.authLogoUrl || next.branding?.authLogoUrlDark) setStoredAuthLogo(next.branding.authLogoUrl, next.branding.authLogoUrlDark);
    if (next.branding?.viewerLogoUrl || next.branding?.viewerLogoUrlDark) setStoredViewerLogo(next.branding.viewerLogoUrl, next.branding.viewerLogoUrlDark);
  };

  // Merge our local state with whatever the cloud has right now, then write it back.
  const pushToCloud = async () => {
    if (pushingRef.current) return;
    const payload = latestRef.current;
    if (!payload) return;
    pushingRef.current = true;
    dirtyRef.current = false;
    try {
      let merged = payload;
      try {
        const res = await getAppState();
        const remote = res && res.data && Object.keys(res.data).length ? normalizeData(res.data) : null;
        if (remote) merged = normalizeData(merge3(baseRef.current, payload, remote));
      } catch {}
      // If the user changed something locally while this push was in flight (e.g. a
      // second upload/edit landed during the network round-trip), `merged` here was
      // computed from a now-stale snapshot. Applying it would silently discard that
      // newer edit. Detect that and skip overwriting local state in that case.
      const changedDuringPush = JSON.stringify(latestRef.current) !== JSON.stringify(payload);
      if (!changedDuringPush && JSON.stringify(merged) !== JSON.stringify(latestRef.current)) {
        applyLocal(merged);
      }
      const saved = await saveAppState({ data: merged, base: baseRef.current });
      const savedData = saved?.data && Object.keys(saved.data).length ? normalizeData(saved.data) : merged;
      if (!changedDuringPush && JSON.stringify(savedData) !== JSON.stringify(latestRef.current)) {
        applyLocal(savedData);
      }
      const serialized = JSON.stringify(savedData);
      baseRef.current = JSON.parse(serialized);
      lastRemoteRef.current = serialized;
      setError(null);
      if (changedDuringPush) {
        // Newer local edits exist that this push never accounted for. Re-sync them
        // against the base we just established so they aren't lost.
        dirtyRef.current = true;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => { pushToCloud(); }, 50);
      }
    } catch (e) {
      console.error("[useStore] save failed", e);
      dirtyRef.current = true; // retry on the next flush
      setError(e);
    } finally {
      pushingRef.current = false;
    }
  };

  // Initial load: cloud first, local cache as instant fallback.
  useEffect(() => {
    let cancelled = false;
    try {
      const raw = memoryStorage.getItem(LOCAL_CACHE_KEY);
      if (raw) applyLocal(normalizeData(JSON.parse(raw)));
    } catch {}

    (async () => {
      try {
        const res = await getAppState();
        if (cancelled) return;
        const remote = res && res.data && Object.keys(res.data).length ? res.data : null;
        if (remote) {
          const normalized = normalizeData(remote);
          const serialized = JSON.stringify(normalized);
          lastRemoteRef.current = serialized;
          baseRef.current = JSON.parse(serialized);
          applyLocal(normalized);
        } else {
          const seed = normalizeData(latestRef.current || makeDefaultData());
          applyLocal(seed);
          const saved = await saveAppState({ data: seed, base: null });
          const savedData = saved?.data && Object.keys(saved.data).length ? normalizeData(saved.data) : seed;
          const serialized = JSON.stringify(savedData);
          lastRemoteRef.current = serialized;
          baseRef.current = JSON.parse(serialized);
        }
      } catch (e) {
        console.error("[useStore] load failed", e);
        if (!cancelled && !latestRef.current) applyLocal(normalizeData(makeDefaultData()));
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Cross-device sync: poll the shared cloud state and merge remote changes in.
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (stopped || dirtyRef.current || pushingRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await getAppState();
        if (stopped || dirtyRef.current || pushingRef.current) return;
        if (!res || !res.data || !Object.keys(res.data).length) return;
        const normalized = normalizeData(res.data);
        const serialized = JSON.stringify(normalized);
        if (serialized === lastRemoteRef.current) return;
        lastRemoteRef.current = serialized;
        const merged = normalizeData(merge3(baseRef.current, latestRef.current || normalized, normalized));
        baseRef.current = JSON.parse(serialized);
        if (JSON.stringify(merged) !== JSON.stringify(latestRef.current)) applyLocal(merged);
      } catch {}
    };
    const id = setInterval(tick, 900);
    const onFocus = () => { tick(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      stopped = true;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  // Flush pending writes before the tab closes / is hidden.
  useEffect(() => {
    const onHide = () => { if (dirtyRef.current) pushToCloud(); };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  const save = (nextOrFn) => {
    const base = latestRef.current || makeDefaultData();
    const candidate = typeof nextOrFn === "function" ? nextOrFn(base) : nextOrFn;
    const normalized = normalizeData(candidate);
    applyLocal(normalized);
    dirtyRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { pushToCloud(); }, 120);
  };

  return { data, setData: save, loading, error };
}



/* ----------------------------- Preferences hook (theme/language/notifications) ----------------------------- */

const DEFAULT_PREFS = {
  theme: "light", // light | dark
  language: "en",
  notifyNewExam: true,
  notifyAnnouncement: true,
  lastSeenExamCount: 0,
  lastSeenAnnouncementIds: [],
};

function usePrefs(studentId) {
  const key = `btr-prefs-${studentId || "guest"}`;
  const [prefs, setPrefs] = useState(() => {
    try {
      const raw = memoryStorage.getItem(key);
      return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  });

  useEffect(() => {
    try {
      const raw = memoryStorage.getItem(key);
      setPrefs(raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS });
    } catch {
      setPrefs({ ...DEFAULT_PREFS });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const update = (patch) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        memoryStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return [prefs, update];
}

/* ----------------------------- Shared UI bits ----------------------------- */

function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-800 placeholder-slate-400 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

function Modal({ title, onClose, children, wide, theme }) {
  const sheetBg = theme?.sheetBg || "#FFFFFF";
  const textPrimary = theme?.textPrimary || "#0F172A";
  const textMuted = theme?.textMuted || "#94A3B8";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.5)" }}
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? "max-w-lg" : "max-w-md"} rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto`}
        style={{ background: sheetBg }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: textPrimary }}>{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-slate-100 transition"
            style={{ color: textMuted }}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Brand({ darkMode = false }) {
  const logoUrl = useLogoUrl(darkMode);
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0 overflow-hidden"
        style={{ background: logoUrl ? "#fff" : "linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%)", border: logoUrl ? "1px solid #E2E8F0" : "none" }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
        ) : (
          <GraduationCap size={18} strokeWidth={2.25} className="text-white" />
        )}
      </div>
      <span className="text-sm font-bold text-slate-800">BTR ትምህርት</span>
    </div>
  );
}

/* ----------------------------- Login screen ----------------------------- */

function LoginScreen({ data, setData, onAdminLogin, onStudentLogin, onAdminSetup }) {
  const systemPrefersDark = usePrefersDarkSystem();
  const logoUrl = useAuthLogoUrl(systemPrefersDark);
  // One shared sign-in form for students and the admin (no role switcher).
  const [idValue, setIdValue] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [pendingDeviceConflict, setPendingDeviceConflict] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetStudentId, setResetStudentId] = useState("");
  const [resetName, setResetName] = useState("");
  const [resetPw, setResetPw] = useState("");
  const [resetPw2, setResetPw2] = useState("");
  const [resetErr, setResetErr] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  const [signupMode, setSignupMode] = useState(false);
  const [signupName, setSignupName] = useState("");
  const [signupId, setSignupId] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPw, setSignupPw] = useState("");
  const [signupPw2, setSignupPw2] = useState("");
  const [signupErr, setSignupErr] = useState("");
  const [showSignupPw, setShowSignupPw] = useState(false);

  const resetSignupForm = () => {
    setSignupName("");
    setSignupId(generateStudentId(data?.students));
    setSignupEmail("");
    setSignupPw("");
    setSignupPw2("");
    setSignupErr("");
  };

  const handleSignupSubmit = () => {
    setSignupErr("");
    if (!signupName.trim()) {
      setSignupErr("Enter your full name.");
      return;
    }
    if (!signupId.trim()) {
      setSignupErr("Choose a Student ID.");
      return;
    }
    const clash = (data?.students || []).some(
      (s) => s.studentId.toLowerCase() === signupId.trim().toLowerCase()
    );
    if (clash) {
      setSignupErr("That Student ID is already taken. Choose another.");
      return;
    }
    if (signupEmail.trim()) {
      const emailClash = (data?.students || []).some(
        (s) => s.email && s.email.trim().toLowerCase() === signupEmail.trim().toLowerCase()
      );
      if (emailClash) {
        setSignupErr("That email is already linked to another account.");
        return;
      }
    }
    if (signupPw.length < 4) {
      setSignupErr("Password must be at least 4 characters.");
      return;
    }
    if (signupPw !== signupPw2) {
      setSignupErr("Passwords don't match.");
      return;
    }
    const newStudent = {
      id: uid("stu"),
      name: signupName.trim(),
      studentId: signupId.trim(),
      password: signupPw,
      grade: "",
      email: signupEmail.trim(),
      planType: "",
      planPrice: "",
      expiresAt: "",
      createdAt: new Date().toISOString(),
    };
    setData((prev) =>
      withActivity(
        { ...prev, students: [...(prev.students || []), newStudent] },
        "Student created their own account",
        `${newStudent.name} (${newStudent.studentId})`,
        `${newStudent.name} (self-service)`
      )
    );
    resetSignupForm();
    setSignupMode(false);
    proceedStudentLogin(newStudent);
  };

  const handleResetSubmit = () => {
    setResetErr("");
    const student = (data?.students || []).find(
      (s) => s.studentId.toLowerCase() === resetStudentId.trim().toLowerCase()
    );
    if (!student) {
      setResetErr("No student found with that ID.");
      return;
    }
    if (student.name.trim().toLowerCase() !== resetName.trim().toLowerCase()) {
      setResetErr("That name doesn't match our records for this Student ID.");
      return;
    }
    if (resetPw.length < 4) {
      setResetErr("New password must be at least 4 characters.");
      return;
    }
    if (resetPw !== resetPw2) {
      setResetErr("Passwords don't match.");
      return;
    }
    setData((prev) =>
      withActivity(
        {
          ...prev,
          students: (prev.students || []).map((s) => (s.id === student.id ? { ...s, password: resetPw } : s)),
        },
        "Student reset password",
        `${student.name} (${student.studentId})`,
        `${student.name} (self-service)`
      )
    );
    setResetSuccess(true);
  };

  const adminExists = !!data?.adminAccount;
  const mySessionId = useMemo(() => {
    try {
      return memoryStorage.getItem("btr-admin-session-id") || null;
    } catch {
      return null;
    }
  }, []);

  const myStudentDeviceId = useMemo(() => {
    try {
      let sid = memoryStorage.getItem("btr-student-session-id");
      if (!sid) {
        sid = uid("sess");
        memoryStorage.setItem("btr-student-session-id", sid);
      }
      return sid;
    } catch {
      return uid("sess");
    }
  }, []);

  const activeSession = data?.adminSession || null;
  const hasOtherActiveSession = !!(
    activeSession &&
    activeSession.sessionId &&
    activeSession.sessionId !== mySessionId &&
    Date.now() - new Date(activeSession.loggedInAt).getTime() < 1000 * 60 * 60 * 12 // treat sessions older than 12h as stale
  );

  const [pendingStudentConflict, setPendingStudentConflict] = useState(null); // { student, activeSession } | null

  const getActiveStudentSession = (studentId) => {
    const s = data?.studentSessions?.[studentId];
    if (!s || !s.sessionId) return null;
    if (s.sessionId === myStudentDeviceId) return null;
    if (Date.now() - new Date(s.loggedInAt).getTime() >= 1000 * 60 * 60 * 12) return null; // stale
    return s;
  };

  const proceedAdminLogin = () => {
    onAdminLogin();
  };

  const proceedStudentLogin = (student) => {
    onStudentLogin(student, myStudentDeviceId);
  };

  const googleClientId = data?.branding?.googleClientId || "";

  const handleGoogleCredential = (credentialResponse) => {
    setErr("");
    const payload = decodeGoogleCredential(credentialResponse?.credential);
    if (!payload?.email) {
      setErr("Couldn't sign in with Google. Please try again.");
      return;
    }
    const email = payload.email.trim().toLowerCase();
    const existing = (data?.students || []).find(
      (s) => (s.email && s.email.trim().toLowerCase() === email) || (s.googleId && s.googleId === payload.sub)
    );
    if (existing) {
      const otherSession = getActiveStudentSession(existing.studentId);
      if (otherSession) {
        setPendingStudentConflict({ student: existing, activeSession: otherSession });
        return;
      }
      proceedStudentLogin(existing);
      return;
    }
    const newStudent = {
      id: uid("stu"),
      name: payload.name || payload.email.split("@")[0],
      studentId: generateStudentId(data?.students),
      password: "",
      grade: "",
      email: payload.email,
      googleId: payload.sub,
      authProvider: "google",
      planType: "",
      planPrice: "",
      expiresAt: "",
      createdAt: new Date().toISOString(),
    };
    setData((prev) =>
      withActivity(
        { ...prev, students: [...(prev.students || []), newStudent] },
        "Student signed up with Google",
        `${newStudent.name} (${newStudent.studentId})`,
        `${newStudent.name} (self-service)`
      )
    );
    proceedStudentLogin(newStudent);
  };

  const googleBtnRef = useGoogleSignInButton(
    googleClientId,
    handleGoogleCredential,
    signupMode || resetMode
  );


  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErr("");
    const typed = idValue.trim().toLowerCase();
    if (!typed) {
      setErr("Enter your User ID.");
      return;
    }

    // One unified login: if the credentials match the admin account, sign in
    // as admin; otherwise fall through to the student lookup.
    if (adminExists && typed === String(data.adminAccount.username || "").toLowerCase()) {
      if (password !== data.adminAccount.password) {
        setErr("Incorrect password.");
        return;
      }
      if (hasOtherActiveSession) {
        setPendingDeviceConflict(true);
        return;
      }
      proceedAdminLogin();
      return;
    }

    const student = data.students.find(
      (s) =>
        s.studentId.toLowerCase() === typed ||
        (s.email && s.email.trim().toLowerCase() === typed)
    );
    if (!student) {
      if (!adminExists && password.length >= 4) {
        // First-run: no admin exists yet, so these credentials create it.
        onAdminSetup({ username: idValue.trim(), password });
        return;
      }
      setErr("No account found with that ID or email.");
      return;
    }
    if (!student.password && student.authProvider === "google") {
      setErr("This account signs in with Google. Use \"Continue with Google\" below.");
      return;
    }
    if (student.password && student.password !== password) {
      setErr("Incorrect password.");
      return;
    }
    const otherSession = getActiveStudentSession(student.studentId);
    if (otherSession) {
      setPendingStudentConflict({ student, activeSession: otherSession });
      return;
    }
    proceedStudentLogin(student);
  };


  return (
    <div
      className="relative flex min-h-screen w-full flex-col overflow-x-hidden"
      style={{
        backgroundImage: `url(${APP_BG_URL})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "#F4F5F8",
      }}
    >
      {pendingDeviceConflict && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.55)" }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4">
              <AlertCircle size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Already signed in elsewhere</h3>
            <p className="mt-2 text-sm text-slate-500">
              This admin account is currently active on <span className="font-semibold text-slate-700">{activeSession?.deviceLabel || "another device"}</span>
              {activeSession?.loggedInAt ? ` since ${fmtDate(activeSession.loggedInAt)}` : ""}. Signing in here will sign that device out.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setPendingDeviceConflict(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setPendingDeviceConflict(false);
                  proceedAdminLogin();
                }}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition"
              >
                Sign in anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingStudentConflict && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.55)" }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4">
              <AlertCircle size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Already signed in elsewhere</h3>
            <p className="mt-2 text-sm text-slate-500">
              This Student ID is currently active on{" "}
              <span className="font-semibold text-slate-700">
                {pendingStudentConflict.activeSession?.deviceLabel || "another device"}
              </span>
              {pendingStudentConflict.activeSession?.loggedInAt
                ? ` since ${fmtDate(pendingStudentConflict.activeSession.loggedInAt)}`
                : ""}
              . Signing in here will sign that device out.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setPendingStudentConflict(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const student = pendingStudentConflict.student;
                  setPendingStudentConflict(null);
                  proceedStudentLogin(student);
                }}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition"
              >
                Sign in anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 mx-auto w-full max-w-sm flex-1 px-6" style={{ paddingTop: "2.5vh", paddingBottom: "1vh" }}>

        {resetMode ? (
          resetSuccess ? (
            <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Check size={22} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Password updated</h2>
              <p className="mt-1.5 text-sm text-slate-500">You can now sign in with your new password.</p>
              <button
                type="button"
                onClick={() => {
                  setResetMode(false);
                  setResetSuccess(false);
                  setResetStudentId("");
                  setResetName("");
                  setResetPw("");
                  setResetPw2("");
                }}
                className="mt-6 w-full rounded-2xl bg-[#1141B0] py-4 text-[15px] font-bold text-white"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => { setResetMode(false); setResetErr(""); }}
                className="mb-4 inline-flex items-center gap-1 text-[15px] font-bold text-[#1141B0]"
              >
                <ChevronLeft size={20} /> Back to sign in
              </button>
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900">Reset your password</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter your Student ID and full name exactly as registered to verify it's you.
                </p>
                <div className="mt-5 space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-bold text-slate-900">Student ID</p>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-[15px] outline-none focus:border-[#1141B0]"
                      placeholder="e.g. BTR-00054"
                      value={resetStudentId}
                      onChange={(e) => setResetStudentId(e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-bold text-slate-900">Full name (as registered)</p>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-[15px] outline-none focus:border-[#1141B0]"
                      placeholder="e.g. Hana Tesfaye"
                      value={resetName}
                      onChange={(e) => setResetName(e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-bold text-slate-900">New password</p>
                    <input
                      type="password"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-[15px] outline-none focus:border-[#1141B0]"
                      placeholder="At least 4 characters"
                      value={resetPw}
                      onChange={(e) => setResetPw(e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-bold text-slate-900">Confirm new password</p>
                    <input
                      type="password"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-[15px] outline-none focus:border-[#1141B0]"
                      placeholder="Re-enter new password"
                      value={resetPw2}
                      onChange={(e) => setResetPw2(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleResetSubmit(); }}
                    />
                  </div>
                  {resetErr && (
                    <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <span>{resetErr}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleResetSubmit}
                    className="w-full rounded-2xl bg-[#1141B0] py-4 text-[15px] font-bold text-white"
                  >
                    Update password
                  </button>
                </div>
              </div>
            </div>
          )
        ) : signupMode ? (
          <>
            <button
              type="button"
              onClick={() => { setSignupMode(false); setSignupErr(""); }}
              className="flex items-center gap-1.5 self-start text-sm font-semibold"
              style={{ color: AUTH_BLUE }}
            >
              <ArrowLeft size={16} /> Back to sign in
            </button>

            <div className="flex shrink-0 flex-col items-center text-center" style={{ marginTop: "1vh" }}>
              <img
                src={logoUrl}
                alt="BTR ትምህርት logo"
                style={{ height: "14vh", maxHeight: 132, width: "auto", objectFit: "contain" }}
              />
              <h2 className="font-bold text-slate-900" style={{ marginTop: "1.4vh", fontSize: "clamp(19px, 2.6vh, 24px)" }}>
                Create your account
              </h2>
              <p className="text-slate-500" style={{ marginTop: "0.6vh", fontSize: "clamp(12px, 1.7vh, 14px)" }}>
                Set up your student profile to start your learning journey
              </p>
            </div>


            <div className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
              <p className="mb-2 text-[15px] font-bold text-slate-900">Full name</p>
              <div className="relative mb-4">
                <span className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-[#EAF0FB] text-[#1141B0]">
                  <User size={18} />
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-[15px] outline-none focus:border-[#1141B0]"
                  placeholder="e.g. Hana Tesfaye"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  autoComplete="name"
                />
              </div>

              <p className="mb-2 text-[15px] font-bold text-slate-900">Your Student ID</p>
              <div className="relative">
                <span className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-[#EAF0FB] text-[#1141B0]">
                  <GraduationCap size={18} />
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-[15px] font-bold text-slate-900 outline-none"
                  value={signupId}
                  readOnly
                />
              </div>
              <p className="mb-4 mt-1.5 text-[13px] text-slate-400">
                Assigned automatically — you'll use this to log in.
              </p>

              <p className="mb-2 text-[15px] font-bold text-slate-900">Email (optional)</p>
              <div className="relative">
                <span className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-[#EAF0FB] text-[#1141B0]">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-[15px] outline-none focus:border-[#1141B0]"
                  placeholder="you@email.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <p className="mb-4 mt-1.5 text-[13px] text-slate-400">
                Lets you sign in with your email instead of your Student ID.
              </p>

              <p className="mb-2 text-[15px] font-bold text-slate-900">Password</p>
              <div className="relative mb-4">
                <span className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-[#EAF0FB] text-[#1141B0]">
                  <Lock size={18} />
                </span>
                <input
                  type={showSignupPw ? "text" : "password"}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-12 text-[15px] outline-none focus:border-[#1141B0]"
                  placeholder="At least 4 characters"
                  value={signupPw}
                  onChange={(e) => setSignupPw(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPw((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showSignupPw ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <p className="mb-2 text-[15px] font-bold text-slate-900">Confirm password</p>
              <div className="relative mb-5">
                <span className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-[#EAF0FB] text-[#1141B0]">
                  <Lock size={18} />
                </span>
                <input
                  type={showSignupPw ? "text" : "password"}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-12 text-[15px] outline-none focus:border-[#1141B0]"
                  placeholder="Re-enter your password"
                  value={signupPw2}
                  onChange={(e) => setSignupPw2(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSignupSubmit(); }}
                  autoComplete="new-password"
                />
              </div>

              {signupErr && (
                <div className="mb-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{signupErr}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSignupSubmit}
                className="flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-[16px] font-bold text-white transition hover:brightness-110"
                style={{ background: "linear-gradient(90deg,#1141B0,#1B54D8)" }}
              >
                Create account <ArrowRight size={18} />
              </button>
              <p className="mt-3 text-center text-[13px] text-slate-500">
                You'll be signed in right away with these details.
              </p>
            </div>

            <a
              href="https://t.me/BTRTmhrt"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1141B0] text-white">
                <Send size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-slate-900">BTR Support</p>
                <p className="text-[13px] text-slate-500">Trouble signing in? Get help on Telegram</p>
              </div>
              <span className="shrink-0 rounded-full border border-[#B9CCEE] px-4 py-2 text-[13px] font-bold text-[#1141B0]">
                Contact
              </span>
            </a>
          </>
        ) : (
          <>
            <div className="flex shrink-0 flex-col items-center text-center" style={{ paddingTop: "3.5vh" }}>
              <img
                src={logoUrl}
                alt="BTR ትምህርት logo"
                style={{ height: "21vh", maxHeight: 208, width: "auto", objectFit: "contain" }}
              />
              <p style={{ marginTop: "1vh", color: "#64748B", fontSize: "clamp(12px, 1.9vh, 16px)" }}>
                Your learning journey starts here
              </p>
            </div>

            <div className="flex shrink-0 items-center justify-center" style={{ marginTop: "4vh" }}>
              <span
                className="pb-1 font-bold"
                style={{ color: AUTH_BLUE, borderBottom: `3px solid ${AUTH_BLUE}`, fontSize: "clamp(18px, 3vh, 26px)" }}
              >
                Login
              </span>
            </div>

            <div style={{ marginTop: "3vh" }}>

              <p className="text-sm font-bold text-slate-900">User ID</p>
              <div className="relative" style={{ marginTop: 6, marginBottom: "2.4vh", height: "5vh", minHeight: 40, maxHeight: 48 }}>
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: AUTH_BLUE }}>
                  <User size={19} />
                </span>
                <input
                  className="h-full w-full rounded-2xl border border-slate-200 bg-white/60 pl-12 pr-4 text-[15px] text-slate-800 outline-none transition focus:border-[#123FBE]"
                  placeholder="Enter your User ID"
                  value={idValue}
                  onChange={(e) => setIdValue(e.target.value)}
                  autoComplete="username"
                />
              </div>

              <p className="text-sm font-bold text-slate-900">Password</p>
              <div className="relative" style={{ marginTop: 6, height: "5vh", minHeight: 40, maxHeight: 48 }}>
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: AUTH_BLUE }}>
                  <Lock size={19} />
                </span>
                <input
                  type={showPw ? "text" : "password"}
                  className="h-full w-full rounded-2xl border border-slate-200 bg-white/60 pl-12 pr-14 text-[15px] text-slate-800 outline-none transition focus:border-[#123FBE]"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(e); }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400"
                >
                  {showPw ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 text-[13px]" style={{ marginTop: "3vh" }}>

                <p className="text-slate-700">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setSignupMode(true); setErr(""); resetSignupForm(); }}
                    className="font-semibold text-[#1141B0]"
                  >
                    Create Account
                  </button>
                </p>
                <button
                  type="button"
                  onClick={() => { setResetMode(true); setErr(""); }}
                  className="shrink-0 font-semibold text-[#1141B0]"
                >
                  Forgot password?
                </button>
              </div>

              {err && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{err}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                className="flex w-full items-center justify-center gap-3 rounded-2xl font-semibold text-white transition hover:brightness-110"
                style={{
                  marginTop: "2.2vh",
                  paddingTop: "1.9vh",
                  paddingBottom: "1.9vh",
                  background: AUTH_BLUE,
                  boxShadow: "0 12px 24px -12px rgba(18,63,190,0.6)",
                  fontSize: "clamp(15px, 2.3vh, 19px)",
                }}
              >
                {adminExists ? "Login" : "Create admin account"} <ArrowRight size={20} />
              </button>

              {googleClientId && (
                <>
                  <div className="flex items-center gap-4" style={{ marginTop: "2.6vh" }}>
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-[13px] text-slate-500">or</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  <div
                    className="flex justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"
                    style={{ marginTop: "2.2vh", paddingTop: "1.2vh", paddingBottom: "1.2vh" }}
                  >
                    <div ref={googleBtnRef} />
                  </div>
                </>
              )}

              <div
                className="flex items-center justify-center gap-2 text-[13px] text-slate-700"
                style={{ marginTop: "2.9vh" }}
              >
                <span>Do you have any question?</span>
                <a
                  href="https://t.me/BTRTmhrt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold"
                  style={{ color: AUTH_BLUE }}
                >
                  <Send size={17} /> Chatbot
                </a>
              </div>
            </div>
          </>
        )}
      </div>

      <footer
        className="relative z-10 flex w-full shrink-0 items-center justify-center text-center text-[11px]"
        style={{ paddingTop: "2.5vh", paddingBottom: "2.5vh", background: "#E4E8F5", color: "#64748B" }}
      >
        © 2026 BTR ትምህርት. All Rights Reserved v1.
      </footer>


    </div>
  );
}

/* ----------------------------- Link pill ----------------------------- */

function MaterialLink({ url, htmlContent, htmlUrl, fileName, label = "Open material", onOpenInApp, variant = "text", size = "md" }) {
  const pillClass =
    size === "sm"
      ? "shrink-0 whitespace-nowrap rounded-full border border-sky-200 px-3 py-1 text-xs font-bold text-sky-600 transition hover:bg-sky-50"
      : "shrink-0 whitespace-nowrap rounded-full border border-sky-200 px-4 py-2 text-sm font-bold text-sky-600 transition hover:bg-sky-50";
  const filledClass =
    size === "sm"
      ? "shrink-0 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-blue-700"
      : "shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700";
  const textClass = "inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:text-sky-800 transition";
  const className = variant === "pill" ? pillClass : variant === "filled" ? filledClass : textClass;

  if (htmlContent || htmlUrl) {
    return (
      <button
        type="button"
        onClick={() => onOpenInApp && onOpenInApp({ htmlContent, htmlUrl }, "Material")}
        className={className}
      >
        {label}
        {variant === "filled" && <ArrowRight size={14} />}
        {variant !== "pill" && variant !== "filled" && <ExternalLink size={14} />}
      </button>
    );
  }
  const href = normalizeUrl(url);
  if (!href) {
    return <span className="text-xs text-slate-400 italic">No material attached</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onOpenInApp && onOpenInApp(toEmbeddableUrl(href), "Material")}
      className={className}
    >
      {label}
      {variant === "filled" && <ArrowRight size={14} />}
      {variant !== "pill" && variant !== "filled" && <ExternalLink size={14} />}
    </button>
  );
}

// A small inline pill shown next to Pro-locked content so students can see
// at a glance, before tapping, that a subscription is required.
function ProBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
      <Crown size={11} /> PRO
    </span>
  );
}

/* ----------------------------- Subscription request flow -----------------------------
   Shown when a student taps Pro-only content without an active subscription.
   Three steps, each a full-screen overlay:
     1. SubscriptionPlansScreen — pick 6-month or 1-year plan
     2. TelebirrPaymentScreen  — shows the Telebirr account to pay to, and a
        form (BTR ID, BTR Name, transaction screenshot) that gets queued as a
        pending request for the admin to verify
     3. SubscriptionRequestSuccessScreen — confirms submission
--------------------------------------------------------------------- */

const PLAN_FEATURES = [
  "Access to all study notes",
  "Unlimited mock exams",
  "Mid exams with answers",
  "Regular content updates",
  "Use on all your devices",
];

const PLAN_PERKS = [
  { icon: GraduationCap, title: "Final Exam", desc: "Comprehensive prep for every freshman course", bg: "#EDE9FE", color: "#7C3AED" },
  { icon: BookOpen, title: "Study Notes", desc: "Well-structured notes for every important topic", bg: "#DBEAFE", color: "#2563EB" },
  { icon: FileText, title: "Mock Exams", desc: "Practice with timed tests and instant results", bg: "#DCFCE7", color: "#15803D" },
  { icon: Sparkles, title: "Mid Exam", desc: "Past mid exams with detailed answers", bg: "#FFEDD5", color: "#EA580C" },
];

function SubscriptionPlansScreen({ data, onClose, onSelectPlan }) {
  const logoUrl = useLogoUrl();
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "#F6F7FB" }}>
      <div className="mx-auto flex w-full max-w-sm items-center justify-end px-5 pt-6">
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mx-auto w-full max-w-sm px-5 pb-12">
        <div className="mt-2 flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full"
            style={{ background: logoUrl ? "#fff" : "linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%)", border: logoUrl ? "1px solid #E2E8F0" : "none" }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <GraduationCap size={28} strokeWidth={2.25} className="text-white" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-slate-900">BTR ትምህርት</h1>
            <p className="text-base font-semibold text-slate-400">Premium Access</p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <CheckCircle2 size={13} className="text-emerald-500" /> Study smarter. Practice more. Succeed anywhere.
            </p>
          </div>
        </div>

        <h2 className="mt-7 text-lg font-extrabold text-slate-900">Choose the plan that fits you best</h2>
        <p className="mt-1 text-sm text-slate-500">Unlock all premium content and ace any exam.</p>

        <div className="mt-5 flex flex-col gap-4">
          {SUBSCRIPTION_PLAN_OPTIONS.map((plan) => {
            const planIconUrl = data?.planIcons?.[plan.id] || null;
            const best = !!plan.bestValue;
            const accent = best ? "#15803D" : "#6D28D9";
            const tint = best ? "#DCFCE7" : "#EDE9FE";
            return (
              <div key={plan.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                    style={{ background: tint, color: accent }}
                  >
                    {planIconUrl ? (
                      <img src={planIconUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <CalendarClock size={20} />
                    )}
                  </span>
                  <div>
                    <div className="text-base font-extrabold text-slate-900">{plan.label}</div>
                    <div className="text-xs font-semibold" style={{ color: accent }}>{plan.subtitle}</div>
                  </div>
                </div>

                <div className="my-4 h-px bg-slate-100" />

                <div className="flex items-baseline gap-2">
                  <span className="text-[40px] font-extrabold leading-none" style={{ color: accent }}>{plan.price}</span>
                  <span className="text-sm font-semibold text-slate-500">Birr</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Clock size={13} style={{ color: accent }} /> {plan.validText}
                </div>

                {plan.savingsText && (
                  <div className="mt-3 rounded-2xl px-3 py-2.5" style={{ background: tint }}>
                    <div className="text-sm font-extrabold" style={{ color: accent }}>Save 100 Birr</div>
                    <div className="text-[11px] font-medium text-slate-600">33% OFF compared to 6-month plan</div>
                  </div>
                )}

                <ul className="mt-4 space-y-2">
                  {PLAN_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[13px] font-medium text-slate-700">
                      <CheckCircle2 size={15} style={{ color: accent }} /> {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => onSelectPlan(plan)}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border py-3.5 text-sm font-bold transition"
                  style={
                    best
                      ? { background: accent, borderColor: accent, color: "#fff" }
                      : { background: "#fff", borderColor: accent, color: accent }
                  }
                >
                  Subscribe Now <ArrowRight size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <h3 className="text-base font-extrabold text-slate-900">What you get</h3>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {PLAN_PERKS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-slate-100 bg-white p-3 text-center shadow-sm">
              <span
                className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: p.bg, color: p.color }}
              >
                <p.icon size={19} />
              </span>
              <div className="text-sm font-bold text-slate-900">{p.title}</div>
              <div className="mt-1 text-[11px] leading-snug text-slate-500">{p.desc}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-slate-100 bg-white p-3">
          {[
            { icon: ShieldCheck, title: "Secure Payment", desc: "100% safe & secure" },
            { icon: CalendarClock, title: "Cancel Anytime", desc: "No commitment" },
            { icon: Mail, title: "24/7 Support", desc: "We're here to help" },
          ].map((it) => (
            <div key={it.title} className="text-center">
              <it.icon size={17} className="mx-auto mb-1 text-slate-500" />
              <div className="text-[11px] font-bold text-slate-800">{it.title}</div>
              <div className="text-[10px] text-slate-500">{it.desc}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <Lock size={12} /> Your payment is secure and encrypted
        </div>
      </div>
    </div>
  );
}


function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className="flex-1 text-center">
      <div className="text-[11px] font-semibold text-slate-400">{label}</div>
      <div className="mt-1 text-base font-extrabold text-slate-900">{value}</div>
      <button
        onClick={copy}
        className="mt-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
        title="Copy"
      >
        {copied ? <Check size={13} className="text-emerald-600" /> : <Paperclip size={13} />}
      </button>
    </div>
  );
}

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024; // 5MB, matches the "Max 5MB" hint on the upload field

function TelebirrPaymentScreen({ student, plan, onBack, onClose, onSubmit }) {
  const [btrId, setBtrId] = useState(student?.studentId || "");
  const [btrName, setBtrName] = useState(student?.name || "");
  const [screenshotDataUrl, setScreenshotDataUrl] = useState(null);
  const [screenshotFileName, setScreenshotFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    setFileError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFileError("Please choose an image file (JPG or PNG).");
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setFileError("That screenshot is too large. Please use one under 5MB.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImageFile(file, "payment-screenshots");
      setScreenshotDataUrl(url);
      setScreenshotFileName(file.name);
    } catch (e) {
      setFileError(e?.message || "Couldn't upload that file. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const canSubmit = btrId.trim() && btrName.trim() && screenshotDataUrl && !uploading;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "#EEF3FC" }}>
      <div className="mx-auto flex w-full max-w-sm items-center justify-between px-5 pt-6">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
          <Bell size={18} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-sky-500" />
        </span>
      </div>

      <div className="mx-auto w-full max-w-sm px-5 pb-12">
        <h1 className="mt-4 text-center text-2xl font-extrabold text-slate-900">Complete Your Subscription</h1>
        <p className="mt-1.5 text-center text-sm text-slate-500">Follow the steps below to activate your plan</p>

        <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg,#38BDF8,#F59E0B)" }}>
              <CreditCard size={18} className="text-white" />
            </span>
            <div>
              <div className="text-xs font-semibold text-blue-600">Send payment to</div>
              <div className="text-base font-extrabold text-slate-900">BTR Telebirr Account</div>
            </div>
          </div>

          <div className="mt-4 flex items-center rounded-2xl bg-slate-50 py-4">
            <CopyField label="Phone Number" value={TELEBIRR_PHONE_NUMBER} />
            <div className="h-10 w-px bg-slate-200" />
            <CopyField label="Account Name" value={TELEBIRR_ACCOUNT_NAME} />
          </div>

          <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-blue-50 p-3.5">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-blue-600" />
            <p className="text-xs font-medium leading-relaxed text-blue-800">
              After sending the payment, please fill in the information below and upload your transaction screenshot.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="text-base font-extrabold text-slate-900">Enter Your Details</h3>

          <div className="mt-4 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <User size={17} />
            </span>
            <div className="flex-1">
              <div className="mb-1 text-xs font-semibold text-slate-500">BTR ID</div>
              <input
                className={inputCls}
                value={btrId}
                onChange={(e) => setBtrId(e.target.value)}
                placeholder="Enter your BTR ID"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <User size={17} />
            </span>
            <div className="flex-1">
              <div className="mb-1 text-xs font-semibold text-slate-500">BTR Name</div>
              <input
                className={inputCls}
                value={btrName}
                onChange={(e) => setBtrName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
          </div>

          <div className="mt-4 text-xs font-semibold text-slate-500">Transaction Screenshot</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="mt-1.5 flex w-full items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-3.5 text-left transition hover:border-blue-300 disabled:opacity-60"
          >
            {screenshotDataUrl ? (
              <img src={screenshotDataUrl} alt="Screenshot preview" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                <ImageIcon size={18} />
              </span>
            )}
            <span className="min-w-0">
              {uploading ? (
                <span className="text-sm font-semibold text-blue-600">Uploading…</span>
              ) : screenshotDataUrl ? (
                <>
                  <span className="block truncate text-sm font-semibold text-slate-700">{screenshotFileName}</span>
                  <span className="text-xs font-medium text-blue-600">Tap to change</span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-blue-600">
                    <UploadCloud size={15} /> Upload Screenshot
                  </span>
                  <span className="text-xs text-slate-400">JPG, PNG (Max 5MB)</span>
                </>
              )}
            </span>
          </button>
          {fileError && <p className="mt-1.5 text-xs font-semibold text-rose-500">{fileError}</p>}

          <button
            onClick={() =>
              canSubmit &&
              onSubmit({
                btrId: btrId.trim(),
                btrName: btrName.trim(),
                screenshotDataUrl,
                screenshotFileName,
              })
            }
            disabled={!canSubmit}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold text-white transition disabled:opacity-40"
            style={{ background: "linear-gradient(to right, #2563EB, #1D4ED8)" }}
          >
            Submit &amp; Verify <ArrowRight size={16} />
          </button>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-slate-400" />
            <p className="text-xs text-slate-500">Your subscription will be activated after verification.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubscriptionRequestSuccessScreen({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.55)" }}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={26} />
        </div>
        <h3 className="mt-4 text-lg font-bold text-slate-900">Request submitted</h3>
        <p className="mt-2 text-sm text-slate-500">
          We've sent your payment details to the BTR ትምህርት admin for verification. Your plan will be activated once it's approved.
        </p>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl py-3 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(to right, #0EA5E9, #2563EB)" }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

// Shared row layout used for both notes and exam listings: an icon in a
// soft circle, title (with optional pin), a row of small badge pills, and
// either an outlined "Open" button or a compact "Subscribers only" lock
// affordance on the right — matching BTR's file-list design.
function UnlockBanner({ label, onUnlock }) {
  return (
    <button
      type="button"
      onClick={onUnlock}
      className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-blue-100 bg-[#F1F6FE] p-3 text-left transition hover:bg-[#E8F0FE]"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100">
        <Lock size={22} className="text-blue-600" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-extrabold text-slate-900">
          Get all <span className="text-blue-600">{label}</span>
        </span>
        <span className="block text-xs text-slate-500">Tap to unlock all materials</span>
      </span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
        <ChevronRight size={18} />
      </span>
    </button>
  );
}

function ContentRow({ icon: Icon, title, pinned, badges, locked, onUnlock, openSlot }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${locked ? "bg-blue-50" : "bg-sky-50"}`}>
          {locked ? <Lock size={19} className="text-blue-500" /> : <Icon size={19} className="text-sky-600" />}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {pinned && <Pin size={12} className="fill-amber-400 text-amber-500 shrink-0" />}
            <span className="truncate text-[15px] font-bold text-slate-800">{title}</span>
          </div>
          {badges && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{badges}</div>}
        </div>
      </div>

      {locked ? (
        <button
          type="button"
          onClick={onUnlock}
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-amber-600"
        >
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1.5 transition hover:bg-amber-100">
            <Lock size={11} /> Subscribers only
          </span>
          <ChevronRight size={16} className="text-slate-400" />
        </button>
      ) : (
        openSlot
      )}
    </div>
  );
}


/* ----------------------------- In-app HTML viewer ----------------------------- */

function ViewerTopBar({ t, brandName, onClose, isDark, onToggleDark }) {
  const logoUrl = useViewerLogoUrl(isDark);
  return (
    <div style={{ background: t.headerBg }}>
      <div
        className="flex items-center gap-2 border-b px-2 py-1.5"
        style={{ borderColor: t.cardBorder }}
      >
        <button
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ color: t.textPrimary }}
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex min-w-0 flex-1 items-center">
          <img
            src={logoUrl}
            alt={brandName || "Logo"}
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
        </div>

        {onToggleDark && (
          <button
            onClick={onToggleDark}
            role="switch"
            aria-checked={!!isDark}
            aria-label="Toggle dark mode"
            className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
            style={{ background: isDark ? "#2563EB" : "#DBEAFE" }}
          >
            <span
              className="absolute top-1 flex h-5 w-5 items-center justify-center rounded-full transition-all"
              style={{
                left: isDark ? "calc(100% - 24px)" : "4px",
                background: "#FFFFFF",
                color: isDark ? "#2563EB" : "#94A3B8",
                boxShadow: "0 1px 3px rgba(15,23,42,0.25)",
              }}
            >
              <Moon size={12} />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}


// Injected into viewer HTML so uploaded (light-styled) materials follow the
// app's dark mode toggle.
const VIEWER_DARK_CSS = `
<style id="btr-dark-mode">
  html { filter: invert(1) hue-rotate(180deg); background: #ffffff !important; }
  img, video, canvas, svg image, iframe, [style*="background-image"] {
    filter: invert(1) hue-rotate(180deg);
  }
</style>`;

function applyViewerTheme(html, isDark) {
  if (!html) return html;
  if (!isDark) return html;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${VIEWER_DARK_CSS}</head>`);
  return VIEWER_DARK_CSS + html;
}


function HtmlViewerModal({ url, htmlContent, htmlUrl, title, onClose, theme, brandName, isDark, onToggleDark }) {

  const t = theme || getTheme(false);
  const [status, setStatus] = useState(htmlContent ? "loaded" : "loading"); // loading | loaded | failed
  const [resolvedHtml, setResolvedHtml] = useState(htmlContent || "");
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (htmlContent) {
      setResolvedHtml(htmlContent);
      setStatus("loaded");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setResolvedHtml("");

    if (htmlUrl) {
      // Our own storage-hosted upload: fetch the text and render it via
      // srcDoc (same trick as inline htmlContent) rather than pointing the
      // iframe straight at the URL, so this keeps working regardless of any
      // future storage CORS/frame changes.
      fetch(htmlUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then((text) => {
          if (cancelled) return;
          setResolvedHtml(text);
          setStatus("loaded");
        })
        .catch(() => {
          if (cancelled) return;
          setStatus("failed");
        });
      return () => {
        cancelled = true;
      };
    }

    // External link (Google Drive, YouTube, etc.) — try embedding it directly
    // and fall back to a "can't preview" message if it never loads.
    timeoutRef.current = setTimeout(() => {
      setStatus((s) => (s === "loading" ? "failed" : s));
    }, 6000);
    return () => {
      cancelled = true;
      clearTimeout(timeoutRef.current);
    };
  }, [url, htmlContent, htmlUrl]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: t.pageBg }}>
      <ViewerTopBar
        t={t}
        brandName={brandName}
        onClose={onClose}
        isDark={isDark}
        onToggleDark={onToggleDark}
      />



      {status === "failed" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <AlertCircle size={28} style={{ color: t.textSecondary }} />
          <p className="text-sm font-semibold" style={{ color: t.textPrimary }}>
            This material can't be previewed here.
          </p>
          <p className="text-xs" style={{ color: t.textSecondary }}>
            The source doesn't allow in-app previews. Ask your BTR admin to share it as a Google Drive, Docs, or YouTube link — or upload it as an HTML file — so it can be viewed here.
          </p>
        </div>
      ) : (
        <>
          {status === "loading" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <img
                src={DEFAULT_LOGO_URL}
                alt="BTR Learning"
                className="h-16 w-16 animate-pulse rounded-2xl"
              />
              <span className="text-xs text-slate-400">Loading material…</span>
            </div>
          )}
          <iframe
            src={resolvedHtml ? undefined : url}
            srcDoc={resolvedHtml ? applyViewerTheme(resolvedHtml, isDark) : undefined}
            title={title || "Material"}
            className="flex-1 w-full border-0"
            style={status === "loading" ? { position: "absolute", opacity: 0, pointerEvents: "none" } : undefined}
            onLoad={() => {
              clearTimeout(timeoutRef.current);
              setStatus("loaded");
            }}
            onContextMenu={(e) => e.preventDefault()}
          />
        </>
      )}
    </div>
  );
}

/* ----------------------------- Status badge ----------------------------- */

function StatusBadge({ status }) {
  const map = {
    Upcoming: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
    Ongoing: { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500" },
    Completed: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  };
  const s = map[status] || map.Upcoming;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${s.bg} ${s.text} px-2.5 py-1 text-xs font-semibold`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

/* ----------------------------- ADMIN: Dashboard ----------------------------- */

function AdminDashboard({ data, setData, onOpenInApp }) {
  const totalExamEntries = useMemo(
    () => Object.values(data.examCategories).reduce((sum, list) => sum + list.length, 0),
    [data.examCategories]
  );

  const recentNotes = useMemo(() => {
    return notesList(data)
      .slice()
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
      .slice(0, 4);
  }, [data.noteLinks]);

  const recentAnnouncements = useMemo(
    () =>
      [...data.announcements]
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return new Date(b.createdAt) - new Date(a.createdAt);
        })
        .slice(0, 3),
    [data.announcements]
  );

  const totalNotes = Object.values(data.noteLinks).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0
  );

  const stats = [
    { label: "Students", value: data.students.length, icon: Users, color: "#2563EB" },
    { label: "Exam entries", value: totalExamEntries, icon: FileText, color: "#7C3AED" },
    { label: "Notes posted", value: totalNotes, icon: StickyNote, color: "#D97706" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div
              className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: `${s.color}1A` }}
            >
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-sm text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
          <Megaphone size={16} className="text-sky-600" /> Latest announcements
        </h3>
        {recentAnnouncements.length === 0 ? (
          <p className="text-sm text-slate-400">No announcements yet — post one from the Announcements tab.</p>
        ) : (
          <div className="space-y-3">
            {recentAnnouncements.map((a) => (
              <div key={a.id} className="rounded-xl bg-slate-50 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  {a.pinned && <Pin size={12} className="fill-amber-400 text-amber-500 shrink-0" />}
                  <span className="truncate text-sm font-semibold text-slate-800">{a.title}</span>
                  <span className="ml-auto shrink-0 text-xs text-slate-400">{fmtDate(a.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500 line-clamp-2">{a.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
            <FileText size={16} className="text-sky-600" /> Exam materials by category
          </h3>
          <div className="space-y-3">
            {Object.entries(data.examCategories).map(([cat, list]) => (
              <div key={cat} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">{cat}</div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-slate-500">
                  {list.length} year{list.length === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
            <StickyNote size={16} className="text-amber-600" /> Recent notes
          </h3>
          {recentNotes.length === 0 ? (
            <p className="text-sm text-slate-400">Add a note from the Notes tab to see it here.</p>
          ) : (
            <div className="space-y-3">
              {recentNotes.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={n.pinned ? { background: "rgba(255,251,235,0.6)" } : { background: "#F8FAFC" }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: accentColor(n.title) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800">{n.title}</div>
                    <div className="text-xs text-slate-500">{n.noteType || NOTE_TYPES[0]}</div>
                  </div>
                  <MaterialLink url={n.link} htmlContent={n.htmlContent} htmlUrl={n.htmlUrl} fileName={n.fileName} label="Open" onOpenInApp={onOpenInApp} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- ADMIN: Students ----------------------------- */

function StudentFormFields({ form, set, data }) {
  return (
    <>
      <Field label="Full name">
        <input className={inputCls} value={form.name} onChange={set("name")} placeholder="e.g. Hana Tesfaye" />
      </Field>
      <Field label="Student ID">
        <input className={inputCls + " font-semibold tracking-wide text-slate-500"} value={form.studentId} readOnly />
      </Field>
      <Field label="Student password (optional)">
        <input className={inputCls} value={form.password} onChange={set("password")} placeholder="Leave blank for no password" />
      </Field>

      <div className="mt-1 mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Subscription</div>
      <Field label="Plan type">
        <input className={inputCls} value={form.planType} onChange={set("planType")} placeholder="e.g. 1 Year, 6 Months" />
      </Field>
      <Field label="Plan price (ETB, optional)">
        <input className={inputCls} value={form.planPrice} onChange={set("planPrice")} placeholder="e.g. 20,900.00" />
      </Field>
      <Field label="Expire date">
        <input type="date" className={inputCls} value={form.expiresAt} onChange={set("expiresAt")} />
      </Field>
    </>
  );
}

const emptyStudentForm = { name: "", studentId: "", password: "", planType: "", planPrice: "", expiresAt: "" };

// Used for editing an existing student — opens as a modal popup.
function StudentForm({ initial, onSave, onClose, data }) {
  const [form, setForm] = useState(initial || emptyStudentForm);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal title={initial ? "Edit student" : "Add student"} onClose={onClose}>
      <StudentFormFields form={form} set={set} data={data} />
      <button
        onClick={() => {
          if (!form.name.trim() || !form.studentId.trim()) return;
          onSave(form);
        }}
        className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
        style={{ background: 'linear-gradient(to right, #0EA5E9, #2563EB)' }}
      >
        {initial ? "Save changes" : "Add student"}
      </button>
    </Modal>
  );
}

// Used for adding a new student — expands inline below the "Add student" button
// instead of opening a modal, so the list stays visible while filling it in.
function InlineAddStudentForm({ open, students, onSave, onCancel, data }) {
  const [form, setForm] = useState(emptyStudentForm);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (open) setForm({ ...emptyStudentForm, studentId: generateStudentId(students) });
  }, [open]);

  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-out"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
          <StudentFormFields form={form} set={set} data={data} />
          <div className="mt-2 flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!form.name.trim() || !form.studentId.trim()) return;
                onSave(form);
              }}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(to right, #0EA5E9, #2563EB)' }}
            >
              Add student
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const SUBSCRIPTION_PRESETS = [
  { label: "1 Week", days: 7, price: "50" },
  { label: "1 Month", days: 30, price: "200" },
  { label: "3 Months", days: 90, price: "550" },
  { label: "6 Months", days: 182, price: "1000" },
  { label: "1 Year", days: 365, price: "1900" },
];

// Lets the admin activate (or extend) a student's Pro subscription in one
// click, using preset durations, instead of filling out the full edit form.
// Also offers a custom date and a way to revoke an active plan.
function QuickSubscribeModal({ student, onSave, onRevoke, onClose }) {
  const [preset, setPreset] = useState(null);
  const [customDate, setCustomDate] = useState(student.expiresAt || "");
  const [price, setPrice] = useState(student.planPrice || "");
  const sub = getSubscriptionStatus(student);

  const apply = (planType, expiresAt, planPrice) => {
    onSave({ ...student, planType, expiresAt, planPrice: planPrice ?? student.planPrice ?? "" });
  };

  return (
    <Modal title={`Make ${student.name} Pro`} onClose={onClose}>
      {sub.hasPlan && (
        <div
          className="mb-4 rounded-xl px-3 py-2.5 text-xs font-semibold"
          style={{
            background: sub.isExpired ? "#FEF2F2" : "#F0FDF4",
            color: sub.isExpired ? "#DC2626" : "#16A34A",
          }}
        >
          {sub.isExpired ? `Plan expired on ${student.expiresAt}` : `Currently active — expires ${student.expiresAt}`}
        </div>
      )}

      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Quick presets</div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SUBSCRIPTION_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              setPreset(p.label);
              setCustomDate(addDaysToToday(p.days));
              setPrice(p.price);
            }}
            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
              preset === p.label ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-600 hover:border-sky-300"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Field label="Expire date">
        <input
          type="date"
          className={inputCls}
          value={customDate}
          onChange={(e) => {
            setCustomDate(e.target.value);
            setPreset(null);
          }}
        />
      </Field>
      <Field label="Plan price (ETB, optional)">
        <input className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 200" />
      </Field>

      <button
        onClick={() => {
          if (!customDate) return;
          apply(preset || student.planType || "Custom", customDate, price);
          onClose();
        }}
        disabled={!customDate}
        className="mt-1 w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        style={{ background: 'linear-gradient(to right, #0EA5E9, #2563EB)' }}
      >
        Activate Pro access
      </button>

      {sub.hasPlan && (
        <button
          onClick={() => {
            onRevoke(student);
            onClose();
          }}
          className="mt-2 w-full rounded-xl border border-rose-200 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
        >
          Revoke subscription
        </button>
      )}
    </Modal>
  );
}

function AdminStudents({ data, setData }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [quickSubscribe, setQuickSubscribe] = useState(null);

  const filtered = data.students.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      (s.grade || "").toLowerCase().includes(query.toLowerCase()) ||
      s.studentId.toLowerCase().includes(query.toLowerCase())
  );

  const addStudent = (form) => {
    setData(withActivity({ ...data, students: [...data.students, { ...form, id: uid("stu") }] }, "Added student", `${form.name} (${form.studentId})`));
    setAdding(false);
  };
  const saveEdit = (form) => {
    setData(
      withActivity(
        {
          ...data,
          students: data.students.map((s) => (s.id === editing.id ? { ...form, id: s.id } : s)),
        },
        "Edited student",
        `${form.name} (${form.studentId})`
      )
    );
    setEditing(null);
  };
  const doDelete = (id) => {
    const target = data.students.find((s) => s.id === id);
    setData(
      withActivity(
        { ...data, students: data.students.filter((s) => s.id !== id) },
        "Removed student",
        target ? `${target.name} (${target.studentId})` : id
      )
    );
    setConfirmDelete(null);
  };

  const saveSubscription = (updated) => {
    setData(
      withActivity(
        { ...data, students: data.students.map((s) => (s.id === updated.id ? updated : s)) },
        "Activated Pro access",
        `${updated.name} (${updated.studentId}) — until ${updated.expiresAt}`
      )
    );
  };

  const revokeSubscription = (student) => {
    const updated = { ...student, planType: "", planPrice: "", expiresAt: "" };
    setData(
      withActivity(
        { ...data, students: data.students.map((s) => (s.id === updated.id ? updated : s)) },
        "Revoked subscription",
        `${updated.name} (${updated.studentId})`
      )
    );
  };

  return (
    <div>
      <div className="mb-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className={inputCls + " pl-9"}
            placeholder="Search by name, grade, or ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shrink-0"
          style={{ background: 'linear-gradient(to right, #0EA5E9, #2563EB)' }}
        >
          <Plus size={16} className={`transition-transform duration-300 ${adding ? "rotate-45" : ""}`} />
          {adding ? "Close" : "Add student"}
        </button>
      </div>

      <InlineAddStudentForm open={adding} students={data.students} onSave={addStudent} onCancel={() => setAdding(false)} data={data} />

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center">
          <Users size={28} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">
            {data.students.length === 0 ? "No students yet. Add your first one." : "No students match your search."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 hidden sm:table-cell">Student ID</th>
                <th className="px-4 py-3 hidden md:table-cell">Grade</th>
                <th className="px-4 py-3 hidden lg:table-cell">Expires</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => {
                const sub = getSubscriptionStatus(s);
                return (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{s.name}</div>
                    <div className="text-xs text-slate-400 sm:hidden">{s.studentId}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-slate-500">{s.studentId}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-500">{s.grade || "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {!sub.hasPlan ? (
                      <span className="text-slate-400">No plan set</span>
                    ) : sub.isExpired ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">
                        Expired
                      </span>
                    ) : sub.isExpiringSoon ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600">
                        {sub.daysLeft}d left
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                        {s.expiresAt}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setQuickSubscribe(s)}
                        title="Make Pro"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-sky-50 hover:text-sky-600"
                      >
                        <Sparkles size={15} />
                      </button>
                      <button
                        onClick={() => setEditing(s)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(s)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && <StudentForm initial={editing} onSave={saveEdit} onClose={() => setEditing(null)} />}
      {quickSubscribe && (
        <QuickSubscribeModal
          student={quickSubscribe}
          onSave={saveSubscription}
          onRevoke={revokeSubscription}
          onClose={() => setQuickSubscribe(null)}
        />
      )}
      {confirmDelete && (
        <Modal title="Remove student?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-slate-600">
            This will permanently remove <span className="font-semibold">{confirmDelete.name}</span> ({confirmDelete.studentId}). This can't be undone.
          </p>
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setConfirmDelete(null)}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              onClick={() => doDelete(confirmDelete.id)}
              className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white"
            >
              Remove
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ----------------------------- ADMIN: Exams ----------------------------- */

const EXAM_CATEGORIES = ["Final exam", "Mid exam", "Practice exam"];
const EXAM_CATEGORY_META = {
  "Final exam": { label: "Final Exam", icon: GraduationCap },
  "Mid exam": { label: "Mid Exam", icon: FileText },
  "Practice exam": { label: "Practice Exam", icon: Pencil },
};
const NOTE_TYPES = ["Full Note"];

/* ----------------------------- Freshman subjects (for exams) ----------------------------- */
// Fixed list of common Ethiopian freshman courses, each with its own icon/color
// so exam cards can show a subject-specific icon instead of a generic one.
const FRESHMAN_SUBJECTS = [
  "Communicative English Language Skills I",
  "Communicative English Language Skills II",
  "Logic and Critical Thinking",
  "Mathematics for Social Sciences",
  "Mathematics for Natural Sciences",
  "General Physics",
  "General Chemistry",
  "General Biology",
  "General Psychology",
  "Economics",
  "Geography of Ethiopia and the Horn",
  "History of Ethiopia and the Horn",
  "Social Anthropology",
  "Introduction to Emerging Technologies",
  "Entrepreneurship",
  "Global Trends",
  "Moral and Civic Education",
  "Inclusiveness",
  "Physical Fitness",
];

const SUBJECT_ICON_MAP = {
  "Communicative English Language Skills I": Languages,
  "Communicative English Language Skills II": Volume2,
  "Logic and Critical Thinking": Sparkles,
  "Mathematics for Social Sciences": Calculator,
  "Mathematics for Natural Sciences": BarChart3,
  "General Physics": Atom,
  "General Chemistry": FlaskConical,
  "General Biology": Leaf,
  "General Psychology": Brain,
  "Economics": TrendingUp,
  "Geography of Ethiopia and the Horn": Globe2,
  "History of Ethiopia and the Horn": Landmark,
  "Social Anthropology": Users,
  "Introduction to Emerging Technologies": Cpu,
  "Entrepreneurship": Briefcase,
  "Global Trends": ArrowUp,
  "Moral and Civic Education": ShieldCheck,
  "Inclusiveness": Layers,
  "Physical Fitness": Flame,
};

const SUBJECT_COLOR_MAP = {
  "Communicative English Language Skills I": "#DB2777",
  "Communicative English Language Skills II": "#E11D48",
  "Logic and Critical Thinking": "#DC2626",
  "Mathematics for Social Sciences": "#7C3AED",
  "Mathematics for Natural Sciences": "#6D28D9",
  "General Physics": "#2563EB",
  "General Chemistry": "#059669",
  "General Biology": "#16A34A",
  "General Psychology": "#C026D3",
  "Economics": "#D97706",
  "Geography of Ethiopia and the Horn": "#0EA5E9",
  "History of Ethiopia and the Horn": "#B45309",
  "Social Anthropology": "#0891B2",
  "Introduction to Emerging Technologies": "#4F46E5",
  "Entrepreneurship": "#EA580C",
  "Global Trends": "#0D9488",
  "Moral and Civic Education": "#0284C7",
  "Inclusiveness": "#9333EA",
  "Physical Fitness": "#EF4444",
};

function subjectIcon(subject) {
  return SUBJECT_ICON_MAP[subject] || BookOpen;
}
function subjectColor(subject) {
  return SUBJECT_COLOR_MAP[subject] || "#2563EB";
}

function currentEthiopianYearGuess() {
  // Simple recent-year list generator; admin can type any year anyway.
  const gregorianYear = new Date().getFullYear();
  return gregorianYear - 7; // rough E.C. offset, just used as a sane default
}

/* ----------------------------- HTML file upload field ----------------------------- */

// 1.5MB per file keeps total localStorage usage (shared across all materials) reasonable.
const MAX_HTML_UPLOAD_BYTES = 1.5 * 1024 * 1024;

function HtmlUploadField({ fileName, onUpload, onRemove }) {
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setErr("");
    if (!/\.html?$/i.test(file.name)) {
      setErr("Please choose a .html file.");
      return;
    }
    if (file.size > MAX_HTML_UPLOAD_BYTES) {
      setErr(`File is too large (${Math.round(file.size / 1024)}KB). Keep uploads under ${Math.round(MAX_HTML_UPLOAD_BYTES / 1024)}KB.`);
      return;
    }
    setUploading(true);
    try {
      const url = await uploadHtmlFile(file, "study-materials");
      onUpload({ htmlUrl: url, fileName: file.name });
    } catch (e2) {
      setErr(e2?.message || "Couldn't upload that file. Try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Field label="Or upload an HTML file">
      {fileName ? (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <span className="truncate text-sm text-slate-700">{fileName}</span>
          <button type="button" onClick={onRemove} className="ml-2 shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      ) : (
        <input
          type="file"
          accept=".html,.htm,text/html"
          onChange={handleFile}
          disabled={uploading}
          className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-700 hover:file:bg-sky-100 disabled:opacity-50"
        />
      )}
      {uploading && <p className="mt-1.5 text-xs text-sky-600">Uploading…</p>}
      {err && <p className="mt-1.5 text-xs text-rose-600">{err}</p>}
      <p className="mt-1.5 text-xs text-slate-400">
        Uploaded files open instantly in-app with no external link exposed. Use this instead of a link when possible.
      </p>
    </Field>
  );
}

function ExamYearForm({ initial, onSave, onClose, category, data }) {
  const [form, setForm] = useState(
    initial || { year: String(currentEthiopianYearGuess()), title: "", subject: "", university: "", time: "", questions: "", link: "", htmlContent: "", htmlUrl: "", fileName: "", isPro: false }
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal title={initial ? `Edit ${category} entry` : `Add ${category} year`} onClose={onClose}>
      <Field label="Subject">
        <select className={inputCls} value={form.subject} onChange={set("subject")}>
          <option value="">Choose a subject</option>
          {FRESHMAN_SUBJECTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field label="University">
        <input
          className={inputCls}
          value={form.university}
          onChange={set("university")}
          placeholder="e.g. Addis Ababa University"
        />
      </Field>
      <Field label="Year">
        <input
          className={inputCls}
          value={form.year}
          onChange={set("year")}
          placeholder="e.g. 2016 E.C."
        />
      </Field>
      <Field label="Title (optional)">
        <input
          className={inputCls}
          value={form.title}
          onChange={set("title")}
          placeholder={`e.g. ${category} ${form.year || ""}`}
        />
      </Field>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Field label="Time">
          <input className={inputCls} value={form.time || ""} onChange={set("time")} placeholder="e.g. 3 Hours" />
        </Field>
        <Field label="Questions">
          <input className={inputCls} value={form.questions || ""} onChange={set("questions")} placeholder="e.g. 80" />
        </Field>
      </div>
      <Field label="Material link">
        <input
          className={inputCls}
          value={form.link}
          onChange={set("link")}
          placeholder="Paste PDF, Drive, or video link"
          disabled={!!(form.htmlContent || form.htmlUrl)}
        />
      </Field>
      <HtmlUploadField
        fileName={form.fileName}
        onUpload={({ htmlUrl, fileName }) => setForm((f) => ({ ...f, htmlUrl, htmlContent: "", fileName, link: "" }))}
        onRemove={() => setForm((f) => ({ ...f, htmlContent: "", htmlUrl: "", fileName: "" }))}
      />
      <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={!!form.isPro}
          onChange={(e) => setForm((f) => ({ ...f, isPro: e.target.checked }))}
          className="h-4 w-4 rounded accent-amber-500"
        />
        Subscribers only (Pro) — locked until admin activates the student's plan
      </label>
      <button
        onClick={() => {
          if (!form.year.trim()) return;
          onSave(form);
        }}
        className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
        style={{ background: 'linear-gradient(to right, #0EA5E9, #2563EB)' }}
      >
        {initial ? "Save changes" : "Add year"}
      </button>
    </Modal>
  );
}

function AdminExams({ data, setData, onOpenInApp }) {
  const [activeCategory, setActiveCategory] = useState(EXAM_CATEGORIES[0]);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const allEntriesInCategory = data.examCategories[activeCategory] || [];
  const entries = [...allEntriesInCategory]
    .filter((e) => subjectFilter === "all" || (e.subject || "") === subjectFilter)
    .sort((a, b) => String(b.year).localeCompare(String(a.year)));

  const addEntry = (form) => {
    setData(
      withActivity(
        {
          ...data,
          examCategories: {
            ...data.examCategories,
            [activeCategory]: [
              ...(data.examCategories[activeCategory] || []),
              { ...form, id: uid("examyr") },
            ],
          },
        },
        "Added exam entry",
        `${activeCategory} — ${form.title || form.year}${form.subject ? ` (${form.subject})` : ""}`
      )
    );
    setAdding(false);
  };
  const saveEdit = (form) => {
    setData(
      withActivity(
        {
          ...data,
          examCategories: {
            ...data.examCategories,
            [activeCategory]: data.examCategories[activeCategory].map((e) =>
              e.id === editing.id ? { ...form, id: e.id } : e
            ),
          },
        },
        "Edited exam entry",
        `${activeCategory} — ${form.title || form.year}${form.subject ? ` (${form.subject})` : ""}`
      )
    );
    setEditing(null);
  };
  const doDelete = (id) => {
    const target = data.examCategories[activeCategory].find((e) => e.id === id);
    setData(
      withActivity(
        {
          ...data,
          examCategories: {
            ...data.examCategories,
            [activeCategory]: data.examCategories[activeCategory].filter((e) => e.id !== id),
          },
        },
        "Removed exam entry",
        target ? `${activeCategory} — ${target.title || target.year}` : id
      )
    );
    setConfirmDelete(null);
  };

  return (
    <div>
      <div className="mb-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-1.5 overflow-x-auto">
          {EXAM_CATEGORIES.map((c) => {
            const meta = EXAM_CATEGORY_META[c] || { label: c, icon: FileText };
            const Icon = meta.icon;
            return (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                  activeCategory === c ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                <Icon size={14} />
                {meta.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shrink-0"
          style={{ background: 'linear-gradient(to right, #0EA5E9, #2563EB)' }}
        >
          <Plus size={16} /> Add year
        </button>
      </div>

      <div className="mb-5 flex items-center gap-2">
        <label className="text-xs font-semibold text-slate-400">Subject</label>
        <select
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
        >
          <option value="all">All subjects</option>
          {FRESHMAN_SUBJECTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center">
          <FileText size={28} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">No {activeCategory.toLowerCase()} entries yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {e.subject && (() => {
                    const SubjectIcon = subjectIcon(e.subject);
                    return (
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: `${subjectColor(e.subject)}1A` }}
                      >
                        <SubjectIcon size={13} style={{ color: subjectColor(e.subject) }} />
                      </span>
                    );
                  })()}
                  <div className="font-semibold text-slate-800">{e.title || `${activeCategory} ${e.year}`}</div>
                  {e.isPro && <ProBadge />}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {e.subject || "No subject set"}{e.university ? ` · ${e.university}` : ""} · Year: {e.year}
                  {e.time ? ` · ${e.time}` : ""}{e.questions ? ` · ${e.questions} Qs` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MaterialLink url={e.link} htmlContent={e.htmlContent} htmlUrl={e.htmlUrl} fileName={e.fileName} label="Material" onOpenInApp={onOpenInApp} />
                <button onClick={() => setEditing(e)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <Pencil size={15} />
                </button>
                <button onClick={() => setConfirmDelete(e)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <ExamYearForm category={activeCategory} onSave={addEntry} onClose={() => setAdding(false)} data={data} />
      )}
      {editing && (
        <ExamYearForm
          category={activeCategory}
          initial={editing}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
          data={data}
        />
      )}
      {confirmDelete && (
        <Modal title="Delete entry?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-slate-600">
            This will permanently remove the <span className="font-semibold">{confirmDelete.year}</span> entry from {activeCategory}.
          </p>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600">
              Cancel
            </button>
            <button onClick={() => doDelete(confirmDelete.id)} className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white">
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ----------------------------- ADMIN: Notes ----------------------------- */


/* ----------------------------- ADMIN: Notes ----------------------------- */

function NoteLinkForm({ initial, onSave, onClose, context }) {
  const [form, setForm] = useState(
    initial || { title: "", noteType: NOTE_TYPES[0], link: "", pinned: false, htmlContent: "", htmlUrl: "", fileName: "", isPro: false, subtitle: "", notesCount: "", topicsCount: "", estTime: "", progress: "", topics: [], practiceExams: [] }
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const topics = form.topics || [];
  const setTopic = (i, patch) =>
    setForm((f) => ({ ...f, topics: (f.topics || []).map((t, idx) => (idx === i ? { ...t, ...patch } : t)) }));
  const practiceExams = form.practiceExams || [];
  const setExam = (i, patch) =>
    setForm((f) => ({ ...f, practiceExams: (f.practiceExams || []).map((x, idx) => (idx === i ? { ...x, ...patch } : x)) }));

  return (
    <Modal title={initial ? "Edit note" : `Add note — ${context}`} onClose={onClose}>
      <Field label="Title">
        <input className={inputCls} value={form.title} onChange={set("title")} placeholder="e.g. Chapter 1" />
      </Field>
      <Field label="Subtitle">
        <input className={inputCls} value={form.subtitle || ""} onChange={set("subtitle")} placeholder="e.g. Introduction to Logic" />
      </Field>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Field label="Sections">
          <input className={inputCls} value={form.notesCount || ""} onChange={set("notesCount")} placeholder="12" />
        </Field>
        <Field label="Topics">
          <input className={inputCls} value={form.topicsCount || ""} onChange={set("topicsCount")} placeholder="8" />
        </Field>
        <Field label="Est. time">
          <input className={inputCls} value={form.estTime || ""} onChange={set("estTime")} placeholder="2h 30m" />
        </Field>
      </div>
      <Field label="Progress (%)">
        <input className={inputCls} value={form.progress || ""} onChange={set("progress")} placeholder="35" />
      </Field>
      <Field label="Material link">
        <input
          className={inputCls}
          value={form.link}
          onChange={set("link")}
          placeholder="Paste PDF, Drive, or video link"
          disabled={!!(form.htmlContent || form.htmlUrl)}
        />
      </Field>
      <HtmlUploadField
        fileName={form.fileName}
        onUpload={({ htmlUrl, fileName }) => setForm((f) => ({ ...f, htmlUrl, htmlContent: "", fileName, link: "" }))}
        onRemove={() => setForm((f) => ({ ...f, htmlContent: "", htmlUrl: "", fileName: "" }))}
      />

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Topics in this chapter</span>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, topics: [...(f.topics || []), { id: uid(), title: "", notesCount: "", link: "" }] }))}
            className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700"
          >
            <Plus size={13} /> Add topic
          </button>
        </div>
        {topics.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">No topics added.</p>
        ) : (
          <div className="space-y-2">
            {topics.map((t, i) => (
              <div key={t.id || i} className="rounded-xl border border-slate-200 p-2.5">
                <div className="flex items-center gap-2">
                  <input className={inputCls} value={t.title} onChange={(e) => setTopic(i, { title: e.target.value })} placeholder="Topic title" />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, topics: (f.topics || []).filter((_, idx) => idx !== i) }))}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <input className={inputCls} value={t.notesCount || ""} onChange={(e) => setTopic(i, { notesCount: e.target.value })} placeholder="Notes (2)" />
                  <div className="col-span-2">
                    <input className={inputCls} value={t.link || ""} onChange={(e) => setTopic(i, { link: e.target.value })} placeholder="Topic link (optional)" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Practice exams for this chapter</span>
          <button
            type="button"
            onClick={() =>
              setForm((f) => ({
                ...f,
                practiceExams: [
                  ...(f.practiceExams || []),
                  { id: uid(), title: "", link: "", htmlContent: "", htmlUrl: "", fileName: "" },
                ],
              }))
            }
            className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700"
          >
            <Plus size={13} /> Add practice exam
          </button>
        </div>
        {practiceExams.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">No practice exams added.</p>
        ) : (
          <div className="space-y-2">
            {practiceExams.map((x, i) => (
              <div key={x.id || i} className="rounded-xl border border-slate-200 p-2.5">
                <div className="flex items-center gap-2">
                  <input className={inputCls} value={x.title} onChange={(e) => setExam(i, { title: e.target.value })} placeholder="Practice exam title" />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, practiceExams: (f.practiceExams || []).filter((_, idx) => idx !== i) }))}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="mt-2">
                  <input
                    className={inputCls}
                    value={x.link || ""}
                    onChange={(e) => setExam(i, { link: e.target.value })}
                    placeholder="Paste PDF, Drive, or video link"
                    disabled={!!(x.htmlContent || x.htmlUrl)}
                  />
                </div>
                <div className="mt-2">
                  <HtmlUploadField
                    fileName={x.fileName}
                    onUpload={({ htmlUrl, fileName }) => setExam(i, { htmlUrl, htmlContent: "", fileName, link: "" })}
                    onRemove={() => setExam(i, { htmlContent: "", htmlUrl: "", fileName: "" })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.pinned}
          onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
          className="h-4 w-4 rounded accent-sky-600"
        />
        Pin to top
      </label>
      <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={!!form.isPro}
          onChange={(e) => setForm((f) => ({ ...f, isPro: e.target.checked }))}
          className="h-4 w-4 rounded accent-amber-500"
        />
        Subscribers only (Pro) — locked until admin activates the student's plan
      </label>

      <button
        onClick={() => {
          if (!form.title.trim()) return;
          onSave(form);
        }}
        className="mt-1 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
        style={{ background: 'linear-gradient(to right, #0EA5E9, #2563EB)' }}
      >
        {initial ? "Save changes" : "Add note"}
      </button>
    </Modal>
  );
}

/* Shared subject list UI (used by both admin and students). */
// Subjects here are free-text names the admin types in (not the fixed
// FRESHMAN_SUBJECTS list used for exams), so icons are picked by matching
// keywords in the name rather than an exact lookup table.
const SUBJECT_KEYWORD_ICONS = [
  [/math|calcul|algebra|geometry/i, Calculator],
  [/physic/i, Atom],
  [/chem/i, FlaskConical],
  [/bio(logy)?\b/i, Leaf],
  [/psycholog/i, Brain],
  [/logic|critical think/i, Brain],
  [/emerging tech|technolog|computer|programming/i, Cpu],
  [/inclusiv|diversity/i, Users],
  [/anthropolog/i, Globe2],
  [/geograph/i, Globe2],
  [/english|language|literature/i, Languages],
  [/civic|ethic/i, ShieldCheck],
  [/econom/i, TrendingUp],
  [/histor/i, BookOpen],
];

function subjectDisplayIcon(name = "") {
  const match = SUBJECT_KEYWORD_ICONS.find(([re]) => re.test(name));
  return match ? match[1] : BookOpen;
}

function SubjectGrid({ notes, subjects, onPick, admin, onAdd, onEdit, onDelete }) {
  const color = "#2563EB";
  const generalCount = notesForSubject(notes, null).length;
  const rows = [
    ...subjects.map((s) => ({ ...s, general: false })),
    ...(generalCount ? [{ id: null, name: "General", general: true }] : []),
  ];

  return (
    <div className="relative">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-extrabold text-slate-900">Subjects</h3>
        <span className="text-sm font-bold text-blue-600">{subjects.length} total</span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center">
          <BookOpen size={28} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">
            {admin ? "No subjects yet — tap + to add one." : "No subjects yet."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-24">
          {rows.map((s) => {
            const c = subjectCounts(notes, s.id);
            const total = c.notes + c.resources;
            const Icon = s.general ? BookOpen : subjectDisplayIcon(s.name);
            return (
              <div
                key={s.id || "__general"}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm"
              >
                <button onClick={() => onPick(s)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span
                    className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `${color}1A` }}
                  >
                    <Icon size={26} style={{ color }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold text-slate-900">{s.name}</span>
                    <span className="block text-sm text-slate-500">
                      {total} item{total === 1 ? "" : "s"} available
                    </span>
                  </span>
                </button>
                {admin && !s.general ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => onEdit(s)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => onDelete(s)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ) : (
                  <ChevronRight size={20} className="shrink-0 text-slate-400" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {admin && (
        <button
          onClick={onAdd}
          aria-label="Add subject"
          className="fixed bottom-24 right-5 z-30 inline-flex h-16 w-16 items-center justify-center rounded-full text-white shadow-xl transition hover:scale-105"
          style={{ background: "#2563EB" }}
        >
          <Plus size={28} />
        </button>
      )}
    </div>
  );
}

function SubjectForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || "");
  return (
    <Modal title={initial ? "Edit subject" : "Add subject"} onClose={onClose}>
      <Field label="Subject name">
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Financial Accounting"
        />
      </Field>
      <button
        onClick={() => {
          if (!name.trim()) return;
          onSave({ name: name.trim() });
        }}
        className="mt-1 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
        style={{ background: "linear-gradient(to right, #0EA5E9, #2563EB)" }}
      >
        {initial ? "Save changes" : "Add subject"}
      </button>
    </Modal>
  );
}

function AdminNotes({ data, setData, onOpenInApp }) {
  const [subject, setSubject] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [addingSubject, setAddingSubject] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [deletingSubject, setDeletingSubject] = useState(null);

  const getList = () => notesList(data);

  const setList = (list, logMsg) => {
    const next = {
      ...data,
      noteLinks: {
        ...data.noteLinks,
        [NOTES_BUCKET]: list,
      },
    };
    setData(logMsg ? withActivity(next, logMsg.action, logMsg.detail) : next);
  };

  const setSubjects = (list, logMsg) => {
    const next = {
      ...data,
      subjects: { ...(data.subjects || {}), [NOTES_BUCKET]: list },
    };
    setData(logMsg ? withActivity(next, logMsg.action, logMsg.detail) : next);
  };

  const addSubject = ({ name }) => {
    const list = subjectsList(data);
    setSubjects([...list, { id: uid("subj"), name, createdAt: new Date().toISOString() }], {
      action: "Added subject",
      detail: name,
    });
    setAddingSubject(false);
  };
  const saveSubject = ({ name }) => {
    const list = subjectsList(data);
    setSubjects(list.map((s) => (s.id === editingSubject.id ? { ...s, name } : s)), {
      action: "Edited subject",
      detail: name,
    });
    setEditingSubject(null);
  };
  const deleteSubject = (s) => {
    const list = subjectsList(data).filter((x) => x.id !== s.id);
    const notes = getList().map((n) => (n.subjectId === s.id ? { ...n, subjectId: null } : n));
    setData(
      withActivity(
        {
          ...data,
          subjects: { ...(data.subjects || {}), [NOTES_BUCKET]: list },
          noteLinks: { ...data.noteLinks, [NOTES_BUCKET]: notes },
        },
        "Removed subject",
        s.name
      )
    );
    setDeletingSubject(null);
  };

  const addNote = (form) => {
    const list = getList();
    setList(
      [...list, { ...form, subjectId: subject?.id || null, id: uid("note"), createdAt: new Date().toISOString() }],
      { action: "Added note", detail: form.title }
    );
    setAdding(false);
  };
  const saveEdit = (form) => {
    const list = getList();
    setList(list.map((n) => (n.id === editing.id ? { ...n, ...form } : n)), {
      action: "Edited note",
      detail: form.title,
    });
    setEditing(null);
  };
  const doDelete = (id) => {
    const list = getList();
    const target = list.find((n) => n.id === id);
    setList(list.filter((n) => n.id !== id), {
      action: "Removed note",
      detail: target ? target.title : id,
    });
    setConfirmDelete(null);
  };
  const togglePin = (n) => {
    const list = getList();
    setList(list.map((x) => (x.id === n.id ? { ...x, pinned: !x.pinned } : x)));
  };

  // Level 1: subjects
  if (!subject) {
    return (
      <>
        <SubjectGrid
          notes={getList()}
          subjects={subjectsList(data)}
          admin
          onPick={(s) => setSubject(s)}
          onAdd={() => setAddingSubject(true)}
          onEdit={(s) => setEditingSubject(s)}
          onDelete={(s) => setDeletingSubject(s)}
        />
        {addingSubject && (
          <SubjectForm onSave={addSubject} onClose={() => setAddingSubject(false)} />
        )}
        {editingSubject && (
          <SubjectForm
            initial={editingSubject}
            onSave={saveSubject}
            onClose={() => setEditingSubject(null)}
          />
        )}
        {deletingSubject && (
          <Modal title="Delete subject?" onClose={() => setDeletingSubject(null)}>
            <p className="text-sm text-slate-600">
              This removes <span className="font-semibold">{deletingSubject.name}</span>. Its notes move to “General”.
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setDeletingSubject(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600">
                Cancel
              </button>
              <button onClick={() => deleteSubject(deletingSubject)} className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white">
                Delete
              </button>
            </div>
          </Modal>
        )}
      </>
    );
  }

  // Level 3: list of notes for this subject
  const sorted = notesForSubject(getList(), subject.id)
    .slice()
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  return (
    <div>
      <button
        onClick={() => setSubject(null)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700"
      >
        ← Back to subjects
      </button>
      <div className="mb-5 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: accentColor(subject.name) }} />
          {subject.name}
        </h3>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(to right, #0EA5E9, #2563EB)' }}
        >
          <Plus size={16} /> Add note
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center">
          <StickyNote size={28} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">No notes yet for this subject.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {sorted.map((n) => (
            <div key={n.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="truncate font-semibold text-slate-800">{n.title}</span>
                <button onClick={() => togglePin(n)} className="shrink-0 text-slate-400 hover:text-amber-500">
                  {n.pinned ? <Pin size={16} className="fill-amber-400 text-amber-500" /> : <PinOff size={16} />}
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: `${noteTypeColor(n.noteType)}1A`, color: noteTypeColor(n.noteType) }}
                >
                  {n.noteType || NOTE_TYPES[0]}
                </span>
                {n.isPro && <ProBadge />}
                <span className="text-xs text-slate-400">{fmtDate(n.createdAt)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <MaterialLink url={n.link} htmlContent={n.htmlContent} htmlUrl={n.htmlUrl} fileName={n.fileName} onOpenInApp={onOpenInApp} />
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditing(n)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => setConfirmDelete(n)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <NoteLinkForm context={subject.name} onSave={addNote} onClose={() => setAdding(false)} />
      )}
      {editing && (
        <NoteLinkForm
          context={subject.name}
          initial={editing}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
        />
      )}
      {confirmDelete && (
        <Modal title="Delete note?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-slate-600">
            This will permanently remove <span className="font-semibold">{confirmDelete.title}</span>.
          </p>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600">
              Cancel
            </button>
            <button onClick={() => doDelete(confirmDelete.id)} className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white">
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}


/* ----------------------------- ADMIN: Announcements ----------------------------- */

function AnnouncementForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { title: "", body: "", pinned: false });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal title={initial ? "Edit announcement" : "Post announcement"} onClose={onClose} wide>
      <Field label="Title">
        <input className={inputCls} value={form.title} onChange={set("title")} placeholder="e.g. Mock exam moved to Monday" />
      </Field>
      <Field label="Message">
        <textarea
          className={inputCls + " min-h-[100px] resize-y"}
          value={form.body}
          onChange={set("body")}
          placeholder="What do students need to know?"
        />
      </Field>
      <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.pinned}
          onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
          className="h-4 w-4 rounded accent-sky-600"
        />
        Pin to top
      </label>
      <button
        onClick={() => {
          if (!form.title.trim() || !form.body.trim()) return;
          onSave(form);
        }}
        className="mt-1 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
        style={{ background: 'linear-gradient(to right, #0EA5E9, #2563EB)' }}
      >
        {initial ? "Save changes" : "Post announcement"}
      </button>
    </Modal>
  );
}

function AdminAnnouncements({ data, setData }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const sorted = [...data.announcements].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const addAnnouncement = (form) => {
    setData(
      withActivity(
        {
          ...data,
          announcements: [...data.announcements, { ...form, id: uid("ann"), createdAt: new Date().toISOString() }],
        },
        "Posted announcement",
        form.title
      )
    );
    setAdding(false);
  };
  const saveEdit = (form) => {
    setData(
      withActivity(
        {
          ...data,
          announcements: data.announcements.map((a) => (a.id === editing.id ? { ...a, ...form } : a)),
        },
        "Edited announcement",
        form.title
      )
    );
    setEditing(null);
  };
  const doDelete = (id) => {
    const target = data.announcements.find((a) => a.id === id);
    setData(
      withActivity(
        { ...data, announcements: data.announcements.filter((a) => a.id !== id) },
        "Removed announcement",
        target ? target.title : id
      )
    );
    setConfirmDelete(null);
  };
  const togglePin = (a) => {
    setData({
      ...data,
      announcements: data.announcements.map((x) => (x.id === a.id ? { ...x, pinned: !x.pinned } : x)),
    });
  };

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(to right, #0EA5E9, #2563EB)' }}
        >
          <Plus size={16} /> Post announcement
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center">
          <Megaphone size={28} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">No announcements yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sorted.map((a) => (
            <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Megaphone size={15} className="shrink-0 text-sky-600" />
                  <span className="truncate font-semibold text-slate-800">{a.title}</span>
                </div>
                <button onClick={() => togglePin(a)} className="shrink-0 text-slate-400 hover:text-amber-500">
                  {a.pinned ? <Pin size={16} className="fill-amber-400 text-amber-500" /> : <PinOff size={16} />}
                </button>
              </div>
              <div className="mt-1 text-xs text-slate-400">{fmtDate(a.createdAt)}</div>
              <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{a.body}</p>
              <div className="mt-3 flex items-center justify-end gap-1">
                <button onClick={() => setEditing(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <Pencil size={15} />
                </button>
                <button onClick={() => setConfirmDelete(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && <AnnouncementForm onSave={addAnnouncement} onClose={() => setAdding(false)} />}
      {editing && <AnnouncementForm initial={editing} onSave={saveEdit} onClose={() => setEditing(null)} />}
      {confirmDelete && (
        <Modal title="Delete announcement?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-slate-600">
            This will permanently remove <span className="font-semibold">{confirmDelete.title}</span>.
          </p>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600">
              Cancel
            </button>
            <button onClick={() => doDelete(confirmDelete.id)} className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white">
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ----------------------------- ADMIN: Ad banners ----------------------------- */

const MAX_AD_IMAGE_BYTES = 3 * 1024 * 1024; // ~3MB

function AdForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(
    initial || { imageUrl: "", title: "", subtitle: "", linkUrl: "", active: true }
  );
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleFile = async (file) => {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, JPG, etc).");
      return;
    }
    if (file.size > MAX_AD_IMAGE_BYTES) {
      setError("That image is too large. Please use one under 3MB.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImageFile(file, "promo");
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (e) {
      setError(e?.message || "Couldn't upload that file. Try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal title={initial ? "Edit ad banner" : "Add ad banner"} onClose={onClose} wide>
      <Field label="Banner image">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="flex items-center gap-3">
          <div
            className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
          >
            {form.imageUrl ? (
              <img src={form.imageUrl} alt="Ad preview" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon size={20} className="text-slate-300" />
            )}
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <UploadCloud size={16} /> {uploading ? "Uploading…" : form.imageUrl ? "Replace image" : "Choose image"}
          </button>
        </div>
      </Field>
      <Field label="Title (optional)">
        <input className={inputCls} value={form.title} onChange={set("title")} placeholder="e.g. 100% Teff — Pure. Natural. Ethiopian." />
      </Field>
      <Field label="Subtitle (optional)">
        <input className={inputCls} value={form.subtitle} onChange={set("subtitle")} placeholder="Short supporting line" />
      </Field>
      <Field label="Link URL (optional)">
        <input className={inputCls} value={form.linkUrl} onChange={set("linkUrl")} placeholder="https://…" />
      </Field>
      <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.active !== false}
          onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          className="h-4 w-4 rounded accent-sky-600"
        />
        Show on student home screen
      </label>
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <button
        onClick={() => {
          if (!form.imageUrl) {
            setError("Please upload a banner image.");
            return;
          }
          onSave(form);
        }}
        disabled={uploading}
        className="mt-1 w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: 'linear-gradient(to right, #0EA5E9, #2563EB)' }}
      >
        {initial ? "Save changes" : "Add ad banner"}
      </button>
    </Modal>
  );
}

function AdminAds({ data, setData }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const ads = [...(data.ads || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const addAd = (form) => {
    const nextOrder = ads.length ? Math.max(...ads.map((a) => a.order ?? 0)) + 1 : 0;
    setData(
      withActivity(
        { ...data, ads: [...(data.ads || []), { ...form, id: uid("ad"), order: nextOrder, createdAt: new Date().toISOString() }] },
        "Added ad banner",
        form.title || "Ad banner"
      )
    );
    setAdding(false);
  };
  const saveEdit = (form) => {
    setData(
      withActivity(
        { ...data, ads: (data.ads || []).map((a) => (a.id === editing.id ? { ...a, ...form } : a)) },
        "Edited ad banner",
        form.title || "Ad banner"
      )
    );
    setEditing(null);
  };
  const doDelete = (id) => {
    const target = (data.ads || []).find((a) => a.id === id);
    setData(
      withActivity(
        { ...data, ads: (data.ads || []).filter((a) => a.id !== id) },
        "Removed ad banner",
        target?.title || id
      )
    );
    setConfirmDelete(null);
  };
  const toggleActive = (a) => {
    setData({ ...data, ads: (data.ads || []).map((x) => (x.id === a.id ? { ...x, active: !(x.active !== false) } : x)) });
  };
  const move = (a, dir) => {
    const sorted = [...ads];
    const idx = sorted.findIndex((x) => x.id === a.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const orderA = sorted[idx].order ?? idx;
    const orderB = sorted[swapIdx].order ?? swapIdx;
    setData({
      ...data,
      ads: (data.ads || []).map((x) => {
        if (x.id === sorted[idx].id) return { ...x, order: orderB };
        if (x.id === sorted[swapIdx].id) return { ...x, order: orderA };
        return x;
      }),
    });
  };

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(to right, #0EA5E9, #2563EB)' }}
        >
          <Plus size={16} /> Add ad banner
        </button>
      </div>

      {ads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center">
          <BadgePercent size={28} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">No ad banners yet.</p>
          <p className="mt-1 text-xs text-slate-400">Add one to show a promo carousel on the student home screen.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {ads.map((a, idx) => (
            <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50">
                <img src={a.imageUrl} alt={a.title || "Ad"} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-slate-800">{a.title || "Untitled banner"}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      a.active !== false ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {a.active !== false ? "Active" : "Hidden"}
                  </span>
                </div>
                {a.subtitle && <p className="truncate text-xs text-slate-500">{a.subtitle}</p>}
                {a.linkUrl && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-sky-600">
                    <Link2 size={11} /> {a.linkUrl}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => move(a, -1)} disabled={idx === 0} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30">
                  <ArrowUp size={15} />
                </button>
                <button onClick={() => move(a, 1)} disabled={idx === ads.length - 1} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30">
                  <ArrowDown size={15} />
                </button>
                <button onClick={() => toggleActive(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  {a.active !== false ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button onClick={() => setEditing(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <Pencil size={15} />
                </button>
                <button onClick={() => setConfirmDelete(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && <AdForm onSave={addAd} onClose={() => setAdding(false)} />}
      {editing && <AdForm initial={editing} onSave={saveEdit} onClose={() => setEditing(null)} />}
      {confirmDelete && (
        <Modal title="Delete ad banner?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-slate-600">
            This will permanently remove <span className="font-semibold">{confirmDelete.title || "this banner"}</span>.
          </p>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600">
              Cancel
            </button>
            <button onClick={() => doDelete(confirmDelete.id)} className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white">
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ----------------------------- ADMIN: Shell ----------------------------- */

/* ----------------------------- ADMIN: Activity log ----------------------------- */

function AdminActivityLog({ data, setData }) {
  const [confirmClear, setConfirmClear] = useState(false);
  const log = data.activityLog || [];

  const actionIcon = (action) => {
    if (action.startsWith("Added") || action.startsWith("Posted")) return Plus;
    if (action.startsWith("Edited")) return Pencil;
    if (action.startsWith("Removed")) return Trash2;
    if (action.includes("password")) return Lock;
    return Clock;
  };
  const actionColor = (action) => {
    if (action.startsWith("Added") || action.startsWith("Posted")) return "#059669";
    if (action.startsWith("Edited")) return "#2563EB";
    if (action.startsWith("Removed")) return "#DC2626";
    return "#64748B";
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Showing the last {log.length} action{log.length === 1 ? "" : "s"} taken from the admin account.
        </p>
        {log.length > 0 && (
          <button
            onClick={() => setConfirmClear(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-rose-500"
          >
            <Trash2 size={13} /> Clear log
          </button>
        )}
      </div>

      {log.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center">
          <Clock size={28} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">No activity recorded yet.</p>
          <p className="mt-1 text-xs text-slate-400">Actions like adding students, exams, and notes will show up here.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {log.map((entry) => {
            const Icon = actionIcon(entry.action);
            const color = actionColor(entry.action);
            return (
              <div key={entry.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `${color}1A` }}
                >
                  <Icon size={15} style={{ color }} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-sm font-semibold text-slate-800">{entry.action}</span>
                    {entry.detail && <span className="truncate text-sm text-slate-500">— {entry.detail}</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {entry.actor} · {fmtDate(entry.at)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmClear && (
        <Modal title="Clear activity log?" onClose={() => setConfirmClear(false)}>
          <p className="text-sm text-slate-600">
            This will permanently delete all {log.length} recorded action{log.length === 1 ? "" : "s"}. This can't be undone.
          </p>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setConfirmClear(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600">
              Cancel
            </button>
            <button
              onClick={() => {
                setData({ ...data, activityLog: [] });
                setConfirmClear(false);
              }}
              className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white"
            >
              Clear
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}


/* ----------------------------- Admin: subscription requests ----------------------------- */

// A student's studentId may not match an existing record verbatim (they can
// edit the "BTR ID" field on the payment form), so approval is matched
// loosely: exact studentId first, falling back to name.
function findStudentForRequest(students, request) {
  const byId = (students || []).find(
    (s) => s.studentId?.trim().toLowerCase() === request.studentId?.trim().toLowerCase()
  );
  if (byId) return byId;
  return (students || []).find(
    (s) => s.name?.trim().toLowerCase() === request.studentName?.trim().toLowerCase()
  );
}

function SubscriptionRequestCard({ request, student, onApprove, onReject, onViewScreenshot }) {
  const isPending = request.status === "pending";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => request.screenshotDataUrl && onViewScreenshot(request.screenshotDataUrl)}
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100"
          >
            {request.screenshotDataUrl ? (
              <img src={request.screenshotDataUrl} alt="Payment screenshot" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon size={18} className="text-slate-300" />
            )}
          </button>
          <div>
            <div className="font-semibold text-slate-800">{request.studentName}</div>
            <div className="text-xs text-slate-400">{request.studentId}</div>
            {!student && (
              <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                <AlertCircle size={11} /> No matching student record
              </div>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            request.status === "pending"
              ? "bg-amber-50 text-amber-600"
              : request.status === "approved"
              ? "bg-emerald-50 text-emerald-600"
              : "bg-rose-50 text-rose-600"
          }`}
        >
          {request.status === "pending" ? "Pending" : request.status === "approved" ? "Approved" : "Rejected"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 font-semibold">
          <CreditCard size={12} /> {request.planLabel} · {request.price} Birr
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 font-semibold">
          <Clock size={12} /> {fmtDate(request.createdAt)}
        </span>
      </div>

      {isPending && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onApprove(request)}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(to right, #0EA5E9, #2563EB)" }}
          >
            Approve &amp; activate
          </button>
          <button
            onClick={() => onReject(request)}
            className="flex-1 rounded-xl border border-rose-200 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

function AdminSubscriptionRequests({ data, setData }) {
  const [filter, setFilter] = useState("pending"); // pending | approved | rejected | all
  const [viewingScreenshot, setViewingScreenshot] = useState(null);

  const requests = data.subscriptionRequests || [];
  const filtered = requests
    .filter((r) => filter === "all" || r.status === filter)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const setRequestStatus = (request, status) => {
    setData(
      withActivity(
        {
          ...data,
          subscriptionRequests: requests.map((r) => (r.id === request.id ? { ...r, status } : r)),
        },
        status === "approved" ? "Approved subscription request" : "Rejected subscription request",
        `${request.studentName} (${request.studentId}) — ${request.planLabel}`
      )
    );
  };

  const approve = (request) => {
    const student = findStudentForRequest(data.students, request);
    const expiresAt = addDaysToToday(Math.round((request.months || 6) * 30.4));
    setData((prev) => {
      const next = {
        ...prev,
        subscriptionRequests: (prev.subscriptionRequests || []).map((r) =>
          r.id === request.id ? { ...r, status: "approved" } : r
        ),
        students: student
          ? prev.students.map((s) =>
              s.id === student.id
                ? { ...s, planType: request.planLabel, planPrice: String(request.price), expiresAt }
                : s
            )
          : prev.students,
      };
      return withActivity(
        next,
        "Approved subscription request",
        `${request.studentName} (${request.studentId}) — ${request.planLabel} until ${expiresAt}`
      );
    });
  };

  const reject = (request) => setRequestStatus(request, "rejected");

  const filters = [
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "all", label: "All" },
  ];

  return (
    <div>
      <div className="mb-5 flex gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === f.key ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {f.label}
            {f.key === "pending" && requests.some((r) => r.status === "pending") && (
              <span className="ml-1.5">({requests.filter((r) => r.status === "pending").length})</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center">
          <CreditCard size={28} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">
            {filter === "pending" ? "No pending subscription requests." : "No requests here yet."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((r) => (
            <SubscriptionRequestCard
              key={r.id}
              request={r}
              student={findStudentForRequest(data.students, r)}
              onApprove={approve}
              onReject={reject}
              onViewScreenshot={setViewingScreenshot}
            />
          ))}
        </div>
      )}

      {viewingScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.75)" }}
          onClick={() => setViewingScreenshot(null)}
        >
          <button
            onClick={() => setViewingScreenshot(null)}
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X size={18} />
          </button>
          <img
            src={viewingScreenshot}
            alt="Payment screenshot"
            className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Admin: subscription plan icons ----------------------------- */

const MAX_PLAN_ICON_BYTES = 1.5 * 1024 * 1024; // ~1.5MB, same ceiling as the logo upload

function AdminPlanIconCard({ plan, data, setData }) {
  const currentIcon = data?.planIcons?.[plan.id] || null;
  const [preview, setPreview] = useState(currentIcon);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    setError("");
    setSaved(false);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, JPG, SVG, etc).");
      return;
    }
    if (file.size > MAX_PLAN_ICON_BYTES) {
      setError("That image is too large. Please use one under 1.5MB.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImageFile(file, "plan-icons");
      setPreview(url);
    } catch (e) {
      setError(e?.message || "Couldn't upload that file. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    setData(
      withActivity(
        { ...data, planIcons: { ...(data.planIcons || {}), [plan.id]: preview || null } },
        preview ? `Updated ${plan.label} card image` : `Removed ${plan.label} card image`,
        ""
      )
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const removeIcon = () => {
    setPreview(null);
    setData(
      withActivity(
        { ...data, planIcons: { ...(data.planIcons || {}), [plan.id]: null } },
        `Removed ${plan.label} card image`,
        ""
      )
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const dirty = preview !== currentIcon;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-semibold text-slate-700">{plan.label}</p>
      <p className="mt-1 text-xs text-slate-500">
        {plan.price} Birr · {plan.validText}. Replaces the default icon shown on this plan's card. Square images work best.
      </p>

      <div className="mt-5 flex items-center gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl overflow-hidden border border-slate-200"
          style={{ background: preview ? "#fff" : (plan.bestValue ? "#EFF6FF" : "#2451D6") }}
        >
          {preview ? (
            <img src={preview} alt={`${plan.label} preview`} className="h-full w-full object-cover" />
          ) : plan.bestValue ? (
            <CalendarClock size={26} className="text-blue-600" />
          ) : (
            <Calendar size={26} className="text-white" />
          )}
        </div>
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <UploadCloud size={16} /> {uploading ? "Uploading…" : "Choose image"}
          </button>
          {preview && (
            <button
              type="button"
              onClick={removeIcon}
              className="ml-2 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-500 hover:bg-rose-50"
            >
              <Trash2 size={16} /> Remove
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <Check size={16} /> <span>Card image updated.</span>
        </div>
      )}

      <button
        type="button"
        disabled={!dirty || uploading}
        onClick={save}
        className={`mt-5 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition ${
          dirty && !uploading ? "hover:brightness-105" : "opacity-40 cursor-not-allowed"
        }`}
        style={{ background: 'linear-gradient(to right, #0EA5E9, #2563EB)' }}
      >
        Save image
      </button>
    </div>
  );
}

function AdminPlans({ data, setData }) {
  return (
    <div className="max-w-lg space-y-5">
      {SUBSCRIPTION_PLAN_OPTIONS.map((plan) => (
        <AdminPlanIconCard key={plan.id} plan={plan} data={data} setData={setData} />
      ))}
    </div>
  );
}

/* ----------------------------- Admin: shell ----------------------------- */

function AdminShell({ data, setData, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [kickedOut, setKickedOut] = useState(false);
  const [htmlViewer, setHtmlViewer] = useState(null); // { url, htmlContent, htmlUrl, title } | null
  const [adminDark, setAdminDark] = useState(() => memoryStorage.getItem("btr-admin-theme") === "dark");
  useEffect(() => {
    memoryStorage.setItem("btr-admin-theme", adminDark ? "dark" : "light");
  }, [adminDark]);
  const openInApp = (source, title) =>
    setHtmlViewer(
      typeof source === "string" ? { url: source, title } : { htmlContent: source.htmlContent, htmlUrl: source.htmlUrl, title }
    );

  // Multi-device detection: if another device claims the admin session while
  // this one is active, warn and sign this device out.
  useEffect(() => {
    let mySid;
    try {
      mySid = memoryStorage.getItem("btr-admin-session-id");
    } catch {
      mySid = null;
    }
    if (!mySid) return;
    if (data?.adminSession && data.adminSession.sessionId !== mySid) {
      setKickedOut(true);
    }
  }, [data?.adminSession]);

  const pendingRequestCount = (data.subscriptionRequests || []).filter((r) => r.status === "pending").length;

  const tabs = [
    { key: "dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard },
    { key: "requests", label: "Subscription requests", shortLabel: "Requests", icon: CreditCard, badge: pendingRequestCount },
    { key: "plans", label: "Subscription plans", shortLabel: "Plans", icon: Sparkles },
    { key: "announcements", label: "Announcements", shortLabel: "News", icon: Megaphone },
    { key: "ads", label: "Ad banners", shortLabel: "Ads", icon: BadgePercent },
    { key: "students", label: "Students", shortLabel: "Students", icon: Users },
    { key: "exams", label: "Exams", shortLabel: "Exams", icon: FileText },
    { key: "notes", label: "Notes", shortLabel: "Notes", icon: StickyNote },
    { key: "activity", label: "Activity log", shortLabel: "Activity", icon: Clock },
    { key: "branding", label: "Branding", shortLabel: "Brand", icon: ImageIcon },
  ];

  return (
    <div className={`min-h-screen bg-slate-50 flex${adminDark ? " dark-mode" : ""}`}>
      <GlobalDarkStyles />
      {htmlViewer && (
        <HtmlViewerModal
          url={htmlViewer.url}
          htmlContent={htmlViewer.htmlContent}
          htmlUrl={htmlViewer.htmlUrl}
          title={htmlViewer.title}
          onClose={() => setHtmlViewer(null)}
        />
      )}
      {kickedOut && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.55)" }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertCircle size={22} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Signed in on another device</h3>
            <p className="mt-2 text-sm text-slate-500">
              This admin account was just signed in on {data.adminSession?.deviceLabel || "another device"}. You've been signed out here.
            </p>
            <button
              onClick={onLogout}
              className="mt-5 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              Return to sign in
            </button>
          </div>
        </div>
      )}
      <aside className="hidden lg:flex w-60 flex-col border-r border-slate-200 bg-white p-5">
        <Brand darkMode={adminDark} />
        <nav className="mt-8 flex-1 space-y-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                tab === t.key ? "bg-sky-50 text-sky-700" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <t.icon size={17} />
              {t.label}
              {!!t.badge && (
                <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        {data?.adminSession && (
          <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
            <div className="flex items-center gap-1.5 font-semibold text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Signed in on this device
            </div>
            <div className="mt-0.5 truncate">{data.adminSession.deviceLabel}</div>
          </div>
        )}
        <button
          onClick={() => setAdminDark((v) => !v)}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        >
          {adminDark ? <Sun size={17} /> : <Moon size={17} />} {adminDark ? "Light mode" : "Dark mode"}
        </button>
        <button
          onClick={onLogout}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-50 hover:text-rose-500"
        >
          <LogOut size={17} /> Log out
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <Brand darkMode={adminDark} />
          <div className="flex items-center gap-3">
            <button onClick={() => setAdminDark((v) => !v)} className="text-slate-400">
              {adminDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={onLogout} className="text-slate-400">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <main className="flex-1 p-5 lg:p-8 max-w-5xl">
          <h1 className="mb-1 text-xl font-bold text-slate-900 capitalize">{tab}</h1>
          <p className="mb-6 text-sm text-slate-500">
            {tab === "dashboard" && "Overview of activity at a glance."}
            {tab === "requests" && "Review Telebirr payment submissions and activate plans."}
            {tab === "plans" && "Set the image shown on each subscription plan card."}
            {tab === "announcements" && "Post quick updates students see right away."}
            {tab === "ads" && "Manage the promo banner carousel shown on the student home screen."}
            {tab === "students" && "Add and manage student records."}
            {tab === "exams" && "Schedule exams and attach study material."}
            {tab === "notes" && "Post notes and link out to study resources."}
            {tab === "activity" && "See who added, edited, or removed content, and when."}
            {tab === "branding" && "Change the logo shown on the sign-in page and throughout the app."}
          </p>
          {tab === "dashboard" && <AdminDashboard data={data} setData={setData} onOpenInApp={openInApp} />}
          {tab === "requests" && <AdminSubscriptionRequests data={data} setData={setData} />}
          {tab === "plans" && <AdminPlans data={data} setData={setData} />}
          {tab === "announcements" && <AdminAnnouncements data={data} setData={setData} />}
          {tab === "ads" && <AdminAds data={data} setData={setData} />}
          {tab === "students" && <AdminStudents data={data} setData={setData} />}
          {tab === "exams" && <AdminExams data={data} setData={setData} onOpenInApp={openInApp} />}
          {tab === "notes" && <AdminNotes data={data} setData={setData} onOpenInApp={openInApp} />}
          {tab === "activity" && <AdminActivityLog data={data} setData={setData} />}
          {tab === "branding" && (
            <div className="space-y-6">
              <AdminBranding data={data} setData={setData} />
              <AdminGoogleSignIn data={data} setData={setData} />
            </div>
          )}
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden sticky bottom-0 z-10 flex border-t border-slate-200 bg-white">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${
                tab === t.key ? "text-sky-600" : "text-slate-400"
              }`}
            >
              <span className="relative">
                <t.icon size={18} />
                {!!t.badge && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white">
                    {t.badge > 9 ? "9+" : t.badge}
                  </span>
                )}
              </span>
              {t.shortLabel}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

/* ----------------------------- Admin: branding ----------------------------- */

const MAX_LOGO_BYTES = 1.5 * 1024 * 1024; // ~1.5MB, keeps localStorage usage sane

// One small upload widget (preview + choose/remove) for a single logo slot.
// Used twice inside LogoSlotCard — once for the light variant, once for dark.
function LogoUploadSlot({ label, swatchBg, preview, onPick, onRemove, uploading, fit }) {
  const fileInputRef = useRef(null);
  return (
    <div className="flex-1 min-w-[180px]">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex items-center gap-3">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200"
          style={{ background: swatchBg }}
        >
          {preview ? (
            <img src={preview} alt={`${label} preview`} className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`} />
          ) : (
            <ImageIcon size={20} className="text-slate-300" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <UploadCloud size={13} /> {uploading ? "Uploading…" : "Choose"}
          </button>
          {preview && (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50"
            >
              <Trash2 size={13} /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// A full logo-slot card: light + dark variants, shared error/saved state,
// one Save button. `fit` controls how the preview image is cropped
// ("cover" for square app icons, "contain" for wordmark-style logos).
function LogoSlotCard({ title, description, lightUrl, darkUrl, onSave, savedMessage, fit = "cover", className = "" }) {
  const [previewLight, setPreviewLight] = useState(lightUrl);
  const [previewDark, setPreviewDark] = useState(darkUrl);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [uploadingLight, setUploadingLight] = useState(false);
  const [uploadingDark, setUploadingDark] = useState(false);

  const handleFile = async (file, which) => {
    setError("");
    setSaved(false);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, JPG, SVG, etc).");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("That image is too large. Please use one under 1.5MB.");
      return;
    }
    const setUploading = which === "dark" ? setUploadingDark : setUploadingLight;
    setUploading(true);
    try {
      const url = await uploadImageFile(file, "logos");
      if (which === "dark") setPreviewDark(url);
      else setPreviewLight(url);
    } catch (e) {
      setError(e?.message || "Couldn't upload that file. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const dirty = previewLight !== lightUrl || previewDark !== darkUrl;

  const save = () => {
    onSave(previewLight || null, previewDark || null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 ${className}`}>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>

      <div className="mt-5 flex flex-wrap gap-6">
        <LogoUploadSlot
          label="Light mode"
          swatchBg="#fff"
          preview={previewLight}
          onPick={(f) => handleFile(f, "light")}
          onRemove={() => { setPreviewLight(null); setError(""); setSaved(false); }}
          uploading={uploadingLight}
          fit={fit}
        />
        <LogoUploadSlot
          label="Dark mode"
          swatchBg="#0B1220"
          preview={previewDark}
          onPick={(f) => handleFile(f, "dark")}
          onRemove={() => { setPreviewDark(null); setError(""); setSaved(false); }}
          uploading={uploadingDark}
          fit={fit}
        />
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        Leave "Dark mode" empty to reuse the light logo when a student or admin switches to dark mode.
      </p>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <Check size={16} /> <span>{savedMessage || "Logo updated."}</span>
        </div>
      )}

      <button
        type="button"
        disabled={!dirty || uploadingLight || uploadingDark}
        onClick={save}
        className={`mt-5 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition ${
          dirty && !uploadingLight && !uploadingDark ? "hover:brightness-105" : "opacity-40 cursor-not-allowed"
        }`}
        style={{ background: "linear-gradient(to right, #0EA5E9, #2563EB)" }}
      >
        Save {title.toLowerCase()}
      </button>
    </div>
  );
}

function AdminBranding({ data, setData }) {
  const saveMainLogo = (light, dark) => {
    setData(
      withActivity(
        { ...data, branding: { ...(data.branding || {}), logoUrl: light, logoUrlDark: dark } },
        light || dark ? "Updated app logo" : "Removed app logo",
        ""
      )
    );
    setStoredLogo(light, dark);
  };

  const saveAuthLogo = (light, dark) => {
    setData(
      withActivity(
        { ...data, branding: { ...(data.branding || {}), authLogoUrl: light, authLogoUrlDark: dark } },
        light || dark ? "Updated sign-in logo" : "Removed sign-in logo",
        ""
      )
    );
    setStoredAuthLogo(light, dark);
  };

  const saveViewerLogo = (light, dark) => {
    setData(
      withActivity(
        { ...data, branding: { ...(data.branding || {}), viewerLogoUrl: light, viewerLogoUrlDark: dark } },
        light || dark ? "Updated note & exam viewer logo" : "Removed note & exam viewer logo",
        ""
      )
    );
    setStoredViewerLogo(light, dark);
  };

  return (
    <div className="max-w-2xl space-y-5">
      <LogoSlotCard
        title="App logo"
        description="Shown in the header throughout the app. Square images work best."
        lightUrl={data?.branding?.logoUrl || null}
        darkUrl={data?.branding?.logoUrlDark || null}
        onSave={saveMainLogo}
        savedMessage="App logo updated."
        fit="cover"
      />
      <LogoSlotCard
        title="Sign-in / sign-up logo"
        description="Shown only on the sign-in and sign-up screens, before anyone has a theme preference saved — this one follows the visitor's device/browser dark-mode setting."
        lightUrl={data?.branding?.authLogoUrl || null}
        darkUrl={data?.branding?.authLogoUrlDark || null}
        onSave={saveAuthLogo}
        savedMessage="Sign-in logo updated."
        fit="contain"
      />
      <LogoSlotCard
        title="Note & exam viewer logo"
        description="Shown at the top of the note & exam viewer, in place of the main app logo. Leave empty to reuse the app logo above."
        lightUrl={data?.branding?.viewerLogoUrl || null}
        darkUrl={data?.branding?.viewerLogoUrlDark || null}
        onSave={saveViewerLogo}
        savedMessage="Viewer logo updated."
        fit="contain"
      />
      <SupportLinkCard data={data} setData={setData} />
    </div>
  );
}

function SupportLinkCard({ data, setData }) {
  const current = data?.branding?.supportUrl || "";
  const [value, setValue] = useState(current);
  const [saved, setSaved] = useState(false);
  const dirty = value.trim() !== current;

  const save = () => {
    setData(
      withActivity(
        { ...data, branding: { ...(data.branding || {}), supportUrl: value.trim() } },
        "Updated support link",
        ""
      )
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-semibold text-slate-700">Support link</p>
      <p className="mt-1 text-xs text-slate-500">
        Shown as the "BTR Support" tile on the student home screen. e.g. your Telegram group link.
      </p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://t.me/your_group"
        className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-sky-400"
      />
      {saved && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <Check size={16} /> <span>Support link updated.</span>
        </div>
      )}
      <button
        type="button"
        disabled={!dirty}
        onClick={save}
        className={`mt-5 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition ${
          dirty ? "hover:brightness-105" : "opacity-40 cursor-not-allowed"
        }`}
        style={{ background: "linear-gradient(to right, #0EA5E9, #2563EB)" }}
      >
        Save support link
      </button>
    </div>
  );
}

function BrandNameCard({ data, setData }) {
  const current = data?.branding?.brandName || "";
  const [value, setValue] = useState(current);
  const [saved, setSaved] = useState(false);
  const dirty = value.trim() !== current;

  const save = () => {
    setData(
      withActivity(
        { ...data, branding: { ...(data.branding || {}), brandName: value.trim() } },
        "Updated brand name",
        ""
      )
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-semibold text-slate-700">Brand name</p>
      <p className="mt-1 text-xs text-slate-500">
        Shown under the logo on the exam & note viewer header. Leave empty to use “BTR ትምህርት”.
      </p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="BTR ትምህርት"
        className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-sky-400"
      />
      {saved && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <Check size={16} /> <span>Brand name updated.</span>
        </div>
      )}
      <button
        type="button"
        disabled={!dirty}
        onClick={save}
        className={`mt-5 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition ${
          dirty ? "hover:brightness-105" : "opacity-40 cursor-not-allowed"
        }`}
        style={{ background: "linear-gradient(to right, #0EA5E9, #2563EB)" }}
      >
        Save brand name
      </button>
    </div>
  );
}


function AdminGoogleSignIn({ data, setData }) {
  const currentId = data?.branding?.googleClientId || "";
  const [value, setValue] = useState(currentId);
  const [saved, setSaved] = useState(false);
  const dirty = value.trim() !== currentId;

  const save = () => {
    setData(
      withActivity(
        { ...data, branding: { ...(data.branding || {}), googleClientId: value.trim() } },
        value.trim() ? "Enabled Google sign-in" : "Disabled Google sign-in",
        ""
      )
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-lg">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-700">Google sign-in</p>
        <p className="mt-1 text-xs text-slate-500">
          Lets students sign in (or create an account) with one tap using Google, in addition to their Student
          ID and password. Create an OAuth Client ID (type "Web application") in the Google Cloud Console and
          paste it below to turn this on. Leave it blank to hide the Google button.
        </p>

        <div className="mt-5">
          <Field label="Google OAuth Client ID">
            <input
              className={inputCls}
              placeholder="e.g. 1234567890-abc123.apps.googleusercontent.com"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>

        {saved && (
          <div className="mb-1 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <Check size={16} /> <span>Saved.</span>
          </div>
        )}

        <button
          type="button"
          disabled={!dirty}
          onClick={save}
          className={`mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition ${
            dirty ? "hover:brightness-105" : "opacity-40 cursor-not-allowed"
          }`}
          style={{ background: 'linear-gradient(to right, #0EA5E9, #2563EB)' }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

/* ------------------- Shared page header (Notes / Exams) ------------------- */

// Header used at the top of the Notes and Exams tabs: brand logo, page title
// with a short subtitle, notification + profile buttons, and a search pill.
function PageHeader({
  logoUrl, title, subtitle, placeholder, theme, darkMode, student, notifications = [],
  onSearch, onNotifications, onProfile,
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        <img src={logoUrl} alt="BTR" className="h-12 w-12 shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl font-extrabold leading-tight" style={{ color: theme.textPrimary }}>
            {title}
          </h2>
          <p className="truncate text-sm" style={{ color: theme.textSecondary }}>{subtitle}</p>
        </div>
        <button
          onClick={onNotifications}
          aria-label="Notifications"
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ color: darkMode ? "#93C5FD" : AUTH_BLUE }}
        >
          <Bell size={22} />
          {notifications.length > 0 && (
            <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
          )}
        </button>
        <button
          onClick={onProfile}
          aria-label="Profile"
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full"
          style={{ color: darkMode ? "#93C5FD" : AUTH_BLUE }}
        >
          {student?.photo ? (
            <img src={student.photo} alt={student.name} className="h-full w-full rounded-full object-cover" />
          ) : (
            <User size={24} />
          )}
        </button>
      </div>

      <button
        onClick={onSearch}
        className="mt-4 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left shadow-sm"
        style={{ background: darkMode ? theme.cardBg : "#FFFFFF" }}
      >
        <Search size={20} style={{ color: darkMode ? "#93C5FD" : AUTH_BLUE }} />
        <span className="min-w-0 flex-1 truncate text-sm" style={{ color: theme.textMuted }}>
          {placeholder}
        </span>
        <SlidersHorizontal size={18} style={{ color: darkMode ? "#93C5FD" : AUTH_BLUE }} />
      </button>
    </div>
  );
}

/* ----------------------------- STUDENT: view ----------------------------- */

function FilterSelect({ icon: Icon, value, onChange, children }) {
  return (
    <div className="relative shrink-0">
      <Icon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" />
      <select
        value={value}
        onChange={onChange}
        className="appearance-none rounded-full border border-blue-200 bg-white py-2 pl-8 pr-7 text-xs font-bold text-blue-700"
      >
        {children}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-400" />
    </div>
  );
}

function ExamCard({ categoryLabel, subject, title, university, year, time, questions, isPro, locked, onUnlock, openSlot, defaultExpanded }) {
  const [expanded, setExpanded] = useState(!!defaultExpanded);
  const SubjectIcon = subjectIcon(subject);
  const color = subjectColor(subject);
  const canExpand = !!(university || time || questions);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `${color}1A` }}
          >
            {locked ? <Lock size={16} className="text-blue-500" /> : <SubjectIcon size={16} style={{ color }} />}
          </span>
          <div className="min-w-0">
            {categoryLabel && (
              <span className="mb-0.5 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                {categoryLabel}
              </span>
            )}
            <span className="block truncate text-sm font-bold leading-tight text-slate-900">{title}</span>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                {year}
              </span>
              {isPro && <ProBadge />}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {locked ? (
            <button
              type="button"
              onClick={onUnlock}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600"
            >
              <Lock size={10} /> Unlock
            </button>
          ) : (
            openSlot
          )}
          {canExpand && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Collapse" : "Expand"}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {expanded && canExpand && (
        <div className="mt-3 flex items-stretch justify-between gap-1 rounded-2xl bg-slate-50 px-2 py-3.5">
          {university && (
            <div className="flex flex-1 items-center justify-center gap-2 px-1">
              <Landmark size={18} className="shrink-0 text-blue-600" />
              <div className="min-w-0">
                <div className="text-[11px] leading-tight text-slate-400">University</div>
                <div className="truncate text-sm font-bold leading-tight text-slate-900">{university}</div>
              </div>
            </div>
          )}
          {time && (
            <div className="flex flex-1 items-center justify-center gap-2 border-l border-slate-200 px-1">
              <Clock size={18} className="shrink-0 text-blue-600" />
              <div className="min-w-0">
                <div className="text-[11px] leading-tight text-slate-400">Time</div>
                <div className="truncate text-sm font-bold leading-tight text-slate-900">{time}</div>
              </div>
            </div>
          )}
          {questions && (
            <div className="flex flex-1 items-center justify-center gap-2 border-l border-slate-200 px-1">
              <HelpCircle size={18} className="shrink-0 text-blue-600" />
              <div className="min-w-0">
                <div className="text-[11px] leading-tight text-slate-400">Questions</div>
                <div className="truncate text-sm font-bold leading-tight text-slate-900">{questions}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StudentExamBrowser({ data, onOpenInApp, isSubscribed, onUnlock }) {
  const [activeCategory, setActiveCategory] = useState(EXAM_CATEGORIES[0]);
  const [yearFilter, setYearFilter] = useState("all");
  const [universityFilter, setUniversityFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  const catEntries = [...(data.examCategories[activeCategory] || [])];

  const availableYears = Array.from(new Set(catEntries.map((e) => e.year).filter(Boolean)))
    .sort((a, b) => String(b).localeCompare(String(a)));
  const availableUniversities = Array.from(
    new Set(catEntries.map((e) => e.university).filter(Boolean))
  ).sort();
  const availableSubjects = Array.from(
    new Set(catEntries.map((e) => e.subject).filter(Boolean))
  ).sort();

  const entries = catEntries
    .filter((e) => yearFilter === "all" || String(e.year) === String(yearFilter))
    .filter((e) => universityFilter === "all" || e.university === universityFilter)
    .filter((e) => subjectFilter === "all" || e.subject === subjectFilter)
    .sort((a, b) => String(b.year).localeCompare(String(a.year)));

  const anyFilterActive =
    yearFilter !== "all" || universityFilter !== "all" || subjectFilter !== "all";

  const clearAll = () => {
    setYearFilter("all");
    setUniversityFilter("all");
    setSubjectFilter("all");
  };

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 overflow-hidden rounded-2xl border border-blue-200 bg-white">
        {EXAM_CATEGORIES.map((c, i) => {
          const meta = EXAM_CATEGORY_META[c] || { label: c, icon: FileText };
          const Icon = meta.icon;
          const active = activeCategory === c;
          return (
            <button
              key={c}
              onClick={() => { setActiveCategory(c); clearAll(); }}
              className={`flex items-center justify-center gap-1.5 py-3 text-[12px] font-bold transition ${
                active ? "bg-blue-600 text-white" : "bg-white text-blue-600"
              } ${i !== 0 ? "border-l border-blue-100" : ""}`}
            >
              <Icon size={15} />
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
        <FilterSelect icon={Calendar} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="all">All years</option>
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </FilterSelect>

        <FilterSelect icon={Landmark} value={universityFilter} onChange={(e) => setUniversityFilter(e.target.value)}>
          <option value="all">All universities</option>
          {availableUniversities.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </FilterSelect>

        <FilterSelect icon={BookOpen} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
          <option value="all">All subjects</option>
          {availableSubjects.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </FilterSelect>

        {anyFilterActive && (
          <button
            onClick={clearAll}
            className="shrink-0 text-xs font-bold text-blue-600"
          >
            Clear all
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          No {activeCategory.toLowerCase()} materials posted yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((e) => {
            const locked = e.isPro && !isSubscribed;
            return (
              <ExamCard
                key={e.id}
                categoryLabel={(EXAM_CATEGORY_META[activeCategory] || {}).label || activeCategory}
                subject={e.subject}
                title={e.title || `${activeCategory} ${e.year}`}
                university={e.university}
                year={e.year}
                time={e.time}
                questions={e.questions}
                isPro={e.isPro}
                locked={locked}
                onUnlock={onUnlock}
                openSlot={
                  <MaterialLink
                    url={e.link}
                    htmlContent={e.htmlContent}
                    htmlUrl={e.htmlUrl}
                    fileName={e.fileName}
                    label="Open"
                    variant="filled"
                    size="sm"
                    onOpenInApp={(source, title) => onOpenInApp(source, title, { type: "exam", category: activeCategory })}
                  />
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function mergedSubjects(data) {
  const notes = notesList(data);
  const rows = subjectsList(data).map((s) => ({
    id: s.id,
    name: s.name,
    notes: notesForSubject(notes, s.id),
  }));
  const general = notesForSubject(notes, null);
  if (general.length) rows.push({ id: "__general", name: "General", notes: general });
  return rows;
}

function SubjectListCards({ rows, onPick, title = "Subjects", emptyLabel }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-extrabold text-slate-900">{title}</h3>
        <span className="text-sm font-bold text-blue-600">{rows.length} total</span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-400">
          {emptyLabel}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => {
            const Icon = r.id === "__general" ? BookOpen : subjectDisplayIcon(r.name);
            return (
              <button
                key={r.id}
                onClick={() => onPick(r)}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 text-left shadow-sm transition hover:shadow-md"
              >
                <span
                  className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "#2563EB1A" }}
                >
                  <Icon size={26} style={{ color: "#2563EB" }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold text-slate-900">{r.name}</span>
                  <span className="block text-sm text-slate-500">
                    {r.count} item{r.count === 1 ? "" : "s"} available
                  </span>
                </span>
                <ChevronRight size={20} className="shrink-0 text-slate-400" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChapterCard({ chapter, locked, onUnlock, onOpenInApp, defaultExpanded }) {
  const [expanded, setExpanded] = useState(!!defaultExpanded);
  const [showAllTopics, setShowAllTopics] = useState(false);
  const topics = chapter.topics || [];
  const practiceExams = chapter.practiceExams || [];
  const TOPIC_PREVIEW_COUNT = 3;
  const visibleTopics = showAllTopics ? topics : topics.slice(0, TOPIC_PREVIEW_COUNT);
  const progress = Math.max(0, Math.min(100, parseInt(chapter.progress, 10) || 0));
  const canExpand =
    !!(chapter.subtitle || chapter.notesCount || chapter.topicsCount || chapter.estTime || topics.length > 0);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
            {locked ? <Lock size={16} className="text-blue-500" /> : <FileText size={16} className="text-blue-600" />}
          </span>
          <div className="min-w-0">
            <span className="block truncate text-sm font-bold leading-tight text-slate-900">{chapter.title}</span>
            {chapter.subtitle && (
              <span className="block truncate text-xs leading-tight text-slate-500">{chapter.subtitle}</span>
            )}
            {chapter.isPro && (
              <span className="mt-0.5 inline-block">
                <ProBadge />
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {locked ? (
            <button
              type="button"
              onClick={onUnlock}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600"
            >
              <Lock size={10} /> Unlock
            </button>
          ) : (
            <MaterialLink
              url={chapter.link}
              htmlContent={chapter.htmlContent}
              htmlUrl={chapter.htmlUrl}
              fileName={chapter.fileName}
              label="Open"
              variant={expanded ? "filled" : "pill"}
              size="sm"
              onOpenInApp={onOpenInApp}
            />
          )}
          {canExpand && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Collapse" : "Expand"}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3">
          {(chapter.notesCount || chapter.topicsCount || chapter.estTime) && (
            <div className="flex items-stretch justify-between gap-1 rounded-2xl bg-slate-50 px-2 py-3.5">
              {chapter.notesCount && (
                <div className="flex flex-1 items-center justify-center gap-2 px-1">
                  <BookOpen size={18} className="shrink-0 text-blue-600" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-tight text-slate-900">{chapter.notesCount}</div>
                    <div className="text-[11px] leading-tight text-slate-400">Sections</div>
                  </div>
                </div>
              )}
              {chapter.topicsCount && (
                <div className="flex flex-1 items-center justify-center gap-2 border-l border-slate-200 px-1">
                  <FileText size={18} className="shrink-0 text-blue-600" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-tight text-slate-900">{chapter.topicsCount}</div>
                    <div className="text-[11px] leading-tight text-slate-400">Topics</div>
                  </div>
                </div>
              )}
              {chapter.estTime && (
                <div className="flex flex-1 items-center justify-center gap-2 border-l border-slate-200 px-1">
                  <Clock size={18} className="shrink-0 text-blue-600" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-tight text-slate-900">{chapter.estTime}</div>
                    <div className="text-[11px] leading-tight text-slate-400">Study time</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {chapter.progress && (
            <div className="mt-3 flex items-center gap-2.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
              </div>
              <span className="shrink-0 text-[11px] font-bold text-blue-600">{progress}% Complete</span>
            </div>
          )}

          {topics.length > 0 && (
            <div className="mt-4">
              <div className="flex flex-col divide-y divide-slate-100 rounded-2xl border border-slate-100">
                {visibleTopics.map((t) => {
                  const href = !locked ? toEmbeddableUrl(normalizeUrl(t.link)) : null;
                  const clickable = !!href;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={!clickable && !locked}
                      onClick={() => {
                        if (locked) { onUnlock && onUnlock(); return; }
                        if (href) onOpenInApp(href, t.title);
                      }}
                      className={`flex items-center gap-3 px-3 py-3 text-left first:rounded-t-2xl last:rounded-b-2xl ${
                        clickable || locked ? "hover:bg-slate-50" : "cursor-default"
                      }`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                        <FileText size={16} className="text-blue-600" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-900">{t.title}</span>
                        {t.notesCount && (
                          <span className="block text-xs text-slate-400">
                            {t.notesCount} Note{String(t.notesCount) === "1" ? "" : "s"}
                          </span>
                        )}
                      </span>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <ChevronRight size={15} />
                      </span>
                    </button>
                  );
                })}
              </div>

              {topics.length > TOPIC_PREVIEW_COUNT && (
                <button
                  type="button"
                  onClick={() => setShowAllTopics((v) => !v)}
                  className="mt-3 flex w-full items-center justify-center gap-1 py-1 text-sm font-bold text-blue-600 hover:text-blue-700"
                >
                  {showAllTopics ? "Show less" : `View all topics (${topics.length})`}
                  <ChevronDown size={16} className={`transition-transform ${showAllTopics ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          )}

          {practiceExams.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-bold text-slate-800">Practice exams</div>
              <div className="flex flex-col gap-2">
                {practiceExams.map((x) => {
                  const href = x.htmlContent || x.htmlUrl ? null : normalizeUrl(x.link);
                  const hasMaterial = !!(x.htmlContent || x.htmlUrl || href);
                  return (
                    <button
                      key={x.id}
                      type="button"
                      disabled={!locked && !hasMaterial}
                      onClick={() => {
                        if (locked) {
                          onUnlock();
                          return;
                        }
                        if (x.htmlContent || x.htmlUrl) {
                          onOpenInApp && onOpenInApp({ htmlContent: x.htmlContent, htmlUrl: x.htmlUrl }, x.title || "Material");
                        } else if (href) {
                          onOpenInApp && onOpenInApp(toEmbeddableUrl(href), x.title || "Material");
                        }
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3.5 text-left transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ClipboardCheck size={20} className="shrink-0 text-blue-600" />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
                        {x.title || "Practice exam"}
                      </span>
                      {locked ? (
                        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600">
                          <Lock size={10} /> Unlock
                        </span>
                      ) : (
                        <ChevronRight size={18} className="shrink-0 text-blue-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StudentNoteBrowser({ data, onOpenInApp, isSubscribed, onUnlock }) {
  const [subject, setSubject] = useState(null);

  const rows = mergedSubjects(data).map((r) => ({ ...r, count: r.notes.length }));

  // Level 1: subjects (departments are not shown any more)
  if (!subject) {
    return (
      <SubjectListCards
        rows={rows}
        onPick={(r) => setSubject(r)}
        emptyLabel="No subjects yet."
      />
    );
  }

  const current = rows.find((r) => r.id === subject.id) || subject;
  const sorted = [...(current.notes || [])].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <div>
      <button
        onClick={() => setSubject(null)}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700"
      >
        ← Back to subjects
      </button>
      <h3 className="mb-3 text-sm font-bold text-slate-800">{current.name}</h3>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          No notes yet for this subject.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sorted.map((n, i) => {
            const locked = n.isPro && !isSubscribed;
            return (
              <ChapterCard
                key={n.id}
                chapter={n}
                locked={locked}
                onUnlock={onUnlock}
                onOpenInApp={(source, title) => onOpenInApp(source, title, { type: "note", subject: current.name })}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Avatar ----------------------------- */

function Avatar({ student, size = 64 }) {
  const initials = (student?.name || "?").trim().charAt(0).toUpperCase();
  if (student?.photo) {
    return (
      <img
        src={student.photo}
        alt={student.name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0 ring-2 ring-white/80"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-white/90 text-sky-600 font-extrabold ring-2 ring-white/80"
    >
      <span style={{ fontSize: size * 0.36 }}>{initials}</span>
    </div>
  );
}

/* ----------------------------- Profile modal (view / edit / upload picture) ----------------------------- */

function ProfileModal({ student, lang, onClose, onSave, theme }) {
  const [mode, setMode] = useState("view"); // view | edit
  const [name, setName] = useState(student.name || "");
  const [email, setEmail] = useState(student.email || "");
  const [photo, setPhoto] = useState(student.photo || "");
  const [savedFlash, setSavedFlash] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handlePickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Please choose an image under 2MB.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImageFile(file, "profile-pictures");
      setPhoto(url);
    } catch (err) {
      alert(err?.message || "Couldn't upload that file. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    onSave({ ...student, name: name.trim() || student.name, email: email.trim(), photo });
    setSavedFlash(true);
    setTimeout(() => {
      setSavedFlash(false);
      setMode("view");
    }, 900);
  };

  return (
    <Modal title={mode === "view" ? t(lang, "profile") : t(lang, "editProfile")} onClose={onClose} theme={theme}>
      <div className="flex flex-col items-center mb-5">
        <div className="relative">
          <Avatar student={{ ...student, photo }} size={88} />
          {mode === "edit" && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-white shadow-md hover:bg-sky-700 transition disabled:opacity-50"
              title={t(lang, "uploadPicture")}
            >
              <Camera size={15} />
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePickFile} />
        </div>
        {mode === "view" && (
          <>
            <h3 className="mt-3 text-lg font-bold text-slate-900">{student.name}</h3>
            <p className="text-sm text-slate-500">{student.grade || "—"} · {student.studentId}</p>
          </>
        )}
      </div>

      {mode === "view" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
            <CreditCard size={17} className="text-slate-400 shrink-0" />
            <div>
              <div className="text-xs text-slate-400">{t(lang, "studentId")}</div>
              <div className="text-sm font-semibold text-slate-700">{student.studentId}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
            <Mail size={17} className="text-slate-400 shrink-0" />
            <div>
              <div className="text-xs text-slate-400">{t(lang, "email")}</div>
              <div className="text-sm font-semibold text-slate-700">{student.email || "—"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
            <GraduationCap size={17} className="text-slate-400 shrink-0" />
            <div>
              <div className="text-xs text-slate-400">{t(lang, "grade")}</div>
              <div className="text-sm font-semibold text-slate-700">{student.grade || "—"}</div>
            </div>
          </div>
          <button
            onClick={() => setMode("edit")}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
          >
            <Pencil size={15} /> {t(lang, "editProfile")}
          </button>
        </div>
      ) : (
        <div>
          <Field label={t(lang, "fullName")}>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t(lang, "email")}>
            <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setMode("view")}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              {t(lang, "cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition disabled:opacity-50"
            >
              {savedFlash ? (
                <>
                  <Check size={15} /> {t(lang, "saved")}
                </>
              ) : uploading ? (
                "Uploading…"
              ) : (
                t(lang, "save")
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ----------------------------- Settings modal ----------------------------- */

function SettingsModal({ lang, prefs, onUpdatePrefs, onClose, onOpenProfile, onOpenSubscription, onOpenAnalysis, theme }) {
  return (
    <Modal title={t(lang, "settings")} onClose={onClose} theme={theme}>
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{t(lang, "theme")}</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onUpdatePrefs({ theme: "light" })}
              className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition ${
                prefs.theme === "light" ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-500"
              }`}
            >
              <Sun size={16} /> {t(lang, "light")}
            </button>
            <button
              onClick={() => onUpdatePrefs({ theme: "dark" })}
              className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition ${
                prefs.theme === "dark" ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-500"
              }`}
            >
              <Moon size={16} /> {t(lang, "dark")}
            </button>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{t(lang, "language")}</div>
          <div className="grid grid-cols-1 gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => onUpdatePrefs({ language: l.code })}
                className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${
                  prefs.language === l.code ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-600"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Languages size={15} /> {l.label}
                </span>
                {prefs.language === l.code && <Check size={16} />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{t(lang, "notificationPrefs")}</div>
          <div className="space-y-2">
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-3 cursor-pointer">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <FileText size={15} className="text-slate-400" /> {t(lang, "newExamAlerts")}
              </span>
              <input
                type="checkbox"
                checked={prefs.notifyNewExam}
                onChange={(e) => onUpdatePrefs({ notifyNewExam: e.target.checked })}
                className="h-5 w-9 appearance-none rounded-full bg-slate-200 checked:bg-sky-500 relative transition cursor-pointer before:content-[''] before:absolute before:h-4 before:w-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:left-4 before:transition-all"
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-3 cursor-pointer">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Megaphone size={15} className="text-slate-400" /> {t(lang, "announcementAlerts")}
              </span>
              <input
                type="checkbox"
                checked={prefs.notifyAnnouncement}
                onChange={(e) => onUpdatePrefs({ notifyAnnouncement: e.target.checked })}
                className="h-5 w-9 appearance-none rounded-full bg-slate-200 checked:bg-sky-500 relative transition cursor-pointer before:content-[''] before:absolute before:h-4 before:w-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:left-4 before:transition-all"
              />
            </label>
          </div>
        </div>

        <button
          onClick={onOpenProfile}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <span className="flex items-center gap-2">
            <User size={15} className="text-slate-400" /> {t(lang, "profileSettings")}
          </span>
          <ChevronRight size={16} className="text-slate-300" />
        </button>

        {onOpenAnalysis && (
          <button
            onClick={onOpenAnalysis}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <span className="flex items-center gap-2">
              <TrendingUp size={15} className="text-slate-400" /> Learning Analysis
            </span>
            <ChevronRight size={16} className="text-slate-300" />
          </button>
        )}

        {onOpenSubscription && (
          <button
            onClick={onOpenSubscription}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <span className="flex items-center gap-2">
              <CreditCard size={15} className="text-slate-400" /> Manage Subscription
            </span>
            <ChevronRight size={16} className="text-slate-300" />
          </button>
        )}
      </div>
    </Modal>
  );
}

/* ----------------------------- Notifications panel ----------------------------- */

function NotificationsPanel({ lang, items, onClose, onMarkAllRead, theme }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6"
      style={{ background: "rgba(15,23,42,0.4)" }}
      onClick={onClose}
    >
      <div
        className="mt-14 w-full max-w-sm rounded-2xl shadow-2xl max-h-[70vh] overflow-y-auto animate-[fadeSlide_180ms_ease-out]"
        style={{ background: theme.sheetBg }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3.5" style={{ borderColor: theme.cardBorder }}>
          <h3 className="text-sm font-bold" style={{ color: theme.textPrimary }}>{t(lang, "notifications")}</h3>
          <button onClick={onClose} className="rounded-full p-1" style={{ color: theme.textMuted }}>
            <X size={16} />
          </button>
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: theme.textMuted }}>{t(lang, "noNotifications")}</div>
        ) : (
          <>
            <div className="divide-y" style={{ borderColor: theme.cardBorder }}>
              {items.map((n) => (
                <div key={n.id} className="flex gap-3 px-4 py-3.5">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={
                      n.type === "exam"
                        ? { background: "#E0F2FE", color: "#0284C7" }
                        : { background: "#FEF3C7", color: "#D97706" }
                    }
                  >
                    {n.type === "exam" ? <FileText size={15} /> : <Megaphone size={15} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate" style={{ color: theme.textPrimary }}>{n.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: theme.textMuted }}>{fmtDate(n.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={onMarkAllRead}
              className="w-full border-t py-3 text-xs font-semibold text-sky-600 hover:bg-sky-50 transition"
              style={{ borderColor: theme.cardBorder }}
            >
              {t(lang, "markAllRead")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Floating action button ----------------------------- */

function FloatingActionButton({ actions, theme }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-24 right-5 z-20 flex flex-col items-end gap-3">
      {open &&
        actions.map((a, i) => (
          <button
            key={a.label}
            onClick={() => {
              a.onClick();
              setOpen(false);
            }}
            className="flex items-center gap-2 rounded-full pl-3.5 pr-1.5 py-1.5 shadow-lg border text-sm font-semibold transition"
            style={{
              background: theme.sheetBg,
              borderColor: theme.cardBorder,
              color: theme.textPrimary,
              animation: `popIn 220ms ease-out ${i * 40}ms backwards`,
            }}
          >
            {a.label}
            <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: a.color || "#2C7BE5" }}>
              <a.icon size={14} className="text-white" />
            </span>
          </button>
        ))}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full shadow-xl text-white transition"
        style={{
          background: "linear-gradient(135deg, #2C7BE5 0%, #1B5FCC 100%)",
          transform: open ? "rotate(45deg)" : "rotate(0deg)",
          transition: "transform 220ms ease",
        }}
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

/* ----------------------------- Search overlay ----------------------------- */

function SearchOverlay({ theme, lang, data, onClose, onOpenExam, onOpenNote, onOpenAnnouncement, onOpenSubject }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return { subjects: [], notes: [], final: [], mid: [], practice: [], announcements: [] };

    const byCat = (cat) =>
      (data.examCategories?.[cat] || [])
        .filter((e) => `${e.title || ""} ${cat} ${e.year || ""}`.toLowerCase().includes(q))
        .map((e) => ({ ...e, category: cat }))
        .slice(0, 12);

    const catFor = (needle) =>
      EXAM_CATEGORIES.find((c) => c.toLowerCase().includes(needle)) || null;

    const finalCat = catFor("final");
    const midCat = catFor("mid");
    const practiceCat = catFor("practice");

    const subjects = subjectsList(data)
      .filter((s) => `${s.name || ""}`.toLowerCase().includes(q))
      .slice(0, 12);

    const notes = notesList(data)
      .filter((n) => `${n.title || ""} ${n.noteType || ""} ${n.subjectName || ""}`.toLowerCase().includes(q))
      .slice(0, 12);

    const announcements = (data.announcements || [])
      .filter((a) => `${a.title || ""} ${a.body || ""}`.toLowerCase().includes(q))
      .slice(0, 12);

    return {
      subjects,
      notes,
      final: finalCat ? byCat(finalCat) : [],
      mid: midCat ? byCat(midCat) : [],
      practice: practiceCat ? byCat(practiceCat) : [],
      announcements,
    };
  }, [q, data]);

  const TABS = [
    { key: "all", label: "All" },
    { key: "notes", label: "Notes" },
    { key: "final", label: "Final Exams" },
    { key: "mid", label: "Mid Exams" },
    { key: "practice", label: "Practice Exams" },
  ];

  const show = (key) => filter === "all" || filter === key;

  const visibleCount =
    (show("notes") ? results.subjects.length + results.notes.length : 0) +
    (show("final") ? results.final.length : 0) +
    (show("mid") ? results.mid.length : 0) +
    (show("practice") ? results.practice.length : 0) +
    (filter === "all" ? results.announcements.length : 0);

  const Row = ({ icon, title, subtitle, onClick }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99]"
      style={{ borderColor: theme.cardBorder, background: theme.cardBg }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: theme.chipBg, color: "#2563EB" }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold truncate" style={{ color: theme.textPrimary }}>
          {title}
        </span>
        {subtitle ? (
          <span className="block text-xs truncate" style={{ color: theme.textMuted }}>
            {subtitle}
          </span>
        ) : null}
      </span>
      <ChevronRight size={16} style={{ color: theme.textMuted }} className="shrink-0" />
    </button>
  );

  const Section = ({ label, children }) => (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: theme.textMuted }}>
        {label}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: theme.pageBg }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search pill */}
      <div className="px-4 pt-4">
        <div
          className="flex items-center gap-3 rounded-full border px-4 py-3 shadow-sm"
          style={{ borderColor: theme.cardBorder, background: theme.cardBg }}
        >
          <Search size={18} style={{ color: theme.textSecondary }} className="shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, exams, subjects…"
            className="flex-1 min-w-0 bg-transparent outline-none text-base"
            style={{ color: theme.textPrimary }}
          />
          <button
            onClick={() => (query ? setQuery("") : onClose())}
            className="shrink-0 rounded-full p-1"
            style={{ color: theme.textSecondary }}
            aria-label={query ? "Clear search" : "Close search"}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-3" style={{ scrollbarWidth: "none" }}>
        {TABS.map((tb) => {
          const active = filter === tb.key;
          return (
            <button
              key={tb.key}
              onClick={() => setFilter(tb.key)}
              className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition"
              style={{
                background: active ? theme.chipBg : "transparent",
                color: active ? "#2563EB" : theme.textSecondary,
              }}
            >
              {tb.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-10">
        {!q ? (
          <div className="mt-24 flex flex-col items-center text-center">
            <Search size={44} style={{ color: theme.textMuted }} />
            <p className="mt-4 text-sm" style={{ color: theme.textMuted }}>
              Start typing to search notes, exams and subjects.
            </p>
          </div>
        ) : visibleCount === 0 ? (
          <div className="mt-24 flex flex-col items-center text-center">
            <SearchX size={48} style={{ color: theme.textMuted }} />
            <p className="mt-4 text-xl font-bold" style={{ color: theme.textPrimary }}>
              No results
            </p>
            <p className="mt-1 text-sm" style={{ color: theme.textMuted }}>
              Nothing matched “{query}”.
            </p>
          </div>
        ) : (
          <div className="space-y-6 pt-1">
            {show("notes") && results.subjects.length > 0 && (
              <Section label="Subjects">
                {results.subjects.map((s) => (
                  <Row
                    key={s.id || s.name}
                    icon={<BookOpen size={16} />}
                    title={s.name}
                    subtitle="Subject"
                    onClick={() => onOpenSubject?.(s)}
                  />
                ))}
              </Section>
            )}

            {show("notes") && results.notes.length > 0 && (
              <Section label="Notes">
                {results.notes.map((n) => (
                  <Row
                    key={n.id}
                    icon={<BookOpen size={16} />}
                    title={n.title}
                    subtitle={n.noteType || NOTE_TYPES[0]}
                    onClick={() => onOpenNote(n)}
                  />
                ))}
              </Section>
            )}

            {[
              { key: "final", label: "Final Exams", list: results.final },
              { key: "mid", label: "Mid Exams", list: results.mid },
              { key: "practice", label: "Practice Exams", list: results.practice },
            ].map(
              (grp) =>
                show(grp.key) &&
                grp.list.length > 0 && (
                  <Section key={grp.key} label={grp.label}>
                    {grp.list.map((e) => (
                      <Row
                        key={e.id}
                        icon={<FileText size={16} />}
                        title={e.title || `${e.category} ${e.year}`}
                        subtitle={`${e.category}${e.year ? ` · ${e.year}` : ""}`}
                        onClick={() => onOpenExam(e)}
                      />
                    ))}
                  </Section>
                )
            )}

            {filter === "all" && results.announcements.length > 0 && (
              <Section label="Announcements">
                {results.announcements.map((a) => (
                  <Row
                    key={a.id}
                    icon={<Megaphone size={16} />}
                    title={a.title}
                    subtitle={a.body}
                    onClick={() => onOpenAnnouncement(a)}
                  />
                ))}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


function SubscriptionScreen({ student, theme, darkMode, onClose }) {
  const sub = getSubscriptionStatus(student);
  const t = theme;
  const [showDetails, setShowDetails] = useState(false);

  const pct = sub.hasPlan
    ? Math.max(0, Math.min(100, Math.round((Math.max(sub.daysLeft, 0) / sub.totalDays) * 100)))
    : 0;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;

  const statusLabel = !sub.hasPlan ? "NO PLAN" : sub.isExpired ? "EXPIRED" : sub.isExpiringSoon ? "EXPIRING SOON" : "ACTIVE";
  const statusDot = !sub.hasPlan ? "#94A3B8" : sub.isExpired ? "#F87171" : sub.isExpiringSoon ? "#FBBF24" : "#4ADE80";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: t.pageBg }}>
      <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: t.cardBorder, background: t.headerBg }}>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: t.chipBg, color: t.textSecondary }}>
          <ChevronLeft size={18} />
        </button>
        <Brand darkMode={darkMode} />
      </div>

      <div className="mx-auto w-full max-w-sm px-5 py-6">
        <h1 className="text-2xl font-bold" style={{ color: t.textPrimary }}>Manage Subscription</h1>
        <p className="mt-1 text-sm" style={{ color: t.textSecondary }}>View your current plan and its status.</p>

        <div className="mt-5 overflow-hidden rounded-3xl">
          {/* Blue status card */}
          <div
            className="relative overflow-hidden p-6"
            style={{ background: "linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%)" }}
          >
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
            <span
              className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide text-white"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusDot }} />
              {statusLabel}
            </span>

            <div className="relative mt-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-50/80">Days left</div>
                <div className="text-5xl font-extrabold leading-tight text-white tabular-nums">
                  {!sub.hasPlan ? "—" : Math.max(sub.daysLeft, 0)}
                </div>
                <div className="mt-0.5 text-sm text-sky-50/80">Days remaining</div>
              </div>
              <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
                <svg width="128" height="128" className="-rotate-90">
                  <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="7" />
                  <circle
                    cx="64" cy="64" r={radius} fill="none"
                    stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={`${dash} ${circumference}`}
                  />
                </svg>
                <div className="absolute flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,0.18)" }}>
                  <Calendar size={18} className="text-white" />
                </div>
              </div>
            </div>

            {sub.hasPlan && (
              <>
                <div className="relative mt-5 border-t" style={{ borderColor: "rgba(255,255,255,0.2)" }} />
                <div className="relative mt-4 flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
                    <Calendar size={15} className="text-white" />
                  </span>
                  <div>
                    <div className="text-xs text-sky-50/80">
                      {sub.isExpired ? "Your plan expired on" : "Your plan will expire on"}
                    </div>
                    <div className="text-base font-bold text-white">{student.expiresAt}</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* White details card */}
          <div className="p-5" style={{ background: t.cardBg }}>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: darkMode ? "rgba(56,189,248,0.15)" : "#E0F2FE" }}>
                <Calendar size={19} style={{ color: darkMode ? "#7DD3FC" : "#0284C7" }} />
              </span>
              <span className="font-bold" style={{ color: t.textPrimary }}>
                {student.planType ? `${student.planType} Plan` : "No plan set yet"}
              </span>
            </div>

            <div className="mt-5 flex items-center">
              <div className="flex flex-1 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: darkMode ? "rgba(56,189,248,0.15)" : "#E0F2FE" }}>
                  <CheckCircle2 size={16} style={{ color: darkMode ? "#7DD3FC" : "#0284C7" }} />
                </span>
                <span className="text-sm font-semibold" style={{ color: t.textPrimary }}>Secure &amp; Reliable</span>
              </div>
              <div className="mx-3 h-8 w-px" style={{ background: t.cardBorder }} />
              <div className="flex flex-1 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: darkMode ? "rgba(124,58,237,0.15)" : "#EDE9FE" }}>
                  <Mail size={16} style={{ color: "#7C3AED" }} />
                </span>
                <span className="text-sm font-semibold" style={{ color: t.textPrimary }}>Priority Support</span>
              </div>
            </div>

            <button
              onClick={() => setShowDetails((v) => !v)}
              className="mt-5 flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-sm font-bold"
              style={{ background: darkMode ? "rgba(56,189,248,0.12)" : "#EFF6FF", color: darkMode ? "#7DD3FC" : "#2563EB" }}
            >
              {showDetails ? "Hide Plan Details" : "View Plan Details"}
              <ChevronRight size={17} className={`transition-transform duration-300 ${showDetails ? "rotate-90" : ""}`} />
            </button>
          </div>
        </div>

        <div
          className="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: showDetails ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="mt-4 rounded-2xl border p-5" style={{ borderColor: t.cardBorder, background: t.cardBg }}>
              <div className="mb-4 flex items-center gap-2">
                <User size={16} style={{ color: t.textSecondary }} />
                <span className="font-bold" style={{ color: t.textPrimary }}>Subscription Details</span>
              </div>
              <div className="divide-y" style={{ borderColor: t.cardBorder }}>
                {[
                  { icon: User, label: "Student ID", value: student.studentId },
                  { icon: GraduationCap, label: "Grade", value: student.grade || "—" },
                  { icon: CreditCard, label: "Plan type", value: student.planType || "—" },
                  { icon: Sparkles, label: "Plan price", value: student.planPrice ? `${student.planPrice} ETB` : "—" },
                  { icon: Calendar, label: "Expire date", value: student.expiresAt || "Not set" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-3">
                    <span className="flex items-center gap-2 text-sm" style={{ color: t.textSecondary }}>
                      <Icon size={15} style={{ color: t.textMuted }} /> {label}
                    </span>
                    <span className="text-sm font-semibold text-right" style={{ color: t.textPrimary }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border p-5" style={{ borderColor: t.cardBorder, background: t.cardBg }}>
              <div className="mb-1 font-bold" style={{ color: t.textPrimary }}>Do you need help?</div>
              <a
                href="https://t.me/btrtmhrt_support"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-3 rounded-xl border p-3 transition hover:shadow-sm"
                style={{ borderColor: t.cardBorder }}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: darkMode ? "rgba(56,189,248,0.15)" : "#E0F2FE" }}>
                  <Mail size={16} style={{ color: darkMode ? "#7DD3FC" : "#0284C7" }} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold" style={{ color: t.textPrimary }}>Telegram Support</span>
                  <span className="block text-xs" style={{ color: t.textSecondary }}>Get help renewing or fixing your plan</span>
                </span>
                <ChevronRight size={16} style={{ color: t.textMuted }} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Learning Analysis ----------------------------- */

function LearningAnalysisScreen({ student, data, theme, darkMode, onClose }) {
  const t = theme;

  const activity = data.studentActivity?.[student.studentId] || [];
  const filtered = activity;

  const notesOpened = filtered.filter((a) => a.type === "note").length;
  const examsOpened = filtered.filter((a) => a.type === "exam").length;

  // Last 7 days, oldest first
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const dayCounts = days.map((d) => {
    const key = d.toDateString();
    const exams = filtered.filter((a) => a.type === "exam" && new Date(a.at).toDateString() === key).length;
    const notes = filtered.filter((a) => a.type === "note" && new Date(a.at).toDateString() === key).length;
    return { label: d.toLocaleDateString(undefined, { weekday: "short" }), exams, notes, total: exams + notes };
  });
  const maxCount = Math.max(1, ...dayCounts.map((d) => d.total));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: t.pageBg }}>
      <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: t.cardBorder, background: t.headerBg }}>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: t.chipBg, color: t.textSecondary }}>
          <ChevronLeft size={18} />
        </button>
        <Brand darkMode={darkMode} />
      </div>

      <div className="mx-auto w-full max-w-sm px-5 py-6">
        <h1 className="text-2xl font-bold" style={{ color: t.textPrimary }}>Learning Analysis</h1>
        <p className="mt-1 text-sm" style={{ color: t.textSecondary }}>Track what you've opened and when.</p>

        <div className="mt-5 flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: t.textPrimary }}>Overview</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border p-4" style={{ borderColor: t.cardBorder, background: t.cardBg }}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: darkMode ? "rgba(139,92,246,0.15)" : "#EDE9FE" }}>
              <BookOpen size={18} style={{ color: "#7C3AED" }} />
            </span>
            <div className="mt-3 text-xs" style={{ color: t.textSecondary }}>Notes opened</div>
            <div className="text-2xl font-extrabold" style={{ color: t.textPrimary }}>{notesOpened}</div>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: t.cardBorder, background: t.cardBg }}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: darkMode ? "rgba(16,185,129,0.15)" : "#D1FAE5" }}>
              <CheckCircle2 size={18} style={{ color: "#059669" }} />
            </span>
            <div className="mt-3 text-xs" style={{ color: t.textSecondary }}>Exams opened</div>
            <div className="text-2xl font-extrabold" style={{ color: t.textPrimary }}>{examsOpened}</div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: t.textPrimary }}>Activity this week</span>
        </div>
        <div className="mt-3 rounded-2xl border p-4" style={{ borderColor: t.cardBorder, background: t.cardBg }}>
          {dayCounts.every((d) => d.total === 0) ? (
            <div className="py-6 text-center text-sm" style={{ color: t.textMuted }}>
              Nothing opened yet this week.
            </div>
          ) : (
            <div className="flex items-end justify-between gap-2" style={{ height: 140 }}>
              {dayCounts.map((d, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full flex-1 flex-col-reverse items-center justify-start rounded-lg overflow-hidden" style={{ background: darkMode ? "rgba(255,255,255,0.05)" : "#F1F5F9" }}>
                    {d.total > 0 && (
                      <>
                        <div style={{ height: `${(d.exams / maxCount) * 100}%`, width: "100%", background: "#059669" }} />
                        <div style={{ height: `${(d.notes / maxCount) * 100}%`, width: "100%", background: "#7C3AED" }} />
                      </>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold" style={{ color: t.textMuted }}>{d.label}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center justify-center gap-4 text-xs" style={{ color: t.textSecondary }}>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#059669" }} /> Exams opened</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#7C3AED" }} /> Notes opened</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpiredGateScreen({ student, theme, darkMode, onLogout, onViewSubscription }) {
  const t = theme;
  return (
    <div className={`min-h-screen w-full${darkMode ? " dark-mode" : ""}`} style={{ background: t.pageBg }}>
      <GlobalDarkStyles />
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: t.cardBorder, background: t.headerBg }}>
        <Brand darkMode={darkMode} />
        <button onClick={onLogout} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: t.textSecondary }}>
          <LogOut size={14} /> Logout
        </button>
      </div>
      <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-500">
          <Lock size={26} />
        </div>
        <h1 className="mt-5 text-xl font-bold" style={{ color: t.textPrimary }}>Your access has expired</h1>
        <p className="mt-2 text-sm" style={{ color: t.textSecondary }}>
          {student.name}, your BTR ትምህርት plan expired on <span className="font-semibold">{student.expiresAt}</span>. Renew to get back into your exams and notes.
        </p>
        <button
          onClick={onViewSubscription}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(to right, #0EA5E9, #2563EB)' }}
        >
          View subscription details
        </button>
        <a
          href="https://t.me/btrtmhrt_support"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold"
          style={{ borderColor: t.cardBorder, color: t.textSecondary }}
        >
          Contact support to renew
        </a>
      </div>
    </div>
  );
}

function InstallHelpModal({ theme, onClose }) {
  const steps = [
    "Open the BTR Exit Exam link in Google Chrome.",
    "Wait a few seconds for the Install App notification to appear.",
    "Tap Install.",
    "The app will be added to your home screen.",
    "Open it from your home screen and enjoy a faster experience.",
  ];
  const fallbackSteps = [
    "Tap the ⋮ (three-dot menu) in Chrome.",
    "Select Install app or Add to Home screen.",
    "Tap Install.",
  ];
  return (
    <Modal title="How to Install BTR Exit Exam" onClose={onClose} theme={theme}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-[#2563EB]/10 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-white">
            <Download size={20} />
          </span>
          <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>
            Add BTR Exit Exam to your home screen for quick access.
          </p>
        </div>

        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed" style={{ color: theme.textSecondary }}>
                {step}
              </span>
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border p-3" style={{ borderColor: theme.cardBorder, background: theme.cardBg }}>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: theme.textPrimary }}>
            <MoreVertical size={16} />
            If the install notification doesn't appear:
          </p>
          <ol className="ml-4 list-decimal space-y-1.5 text-sm" style={{ color: theme.textSecondary }}>
            {fallbackSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-[#2563EB] py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
        >
          Got it
        </button>
      </div>
    </Modal>
  );
}

// Some browsers (and built-in ad blockers) refuse to load URLs containing an
// "ads" path segment, which made promo banners look broken. Serve them from a
// neutral alias path instead.
function promoImageSrc(url = "") {
  const u = String(url || "");
  if (u.startsWith("/api/public/files/ads/")) {
    return `/api/public/media/promo/${u.slice("/api/public/files/ads/".length)}`;
  }
  if (u.startsWith("/api/public/files/")) {
    return `/api/public/media/${u.slice("/api/public/files/".length)}`;
  }
  return u;
}

function AdCarousel({ ads, theme, darkMode }) {
  const scrollerRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const visible = (ads || [])
    .filter((a) => a.active !== false && a.imageUrl)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el || !el.children.length) return;
    const cardWidth = el.children[0].offsetWidth + 12; // + gap
    const idx = Math.round(el.scrollLeft / cardWidth);
    setActiveIdx(Math.max(0, Math.min(visible.length - 1, idx)));
  };

  if (!visible.length) return null;

  return (
    <div className="mb-4">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex gap-3 overflow-x-auto pb-1"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
      >
        {visible.map((ad) => {
          const Wrapper = ad.linkUrl ? "a" : "div";
          const wrapperProps = ad.linkUrl
            ? { href: normalizeUrl(ad.linkUrl) || ad.linkUrl, target: "_blank", rel: "noopener noreferrer" }
            : {};
          return (
            <Wrapper
              key={ad.id}
              {...wrapperProps}
              className="relative block shrink-0 overflow-hidden rounded-2xl"
              style={{ scrollSnapAlign: "start", width: "100%" }}
            >
              <img src={promoImageSrc(ad.imageUrl)} alt={ad.title || "BTR"} loading="lazy" className="h-32 w-full object-cover sm:h-40" />
              {(ad.title || ad.subtitle) && (
                <div
                  className="absolute inset-0 flex flex-col justify-center gap-1 px-5"
                  style={{ background: "linear-gradient(90deg, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0.05) 70%)" }}
                >
                  {ad.title && <span className="text-base font-bold text-white drop-shadow-sm">{ad.title}</span>}
                  {ad.subtitle && <span className="text-xs text-white/85 drop-shadow-sm">{ad.subtitle}</span>}
                </div>
              )}
            </Wrapper>
          );
        })}
      </div>
      {visible.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {visible.map((ad, i) => (
            <span
              key={ad.id}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === activeIdx ? 16 : 6,
                background: i === activeIdx ? "#2563EB" : theme.cardBorder,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementsModal({ theme, lang, darkMode, announcements, expandedId, onToggle, onClose }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl"
        style={{ background: theme.cardBg }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone size={18} style={{ color: darkMode ? "#93C5FD" : "#2563EB" }} />
            <span className="text-lg font-extrabold" style={{ color: theme.textPrimary }}>
              {t(lang, "announcements")}
            </span>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5" style={{ color: theme.textMuted }}>
            <X size={18} />
          </button>
        </div>
        {announcements.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: theme.textMuted }}>{t(lang, "noAnnouncements")}</p>
        ) : (
          <div className="space-y-2">
            {announcements.map((a) => {
              const open = expandedId === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => onToggle(a.id)}
                  className="flex w-full items-start gap-3 rounded-2xl p-3 text-left"
                  style={{
                    background: darkMode ? "rgba(37,99,235,0.06)" : "#F5F8FF",
                    border: `1px solid ${theme.cardBorder}`,
                  }}
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: a.pinned ? "#F59E0B" : "#2563EB" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold" style={{ color: theme.textPrimary }}>{a.title}</span>
                    <span className={`mt-1 block text-sm leading-relaxed ${open ? "" : "hidden"}`} style={{ color: theme.textSecondary }}>
                      {a.body}
                    </span>
                    <span className="mt-1 block text-xs" style={{ color: theme.textMuted }}>
                      {timeAgo(a.createdAt)}{a.pinned ? " · Pinned" : ""}
                    </span>
                  </span>
                  <ChevronRight size={16} style={{ color: theme.textMuted }} className={`mt-0.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


function StudentShell({ student, data, setData, onLogout, onUpdateStudent }) {
  const [tab, setTab] = useState("home"); // home | exams | notes
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [subFlowStep, setSubFlowStep] = useState(null); // null | "plans" | "payment" | "success"
  const [selectedPlan, setSelectedPlan] = useState(null);
  const openSubscribeFlow = () => setSubFlowStep("plans");
  const closeSubscribeFlow = () => {
    setSubFlowStep(null);
    setSelectedPlan(null);
  };
  const [showSubscription, setShowSubscription] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [expandedAnnouncementId, setExpandedAnnouncementId] = useState(null);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [expandedInstall, setExpandedInstall] = useState(false);

  const [kickedOut, setKickedOut] = useState(false);
  const [htmlViewer, setHtmlViewer] = useState(null); // { url, htmlContent, htmlUrl, title } | null
  const [prefs, updatePrefs] = usePrefs(student.id);
  const lang = prefs.language || "en";
  const darkMode = prefs.theme === "dark";
  const theme = getTheme(darkMode);
  const homeLogoUrl = useLogoUrl(darkMode);
  const subscription = getSubscriptionStatus(student);

  // Multi-device detection: if this Student ID signs in on another device
  // while this one is active, warn and sign this device out.
  useEffect(() => {
    let mySid;
    try {
      mySid = memoryStorage.getItem("btr-student-session-id");
    } catch {
      mySid = null;
    }
    if (!mySid) return;
    const current = data?.studentSessions?.[student.studentId];
    if (current && current.sessionId && current.sessionId !== mySid) {
      setKickedOut(true);
    }
  }, [data?.studentSessions, student.studentId]);

  const openInApp = (source, title) =>
    setHtmlViewer(
      typeof source === "string" ? { url: source, title } : { htmlContent: source.htmlContent, htmlUrl: source.htmlUrl, title }
    );

  // Same as openInApp, but first records the open for Learning Analysis.
  // meta: { type: 'exam' | 'note' }
  const trackAndOpen = (source, title, meta) => {
    if (meta && setData) {
      const entry = {
        id: uid("act"),
        type: meta.type,
        title: title || (meta.type === "exam" ? "Exam" : "Note"),
        category: meta.category || null,
        at: new Date().toISOString(),
      };
      const list = [entry, ...(data.studentActivity?.[student.studentId] || [])].slice(0, 500);
      setData({
        ...data,
        studentActivity: { ...(data.studentActivity || {}), [student.studentId]: list },
      });
    }
    openInApp(source, title);
  };

  const myAnnouncements = [...data.announcements].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // Home stat tiles reflect materials across every department, not just the
  // student's own — matching what the Exams/Notes tabs show.
  const allExams = EXAM_CATEGORIES.flatMap((c) =>
    (data.examCategories[c] || []).map((e) => ({ ...e, category: c }))
  );
  const recentExams = [...allExams]
    .sort((a, b) => String(b.year).localeCompare(String(a.year)))
    .slice(0, 3);

  const totalNotes = Object.values(data.noteLinks || {}).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0
  );

  // Build notification feed: new exams + announcements since last seen
  const notifications = useMemo(() => {
    const examItems = prefs.notifyNewExam
      ? allExams.map((e) => ({
          id: `exam_${e.id}`,
          type: "exam",
          title: `${e.category}: ${e.title || e.year}`,
          createdAt: e.createdAt || e.year,
        }))
      : [];
    const annItems = prefs.notifyAnnouncement
      ? myAnnouncements.map((a) => ({ id: `ann_${a.id}`, type: "announcement", title: a.title, createdAt: a.createdAt }))
      : [];
    return [...examItems, ...annItems]
      .filter((n) => !(prefs.lastSeenAnnouncementIds || []).includes(n.id))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 12);
  }, [allExams, myAnnouncements, prefs.notifyNewExam, prefs.notifyAnnouncement, prefs.lastSeenAnnouncementIds]);

  const animatedExams = useCountUp(allExams.length);
  const animatedNotes = useCountUp(totalNotes);
  const animatedUpdates = useCountUp(myAnnouncements.length);

  // A light "weekly progress" signal: whether notes are available
  const weeklyProgress = totalNotes > 0 ? 100 : 0;

  const markAllRead = () => {
    const allIds = notifications.map((n) => n.id);
    updatePrefs({ lastSeenAnnouncementIds: [...(prefs.lastSeenAnnouncementIds || []), ...allIds] });
  };

  const streakInfo = useStreak(student.studentId);
  const myActivity = data.studentActivity?.[student.studentId] || [];
  const testsTaken = myActivity.filter((a) => a.type === "exam").length;
  const notesReviewed = myActivity.filter((a) => a.type === "note").length;
  const recentPractice = myActivity.filter((a) => a.type === "exam").slice(0, 5);
  const totalMaterials = allExams.length + totalNotes;
  const distinctOpened = new Set(myActivity.map((a) => a.title)).size;
  const overallPct = totalMaterials ? Math.min(100, Math.round((distinctOpened / totalMaterials) * 100)) : 0;

  if (subscription.isExpired) {
    return (
      <>
        <ExpiredGateScreen
          student={student}
          theme={theme}
          darkMode={darkMode}
          onLogout={onLogout}
          onViewSubscription={() => setShowSubscription(true)}
        />
        {showSubscription && (
          <SubscriptionScreen
            student={student}
            theme={theme}
            darkMode={darkMode}
            onClose={() => setShowSubscription(false)}
          />
        )}
      </>
    );
  }

  return (
    <div>
      <GlobalDarkStyles />
      <style>{`
        @keyframes fadeSlide { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.85) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .btr-fade-in { animation: fadeSlide 220ms ease-out; }
      `}</style>
      <div
        className={`min-h-screen w-full max-w-full overflow-x-hidden pb-24${darkMode ? " dark-mode" : ""}`}
        style={
          darkMode
            ? { backgroundColor: theme.pageBg }
            : {
                backgroundColor: "#0B1220",
                backgroundImage: `url(${tab === "exams" || tab === "notes" ? EXAM_NOTES_BG_URL : APP_BG_URL})`,
                backgroundSize: "cover",
                backgroundPosition: "top center",
                backgroundRepeat: "no-repeat",
              }
        }
      >

        {kickedOut && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(15,23,42,0.55)" }}
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <AlertCircle size={22} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Signed in on another device</h3>
              <p className="mt-2 text-sm text-slate-500">
                This Student ID was just signed in on {data.studentSessions?.[student.studentId]?.deviceLabel || "another device"}. You've been signed out here.
              </p>
              <button
                onClick={onLogout}
                className="mt-5 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                Return to sign in
              </button>
            </div>
          </div>
        )}
        {/* Top bar — hidden on the main tabs (they carry their own header) */}
        {tab !== "home" && tab !== "exams" && tab !== "notes" && (
        <header
          className={`sticky top-0 z-10 flex items-center justify-between border-b px-5 py-3.5${darkMode ? "" : " backdrop-blur-md"}`}
          style={{ borderColor: theme.cardBorder, background: theme.headerBg }}
        >
          <Brand darkMode={darkMode} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full transition"
              style={{ background: theme.chipBg, color: theme.chipText }}
            >
              <Search size={17} />
            </button>
            <button
              onClick={() => setShowNotifications(true)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full transition"
              style={{ background: theme.chipBg, color: theme.chipText }}
            >
              <Bell size={17} />
              {notifications.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {notifications.length > 9 ? "9+" : notifications.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full transition"
              style={{ background: theme.chipBg, color: theme.chipText }}
            >
              <SettingsIcon size={17} />
            </button>
            <button
              onClick={() => setShowProfile(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full overflow-hidden"
              style={{ background: theme.avatarBg, color: theme.avatarText }}
            >
              {student.photo ? (
                <img src={student.photo} alt={student.name} className="h-full w-full object-cover" />
              ) : (
                <User size={17} />
              )}
            </button>
          </div>
        </header>
        )}

        <main className="mx-auto w-full max-w-3xl min-w-0 px-5 py-5">
          {tab === "home" && (() => {
            const isPro = subscription.hasPlan && !subscription.isExpired;
            const supportUrl = data?.branding?.supportUrl || "";
            const telegramHref = normalizeUrl(supportUrl) || supportUrl || DEFAULT_SUPPORT_URL;
            return (
            <div className="btr-fade-in">
              {/* Header row — menu / notifications / profile */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowSettings(true)}
                  aria-label="Menu"
                  className="flex h-9 w-9 items-center justify-center rounded-full btr-glass-btn shadow-sm"
                  style={{ color: AUTH_BLUE }}
                >
                  <MenuIcon size={22} strokeWidth={2.4} />
                </button>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setShowNotifications(true)}
                    aria-label="Notifications"
                    className="relative flex h-9 w-9 items-center justify-center rounded-full btr-glass-btn shadow-sm"
                    style={{ color: AUTH_BLUE }}
                  >
                    <Bell size={20} />
                    {notifications.length > 0 && (
                      <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                    )}
                  </button>
                  <button
                    onClick={() => setShowProfile(true)}
                    aria-label="Profile"
                    className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full btr-glass-btn shadow-sm ring-2"
                    style={{ borderColor: AUTH_BLUE, color: AUTH_BLUE }}
                  >
                    {student.photo ? (
                      <img src={student.photo} alt={student.name} className="h-full w-full object-cover" />
                    ) : (
                      <User size={18} />
                    )}
                  </button>
                </div>
              </div>

              {/* Logo + welcome */}
              <div className="mt-2 flex flex-col items-center text-center">
                <img src={homeLogoUrl} alt="BTR ትምህርት" className="h-28 w-auto object-contain" />
                <h1 className="mt-1 text-xl font-bold" style={{ color: darkMode ? "#F8FAFC" : "#0F172A" }}>
                  {t(lang, "welcomeBack")}
                </h1>
                <p className="mt-0.5 max-w-xs text-sm font-bold leading-snug" style={{ color: AUTH_BLUE }}>
                  {isPro
                    ? "You have full access to the Pro learning experience."
                    : "You have free access to selected learning content."}
                </p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed" style={{ color: darkMode ? "#CBD5E1" : "#475569" }}>
                  {isPro
                    ? "Enjoy exclusive study materials, past final exams, mid exams, and premium learning content."
                    : "Browse free notes and past exams. Upgrade anytime to unlock premium learning content."}
                </p>
              </div>

              {/* Search */}
              <button
                onClick={() => setShowSearch(true)}
                className="mt-4 flex w-full items-center gap-3 rounded-full bg-white px-4 py-2.5 text-left text-sm text-slate-400 shadow-sm"
              >
                <Search size={18} style={{ color: AUTH_BLUE }} />
                <span>Search</span>
              </button>

              {/* Plan status */}
              {isPro ? (
                <button
                  onClick={() => setShowSubscription(true)}
                  className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "#E4ECFD" }}
                  >
                    <Calendar size={18} style={{ color: AUTH_BLUE }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-900">
                      {Math.max(subscription.daysLeft, 0)} days left on your plan
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      {student.planType && (
                        <span className="rounded-full bg-[#E4ECFD] px-2.5 py-0.5 text-[10px] font-bold" style={{ color: AUTH_BLUE }}>
                          {student.planType}
                        </span>
                      )}
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        Active
                      </span>
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-slate-400" />
                </button>
              ) : (
                <button
                  onClick={openSubscribeFlow}
                  className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "#E4ECFD" }}
                  >
                    <Crown size={18} style={{ color: AUTH_BLUE }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-900">Unlock more with Premium</span>
                    <span className="block text-xs text-slate-500">Upgrade anytime for unlimited access.</span>
                  </span>
                  <ChevronRight size={18} className="text-slate-400" />
                </button>
              )}

              {/* Ad banner carousel — managed by admin */}
              <div className="mt-3">
                <AdCarousel ads={data.ads} theme={theme} darkMode={darkMode} />
              </div>

              {/* Telegram channel */}
              <a
                href={telegramHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: "#2AABEE" }}>
                  <Send size={20} className="text-white" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">BTR Tmhrt</span>
                  <span className="block text-xs text-slate-500">Join our telegram channel for information</span>
                </span>
                <ChevronRight size={18} className="text-slate-400" />
              </a>
            </div>
            );
          })()}



          {tab === "exams" && (
            <section className="btr-fade-in">
              <PageHeader
                logoUrl={homeLogoUrl}
                title={t(lang, "exams")}
                subtitle="Browse final, mid and practice exams"
                placeholder="Search exams, years, subjects..."
                theme={theme}
                darkMode={darkMode}
                student={student}
                notifications={notifications}
                onSearch={() => setShowSearch(true)}
                onNotifications={() => setShowNotifications(true)}
                onProfile={() => setShowProfile(true)}
              />
              <StudentExamBrowser data={data} onOpenInApp={trackAndOpen} isSubscribed={subscription.hasPlan && !subscription.isExpired} onUnlock={openSubscribeFlow} />
            </section>
          )}

          {tab === "notes" && (
            <section className="btr-fade-in">
              <PageHeader
                logoUrl={homeLogoUrl}
                title={t(lang, "notes")}
                subtitle="Browse and study your notes"
                placeholder="Search notes, topics..."
                theme={theme}
                darkMode={darkMode}
                student={student}
                notifications={notifications}
                onSearch={() => setShowSearch(true)}
                onNotifications={() => setShowNotifications(true)}
                onProfile={() => setShowProfile(true)}
              />
              <StudentNoteBrowser data={data} onOpenInApp={trackAndOpen} isSubscribed={subscription.hasPlan && !subscription.isExpired} onUnlock={openSubscribeFlow} />
            </section>
          )}
        </main>

        {/* Bottom nav */}
        <nav
          className={`fixed inset-x-0 bottom-0 z-10 border-t${darkMode ? "" : " backdrop-blur-md"}`}
          style={{ borderColor: theme.cardBorder, background: theme.navBg }}
        >
          <div className="mx-auto grid max-w-3xl grid-cols-4">
            <button
              onClick={() => setTab("home")}
              className="flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors"
              style={{ color: tab === "home" ? "#2563EB" : theme.textMuted }}
            >
              <Home size={20} />
              {t(lang, "home")}
            </button>
            <button
              onClick={() => setTab("exams")}
              className="flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors"
              style={{ color: tab === "exams" ? "#2563EB" : theme.textMuted }}
            >
              <FileText size={20} />
              {t(lang, "exams")}
            </button>
            <button
              onClick={() => setTab("notes")}
              className="flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors"
              style={{ color: tab === "notes" ? "#2563EB" : theme.textMuted }}
            >
              <BookOpen size={20} />
              {t(lang, "notes")}
            </button>
            <button
              onClick={onLogout}
              className="flex flex-col items-center gap-1 py-3 text-xs font-semibold hover:text-rose-500 transition-colors"
              style={{ color: theme.textMuted }}
            >
              <LogOut size={20} />
              {t(lang, "logout")}
            </button>
          </div>
        </nav>
      </div>

      {showSearch && (
        <SearchOverlay
          theme={theme}
          lang={lang}
          data={data}
          onClose={() => setShowSearch(false)}
          onOpenExam={(item) => {
            setShowSearch(false);
            if (item?.isPro && !(subscription.hasPlan && !subscription.isExpired)) {
              openSubscribeFlow();
              return;
            }
            const meta = { type: "exam", category: item?.category };
            if (item?.htmlContent || item?.htmlUrl) {
              trackAndOpen({ htmlContent: item.htmlContent, htmlUrl: item.htmlUrl }, item.fileName || item.title || `${item.category} ${item.year}`, meta);
            } else if (item && normalizeUrl(item.link)) {
              trackAndOpen(toEmbeddableUrl(item.link), item.title || `${item.category} ${item.year}`, meta);
            } else {
              setTab("exams");
            }
          }}
          onOpenNote={(item) => {
            setShowSearch(false);
            if (item?.isPro && !(subscription.hasPlan && !subscription.isExpired)) {
              openSubscribeFlow();
              return;
            }
            const meta = { type: "note" };
            if (item?.htmlContent || item?.htmlUrl) {
              trackAndOpen({ htmlContent: item.htmlContent, htmlUrl: item.htmlUrl }, item.fileName || item.title, meta);
            } else if (item && normalizeUrl(item.link)) {
              trackAndOpen(toEmbeddableUrl(item.link), item.title, meta);
            } else {
              setTab("notes");
            }
          }}
          onOpenAnnouncement={() => {
            setShowSearch(false);
            setTab("home");
          }}
          onOpenSubject={() => {
            setShowSearch(false);
            setTab("notes");
          }}
        />
      )}

      {subFlowStep === "plans" && (
        <SubscriptionPlansScreen
          data={data}
          onClose={closeSubscribeFlow}
          onSelectPlan={(plan) => {
            setSelectedPlan(plan);
            setSubFlowStep("payment");
          }}
        />
      )}

      {subFlowStep === "payment" && selectedPlan && (
        <TelebirrPaymentScreen
          student={student}
          plan={selectedPlan}
          onBack={() => setSubFlowStep("plans")}
          onSubmit={(form) => {
            const request = {
              id: uid("subreq"),
              studentDbId: student.id,
              studentId: form.btrId,
              studentName: form.btrName,
              planId: selectedPlan.id,
              planLabel: selectedPlan.label,
              months: selectedPlan.months,
              price: selectedPlan.price,
              screenshotDataUrl: form.screenshotDataUrl,
              screenshotFileName: form.screenshotFileName,
              status: "pending",
              createdAt: new Date().toISOString(),
            };
            setData((prev) =>
              withActivity(
                { ...prev, subscriptionRequests: [request, ...(prev.subscriptionRequests || [])] },
                "Subscription request submitted",
                `${request.studentName} (${request.studentId}) — ${request.planLabel}`,
                request.studentName
              )
            );
            setSubFlowStep("success");
          }}
        />
      )}

      {subFlowStep === "success" && <SubscriptionRequestSuccessScreen onClose={closeSubscribeFlow} />}

      {htmlViewer && (
        <HtmlViewerModal
          url={htmlViewer.url}
          htmlContent={htmlViewer.htmlContent}
          htmlUrl={htmlViewer.htmlUrl}
          title={htmlViewer.title}
          theme={theme}
          brandName={data?.branding?.brandName}
          isDark={darkMode}
          onToggleDark={() => updatePrefs({ theme: darkMode ? "light" : "dark" })}
          onClose={() => setHtmlViewer(null)}
        />
      )}



      {showSubscription && (
        <SubscriptionScreen
          student={student}
          theme={theme}
          darkMode={darkMode}
          onClose={() => setShowSubscription(false)}
        />
      )}

      {showAnalysis && (
        <LearningAnalysisScreen
          student={student}
          data={data}
          theme={theme}
          darkMode={darkMode}
          onClose={() => setShowAnalysis(false)}
        />
      )}

      {showProfile && (
        <ProfileModal
          student={student}
          lang={lang}
          theme={theme}
          onClose={() => setShowProfile(false)}
          onSave={(updated) => {
            onUpdateStudent(updated);
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          lang={lang}
          prefs={prefs}
          theme={theme}
          onUpdatePrefs={updatePrefs}
          onClose={() => setShowSettings(false)}
          onOpenProfile={() => {
            setShowSettings(false);
            setShowProfile(true);
          }}
          onOpenAnalysis={() => {
            setShowSettings(false);
            setShowAnalysis(true);
          }}
          onOpenSubscription={() => {
            setShowSettings(false);
            setShowSubscription(true);
          }}
        />
      )}

      {showNotifications && (
        <NotificationsPanel
          lang={lang}
          theme={theme}
          items={notifications}
          onClose={() => setShowNotifications(false)}
          onMarkAllRead={() => {
            markAllRead();
            setShowNotifications(false);
          }}
        />
      )}

      {showInstallHelp && (
        <InstallHelpModal
          theme={theme}
          onClose={() => setShowInstallHelp(false)}
        />
      )}

      {showAllAnnouncements && (
        <AnnouncementsModal
          theme={theme}
          lang={lang}
          darkMode={darkMode}
          announcements={myAnnouncements}
          expandedId={expandedAnnouncementId}
          onToggle={(id) => setExpandedAnnouncementId(expandedAnnouncementId === id ? null : id)}
          onClose={() => setShowAllAnnouncements(false)}
        />
      )}



          </div>
  );
}

/* ----------------------------- Root app ----------------------------- */

/* ---------------------------------------------------------------------
   Top-level error boundary.

   Previously, a single uncaught render error anywhere in the tree (in
   either theme) tore down the whole app to a blank white screen with no
   way back in — which is what "the app crashes" usually looks like from
   the outside. Dark mode touches far more of the codebase than light
   mode (every screen's `darkMode ? a : b` branch, plus the CSS override
   pass in GlobalDarkStyles), so it's the more likely place to hit an
   edge case that light mode never exercises.

   This doesn't fix any specific bug — it stops one bad render from
   nuking the session, offers a reload, and (since most of these will be
   theme-shaped bugs) an explicit "switch to light mode" escape hatch so
   the person isn't stuck.
--------------------------------------------------------------------- */
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // Keep a breadcrumb in the console so this is debuggable later;
    // never let logging itself throw.
    try { console.error("BTR app crashed:", error, info); } catch {}
  }
  handleReload = () => {
    try { window.location.reload(); } catch {}
  };
  handleForceLight = () => {
    // Best-effort: clear every prefs key so no student profile can be
    // stuck reopening straight into whatever broke, then reload.
    try {
      const keysToClear = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith("btr-prefs-")) keysToClear.push(k);
      }
      keysToClear.forEach((k) => window.localStorage.removeItem(k));
      window.localStorage.removeItem("btr-admin-theme");
    } catch {}
    this.handleReload();
  };
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white px-6">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-500">
              <AlertCircle size={26} />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-500">
              The app hit an unexpected error and couldn't continue. Reloading usually fixes it.
            </p>
            <button
              onClick={this.handleReload}
              className="mt-5 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              Reload
            </button>
            <button
              onClick={this.handleForceLight}
              className="mt-2 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Reload in light mode
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  const { data, setData, loading, error } = useStore();
  const [session, setSession] = useState(null); // { role: 'admin' } | { role: 'student', student }
  const restoredRef = useRef(false);

  // "Stay logged in": once data has loaded, check for a persisted session
  // pointer from a previous visit and restore it if it still checks out.
  useEffect(() => {
    if (restoredRef.current || !data) return;
    restoredRef.current = true;
    const persisted = readPersistedSession();
    if (!persisted) return;
    if (persisted.role === "admin") {
      if (data.adminAccount) setSession({ role: "admin" });
      else writePersistedSession(null);
    } else if (persisted.role === "student" && persisted.studentId) {
      const student = (data.students || []).find((s) => s.studentId === persisted.studentId);
      if (student) setSession({ role: "student", student });
      else writePersistedSession(null);
    }
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <img
          src={DEFAULT_LOGO_URL}
          alt="BTR Learning"
          className="h-20 w-20 animate-pulse rounded-2xl"
        />
        <span className="text-sm text-slate-400">Loading…</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <p className="text-sm text-rose-500">{error}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <LoginScreen
        data={data}
        setData={setData}
        onAdminLogin={() => {
          let sid;
          try {
            sid = memoryStorage.getItem("btr-admin-session-id");
            if (!sid) {
              sid = uid("sess");
              memoryStorage.setItem("btr-admin-session-id", sid);
            }
          } catch {
            sid = uid("sess");
          }
          setData((prev) => ({
            ...prev,
            adminSession: { sessionId: sid, deviceLabel: getDeviceLabel(), loggedInAt: new Date().toISOString() },
          }));
          writePersistedSession({ role: "admin" });
          setSession({ role: "admin" });
        }}
        onAdminSetup={(account) => {
          let sid;
          try {
            sid = uid("sess");
            memoryStorage.setItem("btr-admin-session-id", sid);
          } catch {
            sid = uid("sess");
          }
          setData((prev) => ({
            ...prev,
            adminAccount: account,
            adminSession: { sessionId: sid, deviceLabel: getDeviceLabel(), loggedInAt: new Date().toISOString() },
          }));
          writePersistedSession({ role: "admin" });
          setSession({ role: "admin" });
        }}
        onStudentLogin={(student, deviceSessionId) => {
          setData((prev) => ({
            ...prev,
            studentSessions: {
              ...(prev.studentSessions || {}),
              [student.studentId]: {
                sessionId: deviceSessionId,
                deviceLabel: getDeviceLabel(),
                loggedInAt: new Date().toISOString(),
              },
            },
          }));
          writePersistedSession({ role: "student", studentId: student.studentId });
          setSession({ role: "student", student });
        }}
      />
    );
  }

  if (session.role === "admin") {
    return (
      <AdminShell
        data={data}
        setData={setData}
        onLogout={() => {
          try {
            const mySid = memoryStorage.getItem("btr-admin-session-id");
            setData((prev) =>
              prev.adminSession && prev.adminSession.sessionId === mySid
                ? { ...prev, adminSession: null }
                : prev
            );
          } catch {}
          writePersistedSession(null);
          setSession(null);
        }}
      />
    );
  }

  return (
    <StudentShell
      student={session.student}
      data={data}
      setData={setData}
      onLogout={() => {
        try {
          const mySid = memoryStorage.getItem("btr-student-session-id");
          setData((prev) => {
            const current = prev.studentSessions?.[session.student.studentId];
            if (current && current.sessionId === mySid) {
              return {
                ...prev,
                studentSessions: { ...prev.studentSessions, [session.student.studentId]: null },
              };
            }
            return prev;
          });
        } catch {}
        writePersistedSession(null);
        setSession(null);
      }}

      onUpdateStudent={(updatedStudent) => {
        setData((prev) => ({
          ...prev,
          students: (prev.students || []).map((s) =>
            s.id === updatedStudent.id ? updatedStudent : s
          ),
        }));
        setSession({ role: "student", student: updatedStudent });
      }}

    />
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppInner />
    </AppErrorBoundary>
  );
}

/* Relative time for announcement cards ("2 hours ago"). */
function timeAgo(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString();
}
