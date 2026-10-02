/**
 * Menu Web — nhóm/thứ tự/icon chép từ ui-demo/src/lib/nav.ts; quyền hiển thị theo ChucNang (GET /api/auth/toi)
 * thay cho vai trò demo. Chỉ để ẩn/hiện — server vẫn kiểm tra lại mọi API [TDD 14.3].
 */
import type { ChucNang } from '@vsn/shared';
import {
  CalendarRange, ChartColumn, Clock, Factory, FileSpreadsheet, GitBranch, House, LayoutDashboard,
  Lock, Radio, ScrollText, Settings, ShieldCheck, Shirt, Table2, Users, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  /** Đường dẫn trong app (basename /quanly) */
  href: string;
  icon: LucideIcon;
  /** Hiện khi tài khoản có ÍT NHẤT MỘT chức năng; rỗng = mọi tài khoản */
  chucNang: ChucNang[];
  /** placeholder ô tìm kiếm trên header khi đang ở màn này */
  search?: string;
}
export interface NavGroup {
  title?: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { items: [{ label: 'Trang chủ', href: '/trang-chu', icon: House, chucNang: [] }] },
  {
    title: 'Sản xuất',
    items: [
      { label: 'Bảng sản lượng ngày', href: '/san-xuat/bang-san-luong', icon: Table2, chucNang: ['SAN_LUONG_SUA'], search: 'Tìm công nhân, mã NV, công đoạn…' },
      { label: 'Sơ đồ chuyền', href: '/san-xuat/so-do-chuyen', icon: GitBranch, chucNang: ['SO_DO_GAN'], search: 'Tìm công đoạn…' },
      { label: 'Sơ đồ trạm trực tiếp', href: '/san-xuat/so-do-tram', icon: Radio, chucNang: ['SO_DO_TRAM_XEM'], search: 'Tìm trạm, công nhân…' },
      { label: 'Duyệt giờ làm', href: '/san-xuat/duyet-gio', icon: Clock, chucNang: ['GIO_LAM_DUYET'], search: 'Tìm công nhân, mã NV…' },
    ],
  },
  {
    title: 'Báo cáo',
    items: [
      { label: 'Báo cáo', href: '/bao-cao', icon: ChartColumn, chucNang: ['BAO_CAO_XEM'], search: 'Tìm công nhân, công đoạn…' },
      { label: 'Dashboard', href: '/bao-cao/dashboard', icon: LayoutDashboard, chucNang: ['DASHBOARD_XEM'] },
    ],
  },
  {
    title: 'Lương',
    items: [
      { label: 'Khóa sổ', href: '/luong/khoa-so', icon: Lock, chucNang: ['KHOA_THANG'], search: 'Tìm mã hàng…' },
      { label: 'Xuất dữ liệu lương', href: '/luong/xuat-du-lieu', icon: FileSpreadsheet, chucNang: ['XUAT_LUONG'] },
    ],
  },
  {
    title: 'Kế hoạch',
    items: [{ label: 'Kế hoạch sản lượng', href: '/ke-hoach', icon: CalendarRange, chucNang: ['KE_HOACH_QUAN_LY'], search: 'Tìm mã hàng, chuyền…' }],
  },
  {
    title: 'Danh mục',
    items: [
      { label: 'Nhân viên', href: '/danh-muc/nhan-vien', icon: Users, chucNang: ['NHAN_VIEN_QUAN_LY'], search: 'Tìm mã NV, họ tên…' },
      { label: 'Mã hàng & công đoạn', href: '/danh-muc/ma-hang', icon: Shirt, chucNang: ['MA_HANG_QUAN_LY'], search: 'Tìm mã hàng, công đoạn…' },
      { label: 'Xưởng – Chuyền – Trạm', href: '/danh-muc/chuyen-tram', icon: Factory, chucNang: ['DANH_MUC_XUONG_CHUYEN'], search: 'Tìm chuyền…' },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { label: 'Tài khoản & phân quyền', href: '/he-thong/tai-khoan', icon: ShieldCheck, chucNang: ['TAI_KHOAN_QUAN_LY'], search: 'Tìm tài khoản…' },
      { label: 'Cài đặt', href: '/he-thong/cai-dat', icon: Settings, chucNang: ['CAU_HINH', 'GIO_MAC_DINH_CAI'] },
      { label: 'Audit log', href: '/he-thong/audit-log', icon: ScrollText, chucNang: ['AUDIT_XEM'], search: 'Tìm người thực hiện, đối tượng…' },
    ],
  },
];

export const duocXem = (item: NavItem, chucNang: readonly ChucNang[]) =>
  item.chucNang.length === 0 || item.chucNang.some((c) => chucNang.includes(c));

export function timNav(pathname: string) {
  for (const g of NAV) for (const it of g.items) if (it.href === pathname) return { group: g.title, item: it };
  return null;
}
