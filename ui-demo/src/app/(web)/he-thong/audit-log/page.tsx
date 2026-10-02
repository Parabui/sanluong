"use client";

import { Download, Lock, ScrollText } from "lucide-react";
import { useState } from "react";
import { StatusBar } from "@/components/shell/app-shell";
import { useShell } from "@/components/shell/shell-context";
import { DataTable, TableFooter, type Col } from "@/components/ui/data-table";
import { Button, Drawer, Page, Pill, Select, Toolbar, type Tone } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

type Log = { t: string; who: string; act: string; obj: string; id: string; old?: object; nw?: object; reason?: string; ip: string };
const LOGS: Log[] = [
  { t: "09:14:52 29/09", who: "admin.quan", act: "PHAN_QUYEN", obj: "QuyenVaiTro", id: "TT × Báo cáo", old: { batTat: false }, nw: { batTat: true }, ip: "10.0.4.12" },
  { t: "09:04:10 29/09", who: "NV00127", act: "TAO", obj: "SanLuong", id: "29/09 · T27 · CD-07", nw: { soLuong: 101, nguon: "APP" }, ip: "113.161.x.x" },
  { t: "08:07:33 29/09", who: "tt.binh", act: "SUA", obj: "SanLuong", id: "28/09 · T32 · CD-15", old: { soLuong: 460 }, nw: { soLuong: 430, nguon: "SUA_WEB" }, reason: "Đếm lại bó hàng", ip: "10.0.4.31" },
  { t: "08:05:02 29/09", who: "tt.binh", act: "NHAP_HO", obj: "SanLuong", id: "28/09 · T29 · CD-12", nw: { soLuong: 610, nhanVien: "NV01022" }, reason: "Không mang điện thoại", ip: "10.0.4.31" },
  { t: "07:21:40 29/09", who: "tt.binh", act: "DANG_XUAT_HO", obj: "PhienTram", id: "C05 · Trạm 34", old: { nhanVien: "NV00848" }, reason: "Đăng nhập nhầm trạm", ip: "10.0.4.31" },
  { t: "10:20:15 27/09", who: "hr.my", act: "MO_KHOA", obj: "KhoaThang", id: "PL-2588 × 2026-09", old: { trangThai: "KHOA" }, nw: { trangThai: "MO" }, reason: "Sửa số C03 ngày 19/09", ip: "10.0.4.8" },
  { t: "08:10:04 28/09", who: "tt.binh", act: "CHOT", obj: "ChotNgay", id: "C05 · 26/09", nw: { chotBoi: "tt.binh" }, ip: "10.0.4.31" },
  { t: "14:10:22 21/09", who: "ie.ha", act: "SUA", obj: "SmvLichSu", id: "PL-2641 · CD-06", old: { smv: 55 }, nw: { smv: 52, apDungTuNgay: "2026-09-22" }, ip: "10.0.4.20" },
];
const TONE: Record<string, Tone> = { SUA: "adjust", NHAP_HO: "adjust", TAO: "neutral", CHOT: "closed", MO_KHOA: "warn", PHAN_QUYEN: "brand", DANG_XUAT_HO: "danger" };

export default function AuditPage() {
  const toast = useToast();
  const { q } = useShell();
  const [sel, setSel] = useState<Log | null>(null);
  const s = q.trim().toLowerCase();
  const rows = LOGS.filter((l) => !s || `${l.who} ${l.obj} ${l.id} ${l.act}`.toLowerCase().includes(s));

  const cols: Col<Log>[] = [
    { key: "t", label: "Thời điểm", width: 150, render: (l) => <span className="num text-muted">{l.t}</span> },
    { key: "w", label: "Người thực hiện", width: 140, render: (l) => <span className="font-mono text-[13px]">{l.who}</span> },
    { key: "a", label: "Hành động", width: 150, render: (l) => <Pill size="sm" tone={TONE[l.act]}>{l.act}</Pill> },
    { key: "o", label: "Đối tượng", render: (l) => <span><span className="text-muted">{l.obj}</span> · {l.id}</span> },
    { key: "r", label: "Lý do", width: 200, render: (l) => <span className="text-muted truncate block">{l.reason ?? "—"}</span> },
    { key: "ip", label: "IP", width: 110, render: (l) => <span className="font-mono text-tag text-muted">{l.ip}</span> },
  ];

  return (
    <>
      <Page>
        <Toolbar title="Audit log" right={<Button icon={Download} onClick={() => toast("Đang xuất Excel…", "info")}>Xuất Excel</Button>}>
          <Select label="Khoảng thời gian" className="w-40"><option>7 ngày gần nhất</option><option>30 ngày</option></Select>
          <Select label="Hành động" className="w-40"><option>Mọi hành động</option>{Object.keys(TONE).map((a) => <option key={a}>{a}</option>)}</Select>
        </Toolbar>
        <DataTable cols={cols} rows={rows} rowKey={(l) => l.t + l.id} onRowClick={setSel} emptyIcon={ScrollText}
          footer={<TableFooter><Lock className="w-3.5 h-3.5" />Chỉ-thêm (append-only) · không ai sửa / xóa được, kể cả Superadmin<span className="ml-auto">Bấm dòng để xem dữ liệu cũ / mới</span></TableFooter>} />
      </Page>
      <StatusBar right={<span>Lưu trữ 3 năm</span>} />

      <Drawer open={!!sel} onClose={() => setSel(null)} title="Chi tiết thao tác">
        {sel && (
          <div className="flex flex-col gap-4 text-chip">
            <dl className="grid grid-cols-[110px_1fr] gap-y-2">
              <dt className="text-muted">Thời điểm</dt><dd className="num">{sel.t}</dd>
              <dt className="text-muted">Người</dt><dd className="font-mono">{sel.who}</dd>
              <dt className="text-muted">Hành động</dt><dd><Pill size="sm" tone={TONE[sel.act]}>{sel.act}</Pill></dd>
              <dt className="text-muted">Đối tượng</dt><dd>{sel.obj} · {sel.id}</dd>
              {sel.reason && (<><dt className="text-muted">Lý do</dt><dd>{sel.reason}</dd></>)}
              <dt className="text-muted">IP</dt><dd className="font-mono">{sel.ip}</dd>
            </dl>
            {(["old", "nw"] as const).map((k) => sel[k] && (
              <div key={k}>
                <div className="text-sub font-semibold text-muted uppercase tracking-[0.04em] mb-1">{k === "old" ? "Dữ liệu cũ" : "Dữ liệu mới"}</div>
                <pre className={`rounded-ctl border px-3 py-2 font-mono text-[12px] whitespace-pre-wrap ${k === "old" ? "bg-danger-bg border-danger/20" : "bg-closed-bg border-closed-ink/20"}`}>{JSON.stringify(sel[k], null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </>
  );
}
