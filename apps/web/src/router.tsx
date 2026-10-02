import { createBrowserRouter, Navigate } from 'react-router';
import { MAN_HINH_TV, MAN_HINH_WEB, MAN_HINH_XAC_THUC, type ManHinh } from './man-hinh';
import { TrangTam } from './routes/trang-tam';

const route = (m: ManHinh) => ({ path: m.duongDan, element: <TrangTam manHinh={m} /> });

/**
 * React Router v7 — library mode [D12]. basename khớp `base: '/quanly/'` của Vite.
 * Route group (auth)/(web) của Next.js → layout route ở đây (thêm khi chuyển shell từ ui-demo, tuần 2).
 */
export const router = createBrowserRouter(
  [
    { index: true, element: <Navigate to="/trang-chu" replace /> },
    ...MAN_HINH_XAC_THUC.map(route),
    ...MAN_HINH_WEB.map(route),
    route(MAN_HINH_TV),
    {
      path: '*',
      element: (
        <TrangTam manHinh={{ duongDan: '*', tieuDe: 'Không tìm thấy trang', tinhNang: '—', demo: '—' }} />
      ),
    },
  ],
  { basename: '/quanly' },
);
