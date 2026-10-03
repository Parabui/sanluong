/**
 * Sơ đồ chuyền · F4 — giao diện chép từ ui-demo/(web)/san-xuat/so-do-chuyen
 * (cột "Chưa gán trạm" + lưới 18 trạm vừa 1 màn 1366×768; kéo thả hoặc bấm chọn → bấm trạm; Sao chép / Kết thúc mã hàng / Lưu).
 * Kéo thả dùng dnd-kit [TDD 5] (chuột, cảm ứng, bàn phím). Bổ sung so với demo: chọn thêm mã hàng (tối đa 2), hiện cả công đoạn
 * đã gán để gán một công đoạn vào nhiều trạm.
 */
import { DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type CongDoanSoDo, dinhDangGio, dinhDangNgay, homNay, LoiApi, noiDungLoi, SO_MA_HANG_TOI_DA, type SoDo,
  zChuyen, zCongDoan, zDeXuatSaoChep, zKetQuaLuuSoDo, zMaHang, zSoDo,
} from '@vsn/shared';
import { Button, cn, EmptyState, Modal, Page, Select, StatusBar, Switch, Toolbar, useToast } from '@vsn/ui';
import { Copy, Flag, GitBranch, GripVertical, Save, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { api } from '../../lib/api';
import { useShell } from '../../shell/shell-context';

const MAU = ['bg-brand-soft text-brand-ink border-brand/30', 'bg-support-bg text-support-ink border-support-ink/20'];
const VIEN = ['bg-brand-soft border-brand', 'bg-support-bg border-support-ink'];
type Ban = Record<string, CongDoanSoDo[]>; // tramId → công đoạn
const tuSoDo = (sd: SoDo): Ban => Object.fromEntries(sd.tram.map((t) => [t.id, t.congDoan]));

export function SoDoChuyenPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const chuyenQ = useQuery({ queryKey: ['chuyen', 'tat-ca'], queryFn: ({ signal }) => api.goi('/chuyen', { schema: z.array(zChuyen), signal }) });
  const dsChuyen = (chuyenQ.data ?? []).filter((c) => c.loai === 'CHUYEN_MAY' && c.trangThai === 'HOAT_DONG');
  const [chuyenId, setChuyenId] = useState<string | null>(null);
  const id = chuyenId ?? dsChuyen[0]?.id;
  const sdQ = useQuery({ queryKey: ['so-do', id], queryFn: ({ signal }) => api.goi(`/so-do?chuyenId=${id}`, { schema: zSoDo, signal }), enabled: !!id });

  if (chuyenQ.isSuccess && !dsChuyen.length) {
    return <Page><Toolbar title="Sơ đồ chuyền" /><section className="flex-1 bg-surface border border-line rounded-card grid place-items-center"><EmptyState icon={GitBranch} title="Chưa có chuyền may trong phạm vi của bạn" /></section></Page>;
  }
  if (!sdQ.data) return <Page><Toolbar title="Sơ đồ chuyền" /><div className="flex-1 grid place-items-center text-muted" role="status"><span className="spin w-6 h-6 rounded-full border-2 border-current border-t-transparent" /></div></Page>;
  // key: đổi chuyền / có phiên bản mới → khởi tạo lại bản nháp
  return <BanSoDo key={`${sdQ.data.chuyenId}|${sdQ.data.versionSoDo}`} sd={sdQ.data} dsChuyen={dsChuyen} onChonChuyen={setChuyenId}
    onDaLuu={() => void queryClient.invalidateQueries({ predicate: (k) => ['so-do', 'ma-hang', 'cong-doan'].includes(String(k.queryKey[0])) })} toast={toast} />;
}

function BanSoDo({ sd, dsChuyen, onChonChuyen, onDaLuu, toast }: {
  sd: SoDo; dsChuyen: z.infer<typeof zChuyen>[]; onChonChuyen: (id: string) => void; onDaLuu: () => void; toast: ReturnType<typeof useToast>;
}) {
  const { q } = useShell();
  const [ban, setBan] = useState<Ban>(() => tuSoDo(sd));
  const [them, setThem] = useState<CongDoanSoDo[]>([]); // công đoạn của mã hàng vừa chọn thêm (chưa chạy trên chuyền)
  const [picked, setPicked] = useState<{ cd: CongDoanSoDo; from: string } | null>(null);
  const [locMh, setLocMh] = useState<string | null>(null);
  const [hienTatCa, setHienTatCa] = useState(false);
  const [modal, setModal] = useState<'ket-thuc' | 'sao-chep' | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

  const mhQ = useQuery({ queryKey: ['ma-hang'], queryFn: ({ signal }) => api.goi('/ma-hang', { schema: z.array(zMaHang), signal }) });
  // Mã hàng trên sơ đồ: đang chạy + vừa chọn thêm + có trong bản nháp
  const maHang = new Map<string, { id: string; ma: string; ten: string; moi: boolean }>();
  for (const m of sd.maHangDangChay) maHang.set(m.id, { ...m, moi: false });
  for (const c of [...them, ...Object.values(ban).flat()]) {
    if (!maHang.has(c.maHangId)) maHang.set(c.maHangId, { id: c.maHangId, ma: c.maMaHang, ten: mhQ.data?.find((m) => m.id === c.maHangId)?.ten ?? '', moi: true });
  }
  const dsMh = [...maHang.values()];
  const mau = (mhId: string) => Math.max(0, dsMh.findIndex((m) => m.id === mhId)) % MAU.length;

  const tatCaCd = new Map<string, CongDoanSoDo>();
  for (const c of [...sd.chuaGan, ...sd.tram.flatMap((t) => t.congDoan), ...them]) if (c.hoatDong) tatCaCd.set(c.congDoanId, c);
  const daGan = new Set(Object.values(ban).flat().map((c) => c.congDoanId));
  const pool = [...tatCaCd.values()].filter((c) => hienTatCa || !daGan.has(c.congDoanId))
    .sort((a, b) => a.maMaHang.localeCompare(b.maMaHang) || a.ma.localeCompare(b.ma));
  const soDoi = (() => {
    const goc = tuSoDo(sd);
    let n = 0;
    for (const t of sd.tram) {
      const a = new Set((goc[t.id] ?? []).map((c) => c.congDoanId)), b = new Set((ban[t.id] ?? []).map((c) => c.congDoanId));
      for (const x of a) if (!b.has(x)) n++;
      for (const x of b) if (!a.has(x)) n++;
    }
    return n;
  })();

  const move = (cd: CongDoanSoDo, from: string, to: string) => {
    setPicked(null);
    if (from === to) return;
    const so = sd.tram.find((t) => t.id === to)?.soTram;
    if (to !== 'pool' && ban[to]?.some((c) => c.congDoanId === cd.congDoanId)) return toast(`Trạm ${so} đã có ${cd.ma}`, 'warn');
    setBan((b) => {
      const n = { ...b };
      if (from !== 'pool') n[from] = (n[from] ?? []).filter((c) => c.congDoanId !== cd.congDoanId);
      if (to !== 'pool') n[to] = [...(n[to] ?? []), cd];
      return n;
    });
  };
  const onDragEnd = (e: DragEndEvent) => {
    const d = e.active.data.current as { cd: CongDoanSoDo; from: string } | undefined;
    if (d && e.over) move(d.cd, d.from, String(e.over.id));
  };

  const luu = useMutation({
    mutationFn: () => api.goi('/so-do', {
      method: 'PUT',
      body: { chuyenId: sd.chuyenId, versionSoDo: sd.versionSoDo, gan: sd.tram.map((t) => ({ tramId: t.id, congDoanIds: (ban[t.id] ?? []).map((c) => c.congDoanId) })) },
      schema: zKetQuaLuuSoDo,
    }),
    onSuccess: () => { toast('Đã lưu sơ đồ · app công nhân cập nhật ở lần mở tiếp theo'); onDaLuu(); },
    onError: (e) => { toast(e.message, 'warn'); if (e instanceof LoiApi && e.code === 'DU_LIEU_DA_THAY_DOI') onDaLuu(); },
  });
  const chonThemMh = async (mhId: string) => {
    if (!mhId) return;
    try {
      const ds = await api.goi(`/ma-hang/${mhId}/cong-doan`, { schema: z.array(zCongDoan) });
      const mh = mhQ.data?.find((m) => m.id === mhId);
      setThem((t) => [...t, ...ds.filter((c) => c.trangThai === 'HOAT_DONG').map((c) => ({
        congDoanId: c.id, ma: c.ma, ten: c.ten, smv: c.smv, laCongDoanHoanThanh: c.laCongDoanHoanThanh, maHangId: mhId, maMaHang: mh?.ma ?? '', hoatDong: true,
      }))]);
    } catch (e) { toast(noiDungLoi(e, 'Không tải được công đoạn'), 'warn'); }
  };

  const s = q.trim().toLowerCase();
  const khop = (c: CongDoanSoDo) => (!s || `${c.ma} ${c.ten}`.toLowerCase().includes(s)) && (!locMh || c.maHangId === locMh);
  const soDaGan = Object.values(ban).reduce((n, v) => n + v.length, 0);
  const soHang = Math.max(1, Math.ceil(sd.tram.length / 6));
  const conChoMh = dsMh.length < SO_MA_HANG_TOI_DA;

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <Page>
        <Toolbar title="Sơ đồ chuyền" right={<>
          <Button icon={Copy} disabled={!sd.hienHanh} onClick={() => setModal('sao-chep')}>Sao chép sơ đồ</Button>
          <Button icon={Flag} disabled={!sd.maHangDangChay.length || soDoi > 0} data-tip={soDoi ? 'Lưu hoặc hoàn tác thay đổi trước' : undefined} onClick={() => setModal('ket-thuc')}>Kết thúc mã hàng</Button>
          <Button variant="primary" icon={Save} disabled={!soDoi} busy={luu.isPending} onClick={() => luu.mutate()}>Lưu</Button>
        </>}>
          <Select label="Chuyền" value={sd.chuyenId} onChange={(e) => onChonChuyen(e.target.value)} className="w-44">
            {dsChuyen.map((c) => <option key={c.id} value={c.id}>{c.ma} · {c.ten}</option>)}
          </Select>
          <div className="flex items-center gap-1.5 ml-1" data-tip={`${dsMh.length}/${SO_MA_HANG_TOI_DA} mã hàng trên chuyền · bấm để làm nổi công đoạn của mã`}>
            {dsMh.map((m) => (
              <button key={m.id} type="button" onClick={() => setLocMh(locMh === m.id ? null : m.id)} aria-pressed={locMh === m.id}
                className={cn('h-8 px-3 rounded-pill border text-chip font-semibold whitespace-nowrap transition duration-fast', MAU[mau(m.id)], m.moi && 'border-dashed', locMh === m.id && 'ring-2 ring-offset-1 ring-current')}>{m.ma}</button>
            ))}
            {conChoMh && (
              <Select label="Thêm mã hàng" value="" onChange={(e) => void chonThemMh(e.target.value)} className="h-8 w-40 text-chip">
                <option value="">+ Thêm mã hàng…</option>
                {mhQ.data?.filter((m) => !maHang.has(m.id) && m.soCongDoan > 0).map((m) => <option key={m.id} value={m.id}>{m.ma} · {m.ten}</option>)}
              </Select>
            )}
          </div>
          {soDoi > 0 && <span className="ml-2 text-chip text-brand-ink font-semibold flex items-center gap-1.5 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-brand" />{soDoi} thay đổi chưa lưu
            <button type="button" onClick={() => { setBan(tuSoDo(sd)); setThem([]); }} className="ml-1 text-muted hover:text-ink inline-flex items-center gap-1 font-medium"><Undo2 className="w-3.5 h-3.5" />Hoàn tác</button></span>}
        </Toolbar>

        <div className="flex-1 min-h-0 grid grid-cols-[264px_minmax(0,1fr)] gap-4">
          <VungTha id="pool" className="bg-surface border border-line rounded-card flex flex-col min-h-0">
            <div className="h-12 px-4 flex items-center border-b border-line">
              <h2 className="text-h font-semibold">{hienTatCa ? 'Công đoạn' : 'Chưa gán trạm'}</h2>
              <span className="ml-auto h-[18px] min-w-[18px] px-1.5 rounded-pill bg-empty-bg text-empty-ink text-tag font-semibold grid place-items-center">{pool.length}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scroll-area p-3 flex flex-col gap-1.5">
              {pool.length ? pool.map((c) => (
                <ChipCd key={c.congDoanId} cd={c} from="pool" mau={MAU[mau(c.maHangId)]!} mo={!khop(c)} chon={picked?.cd.congDoanId === c.congDoanId && picked.from === 'pool'}
                  onChon={() => setPicked(picked?.cd.congDoanId === c.congDoanId && picked.from === 'pool' ? null : { cd: c, from: 'pool' })} daGan={hienTatCa && daGan.has(c.congDoanId)} />
              )) : <p className="text-chip text-muted text-center py-8">{tatCaCd.size ? 'Mọi công đoạn đã được gán.' : 'Chọn mã hàng để có công đoạn.'}</p>}
            </div>
            <div className="px-4 py-3 border-t border-line flex flex-col gap-2">
              <Switch checked={hienTatCa} onChange={setHienTatCa} label="Hiện cả công đoạn đã gán (gán 1 công đoạn vào nhiều trạm)" />
              <p className="text-sub text-muted">Kéo công đoạn thả vào trạm. Hoặc bấm chọn công đoạn rồi bấm vào trạm.</p>
            </div>
          </VungTha>

          <section className="grid grid-cols-6 gap-2 min-h-0" style={{ gridTemplateRows: `repeat(${soHang}, minmax(0, 1fr))` }}>
            {sd.tram.map((t) => {
              const ops = ban[t.id] ?? [];
              const dacBiet = t.soTram === 12 ? 'QC' : t.soTram === 25 ? 'Ủi' : null;
              return (
                <VungTha key={t.id} id={t.id} chon={!!picked} onClick={() => picked && move(picked.cd, picked.from, t.id)}
                  className={cn('bg-surface border rounded-card p-2 flex flex-col gap-1.5 min-h-0 overflow-hidden transition-colors duration-fast',
                    picked ? 'border-brand/60 cursor-copy hover:bg-brand-soft' : 'border-line')}>
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-qty font-semibold num" aria-label={`Trạm ${t.soTram}`}><span className="text-sub text-muted font-medium">Trạm </span>{t.soTram}</span>
                    {dacBiet && <span className="h-[18px] px-1.5 rounded-pill bg-closed-bg text-closed-ink text-tag font-semibold inline-flex items-center">{dacBiet}</span>}
                    <span className="ml-auto text-tag text-muted">{ops.length ? `${ops.length} CĐ` : 'Trống'}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 min-h-0 overflow-y-auto no-scrollbar pt-1 pr-1">
                    {ops.map((c) => (
                      <ChipCd key={c.congDoanId} cd={c} from={t.id} trongTram mau={MAU[mau(c.maHangId)]!} mo={!khop(c)}
                        chon={picked?.cd.congDoanId === c.congDoanId && picked.from === t.id}
                        onChon={() => setPicked(picked?.cd.congDoanId === c.congDoanId && picked.from === t.id ? null : { cd: c, from: t.id })}
                        onGo={() => move(c, t.id, 'pool')} soTram={t.soTram} />
                    ))}
                    {!ops.length && <div className="flex-1 min-h-10 rounded-ctl border border-dashed border-line-strong grid place-items-center text-sub text-muted">Thả công đoạn</div>}
                  </div>
                </VungTha>
              );
            })}
          </section>
        </div>
      </Page>
      <StatusBar right={sd.phienBan && <span>Phiên bản gán hiện hành: {dinhDangNgay(homNay(new Date(sd.phienBan.luc))).slice(0, 5)} {dinhDangGio(sd.phienBan.luc)} · {sd.phienBan.nguoi ?? '—'}</span>}>
        {dsMh.map((m) => <span key={m.id} className="flex items-center gap-1.5"><span className={cn('w-2.5 h-2.5 rounded-sm border', VIEN[mau(m.id)])} />{m.ma}{m.ten ? ` · ${m.ten}` : ''}</span>)}
        <span><b className="text-ink num">{soDaGan}</b> công đoạn đã gán · {sd.tram.length} trạm</span>
      </StatusBar>

      {modal === 'ket-thuc' && <ModalKetThuc sd={sd} onClose={() => setModal(null)} onXong={onDaLuu} />}
      {modal === 'sao-chep' && (
        <ModalSaoChep sd={sd} dsMh={dsMh} dsChuyen={dsChuyen} maHang={mhQ.data ?? []} onClose={() => setModal(null)}
          onApDung={(gan, boQua) => {
            setBan((b) => {
              const n = { ...b };
              for (const g of gan) {
                const t = sd.tram.find((x) => x.soTram === g.soTram);
                if (!t) continue;
                const co = new Set((n[t.id] ?? []).map((c) => c.congDoanId));
                n[t.id] = [...(n[t.id] ?? []), ...g.congDoan.filter((c) => !co.has(c.congDoanId))];
              }
              return n;
            });
            toast(`Đã sao chép bố cục${boQua ? ` · bỏ qua ${boQua} công đoạn đã ngưng` : ''} — kiểm tra rồi bấm Lưu`);
          }} />
      )}
    </DndContext>
  );
}

function VungTha({ id, className, children, onClick, chon }: { id: string; className: string; children: React.ReactNode; onClick?: () => void; chon?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <section ref={setNodeRef} onClick={onClick} className={cn(className, isOver && 'drop-target')} aria-dropeffect={chon ? 'move' : undefined}>{children}</section>;
}

function ChipCd({ cd, from, trongTram, mau, mo, chon, onChon, onGo, soTram, daGan }: {
  cd: CongDoanSoDo; from: string; trongTram?: boolean; mau: string; mo: boolean; chon: boolean; onChon: () => void; onGo?: () => void; soTram?: number; daGan?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `${from}|${cd.congDoanId}`, data: { cd, from } });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} aria-pressed={chon} aria-label={`${cd.ma} ${cd.ten}`}
      onClick={(e) => { e.stopPropagation(); onChon(); }}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined}
      className={cn('group/op relative rounded-ctl border text-chip cursor-grab active:cursor-grabbing select-none transition-colors duration-fast',
        trongTram ? 'px-2 py-1' : 'flex items-center gap-1.5 pl-1 pr-1.5 py-1.5', mau, chon && 'ring-2 ring-brand-ink', mo && 'opacity-30', isDragging && 'shadow-pop opacity-90')}>
      {trongTram ? (
        <>
          <div className="flex items-center gap-1">
            <span className="font-mono text-tag font-semibold">{cd.ma}</span>
            {cd.laCongDoanHoanThanh && <span className="text-tag font-semibold text-closed-ink">★</span>}
            {cd.smv != null && <span className="ml-auto text-tag opacity-70 num">{cd.smv}s</span>}
          </div>
          <div className="font-medium truncate leading-4">{cd.ten}</div>
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onGo?.(); }} aria-label={`Gỡ ${cd.ma} khỏi trạm ${soTram}`}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 grid place-items-center rounded-full bg-surface border border-line-strong text-muted hover:text-ink opacity-0 group-hover/op:opacity-100 focus:opacity-100 shadow-pop"><X className="w-3 h-3" /></button>
        </>
      ) : (
        <>
          <GripVertical className="w-3.5 h-3.5 opacity-50" />
          <span className="font-mono text-tag font-semibold">{cd.ma}</span>
          <span className="truncate font-medium">{cd.ten}</span>
          <span className="ml-auto text-tag opacity-70 num whitespace-nowrap">{daGan ? '✓ ' : ''}{cd.smv != null ? `${cd.smv}s` : ''}</span>
        </>
      )}
    </div>
  );
}

function ModalKetThuc({ sd, onClose, onXong }: { sd: SoDo; onClose: () => void; onXong: () => void }) {
  const toast = useToast();
  const [mhId, setMhId] = useState(sd.maHangDangChay[0]?.id ?? '');
  const mh = sd.maHangDangChay.find((m) => m.id === mhId);
  const kt = useMutation({
    mutationFn: () => api.goi('/so-do/ket-thuc-ma-hang', { method: 'POST', body: { chuyenId: sd.chuyenId, maHangId: mhId, versionSoDo: sd.versionSoDo }, schema: z.object({ go: z.number(), versionSoDo: z.number() }) }),
    onSuccess: (kq) => { toast(`Đã kết thúc ${mh?.ma} trên ${sd.maChuyen} · gỡ ${kq.go} công đoạn`); onXong(); onClose(); },
    onError: (e) => toast(e.message, 'warn'),
  });
  return (
    <Modal open onClose={onClose} title="Kết thúc mã hàng?"
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" busy={kt.isPending} disabled={!mh} onClick={() => kt.mutate()}>Kết thúc {mh?.ma}</Button></>}>
      {sd.maHangDangChay.length > 1 && (
        <Select label="Mã hàng" value={mhId} onChange={(e) => setMhId(e.target.value)} className="w-full mb-3">
          {sd.maHangDangChay.map((m) => <option key={m.id} value={m.id}>{m.ma} · {m.ten}</option>)}
        </Select>
      )}
      <p className="text-body text-muted">Gỡ toàn bộ công đoạn của mã <b className="text-ink">{mh?.ma}</b> khỏi các trạm {sd.maChuyen}. Sản lượng đã nhập và sơ đồ các ngày trước <b className="text-ink">không bị ảnh hưởng</b>; công nhân vẫn nhập được số cuối ngày hôm nay.</p>
    </Modal>
  );
}

function ModalSaoChep({ sd, dsMh, dsChuyen, maHang, onClose, onApDung }: {
  sd: SoDo; dsMh: { id: string; ma: string }[]; dsChuyen: z.infer<typeof zChuyen>[]; maHang: z.infer<typeof zMaHang>[];
  onClose: () => void; onApDung: (gan: z.infer<typeof zDeXuatSaoChep>['gan'], boQua: number) => void;
}) {
  const toast = useToast();
  // Nguồn: chuyền khác (trong phạm vi) đang chạy CÙNG mã hàng → giữ bố cục + công đoạn
  const nguon = maHang.flatMap((m) => m.dangChayTren.filter((ma) => ma !== sd.maChuyen).map((ma) => ({ maHang: m, chuyen: dsChuyen.find((c) => c.ma === ma) })))
    .filter((x): x is { maHang: typeof x.maHang; chuyen: NonNullable<typeof x.chuyen> } => !!x.chuyen);
  const [chon, setChon] = useState(0);
  const sao = useMutation({
    mutationFn: () => {
      const n = nguon[chon]!;
      return api.goi('/so-do/sao-chep', { method: 'POST', body: { chuyenDichId: sd.chuyenId, chuyenNguonId: n.chuyen.id, maHangId: n.maHang.id }, schema: zDeXuatSaoChep });
    },
    onSuccess: (dx) => { onApDung(dx.gan, dx.boQuaNgung); onClose(); },
    onError: (e) => toast(e.message, 'warn'),
  });
  const vuotMh = nguon[chon] && !dsMh.some((m) => m.id === nguon[chon]!.maHang.id) && dsMh.length >= SO_MA_HANG_TOI_DA;
  return (
    <Modal open onClose={onClose} title="Sao chép sơ đồ"
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" busy={sao.isPending} disabled={!nguon.length || vuotMh} onClick={() => sao.mutate()}>Sao chép</Button></>}>
      <div className="flex flex-col gap-3">
        {nguon.length ? (
          <Select label="Nguồn" value={chon} onChange={(e) => setChon(Number(e.target.value))} className="w-full">
            {nguon.map((n, i) => <option key={`${n.chuyen.id}|${n.maHang.id}`} value={i}>{n.chuyen.ma} · {n.maHang.ma} (cùng mã hàng — giữ bố cục + công đoạn)</option>)}
          </Select>
        ) : <p className="text-chip text-muted">Chưa có chuyền nào khác (trong phạm vi của bạn) đang chạy mã hàng để sao chép.</p>}
        {vuotMh && <p className="text-sub text-danger">Chuyền đã có {SO_MA_HANG_TOI_DA} mã hàng — kết thúc mã hàng cũ trước.</p>}
        <p className="text-sub text-muted">Công đoạn được thêm vào đúng số trạm như chuyền nguồn (chưa lưu — kiểm tra rồi bấm Lưu). Công đoạn đã Ngưng sẽ bị bỏ qua và báo số lượng.</p>
      </div>
    </Modal>
  );
}
