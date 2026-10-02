import { createBrowserRouter, Navigate } from 'react-router';
import { MAN_HINH_WORKER } from './man-hinh';
import { TrangTam } from './routes/trang-tam';

/** React Router v7 — library mode [D12] */
export const router = createBrowserRouter([
  // Điều hướng ban đầu (hướng dẫn / chọn trạm / nhập) sẽ dựa vào GET /api/cn/khoi-dong — làm ở F1
  { index: true, element: <Navigate to="/chon-tram" replace /> },
  ...MAN_HINH_WORKER.map((m) => ({ path: m.duongDan, element: <TrangTam manHinh={m} /> })),
  {
    path: '*',
    element: <TrangTam manHinh={{ duongDan: '*', tieuDe: 'Không tìm thấy trang', tinhNang: '—', demo: '—' }} />,
  },
]);
