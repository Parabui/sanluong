/**
 * Cloudflare Turnstile chế độ ẩn cho đăng nhập trạm [D23]. Site key qua VITE_TURNSTILE_SITE_KEY;
 * không cấu hình (dev) → gửi token rỗng (server dev/test cũng bỏ qua khi không có secret).
 * Script nạp LƯỜI khi cần — không tính vào dung lượng tải lần đầu.
 */
interface TurnstileApi {
  render(el: HTMLElement, opt: Record<string, unknown>): string;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = import.meta.env['VITE_TURNSTILE_SITE_KEY'] as string | undefined;
let napScript: Promise<void> | undefined;

function nap(): Promise<void> {
  napScript ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { napScript = undefined; reject(new Error('Không tải được Turnstile')); };
    document.head.appendChild(s);
  });
  return napScript;
}

export async function layTokenTurnstile(): Promise<string> {
  if (!SITE_KEY) return '';
  await nap();
  return new Promise((resolve, reject) => {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.bottom = '0';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    const xong = (id: string) => { window.turnstile?.remove(id); el.remove(); };
    const id: string = window.turnstile!.render(el, {
      sitekey: SITE_KEY,
      callback: (token: string) => { resolve(token); xong(id); },
      'error-callback': () => { reject(new Error('Không xác minh được thiết bị')); xong(id); },
    });
  });
}
