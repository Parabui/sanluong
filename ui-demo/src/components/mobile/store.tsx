"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/* Trạng thái demo của App công nhân — dùng chung giữa các màn trong khung điện thoại */
export const ME = { nv: "NV00127", name: "Phạm Thị Mai", line: "C05" };
export const LEADER = "Nguyễn Văn Bình";
export type Scenario = "normal" | "offline" | "adjusted" | "noops";
export const SCENARIOS: [Scenario, string, string][] = [
  ["normal", "Bình thường", "Hôm nay đã lưu 101 / 101 lúc 09:03"],
  ["offline", "Mất mạng khi bấm Lưu", "Giữ số trên form + Thử lại (MVP)"],
  ["adjusted", "Tổ trưởng đã điều chỉnh 1 ô", "Ô chỉ đọc + lý do (R6)"],
  ["noops", "Trạm chưa có công đoạn", "Liên hệ tổ trưởng"],
];
export type Rec = { v: number; at: string; adj?: { old: number; reason: string; by: string; at: string } };

type Store = {
  scenario: Scenario; setScenario: (s: Scenario) => void;
  online: boolean; setOnline: (v: boolean) => void;
  date: string; setDate: (d: string) => void;
  sessions: Record<string, number[]>; addSession: (t: number) => void;
  active: Record<string, number>; setActive: (d: string, t: number) => void;
  rec: Record<string, Rec>; saveRec: (k: string, v: number, at: string) => void;
  toast: (msg: string, kind?: "ok" | "err") => void;
  toasts: { id: number; msg: string; kind: "ok" | "err" }[];
  loggedIn: boolean; setLoggedIn: (v: boolean) => void;
};

const INIT_REC: Record<string, Rec> = {
  "2026-09-29|27|CD-06": { v: 101, at: "09:03" }, "2026-09-29|27|CD-07": { v: 101, at: "09:04" },
  "2026-09-28|27|CD-06": { v: 388, at: "16:16 28/09" }, "2026-09-28|27|CD-07": { v: 390, at: "16:18 28/09" },
};

const Ctx = createContext<Store | null>(null);
export const useWorker = () => useContext(Ctx)!;
let seq = 0;

export function WorkerProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenarioState] = useState<Scenario>("normal");
  const [online, setOnline] = useState(true);
  const [date, setDate] = useState("2026-09-29");
  const [sessions, setSessions] = useState<Record<string, number[]>>({ "2026-09-29": [27], "2026-09-28": [27] });
  const [active, setActiveState] = useState<Record<string, number>>({ "2026-09-29": 27, "2026-09-28": 27 });
  const [rec, setRec] = useState<Record<string, Rec>>(INIT_REC);
  const [toasts, setToasts] = useState<Store["toasts"]>([]);
  const [loggedIn, setLoggedIn] = useState(true);

  const toast = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = ++seq;
    setToasts((l) => [...l.slice(-1), { id, msg, kind }]);
    setTimeout(() => setToasts((l) => l.filter((t) => t.id !== id)), 2600);
  }, []);

  const setScenario = (s: Scenario) => {
    setScenarioState(s);
    setOnline(s !== "offline");
    setRec(s === "adjusted"
      ? { ...INIT_REC, "2026-09-29|27|CD-07": { v: 110, at: "09:10", adj: { old: 101, reason: "Công nhân báo lại", by: LEADER, at: "09:10 29/09" } } }
      : INIT_REC);
    setDate("2026-09-29");
  };

  return (
    <Ctx.Provider value={{
      scenario, setScenario, online, setOnline, date, setDate, sessions,
      addSession: (t) => { setSessions((s) => ({ ...s, "2026-09-29": [...new Set([...(s["2026-09-29"] || []), t])] })); setActiveState((a) => ({ ...a, "2026-09-29": t })); setDate("2026-09-29"); },
      active, setActive: (d, t) => setActiveState((a) => ({ ...a, [d]: t })),
      rec, saveRec: (k, v, at) => setRec((r) => ({ ...r, [k]: { v, at } })),
      toast, toasts, loggedIn, setLoggedIn,
    }}>
      {children}
    </Ctx.Provider>
  );
}
