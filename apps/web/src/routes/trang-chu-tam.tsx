import { Navigate } from 'react-router';
import { MAN_HINH_WEB } from '../man-hinh';
import { duocXem, NAV } from '../nav';
import { useToi } from '../lib/xac-thuc';
import { TrangTam } from './trang-tam';

/**
 * Trang chủ (F10, F13 — SHOULD) CHƯA làm: tạm chuyển thẳng tới màn hình ĐÃ LÀM đầu tiên trong menu mà tài khoản được xem
 * (tổ trưởng → Bảng sản lượng ngày, HR → Báo cáo / Khóa sổ …) để pilot không rơi vào trang tạm sau khi đăng nhập.
 * Mọi link "Trang chủ" (sau đăng nhập, logo, đổi mật khẩu, trang 403) đi qua đây. Làm F13 thì thay component này.
 */
export function TrangChuTam({ daLam }: { daLam: readonly string[] }) {
  const tk = useToi();
  const dau = NAV.flatMap((g) => g.items).find((i) => i.href !== '/trang-chu' && daLam.includes(i.href.slice(1)) && duocXem(i, tk.chucNang));
  if (dau) return <Navigate to={dau.href} replace />;
  return <TrangTam manHinh={MAN_HINH_WEB.find((m) => m.duongDan === 'trang-chu')!} />;
}
