import type { ReactNode } from 'react';

const goc = import.meta.env.BASE_URL;

/** Khung màn Đăng nhập / Đổi mật khẩu: panel thương hiệu bên trái, form bên phải — chép từ ui-demo/(auth)/auth-frame.tsx */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_520px] bg-page">
      <section className="hidden lg:flex flex-col justify-between p-12 bg-surface border-r border-line relative overflow-hidden">
        <img src={`${goc}logo.png`} alt="VIETSUN — Warming Your Life" width={220} height={89} />
        <div className="relative z-10 max-w-md">
          <p className="text-chip font-semibold uppercase tracking-[0.08em] text-brand-ink">VSN Sản Lượng</p>
          <h1 className="text-[34px] leading-[44px] font-bold mt-2">Nhập nhanh – Đúng số – Đúng tiến độ</h1>
          <p className="text-body text-muted mt-3">Công nhân tự nhập sản lượng trên điện thoại; tổ trưởng rà soát, chốt ngày; HR dùng số liệu đã khóa để tính lương.</p>
          <ul className="mt-8 grid grid-cols-3 gap-3">
            {[['15', 'chuyền may'], ['270', 'trạm nhập qua app'], ['~500', 'công nhân']].map(([n, l]) => (
              <li key={l} className="rounded-card border border-line bg-page px-4 py-3">
                <div className="text-[22px] font-semibold">{n}</div><div className="text-sub text-muted">{l}</div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sub text-muted relative z-10">© VIETSUN Đồng Nai · v{__APP_VERSION__}</p>
        <img src={`${goc}logonho.png`} alt="" aria-hidden="true" width={420} height={420} className="absolute -right-24 -bottom-24 opacity-[0.07] pointer-events-none select-none" />
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="page-in w-full max-w-[400px]">{children}</div>
      </section>
    </div>
  );
}

export const LOGO_NHO = `${goc}logo.png`;
