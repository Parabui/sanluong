/** Mở app: thiết bị còn phiên trạm → Nhập, chưa có → Chọn trạm (GET /api/cn/khoi-dong, không tạo cookie [D21]) */
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router';
import { KHOA_KHOI_DONG, layKhoiDong } from '../lib/api';

export function KhoiDongPage() {
  const kdQ = useQuery({ queryKey: KHOA_KHOI_DONG, queryFn: layKhoiDong });
  if (kdQ.isPending) return <div className="flex-1 grid place-items-center text-muted" role="status"><span className="spin w-6 h-6 rounded-full border-2 border-current border-t-transparent" /></div>;
  if (kdQ.isError) return <p className="m-4 rounded-card bg-danger-bg text-danger p-4 text-[15px]" role="alert">{kdQ.error.message}</p>;
  return <Navigate to={kdQ.data.phien.length ? '/nhap' : '/chon-tram'} replace />;
}
