"use client";

import { KeyRound, MoreHorizontal, Pause, Pencil, Plus, ShieldCheck, Tv, UserCog } from "lucide-react";
import { useState } from "react";
import { StatusBar } from "@/components/shell/app-shell";
import { useShell } from "@/components/shell/shell-context";
import { DataTable, type Col } from "@/components/ui/data-table";
import { Button, Drawer, Field, Input, Menu, MenuItem, Page, Pill, Select, Tabs, Toolbar } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ROLES, type Role } from "@/lib/nav";
import { cn } from "@/lib/utils";

type Acc = { user: string; name: string; role: Role | "TV"; scope: string; last: string; active: boolean };
const ACCS: Acc[] = [
  { user: "admin.quan", name: "Lê Minh Quân", role: "SA", scope: "Toàn nhà máy", last: "09:14 29/09", active: true },
  { user: "tt.binh", name: "Nguyễn Văn Bình", role: "TT", scope: "C05, C06", last: "08:05 29/09", active: true },
  { user: "tp.thanh", name: "Võ Thị Thanh", role: "TT", scope: "C05", last: "17:40 28/09", active: true },
  { user: "tt.hung", name: "Mạc Văn Hưng", role: "TT", scope: "C01, C02", last: "07:58 29/09", active: true },
  { user: "qlx.thang", name: "Hoàng Văn Thắng", role: "QLX", scope: "Xưởng May 1", last: "08:30 29/09", active: true },
  { user: "ie.ha", name: "Phùng Thị Hà", role: "IE", scope: "Toàn nhà máy", last: "16:22 28/09", active: true },
  { user: "hr.my", name: "Dương Thị Mỹ", role: "HR", scope: "Toàn nhà máy", last: "09:01 29/09", active: true },
  { user: "kh.khoa", name: "Tô Văn Khoa", role: "KH", scope: "Toàn nhà máy", last: "15:10 27/09", active: true },
  { user: "bgd.vinh", name: "Lưu Quang Vinh", role: "BGD", scope: "Toàn nhà máy", last: "07:30 29/09", active: true },
  { user: "tv.xuong1", name: "TV Xưởng May 1", role: "TV", scope: "Toàn nhà máy", last: "05:00 29/09", active: true },
  { user: "tt.lan", name: "Kha Thị Lan", role: "TT", scope: "C09", last: "11:02 02/09", active: false },
];

const FUNCS = [
  "Tài khoản & phân quyền (F8)", "Xưởng / chuyền / trạm (F9)", "Nhân viên (F2)", "Mã hàng / công đoạn (F3)", "Gán công đoạn (F4)",
  "Giờ mặc định (F6)", "Duyệt / sửa giờ (F6)", "Bảng sản lượng ngày: sửa, nhập hộ", "Chốt ngày (F10)", "Khóa / mở khóa (F10)",
  "Báo cáo (F5)", "Dashboard (F7)", "Kế hoạch (F16)", "Xuất dữ liệu lương (F15)", "Cài đặt hệ thống",
];
const COLS: (Role | "TV")[] = ["SA", "QLX", "TT", "IE", "HR", "KH", "BGD", "TV"];
// ma trận mặc định theo PRD F8 (chuỗi 8 ký tự theo COLS; 1 = bật)
const DEFAULT = ["10000000", "10000000", "10001000", "10010000", "10110000", "11000000", "10100000", "10100000", "10100000", "10001000", "11111000", "11100011", "10000100", "10001000", "10000000"];
const NOTE: Record<string, string> = { "4-2": "Chuyền gắn", "5-1": "Xưởng gắn", "6-2": "NV chuyền gốc", "7-2": "Chuyền gắn", "8-2": "Chuyền gắn", "10-1": "Xưởng gắn", "10-2": "Chuyền gắn", "11-1": "Xưởng gắn", "11-2": "Chuyền gắn" };
const roleLabel = (r: Role | "TV") => (r === "TV" ? "TV" : ROLES[r].label);

export default function AccountsPage() {
  const toast = useToast();
  const { q } = useShell();
  const [tab, setTab] = useState<"acc" | "perm">("acc");
  const [m, setM] = useState(() => DEFAULT.map((r) => r.split("").map((c) => c === "1")));
  const [edit, setEdit] = useState<Acc | "new" | null>(null);
  const [role, setRole] = useState<Role | "TV">("TT");
  const s = q.trim().toLowerCase();
  const rows = ACCS.filter((a) => !s || `${a.user} ${a.name}`.toLowerCase().includes(s));

  const cols: Col<Acc>[] = [
    { key: "u", label: "Tài khoản", width: 240, render: (a) => (<div className="flex items-center gap-2.5">
      <span className={cn("w-8 h-8 rounded-full grid place-items-center text-chip font-semibold", a.role === "TV" ? "bg-group text-ink" : "bg-brand-soft text-brand-ink")}>{a.role === "TV" ? <Tv className="w-4 h-4" /> : a.name.split(" ").slice(-1)[0][0]}</span>
      <div><div className={cn("font-medium", !a.active && "text-muted")}>{a.name}</div><div className="text-sub text-muted font-mono">{a.user}</div></div></div>) },
    { key: "r", label: "Vai trò", width: 150, render: (a) => <Pill tone={a.role === "SA" ? "brand" : "neutral"}>{roleLabel(a.role)}</Pill> },
    { key: "s", label: "Phạm vi", render: (a) => <span className={cn(a.scope === "Toàn nhà máy" && "text-muted")}>{a.scope}</span> },
    { key: "l", label: "Đăng nhập gần nhất", width: 170, render: (a) => <span className="num text-muted">{a.last}</span> },
    { key: "st", label: "Trạng thái", width: 130, render: (a) => a.active ? <Pill tone="closed">Hoạt động</Pill> : <Pill tone="locked">Vô hiệu hóa</Pill> },
    { key: "a", label: <span className="sr-only">Thao tác</span>, width: 60, align: "center", render: (a) => (
      <Menu width="w-56" trigger={(o, t) => <button onClick={t} aria-expanded={o} aria-label={`Thao tác ${a.user}`} className="w-8 h-8 grid place-items-center rounded-ctl text-muted hover:bg-group hover:text-ink mx-auto"><MoreHorizontal className="w-4 h-4" /></button>}>
        {(close) => (<>
          <MenuItem icon={Pencil} onClick={() => { close(); setEdit(a); setRole(a.role); }}>Sửa vai trò & phạm vi</MenuItem>
          <MenuItem icon={KeyRound} onClick={() => { close(); toast(`Đã đặt lại mật khẩu ${a.user} · phải đổi ở lần đăng nhập sau`); }}>Đặt lại mật khẩu</MenuItem>
          {a.role === "TV" && <MenuItem icon={Tv} onClick={() => { close(); toast("Đã thu hồi phiên TV · bắt buộc đăng nhập lại"); }}>Thu hồi phiên TV</MenuItem>}
          {a.role !== "SA" && <MenuItem icon={Pause} danger onClick={() => { close(); toast(`Đã vô hiệu hóa ${a.user}`); }}>Vô hiệu hóa</MenuItem>}
        </>)}
      </Menu>) },
  ];

  return (
    <>
      <Page>
        <Toolbar title="Tài khoản & phân quyền" right={tab === "acc" ? <Button variant="primary" icon={Plus} onClick={() => { setEdit("new"); setRole("TT"); }}>Thêm tài khoản</Button>
          : <Button variant="primary" icon={ShieldCheck} onClick={() => toast("Đã lưu ma trận quyền · ghi lịch sử")}>Lưu thay đổi</Button>} />
        <section className="bg-surface border border-line rounded-card flex-1 min-h-0 flex flex-col overflow-hidden">
          <Tabs value={tab} onChange={setTab} options={[{ value: "acc", label: "Tài khoản", count: ACCS.length }, { value: "perm", label: "Phân quyền theo vai trò" }]} />
          {tab === "acc" ? <DataTable cols={cols} rows={rows} rowKey={(a) => a.user} className="border-0 rounded-none" /> : (
            <div className="flex-1 min-h-0 overflow-auto scroll-area">
              <table className="grid-table hoverable text-body">
                <colgroup><col style={{ width: 300 }} />{COLS.map((c) => <col key={c} />)}</colgroup>
                <thead><tr className="text-th font-semibold uppercase tracking-[0.02em] text-muted"><th className="px-4 text-left">Chức năng</th>{COLS.map((c) => <th key={c} className="px-2 text-center">{roleLabel(c)}</th>)}</tr></thead>
                <tbody>{FUNCS.map((f, i) => (
                  <tr key={f}>
                    <td className="px-4 font-medium">{f}</td>
                    {COLS.map((c, j) => {
                      const on = m[i][j], locked = i === 0 && j === 0;
                      return (
                        <td key={c} className="px-2 text-center">
                          <button role="switch" aria-checked={on} aria-label={`${f} — ${roleLabel(c)}`} disabled={locked}
                            data-tip={locked ? "Quyền quản lý tài khoản của Superadmin không tắt được" : NOTE[`${i}-${j}`]}
                            onClick={() => setM(m.map((r, ri) => (ri === i ? r.map((v, ci) => (ci === j ? !v : v)) : r)))}
                            className="inline-flex flex-col items-center gap-0.5 disabled:opacity-60 disabled:cursor-not-allowed">
                            <span className="switch" aria-hidden="true" />
                            {on && NOTE[`${i}-${j}`] && <span className="text-tag text-muted whitespace-nowrap">{NOTE[`${i}-${j}`]}</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>))}</tbody>
              </table>
            </div>
          )}
        </section>
      </Page>
      <StatusBar right={<span>Luôn còn ít nhất 1 Superadmin</span>}>
        <span className="flex items-center gap-1.5"><UserCog className="w-3.5 h-3.5" />Vai trò = làm chức năng gì · Phạm vi (chuyền / xưởng) = thấy dữ liệu nào</span>
      </StatusBar>

      <Drawer open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "Thêm tài khoản" : "Sửa tài khoản"}
        footer={<><Button onClick={() => setEdit(null)}>Hủy</Button><Button variant="primary" onClick={() => { setEdit(null); toast(edit === "new" ? "Đã tạo tài khoản · bắt buộc đổi mật khẩu lần đầu" : "Đã lưu · có hiệu lực ngay"); }}>Lưu</Button></>}>
        {edit && (
          <div className="flex flex-col gap-4">
            <Field label="Tên đăng nhập" required><Input defaultValue={edit === "new" ? "" : edit.user} disabled={edit !== "new"} className="w-full font-mono disabled:bg-disabled-bg" /></Field>
            <Field label="Họ tên" required><Input defaultValue={edit === "new" ? "" : edit.name} className="w-full" /></Field>
            {edit === "new" && <Field label="Mật khẩu tạm" required hint="Người dùng phải đổi ở lần đăng nhập đầu"><Input type="password" autoComplete="new-password" className="w-full" /></Field>}
            <Field label="Vai trò" required>
              <Select label="Vai trò" value={role} onChange={(e) => setRole(e.target.value as Role | "TV")} className="w-full">{COLS.map((c) => <option key={c} value={c}>{roleLabel(c)}</option>)}</Select>
            </Field>
            {(role === "TT" || role === "QLX") && (
              <Field label={role === "TT" ? "Chuyền phụ trách" : "Xưởng phụ trách"} required hint={role === "TT" ? "Phải gắn ít nhất 1 chuyền" : "Phải gắn ít nhất 1 xưởng"}>
                <div className="flex flex-wrap gap-1.5">
                  {(role === "TT" ? ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08"] : ["Xưởng May 1"]).map((c) => (
                    <label key={c} className="chip-radio"><input type="checkbox" className="sr-only" defaultChecked={edit !== "new" && edit.scope.includes(c)} />
                      <span className="inline-flex items-center h-8 px-3 rounded-pill border border-line-strong bg-surface text-chip font-medium hover:bg-hover transition-colors duration-fast">{c}</span></label>
                  ))}
                </div>
              </Field>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
