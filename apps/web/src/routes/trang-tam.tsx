import type { ManHinh } from '../man-hinh';

/**
 * Trang TẠM cho màn hình chưa implement. Không phải layout thật —
 * giao diện thật chuyển từ ui-demo (đường dẫn ở `manHinh.demo`) khi làm User Story.
 */
export function TrangTam({ manHinh }: { manHinh: ManHinh }) {
  return (
    <main className="p-5 flex flex-col gap-2">
      <h1 className="text-title font-semibold">{manHinh.tieuDe}</h1>
      <p className="text-muted">
        {manHinh.tinhNang} · chưa implement — giao diện gốc: <code className="font-mono">{manHinh.demo}</code>
      </p>
    </main>
  );
}
