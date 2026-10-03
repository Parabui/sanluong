import { useQuery } from '@tanstack/react-query';
import { zHealth } from '@vsn/shared';
import { api } from '../lib/api';
import type { ManHinh } from '../man-hinh';
import { BottomNav, TopBar } from '../ui/mobile';

/**
 * Trang TẠM cho màn hình chưa implement. Không phải layout thật —
 * giao diện thật chuyển từ ui-demo (đường dẫn ở `manHinh.demo`) khi làm User Story.
 */
export function TrangTam({ manHinh }: { manHinh: ManHinh }) {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => api.goi('/health', { schema: zHealth, signal }),
  });

  const coNav = ['cua-toi', 'cua-toi/:ngay', 'gio-lam'].includes(manHinh.duongDan);
  return (
    <>
      <TopBar title={manHinh.tieuDe} back={coNav ? undefined : '/'} />
      <main className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-2 text-[length:var(--fs-base)]">
        <p className="text-muted">
          {manHinh.tinhNang} · chưa implement — giao diện gốc: <code className="font-mono text-sub">{manHinh.demo}</code>
        </p>
        <p className="text-sub">
          API:{' '}
          {health.isPending ? 'đang kiểm tra…' : health.isSuccess ? (
            <span className="text-success">đã kết nối</span>
          ) : (
            <span className="text-danger">chưa kết nối</span>
          )}
        </p>
      </main>
      {coNav && <BottomNav />}
    </>
  );
}
