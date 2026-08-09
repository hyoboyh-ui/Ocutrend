"use client";

import { useEffect, useState } from "react";
import { Bell, Share, X } from "lucide-react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function PushOptIn() {
  const [dismissed, setDismissed] = useState(true);
  const [needsIosInstall, setNeedsIosInstall] = useState(false);

  useEffect(() => {
    // One-time feature/environment detection at mount — there is no external
    // subscription to model here, just an initial read of browser state.
    const wasDismissed = localStorage.getItem("ocutrend_push_dismissed") === "1";
    if (wasDismissed) return;

    if (isIos() && !isStandalone()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNeedsIosInstall(true);
      setDismissed(false);
      return;
    }

    if ("serviceWorker" in navigator && "PushManager" in window && Notification.permission !== "granted") {
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    localStorage.setItem("ocutrend_push_dismissed", "1");
    setDismissed(true);
  }

  async function enablePush() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    dismiss();
  }

  if (dismissed) return null;

  return (
    <div className="card-enter flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/10 p-4">
      {needsIosInstall ? (
        <>
          <Share size={18} className="mt-0.5 shrink-0 text-accent" />
          <p className="flex-1 text-sm">
            通知を受け取るには、共有ボタン(<Share size={12} className="inline" />)から「ホーム画面に追加」してください。
          </p>
        </>
      ) : (
        <>
          <Bell size={18} className="mt-0.5 shrink-0 text-accent" />
          <div className="flex-1 text-sm">
            <p className="mb-2">週次レポート完成時にプッシュ通知を受け取りますか?</p>
            <button
              type="button"
              onClick={enablePush}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-bg-page"
            >
              通知を有効にする
            </button>
          </div>
        </>
      )}
      <button type="button" onClick={dismiss} aria-label="閉じる" className="text-text-muted hover:text-text-primary">
        <X size={16} />
      </button>
    </div>
  );
}
