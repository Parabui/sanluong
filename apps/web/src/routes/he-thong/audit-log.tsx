/**
 * Audit log · F8 (Superadmin) — giao diện chép từ ui-demo/(web)/he-thong/audit-log
 * (khoảng thời gian, lọc hành động, ô tìm người thực hiện · bảng · drawer dữ liệu cũ / mới · Xuất Excel).
 * Bảng chỉ-thêm: không ai sửa / xóa được, kể cả Superadmin [D9].
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { congNgay, type DongAuditLog, dinhDangNgay, zDsAuditLog } from '@vsn/shared';
import { Button, Drawer, Page, Pill, Select, StatusBar, Toolbar, type Tone, useToast } from '@vsn/ui';
import { type Col, DataTable, TableFooter } from '@vsn/ui/data-table';
import { ChevronLeft, ChevronRight, Download, Lock, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { api, taiFile, thongBaoLoi } from '../../lib/api';
import { useDebounced } from '../../lib/hooks';
import { useToi } from '../../lib/xac-thuc';
import { useShell } from '../../shell/shell-context';

const KICH_THUOC = 100;
const KHOANG = [['7', '7 ngày gần nhất'], ['30', '30 ngày'], ['90', '90 ngày']] as const;
const fmt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', hour12: false });
const luc = (iso: string) => fmt.format(new Date(iso)).replace(',', '');

/** Màu theo nhóm hành động (chép tinh thần demo: sửa / nhập hộ = tím, chốt = xanh, mở khóa = cam, quyền = cam đậm, đăng xuất hộ = đỏ) */
function tone(a: string): Tone {
  if (/^(SUA|NHAP_HO|XAC_NHAN)/.test(a) || a === 'SUA_GIO_TRUC_TIEP') return 'adjust';
  if (/^(CHOT|KHOA_THANG|KHOA_LAI|DUYET)/.test(a)) return 'closed';
  if (/^(MO_KHOA|DOI_SMV|TINH_LAI)/.test(a)) return 'warn';
  if (/^(DOI_QUYEN|DOI_PHAM_VI|SUA_CAU_HINH|DAT_LAI)/.test(a)) return 'brand';
  if (/^(DANG_XUAT_HO|TU_CHOI|THU_HOI|XOA|DANG_NHAP_THAT_BAI|DB_TRUC_TIEP)/.test(a)) return 'danger';
  return 'neutral';
}

export function AuditLogPage() {
  const toast = useToast();
  const toi = useToi();
  const { q } = useShell();
  const qTim = useDebounced(q.trim(), 300);
  const [soNgay, setSoNgay] = useState<(typeof KHOANG)[number][0]>('7');
  const [hanhDong, setHanhDong] = useState('');
  const [trang, setTrang] = useState(1);
  const [sel, setSel] = useState<DongAuditLog | null>(null);

  const den = toi.homNay;
  const tu = congNgay(den, 1 - Number(soNgay));
  const loc = new URLSearchParams({ tu, den });
  if (hanhDong) loc.set('hanhDong', hanhDong);
  if (qTim) loc.set('q', qTim);
  const dsQ = useQuery({
    queryKey: ['audit-log', loc.toString(), trang],
    queryFn: ({ signal }) => api.goi(`/audit-log?${loc.toString()}&trang=${trang}&kichThuoc=${KICH_THUOC}`, { schema: zDsAuditLog, signal }),
    placeholderData: keepPreviousData,
  });
  const d = dsQ.data;
  const soTrang = d ? Math.max(1, Math.ceil(d.tongDong / KICH_THUOC)) : 1;
  const xuat = useMutation({
    mutationFn: () => taiFile(`/audit-log/xuat?${loc.toString()}`),
    onSuccess: () => toast('Đã xuất Excel'),
    onError: (e) => toast(thongBaoLoi(e), 'warn'),
  });

  const cols: Col<DongAuditLog>[] = [
    { key: 't', label: 'Thời điểm', width: 150, render: (l) => <span className="num text-muted whitespace-nowrap">{luc(l.luc)}</span> },
    { key: 'w', label: 'Người thực hiện', width: 170, render: (l) => <span className="font-mono text-[13px]" data-tip={l.hoTen ?? undefined}>{l.nguoi}</span> },
    { key: 'a', label: 'Hành động', width: 190, render: (l) => <Pill size="sm" tone={tone(l.hanhDong)}>{l.hanhDong}</Pill> },
    { key: 'o', label: 'Đối tượng', render: (l) => <span className="truncate block"><span className="text-muted">{l.doiTuong}</span>{l.doiTuongId && <> · <span className="font-mono text-tag">{l.doiTuongId}</span></>}</span> },
    { key: 'r', label: 'Lý do', width: 200, render: (l) => <span className="text-muted truncate block">{l.lyDo ?? '—'}</span> },
    { key: 'ip', label: 'IP', width: 120, render: (l) => <span className="font-mono text-tag text-muted">{l.ip ?? '—'}</span> },
  ];

  return (
    <>
      <Page>
        <Toolbar title="Audit log" right={<Button icon={Download} disabled={!d?.tongDong || xuat.isPending} onClick={() => xuat.mutate()}>Xuất Excel</Button>}>
          <Select label="Khoảng thời gian" className="w-40" value={soNgay} onChange={(e) => { setSoNgay(e.target.value as typeof soNgay); setTrang(1); }}>
            {KHOANG.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select label="Hành động" className="w-48" value={hanhDong} onChange={(e) => { setHanhDong(e.target.value); setTrang(1); }}>
            <option value="">Mọi hành động</option>
            {(d?.dsHanhDong ?? []).map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
          <span className="text-sub text-muted ml-2 whitespace-nowrap">{dinhDangNgay(tu)} – {dinhDangNgay(den)}</span>
        </Toolbar>
        <DataTable cols={cols} rows={d?.dong ?? []} rowKey={(l) => l.id} onRowClick={setSel} emptyIcon={ScrollText} dangTai={dsQ.isPending}
          empty={dsQ.isError ? thongBaoLoi(dsQ.error) : 'Không có thao tác nào trong khoảng này'}
          footer={<TableFooter><Lock className="w-3.5 h-3.5" />Chỉ-thêm (append-only) · không ai sửa / xóa được, kể cả Superadmin
            <span className="ml-auto flex items-center gap-2">
              <span>{d ? `${d.tongDong.toLocaleString('vi-VN')} dòng · ` : ''}Bấm dòng để xem dữ liệu cũ / mới</span>
              {soTrang > 1 && (<>
                <button type="button" disabled={trang <= 1} onClick={() => setTrang(trang - 1)} className="w-7 h-7 grid place-items-center rounded-ctl hover:bg-hover disabled:opacity-40" aria-label="Trang trước"><ChevronLeft className="w-4 h-4" /></button>
                <span className="num">Trang {trang}/{soTrang}</span>
                <button type="button" disabled={trang >= soTrang} onClick={() => setTrang(trang + 1)} className="w-7 h-7 grid place-items-center rounded-ctl hover:bg-hover disabled:opacity-40" aria-label="Trang sau"><ChevronRight className="w-4 h-4" /></button>
              </>)}
            </span>
          </TableFooter>} />
      </Page>
      <StatusBar right={<span>Lưu trữ 3 năm</span>}>{qTim && <span>Lọc người thực hiện: “{qTim}”</span>}</StatusBar>

      <Drawer open={!!sel} onClose={() => setSel(null)} title="Chi tiết thao tác">
        {sel && (
          <div className="flex flex-col gap-4 text-chip">
            <dl className="grid grid-cols-[110px_1fr] gap-y-2">
              <dt className="text-muted">Thời điểm</dt><dd className="num">{luc(sel.luc)}</dd>
              <dt className="text-muted">Người</dt><dd><span className="font-mono">{sel.nguoi}</span>{sel.hoTen && <span className="text-muted"> · {sel.hoTen}</span>}</dd>
              <dt className="text-muted">Hành động</dt><dd><Pill size="sm" tone={tone(sel.hanhDong)}>{sel.hanhDong}</Pill></dd>
              <dt className="text-muted">Đối tượng</dt><dd className="break-all">{sel.doiTuong}{sel.doiTuongId && ` · ${sel.doiTuongId}`}</dd>
              {sel.lyDo && (<><dt className="text-muted">Lý do</dt><dd>{sel.lyDo}</dd></>)}
              <dt className="text-muted">IP</dt><dd className="font-mono">{sel.ip ?? '—'}</dd>
              {sel.traceId && (<><dt className="text-muted">Trace ID</dt><dd className="font-mono text-tag break-all">{sel.traceId}</dd></>)}
            </dl>
            {(['duLieuCu', 'duLieuMoi'] as const).map((k) => sel[k] != null && (
              <div key={k}>
                <div className="text-sub font-semibold text-muted uppercase tracking-[0.04em] mb-1">{k === 'duLieuCu' ? 'Dữ liệu cũ' : 'Dữ liệu mới'}</div>
                <pre className={`rounded-ctl border px-3 py-2 font-mono text-[12px] whitespace-pre-wrap break-all ${k === 'duLieuCu' ? 'bg-danger-bg border-danger/20' : 'bg-closed-bg border-closed-ink/20'}`}>{JSON.stringify(sel[k], null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </>
  );
}
