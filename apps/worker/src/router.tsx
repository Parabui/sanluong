import { createBrowserRouter } from 'react-router';
import { MAN_HINH_WORKER } from './man-hinh';
import { ChonTramPage } from './routes/chon-tram';
import { DangNhapPage } from './routes/dang-nhap';
import { KhoiDongPage } from './routes/khoi-dong';
import { NhapPage } from './routes/nhap';
import { TrangTam } from './routes/trang-tam';

const DA_LAM: Record<string, React.ReactNode> = {
  'chon-tram': <ChonTramPage />,
  'dang-nhap/:tramId': <DangNhapPage />,
  nhap: <NhapPage />,
};

/** React Router v7 — library mode [D12] */
export const router = createBrowserRouter([
  { index: true, element: <KhoiDongPage /> },
  ...MAN_HINH_WORKER.map((m) => ({ path: m.duongDan, element: DA_LAM[m.duongDan] ?? <TrangTam manHinh={m} /> })),
  {
    path: '*',
    element: <TrangTam manHinh={{ duongDan: '*', tieuDe: 'Không tìm thấy trang', tinhNang: '—', demo: '—' }} />,
  },
]);
