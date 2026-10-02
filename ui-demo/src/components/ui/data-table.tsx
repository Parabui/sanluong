"use client";

import { SearchX, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Col<T> = {
  key: string;
  label: ReactNode;
  width?: number | string;
  align?: "left" | "right" | "center";
  render: (row: T, i: number) => ReactNode;
  className?: string;
};

/** Bảng dữ liệu chuẩn: header dính, dòng 44px, hover nhạt — cùng style Bảng sản lượng ngày */
export function DataTable<T>({
  cols, rows, rowKey, rowClass, onRowClick, empty, emptyIcon = SearchX, footer, className,
}: {
  cols: Col<T>[];
  rows: T[];
  rowKey: (r: T, i: number) => string;
  rowClass?: (r: T) => string | undefined;
  onRowClick?: (r: T) => void;
  empty?: string;
  emptyIcon?: LucideIcon;
  footer?: ReactNode;
  className?: string;
}) {
  const EI = emptyIcon;
  return (
    <section className={cn("bg-surface border border-line rounded-card overflow-hidden flex-1 min-h-0 flex flex-col", className)}>
      <div className="flex-1 min-h-0 overflow-auto scroll-area">
        <table className="grid-table hoverable text-body">
          <colgroup>{cols.map((c) => <col key={c.key} style={{ width: c.width }} />)}</colgroup>
          <thead>
            <tr className="text-th font-semibold uppercase tracking-[0.02em] text-muted">
              {cols.map((c) => (
                <th key={c.key} scope="col" className={cn("px-3", c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left")}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={cols.length} className="!h-auto !border-0">
                <div className="py-16 flex flex-col items-center gap-3 text-center"><EI className="w-10 h-10 text-muted" /><p className="text-body text-ink font-medium">{empty ?? "Không có dữ liệu"}</p></div>
              </td></tr>
            ) : rows.map((r, i) => (
              <tr key={rowKey(r, i)} className={cn(rowClass?.(r), onRowClick && "cursor-pointer")} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {cols.map((c) => (
                  <td key={c.key} className={cn("px-3 py-1", c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "", c.className)}>{c.render(r, i)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </section>
  );
}

export function TableFooter({ children }: { children: ReactNode }) {
  return <div className="h-10 shrink-0 border-t border-line px-4 flex items-center gap-3 text-sub text-muted bg-thead">{children}</div>;
}
