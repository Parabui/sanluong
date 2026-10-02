# Tài liệu dự án
Các tài liệu nằm trong repo — đọc khi cần, không phải mỗi lần:
- PRD (yêu cầu sản phẩm): docs/PRD.md
- TDD (thiết kế kỹ thuật): docs/TDD.md
- UI Demo (prototype thiết kế sẵn): ui-demo/
- Diagram (draw.io): diagrams/

# Nguyên tắc khi implement
- Trước khi code một User Story: đọc story đó trong PRD và phần kỹ thuật liên quan trong TDD
- Implement đầy đủ theo từng tiêu chí "Done khi" trong story
- Tham chiếu TDD cho mọi quyết định kỹ thuật: tech stack, DB schema, API design
- Đọc UI trong ui-demo/ trước khi viết layout — không tự sáng tạo layout mới
- Hỏi trước khi làm nếu có gì chưa rõ trong PRD hoặc TDD

# Quy tắc bắt buộc (TDD Phụ lục C)
1. Schema/validation chỉ viết trong packages/shared (Zod). Không viết lại ở api hay frontend.
2. Ngày làm việc là chuỗi 'YYYY-MM-DD'. KHÔNG dùng new Date()/Date.now() trong apps/api/src/modules — dùng ClockService.
   KHÔNG dùng toISOString().slice(0,10). Frontend không tự tính "hôm nay".
3. Mọi route API phải có @Quyen(ChucNang.X) hoặc @CongKhai() (hoặc @DaDangNhap() cho route chỉ cần phiên Web:
   /auth/toi, đổi mật khẩu, đăng xuất). Mọi hàm repository/báo cáo nhận PhamVi.
   Route mới phải thêm vào apps/api/test/quyen/ma-tran.data.ts (test ma trận quyền sẽ đỏ nếu thiếu).
4. Mọi thao tác ghi sản lượng đi qua GhiSanLuongService. Không ghi bảng san_luong ở chỗ khác.
5. Công thức (phút SMV, giờ làm hiệu lực, % hiệu suất NV và chuyền) chỉ lấy từ view v_san_luong_chi_tiet / v_nv_ngay / v_nv_chuyen_ngay.
6. Thao tác ghi phải ghi audit trong cùng transaction (audit.ghi(tx, …)).
7. SQL tay: chỉ dùng tagged template có tham số. Không nối chuỗi.
8. Migration chỉ THÊM. Xóa/đổi tên cột phải qua 2 lần deploy.
9. Test nghiệp vụ dùng PostgreSQL thật (Testcontainers), không mock Prisma. Tên test bắt đầu bằng mã [R x.y] nếu có.
10. apps/worker không import recharts, @dnd-kit, @tanstack/react-table.
11. Thứ tự lấy khóa: advisory (CN, chuyền, ngày) → advisory (MH, mã hàng, tháng) theo thứ tự tăng dần → khóa dòng.
    Lưu/Sửa/Nhập hộ dùng khóa CHIA SẺ; chỉ Chốt ngày, Khóa tháng, Đổi SMV dùng ĐỘC QUYỀN. Xem ma trận TDD 8.9.
12. Chuyền của bản ghi = san_luong.chuyen_tram_snapshot. Chuyền gốc NV ngày D = chuyen_goc_ngay(nv, d).
    KHÔNG join tram → chuyen hay đọc nhan_vien.chuyen_id để lấy giá trị của ngày cũ.
13. Không UPDATE tram.chuyen_id; không sửa chuyen_tram_snapshot / smv_snapshot trong nhánh ON CONFLICT DO UPDATE.
14. Chỉ so thu_tu_thiet_bi khi cùng thiet_bi_id. Kiểm tra requestId nằm TRONG transaction.

# Ranh giới
- Chỉ sửa trong thư mục được yêu cầu (vd. "chỉ sửa apps/web").
- Thông báo lỗi cho người dùng: tiếng Việt, lấy từ packages/shared/src/loi.ts.
- Tên nghiệp vụ theo PRD mục ⑩ (tiếng Việt không dấu, camelCase).

# Lệnh
pnpm dev · pnpm test · pnpm test:int · pnpm lint · pnpm typecheck · pnpm e2e (Playwright — chưa thiết lập, tuần 12)
