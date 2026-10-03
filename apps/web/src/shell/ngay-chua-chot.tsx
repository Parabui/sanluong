/**
 * "Còn X ngày chưa chốt" trên header [F10] — chép từ ui-demo/components/shell/app-shell.tsx (pill + menu chọn ngày).
 * Tổ trưởng quên chốt → hệ thống không tự chốt, chỉ nhắc ở đây.
 */
import { useQuery } from '@tanstack/react-query';
import { dinhDangNgay, HEADER_POLLING, thuIso, zNgayChuaChot } from '@vsn/shared';
import { Menu, MenuItem, MenuLabel } from '@vsn/ui';
import { CalendarClock, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { api } from '../lib/api';

const thuNgan = (d: string) => { const t = thuIso(d); return t === 7 ? 'CN' : `T${t + 1}`; };

export function NgayChuaChot() {
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ['chot-ngay', 'chua-chot'],
    // Polling: không gia hạn phiên Web [D24]
    queryFn: ({ signal }) => api.goi('/chot-ngay/chua-chot', { schema: z.array(zNgayChuaChot), signal, headers: { [HEADER_POLLING]: '1' } }),
    refetchInterval: 5 * 60_000,
  });
  const ds = q.data ?? [];
  if (!ds.length) return null;
  return (
    <Menu width="w-60" trigger={
      <button type="button" className="h-8 px-3 rounded-pill bg-empty-bg text-empty-ink text-chip font-semibold flex items-center gap-1.5 hover:brightness-[.98] transition duration-fast">
        <TriangleAlert className="w-4 h-4" />Còn {ds.length} ngày chưa chốt
      </button>
    }>
      <MenuLabel>Ngày chưa chốt</MenuLabel>
      {ds.map((p) => (
        <MenuItem key={`${p.chuyenId}|${p.ngay}`} icon={CalendarClock} onSelect={() => void navigate(`/san-xuat/bang-san-luong?chuyen=${p.chuyenId}&ngay=${p.ngay}`)}>
          <span className="font-medium">{p.maChuyen}</span><span className="text-muted">·</span>
          <span className="num">{thuNgan(p.ngay)}, {dinhDangNgay(p.ngay).slice(0, 5)}</span>
        </MenuItem>
      ))}
    </Menu>
  );
}
