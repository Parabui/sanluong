import type { ReactElement } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { YeuCauDangNhap } from './lib/xac-thuc';
import { MAN_HINH_TV, MAN_HINH_WEB, type ManHinh } from './man-hinh';
import { ChuyenTramPage } from './routes/danh-muc/chuyen-tram';
import { MaHangPage } from './routes/danh-muc/ma-hang';
import { SoDoChuyenPage } from './routes/san-xuat/so-do-chuyen';
import { NhanVienPage } from './routes/danh-muc/nhan-vien';
import { TaiKhoanPage } from './routes/he-thong/tai-khoan';
import { TrangTam } from './routes/trang-tam';
import { DangNhapPage } from './routes/xac-thuc/dang-nhap';
import { DoiMatKhauPage } from './routes/xac-thuc/doi-mat-khau';
import { AppShell } from './shell/app-shell';

/** Màn hình đã implement; còn lại dùng TrangTam (chỉ báo chưa làm + đường dẫn giao diện gốc trong ui-demo) */
const DA_LAM: Record<string, ReactElement> = {
  'danh-muc/chuyen-tram': <ChuyenTramPage />,
  'danh-muc/nhan-vien': <NhanVienPage />,
  'danh-muc/ma-hang': <MaHangPage />,
  'san-xuat/so-do-chuyen': <SoDoChuyenPage />,
  'he-thong/tai-khoan': <TaiKhoanPage />,
};

const route = (m: ManHinh) => ({ path: m.duongDan, element: DA_LAM[m.duongDan] ?? <TrangTam manHinh={m} /> });

/**
 * React Router v7 — library mode [D12]. basename khớp `base: '/quanly/'` của Vite.
 * Route group (auth)/(web) của Next.js → layout route: YeuCauDangNhap (phiên) → AppShell (khung Web).
 */
export const router = createBrowserRouter(
  [
    { path: 'dang-nhap', element: <DangNhapPage /> },
    {
      element: <YeuCauDangNhap choPhepDoiMatKhau />,
      children: [{ path: 'doi-mat-khau', element: <DoiMatKhauPage /> }],
    },
    {
      element: <YeuCauDangNhap />,
      children: [
        route(MAN_HINH_TV),
        {
          element: <AppShell />,
          children: [
            { index: true, element: <Navigate to="/trang-chu" replace /> },
            ...MAN_HINH_WEB.map(route),
            {
              path: '*',
              element: <TrangTam manHinh={{ duongDan: '*', tieuDe: 'Không tìm thấy trang', tinhNang: '—', demo: '—' }} />,
            },
          ],
        },
      ],
    },
  ],
  { basename: '/quanly' },
);
