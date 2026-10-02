"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/nav";

export type ShellCtx = {
  role: Role;
  setRole: (r: Role) => void;
  q: string;
  setQ: (q: string) => void;
  online: boolean;
};

export const ShellContext = createContext<ShellCtx>({
  role: "SA", setRole: () => {}, q: "", setQ: () => {}, online: true,
});

export const useShell = () => useContext(ShellContext);
