/**
 * Cập nhật PWA [TDD 14.2]: `registerType: 'prompt'` — KHÔNG BAO GIỜ tự tải lại khi form còn số chưa lưu.
 * Chỉ áp dụng bản mới khi vừa mở app hoặc ngay sau khi Lưu thành công.
 */
import { registerSW } from 'virtual:pwa-register';

const LUC_MO = performance.now();
const CUA_SO_MO_APP_MS = 5_000;
let coBanMoi = false;
let capNhat: ((reload?: boolean) => Promise<void>) | undefined;

export function dangKyPwa(): void {
  capNhat = registerSW({
    onNeedRefresh() {
      // Vừa mở app (chưa kịp nhập gì) → áp dụng luôn; còn lại chờ lần Lưu thành công kế tiếp
      if (performance.now() - LUC_MO < CUA_SO_MO_APP_MS) void capNhat?.(true);
      else coBanMoi = true;
    },
  });
}

export const dangCoBanMoi = () => coBanMoi;
export function capNhatBanMoi(): void {
  coBanMoi = false;
  void capNhat?.(true);
}
