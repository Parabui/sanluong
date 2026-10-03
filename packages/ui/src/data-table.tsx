/**
 * Bảng dữ liệu chuẩn — dựng trên TanStack Table [TDD 14.1], giữ style ui-demo/components/ui/data-table.tsx
 * (header dính, dòng 44px, hover nhạt). API cột giữ như demo (`Col`) để chép màn hình demo sang dễ.
 * Import qua '@vsn/ui/data-table' (KHÔNG có trong '@vsn/ui') — apps/worker không được nạp TanStack Table [CLAUDE.md #10].
 */
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { SearchX, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn.js';

export interface Col<T> {
  key: string;
  label: ReactNode;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  render: (row: T, i: number) => ReactNode;
  className?: string;
}

const canh = (a?: Col<unknown>['align']) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

export function DataTable<T>({
  cols, rows, rowKey, rowClass, onRowClick, empty, emptyIcon = SearchX, footer, className, dangTai,
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
  /** Đang tải lần đầu: hiện dòng chờ thay cho "Không có dữ liệu" */
  dangTai?: boolean;
}) {
  const columns: ColumnDef<T>[] = cols.map((c) => ({
    id: c.key,
    header: () => c.label,
    cell: (ctx) => c.render(ctx.row.original, ctx.row.index),
  }));
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table v8 trả về hàm không memo được; bảng nhỏ, render lại không đáng kể
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel(), getRowId: (r, i) => rowKey(r, i) });
  const EI = emptyIcon;
  return (
    <section className={cn('bg-surface border border-line rounded-card overflow-hidden flex-1 min-h-0 flex flex-col', className)}>
      <div className="flex-1 min-h-0 overflow-auto scroll-area">
        <table className="grid-table hoverable text-body">
          <colgroup>{cols.map((c) => <col key={c.key} style={{ width: c.width }} />)}</colgroup>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="text-th font-semibold uppercase tracking-[0.02em] text-muted">
                {hg.headers.map((h, i) => (
                  <th key={h.id} scope="col" className={cn('px-3', canh(cols[i]?.align))}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={cols.length} className="!h-auto !border-0">
                {dangTai ? (
                  <div className="py-16 grid place-items-center text-muted" role="status"><span className="spin w-6 h-6 rounded-full border-2 border-current border-t-transparent" /></div>
                ) : (
                  <div className="py-16 flex flex-col items-center gap-3 text-center"><EI className="w-10 h-10 text-muted" /><p className="text-body text-ink font-medium">{empty ?? 'Không có dữ liệu'}</p></div>
                )}
              </td></tr>
            ) : table.getRowModel().rows.map((r) => (
              <tr key={r.id} className={cn(rowClass?.(r.original), onRowClick && 'cursor-pointer')} onClick={onRowClick ? () => onRowClick(r.original) : undefined}>
                {r.getVisibleCells().map((cell, i) => (
                  <td key={cell.id} className={cn('px-3 py-1', canh(cols[i]?.align), cols[i]?.className)}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
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
