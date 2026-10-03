/**
 * E2E Web quản lý [TDD 16.3]: Tổ trưởng sửa ô → nhập hộ → chốt · Đăng xuất hộ · IT/HR khóa sổ.
 * Chạy trên Chromium và WebKit 1366×768 — mỗi project 1 bộ dữ liệu (metadata.k, xem apps/api/src/seed/e2e.ts).
 * Mật khẩu là mật khẩu THỬ của DB E2E (seed), không phải tài khoản thật.
 */
import { expect, type Page, test } from '@playwright/test';

const MAT_KHAU = process.env['E2E_MAT_KHAU'] ?? 'E2eThu12345';

async function dangNhap(page: Page, ten: string) {
  await page.goto('/quanly/dang-nhap');
  await page.getByLabel('Tên đăng nhập').fill(ten);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(MAT_KHAU);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).not.toHaveURL(/dang-nhap/);
}

test.describe.serial('Tổ trưởng & IT/HR [F10] [F17] [F19]', () => {
  test('tổ trưởng: "Còn 1 ngày chưa chốt" → sửa ô (lý do) → nhập hộ ô vàng → chốt ngày (xác nhận còn ô chưa có số)', async ({ page }, info) => {
    const k = info.project.metadata['k'] as number;
    await dangNhap(page, `e2e.tt${k}`);
    // Trang chủ (F13) chưa làm → vào thẳng màn hình đầu tiên được xem, không rơi vào trang tạm
    await expect(page).toHaveURL(/\/quanly\/san-xuat\/bang-san-luong/);
    await expect(page.getByText('chưa implement')).toHaveCount(0);

    await page.getByRole('button', { name: 'Còn 1 ngày chưa chốt' }).click();
    await page.getByRole('menuitem', { name: new RegExp(`^EC${k}\\b`) }).click();
    await expect(page).toHaveURL(/san-xuat\/bang-san-luong/);
    await expect(page.getByText('2 ô chưa có số')).toBeVisible();

    // Sửa ô trạm 2: 120 → 130, bắt buộc lý do
    await page.getByRole('button', { name: 'Sửa số lượng 120' }).click();
    await page.locator('#qty-input').fill('130');
    await page.locator('#qty-input').press('Enter');
    await page.getByRole('dialog', { name: 'Lý do điều chỉnh' }).getByText('Đếm lại bó hàng', { exact: true }).click();
    await page.getByRole('dialog', { name: 'Lý do điều chỉnh' }).getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByRole('button', { name: 'Sửa số lượng 130' })).toBeVisible();
    await expect(page.getByText('1 ô đã điều chỉnh')).toBeVisible();

    // Nhập hộ ô vàng trạm 1 cho Nguyễn Thị Lan
    await page.getByRole('button', { name: 'Nhập hộ' }).first().click();
    const px = page.getByRole('dialog', { name: 'Nhập hộ' });
    await px.getByLabel(/Mã NV/).fill(`EN${k}01`);
    await px.getByRole('option', { name: new RegExp(`EN${k}01`) }).click();
    await px.getByLabel(/Số lượng/).fill('50');
    await px.getByText('Hết pin', { exact: true }).click();
    await px.getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByText('1 ô chưa có số')).toBeVisible();
    await expect(page.getByText('2 ô đã điều chỉnh')).toBeVisible();

    // Chốt ngày: còn 1 ô chưa có số → phải tích xác nhận
    await page.getByRole('button', { name: 'Chốt ngày' }).click();
    const modal = page.getByRole('dialog', { name: /Chốt ngày/ });
    await expect(modal.getByText(/Còn 1 ô chưa có số/)).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Vẫn chốt ngày' })).toBeDisabled();
    await modal.getByRole('checkbox').check();
    await modal.getByRole('button', { name: 'Vẫn chốt ngày' }).click();
    await expect(page.getByText(/Đã chốt ·/)).toBeVisible();
    await expect(page.getByRole('button', { name: /ngày chưa chốt/ })).toHaveCount(0);
  });

  test('tổ trưởng: đăng xuất hộ công nhân chưa có số (cảnh báo → vẫn đăng xuất) → trạm trống', async ({ page }, info) => {
    const k = info.project.metadata['k'] as number;
    await dangNhap(page, `e2e.tt${k}`);
    await page.goto('/quanly/san-xuat/so-do-tram');
    const tram3 = page.getByRole('button', { name: /Trạm 3.*Lê Thị Hoa/ });
    await expect(tram3).toBeVisible();
    await tram3.click();
    await page.getByText('Đăng nhập nhầm trạm', { exact: true }).click();
    await page.getByRole('button', { name: 'Đăng xuất hộ', exact: true }).click();
    // Server trả CAN_XAC_NHAN (NV chưa có số hôm nay) → hiện cảnh báo, nút đổi thành "Vẫn đăng xuất hộ"
    await page.getByRole('button', { name: 'Vẫn đăng xuất hộ' }).click();
    await expect(page.getByText('Đã đăng xuất Lê Thị Hoa khỏi Trạm 3')).toBeVisible();
    await expect(page.getByRole('button', { name: /Trạm 3.*Trống/ })).toBeVisible();
  });

  test('IT/HR: khóa sổ mã hàng × tháng đã chốt đủ', async ({ page }, info) => {
    const k = info.project.metadata['k'] as number;
    await dangNhap(page, `e2e.hr${k}`);
    await expect(page.getByText('chưa implement')).toHaveCount(0);
    await page.goto('/quanly/luong/khoa-so');
    await page.getByLabel('Tháng').selectOption('2025-06');
    const dong = page.getByRole('row').filter({ hasText: `EMH${k}B` });
    await expect(dong.getByText('Sẵn sàng khóa')).toBeVisible();
    await dong.getByRole('button', { name: 'Khóa' }).click();
    await expect(dong.getByText('Đã khóa')).toBeVisible();
    await expect(dong.getByRole('button', { name: 'Mở khóa' })).toBeVisible();
  });
});
