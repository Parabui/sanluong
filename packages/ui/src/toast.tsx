/** Thông báo nhanh góc dưới phải — chép từ ui-demo/src/components/ui/toast.tsx */
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

type Kind = 'ok' | 'info' | 'warn';
type Toast = { id: number; msg: string; kind: Kind };
const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => {});

export const useToast = () => useContext(Ctx);

let seq = 0;
const ICON = { ok: CircleCheck, info: Info, warn: TriangleAlert };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind: Kind = 'ok') => {
    const id = ++seq;
    setList((l) => [...l.slice(-3), { id, msg, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), kind === 'warn' ? 5000 : 3000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[80] flex flex-col gap-2 items-end pointer-events-none" aria-live="polite">
        {list.map((t) => {
          const I = ICON[t.kind];
          return (
            <div key={t.id} className="toast-in min-h-10 py-2 px-4 rounded-card bg-toast text-ondark text-chip font-medium flex items-center gap-2 shadow-pop max-w-sm">
              <I className={`w-4 h-4 ${t.kind === 'warn' ? 'text-warn-bg' : 'text-closed-bg'}`} />
              {t.msg}
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
