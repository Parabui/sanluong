"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Media query → boolean (server: `server`) */
export function useMediaQuery(query: string, server = false) {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(query).matches,
    () => server,
  );
}

/* Giá trị nhớ trong trình duyệt (localStorage) — có bộ nhớ tạm khi trình duyệt chặn storage */
const listeners = new Set<() => void>();
const memory = new Map<string, string | null>();
const read = (key: string, fallback: string | null) => {
  if (memory.has(key)) return memory.get(key) ?? fallback;
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};

export function useStored(key: string, fallback: string | null = null): [string | null, (v: string | null) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      addEventListener("storage", cb);
      return () => { listeners.delete(cb); removeEventListener("storage", cb); };
    },
    () => read(key, fallback),
    () => fallback,
  );
  const set = useCallback((v: string | null) => {
    memory.set(key, v);
    try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, v); } catch {}
    listeners.forEach((l) => l());
  }, [key]);
  return [value, set];
}
