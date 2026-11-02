"use client";

let permissionRequested = false;

export function ensureNotificationPermission(): void {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (permissionRequested) return;
  permissionRequested = true;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

export function notify(
  title: string,
  body: string,
  onClick?: () => void
): void {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;

  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: title,
    });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    // Some browsers block programmatic Notification()
  }
}