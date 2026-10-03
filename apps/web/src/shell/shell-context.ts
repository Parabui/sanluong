import { createContext, useContext } from 'react';

export interface ShellCtx {
  /** Nội dung ô tìm kiếm trên header (mỗi màn tự lọc theo) */
  q: string;
  setQ: (q: string) => void;
  online: boolean;
}

export const ShellContext = createContext<ShellCtx>({ q: '', setQ: () => {}, online: true });

export const useShell = () => useContext(ShellContext);
