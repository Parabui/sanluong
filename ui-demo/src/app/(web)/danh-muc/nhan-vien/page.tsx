"use client";

import { CircleAlert, CircleCheck, Download, FileUp, MoreHorizontal, Pause, Pencil, Play, RefreshCw, Trash2, Upload, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { StatusBar } from "@/components/shell/app-shell";
import { useShell } from "@/components/shell/shell-context";
import { DataTable, TableFooter, type Col } from "@/components/ui/data-table";
import { Button, Drawer, Field, Input, Menu, MenuItem, Modal, Page, Pill, Segmented, Select, Toolbar } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { EMPLOYEES, type Employee } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

const HAS_OUTPUT = new Set(EMPLOYEES.map((e) => e.nv).filter((nv) => nv !== "NV00603"));

export default function EmployeesPage() {
  const toast = useToast();
  const { q, role } = useShell();
  const [list, setList] = useState<Employee[]>(EMPLOYEES);
  const [line, setLine] = useState("all");
  const [st, setSt] = useState<"all" | "on" | "off">("on");
  const [edit, setEdit] = useState<Employee | "new" | null>(null);
  const [imp, setImp] = useState<0 | 1 | 2>(0);

  const s = q.trim().toLowerCase();
  const rows = list.filter((e) => (line === "all" || e.chuyen === line) && (st === "all" || (st === "on" ? e.active : !e.active)) && (!s || `${e.nv} ${e.hoTen}`.toLowerCase().includes(s)));
  const toggle = (e: Employee) => { setList(list.map((x) => (x.nv === e.nv ? { ...x, active: !x.active } : x))); toast(e.active ? `Đã ngưng ${e.nv} · tự đăng xuất khỏi mọi trạm` : `Đã kích hoạt lại ${e.nv}`); };

  const cols: Col<Employee>[] = [
    { key: "nv", label: "Mã NV", width: 110, render: (e) => <span className="font-mono text-[13px]">{e.nv}</span> },
    { key: "ten", label: "Họ tên", render: (e) => <span className={cn("font-medium", !e.active && "text-muted")}>{e.hoTen}</span> },
    { key: "ch", label: "Chuyền / Nhóm", width: 150, render: (e) => <span>{e.chuyen} · Chuyền {Number(e.chuyen.slice(1))}</span> },
    { key: "bac", label: "Bậc tay nghề", width: 120, align: "center", render: (e) => <span className="num">{e.bac ?? "—"}</span> },
    { key: "st", label: "Trạng thái", width: 140, render: (e) => e.active ? <Pill tone="closed">Hoạt động</Pill> : <Pill tone="locked">Ngưng</Pill> },
    { key: "act", label: <span className="sr-only">Thao tác</span>, width: 64, align: "center", render: (e) => (
      <Menu width="w-52" trigger={(open, t) => <button onClick={(ev) => { ev.stopPropagation(); t(); }} aria-expanded={open} aria-label={`Thao tác ${e.nv}`} className="w-8 h-8 grid place-items-center rounded-ctl text-muted hover:bg-group hover:text-ink mx-auto"><MoreHorizontal className="w-4 h-4" /></button>}>
        {(close) => (<>
          <MenuItem icon={Pencil} onClick={() => { close(); setEdit(e); }}>Sửa thông tin</MenuItem>
          <MenuItem icon={e.active ? Pause : Play} onClick={() => { close(); toggle(e); }}>{e.active ? "Ngưng hoạt động" : "Kích hoạt lại"}</MenuItem>
          {role === "SA" && !HAS_OUTPUT.has(e.nv) && <MenuItem icon={Trash2} danger onClick={() => { close(); setList(list.filter((x) => x.nv !== e.nv)); toast(`Đã xóa hẳn ${e.nv}`); }}>Xóa hẳn</MenuItem>}
        </>)}
      </Menu>) },
  ];

  return (
    <>
      <Page>
        <Toolbar title="Nhân viên" right={<>
          <Button icon={UserPlus} onClick={() => setEdit("new")}>Thêm nhân viên</Button>
          <Button variant="primary" icon={Upload} onClick={() => setImp(1)}>Import Excel</Button>
        </>}>
          <Select label="Chuyền" value={line} onChange={(e) => setLine(e.target.value)} className="w-40">
            <option value="all">Tất cả chuyền</option>{["C03", "C05", "C06"].map((c) => <option key={c} value={c}>{c} · Chuyền {Number(c.slice(1))}</option>)}
          </Select>
          <Segmented label="Trạng thái" value={st} onChange={setSt} options={[{ value: "on", label: "Hoạt động" }, { value: "off", label: "Ngưng" }, { value: "all", label: "Tất cả" }]} />
        </Toolbar>
        <DataTable cols={cols} rows={rows} rowKey={(e) => e.nv} emptyIcon={Users} empty="Không tìm thấy nhân viên"
          footer={<TableFooter><span><b className="text-ink num">{rows.length}</b> nhân viên</span><span className="ml-auto">Mã NV lưu dạng text, tự trim + viết hoa · không bao giờ tái sử dụng</span></TableFooter>} />
      </Page>
      <StatusBar right={<span>Import lần cuối: 08:30 22/09/2026 · 548 dòng</span>}>
        <span>Xóa hẳn chỉ áp dụng cho NV chưa có sản lượng (Superadmin)</span>
      </StatusBar>

      <Drawer open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "Thêm nhân viên" : "Sửa nhân viên"}
        footer={<><Button onClick={() => setEdit(null)}>Hủy</Button><Button variant="primary" onClick={() => { setEdit(null); toast("Đã lưu nhân viên"); }}>Lưu</Button></>}>
        {edit && (
          <div className="flex flex-col gap-4">
            <Field label="Mã NV" required hint="Giữ nguyên số 0 đầu · tự viết hoa"><Input defaultValue={edit === "new" ? "" : edit.nv} disabled={edit !== "new"} placeholder="VD: NV01088" className="w-full font-mono uppercase disabled:bg-disabled-bg" /></Field>
            <Field label="Họ tên" required><Input defaultValue={edit === "new" ? "" : edit.hoTen} className="w-full" /></Field>
            <Field label="Chuyền / Nhóm" required hint="Đổi chuyền chỉ ảnh hưởng bản ghi sản lượng mới"><Select label="Chuyền" defaultValue={edit === "new" ? "C05" : edit.chuyen} className="w-full">{["C03", "C05", "C06"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Bậc tay nghề"><Input defaultValue={edit === "new" ? "" : edit.bac} className="w-full" /></Field>
          </div>
        )}
      </Drawer>

      <Modal open={imp > 0} onClose={() => setImp(0)} title="Import nhân viên từ Excel" width={560}
        footer={imp === 1 ? <><Button icon={Download} onClick={() => toast("Tải file mẫu (cột Mã NV định dạng Text)", "info")}>Tải file mẫu</Button><Button variant="primary" onClick={() => setImp(2)}>Kiểm tra file</Button></>
          : <><Button onClick={() => setImp(1)}>Chọn file khác</Button><Button variant="primary" onClick={() => { setImp(0); toast("Đã ghi 552 dòng · bỏ qua 3 dòng lỗi"); }}>Xác nhận</Button></>}>
        {imp === 1 ? (
          <label className="block rounded-card border-2 border-dashed border-line-strong hover:border-brand bg-thead hover:bg-brand-soft/40 transition-colors duration-fast p-8 text-center cursor-pointer">
            <FileUp className="w-8 h-8 mx-auto text-muted" />
            <p className="text-body font-medium mt-2">Kéo thả file .xlsx hoặc bấm để chọn</p>
            <p className="text-sub text-muted mt-1">Cột bắt buộc: Mã NV · Họ tên · Chuyền/Nhóm · (Bậc tay nghề)</p>
            <input type="file" accept=".xlsx" className="sr-only" onChange={() => setImp(2)} />
          </label>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-chip text-muted">DanhSachNV_HR_09-2026.xlsx · 555 dòng</p>
            <div className="grid grid-cols-3 gap-2">
              {([["Thêm mới", 14, "text-closed-ink", CircleCheck], ["Cập nhật", 538, "text-open-ink", RefreshCw], ["Lỗi", 3, "text-danger", CircleAlert]] as const).map(([l, n, c, I]) => (
                <div key={l} className="rounded-card border border-line p-3"><div className={cn("flex items-center gap-1.5 text-chip font-medium", c)}><I className="w-4 h-4" />{l}</div><div className="text-[22px] font-semibold mt-1">{n}</div></div>
              ))}
            </div>
            <ul className="rounded-card border border-line divide-y divide-line text-chip">
              <li className="px-3 py-2 flex gap-2"><span className="text-muted w-16">Dòng 88</span><span className="text-danger">Thiếu Chuyền/Nhóm</span></li>
              <li className="px-3 py-2 flex gap-2"><span className="text-muted w-16">Dòng 120, 341</span><span className="text-danger">Trùng mã NV01102 (sau chuẩn hóa)</span></li>
              <li className="px-3 py-2 flex gap-2 bg-empty-bg text-empty-ink"><span className="w-16">Dòng 205</span><span>Mã NV đang ở dạng số — kiểm tra số 0 đầu</span></li>
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}
