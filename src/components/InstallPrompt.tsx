import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import btrLogoAsset from "@/assets/btr-logo.png.asset.json";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => setVisible(false);
    window.addEventListener("appinstalled", onInstalled);

    // Show a banner on every visit, even where the native prompt event
    // never fires (iOS, Firefox) — there we explain the manual steps.
    const timer = window.setTimeout(() => {
      setVisible(true);
      if (isIos) setIosHint(true);
    }, 1200);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setVisible(false);
      setDeferred(null);
      return;
    }
    setIosHint(true);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9999] flex justify-center p-3 sm:p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
        <div className="flex items-center gap-3">
          <img src={btrLogoAsset.url} alt="BTR Learning" className="h-11 w-11 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">Install BTR Learning</p>
            <p className="truncate text-xs text-slate-500">
              Add the app to your home screen for quick access.
            </p>
          </div>
          <button
            onClick={install}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0b3fac] px-3 py-2 text-xs font-semibold text-white"
          >
            <Download className="h-4 w-4" />
            Install
          </button>
          <button
            aria-label="Dismiss"
            onClick={() => setVisible(false)}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {iosHint && !deferred && (
          <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
            <Share className="h-3.5 w-3.5 shrink-0" />
            Tap the browser Share button, then choose “Add to Home Screen”.
          </p>
        )}
      </div>
    </div>
  );
}
