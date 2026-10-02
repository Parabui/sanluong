/**
 * E2E công nhân [TDD 16.3]: chọn trạm → đăng nhập mã NV → nhập → Lưu → "Của tôi".
 * Chạy trên iPhone (WebKit) và Android (Chromium) — mỗi project 1 bộ dữ liệu (metadata.k, xem apps/api/src/seed/e2e.ts).
 * Một test = một điện thoại (context Playwright mới = cookie thiết bị mới) nên cả luồng nằm trong 1 test.
 */
import { expect, test } from '@playwright/test';

test('công nhân: chọn trạm từ danh sách → đăng nhập → nhập tổng số → Lưu → số nhỏ hơn phải xác nhận → Của tôi', async ({ page }, info) => {
  const k = info.project.metadata['k'] as number;

  await test.step('mở app lần đầu → Chọn trạm → Trạm 1 của EC<k>', async () => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/chon-tram$/);
    await page.getByRole('button', { name: `EC${k}`, exact: true }).click();
    await page.getByRole('button', { name: /^Trạm 1(?!\d)/ }).click();
    await expect(page).toHaveURL(/\/dang-nhap\//);
    await expect(page.getByText('May cổ')).toBeVisible();
  });

  await test.step('đăng nhập mã NV (gõ chữ thường → tự viết hoa)', async () => {
    await page.getByLabel('Mã nhân viên').fill(`en${k}01`);
    await expect(page.getByLabel('Mã nhân viên')).toHaveValue(`EN${k}01`);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/nhap/);
    await expect(page.getByText('Nguyễn Thị Lan')).toBeVisible();
  });

  const o = page.getByLabel('Tổng số đã làm – May cổ');
  const luu = page.getByRole('button', { name: 'Lưu', exact: true });

  await test.step('nhập 85 → Lưu → tải lại vẫn là 85', async () => {
    await expect(page.getByText('Nhập TỔNG số đã làm từ đầu ngày')).toBeVisible();
    await expect(luu).toBeDisabled();
    await o.fill('85');
    await expect(page.getByText('công đoạn chưa lưu')).toBeVisible();
    await luu.click();
    await expect(page.getByText(/Đã lưu 1 công đoạn · Trạm 1/)).toBeVisible();
    await expect(page.getByText(/Đã lưu hết/)).toBeVisible();
    await page.reload();
    await expect(o).toHaveValue('85');
  });

  await test.step('số nhỏ hơn số đã lưu → hỏi lại; "Sửa lại" giữ số đang gõ, không gửi', async () => {
    await o.fill('80');
    await luu.click();
    await expect(page.getByText('Kiểm tra lại trước khi lưu')).toBeVisible();
    await page.getByRole('button', { name: 'Sửa lại' }).click();
    await expect(o).toHaveValue('80');
    await o.fill('85');
    await expect(luu).toBeDisabled();
  });

  await test.step('Của tôi → hôm nay 85 sp → chi tiết ngày', async () => {
    await page.getByRole('link', { name: 'Của tôi' }).click();
    await expect(page).toHaveURL(/\/cua-toi$/);
    await expect(page.getByText('Tổng sản lượng')).toBeVisible();
    const ngay = page.getByRole('link').filter({ hasText: 'Tạm tính' }).first();
    await expect(ngay).toContainText('85');
    await ngay.click();
    await expect(page.getByText(`Trạm 1 · EC${k}`)).toBeVisible();
    await expect(page.getByText('May cổ')).toBeVisible();
  });
});
