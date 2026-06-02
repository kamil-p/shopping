"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { DownloadIcon, PlusSquareIcon, Share2Icon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Not yet in the standard DOM lib types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// useSyncExternalStore-based hook for detecting standalone (installed) mode.
// Returns null on the server / before hydration (snapshot = null → hide button).
function useIsStandalone(): boolean | null {
  const query = useSyncExternalStore(
    // subscribe: call onChange whenever display-mode changes
    (onChange) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia("(display-mode: standalone)");
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    // client snapshot
    () => {
      const nav = window.navigator as Navigator & { standalone?: boolean };
      return (
        window.matchMedia("(display-mode: standalone)").matches ||
        nav.standalone === true
      );
    },
    // server snapshot — null signals "not yet known"
    () => null,
  );
  return query;
}

// Detect iOS via useSyncExternalStore so it is hydration-safe.
// userAgent never changes, so subscribe is a no-op.
function useIsIOS(): boolean {
  return useSyncExternalStore(
    // subscribe: userAgent never changes — no-op unsubscribe
    () => () => {},
    // client snapshot
    () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()),
    // server snapshot
    () => false,
  );
}

export function InstallButton() {
  const standalone = useIsStandalone();
  const isIOS = useIsIOS();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [manuallyInstalled, setManuallyInstalled] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault(); // stop Chrome's mini-infobar; we trigger it ourselves
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setManuallyInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // null = server/hydration (hide); true = already installed (hide).
  if (standalone === null || standalone === true || manuallyInstalled) return null;

  async function handleClick() {
    if (promptEvent) {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") setManuallyInstalled(true);
      setPromptEvent(null);
      return;
    }
    setDialogOpen(true);
  }

  return (
    <>
      <button
        className="zk-icon-btn"
        onClick={handleClick}
        aria-label="Zainstaluj aplikację"
        type="button"
      >
        <DownloadIcon className="size-[22px]" />
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zainstaluj aplikację</DialogTitle>
            <DialogDescription>
              {isIOS
                ? "Dodaj „Zakupy” do ekranu początkowego, aby otwierać aplikację bez paska adresu."
                : "Zainstaluj „Zakupy”, aby otwierać aplikację jak zwykłą apkę na telefonie."}
            </DialogDescription>
          </DialogHeader>

          {isIOS ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>
                Stuknij{" "}
                <Share2Icon className="inline size-4 align-text-bottom" aria-hidden />{" "}
                (Udostępnij) na dole ekranu.
              </li>
              <li>
                Wybierz{" "}
                <PlusSquareIcon className="inline size-4 align-text-bottom" aria-hidden />{" "}
                &bdquo;Do ekranu początkowego&rdquo;.
              </li>
              <li>Potwierdź przyciskiem &bdquo;Dodaj&rdquo;.</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Otwórz menu przeglądarki (⋮).</li>
              <li>Wybierz &bdquo;Zainstaluj aplikację&rdquo; lub &bdquo;Dodaj do ekranu głównego&rdquo;.</li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
