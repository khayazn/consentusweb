import { useRouter } from "next/navigation";
import type { User } from "@/services/api";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: User) {
  if (typeof window === "undefined") return;
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function logout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

/**
 * Client-side auth gate. Call inside a `useEffect` in a `"use client"` page.
 * Redirects to "/" (login) if no token is present.
 * Returns the current user (or null) so the caller can render.
 */
export function useRequireAuth() {
  const router = useRouter();

  if (typeof window === "undefined") return { user: null, ready: false };

  const token = getToken();
  const user = getCurrentUser();

  if (!token || !user) {
    // Schedule the redirect on the next tick to avoid "router during render"
    setTimeout(() => router.replace("/"), 0);
    return { user: null, ready: false };
  }

  return { user, ready: true };
}