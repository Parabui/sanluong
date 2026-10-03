/**
 * Phiên đăng nhập phía Web: tài khoản hiện tại lấy từ GET /api/auth/toi (cookie vsn_sid httpOnly — JS không đọc được).
 * Hết phiên → về /dang-nhap?quayLai=<trang cũ> [TDD 9.2] · bắt buộc đổi mật khẩu → /doi-mat-khau [F8].
 */
import { useQuery } from '@tanstack/react-query';
import { type ChucNang, LoiApi, type TaiKhoanToi } from '@vsn/shared';
import { Button, EmptyState } from '@vsn/ui';
import { WifiOff } from 'lucide-react';
import { createContext, useContext } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { KHOA_TOI, layTaiKhoanToi } from './api';

const TaiKhoanCtx = createContext<TaiKhoanToi | null>(null);

/** Tài khoản đang đăng nhập — chỉ dùng bên trong <YeuCauDangNhap> */
export function useToi(): TaiKhoanToi {
  const tk = useContext(TaiKhoanCtx);
  if (!tk) throw new Error('useToi() phải nằm trong <YeuCauDangNhap>');
  return tk;
}

export const coChucNang = (tk: TaiKhoanToi, ...cn: ChucNang[]) => cn.some((c) => tk.chucNang.includes(c));

export const duongDanDangNhap = (quayLai: string) =>
  quayLai && quayLai !== '/' ? `/dang-nhap?quayLai=${encodeURIComponent(quayLai)}` : '/dang-nhap';

export function YeuCauDangNhap({ choPhepDoiMatKhau = false }: { choPhepDoiMatKhau?: boolean }) {
  const location = useLocation();
  const q = useQuery({ queryKey: KHOA_TOI, queryFn: layTaiKhoanToi, retry: false, staleTime: 60_000 });

  if (q.isPending) {
    return (
      <div className="min-h-screen grid place-items-center text-muted text-chip" role="status">
        <span className="spin w-6 h-6 rounded-full border-2 border-current border-t-transparent" />
      </div>
    );
  }
  if (q.isError) {
    if (q.error instanceof LoiApi && q.error.status === 401) {
      return <Navigate to={duongDanDangNhap(location.pathname + location.search)} replace />;
    }
    return (
      <div className="min-h-screen grid place-items-center">
        <EmptyState
          icon={WifiOff}
          title="Hệ thống tạm gián đoạn"
          sub={q.error.message}
          action={<Button variant="primary" onClick={() => void q.refetch()}>Thử lại</Button>}
        />
      </div>
    );
  }
  if (q.data.phaiDoiMatKhau && !choPhepDoiMatKhau) return <Navigate to="/doi-mat-khau" replace />;

  return (
    <TaiKhoanCtx.Provider value={q.data}>
      <Outlet />
    </TaiKhoanCtx.Provider>
  );
}
