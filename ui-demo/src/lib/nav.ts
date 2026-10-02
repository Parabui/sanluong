import {
  ChartColumn, CalendarRange, Clock, Factory, FileSpreadsheet, GitBranch, House, LayoutDashboard,
  Lock, Radio, ScrollText, Settings, ShieldCheck, Shirt, Table2, Users, type LucideIcon,
} from "lucide-react";

export type Role = "SA" | "QLX" | "TT" | "IE" | "HR" | "KH" | "BGD";

export const ROLES: Record<Role, { label: string; name: string; scope: string }> = {
  SA: { label: "Superadmin", name: "Lê Minh Quân", scope: "Toàn nhà máy" },
  TT: { label: "Tổ trưởng", name: "Nguyễn Văn Bình", scope: "C05, C06" },
  QLX: { label: "Quản lý xưởng", name: "Hoàng Văn Thắng", scope: "Xưởng May 1" },
  IE: { label: "Kỹ thuật / IE", name: "Phùng Thị Hà", scope: "Toàn nhà máy" },
  HR: { label: "IT / HR", name: "Dương Thị Mỹ", scope: "Toàn nhà máy" },
  KH: { label: "Kế hoạch", name: "Tô Văn Khoa", scope: "Toàn nhà máy" },
  BGD: { label: "Ban Giám đốc", name: "Lưu Quang Vinh", scope: "Toàn nhà máy" },
};

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
  badge?: number;
  /** placeholder của ô tìm kiếm trên header khi đang ở màn này */
  search?: string;
};
export type NavGroup = { title?: string; items: NavItem[] };

const ALL: Role[] = ["SA", "QLX", "TT", "IE", "HR", "KH", "BGD"];

export const NAV: NavGroup[] = [
  { items: [{ label: "Trang chủ", href: "/trang-chu", icon: House, roles: ALL }] },
  {
    title: "Sản xuất",
    items: [
      { label: "Bảng sản lượng ngày", href: "/san-xuat/bang-san-luong", icon: Table2, roles: ["SA", "TT"], search: "Tìm công nhân, mã NV, công đoạn…" },
      { label: "Sơ đồ chuyền", href: "/san-xuat/so-do-chuyen", icon: GitBranch, roles: ["SA", "TT", "IE"], search: "Tìm công đoạn…" },
      { label: "Sơ đồ trạm trực tiếp", href: "/san-xuat/so-do-tram", icon: Radio, roles: ["SA", "TT"], search: "Tìm trạm, công nhân…" },
      { label: "Duyệt giờ làm", href: "/san-xuat/duyet-gio", icon: Clock, roles: ["SA", "TT"], badge: 3, search: "Tìm công nhân, mã NV…" },
    ],
  },
  {
    title: "Báo cáo",
    items: [
      { label: "Báo cáo", href: "/bao-cao", icon: ChartColumn, roles: ["SA", "QLX", "TT", "IE", "HR"], search: "Tìm công nhân, công đoạn…" },
      { label: "Dashboard", href: "/bao-cao/dashboard", icon: LayoutDashboard, roles: ["SA", "QLX", "TT", "BGD"] },
    ],
  },
  {
    title: "Lương",
    items: [
      { label: "Khóa sổ", href: "/luong/khoa-so", icon: Lock, roles: ["SA", "HR"], search: "Tìm mã hàng…" },
      { label: "Xuất dữ liệu lương", href: "/luong/xuat-du-lieu", icon: FileSpreadsheet, roles: ["SA", "HR"] },
    ],
  },
  {
    title: "Kế hoạch",
    items: [{ label: "Kế hoạch sản lượng", href: "/ke-hoach", icon: CalendarRange, roles: ["SA", "KH"], search: "Tìm mã hàng, chuyền…" }],
  },
  {
    title: "Danh mục",
    items: [
      { label: "Nhân viên", href: "/danh-muc/nhan-vien", icon: Users, roles: ["SA", "HR"], search: "Tìm mã NV, họ tên…" },
      { label: "Mã hàng & công đoạn", href: "/danh-muc/ma-hang", icon: Shirt, roles: ["SA", "IE"], search: "Tìm mã hàng, công đoạn…" },
      { label: "Xưởng – Chuyền – Trạm", href: "/danh-muc/chuyen-tram", icon: Factory, roles: ["SA"], search: "Tìm chuyền…" },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { label: "Tài khoản & phân quyền", href: "/he-thong/tai-khoan", icon: ShieldCheck, roles: ["SA"], search: "Tìm tài khoản…" },
      { label: "Cài đặt", href: "/he-thong/cai-dat", icon: Settings, roles: ["SA", "QLX"] },
      { label: "Audit log", href: "/he-thong/audit-log", icon: ScrollText, roles: ["SA"], search: "Tìm người thực hiện, đối tượng…" },
    ],
  },
];

export const findNav = (pathname: string) => {
  for (const g of NAV)
    for (const it of g.items)
      if (it.href === pathname) return { group: g.title, item: it };
  return null;
};
