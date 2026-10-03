/** Đăng nhập Web — giao diện ui-demo/(auth)/dang-nhap · F8 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type DangNhap, zDangNhap, zTaiKhoanToi } from '@vsn/shared';
import { cn } from '@vsn/ui';
import { CircleAlert, Eye, EyeOff, LogIn, Smartphone, Tv } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, KHOA_TOI } from '../../lib/api';
import { AuthFrame, LOGO_NHO } from './auth-frame';

/** Chỉ cho quay lại đường dẫn nội bộ (chống open redirect) */
const quayLaiAnToan = (v: string | null) => (v && v.startsWith('/') && !v.startsWith('//') ? v : '/trang-chu');

export function DangNhapPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const [show, setShow] = useState(false);
  const form = useForm<DangNhap>({ resolver: zodResolver(zDangNhap), defaultValues: { tenDangNhap: '', matKhau: '' } });

  const dangNhap = useMutation({
    mutationFn: (dto: DangNhap) => api.goi('/auth/dang-nhap', { method: 'POST', body: dto, schema: zTaiKhoanToi }),
    onSuccess: (tk) => {
      queryClient.setQueryData(KHOA_TOI, tk);
      void navigate(tk.phaiDoiMatKhau ? '/doi-mat-khau' : quayLaiAnToan(params.get('quayLai')), { replace: true });
    },
  });

  const { errors } = form.formState;
  const err = errors.tenDangNhap?.message ?? errors.matKhau?.message ?? (dangNhap.error?.message || '');
  const biKhoa = dangNhap.error && 'code' in dangNhap.error && dangNhap.error.code === 'QUA_SO_LAN_SAI';
  const input = 'w-full h-11 px-3 rounded-ctl border bg-surface text-body outline-none focus:border-brand-ink transition-colors duration-fast';

  return (
    <AuthFrame>
      <img src={LOGO_NHO} alt="VIETSUN" width={140} height={57} className="lg:hidden mb-8" />
      <h2 className="text-[24px] leading-8 font-semibold">Đăng nhập</h2>
      <p className="text-body text-muted mt-1">Dành cho tổ trưởng, quản lý, IE, HR, kế hoạch, BGĐ.</p>

      <form onSubmit={form.handleSubmit((d) => dangNhap.mutate(d))} className="mt-6 flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor="u" className="block text-chip font-medium mb-1">Tên đăng nhập</label>
          <input id="u" autoComplete="username" autoFocus {...form.register('tenDangNhap', { onChange: () => dangNhap.reset() })}
            aria-invalid={!!errors.tenDangNhap}
            className={cn(input, errors.tenDangNhap ? 'border-danger' : 'border-line-strong')} />
        </div>
        <div>
          <label htmlFor="p" className="block text-chip font-medium mb-1">Mật khẩu</label>
          <div className="relative">
            <input id="p" type={show ? 'text' : 'password'} autoComplete="current-password"
              {...form.register('matKhau', { onChange: () => dangNhap.reset() })}
              aria-invalid={!!err} aria-describedby={err ? 'login-err' : undefined}
              className={cn('w-full h-11 pl-3 pr-11 rounded-ctl border bg-surface text-body outline-none focus:border-brand-ink transition-colors duration-fast', err ? 'border-danger' : 'border-line-strong')} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="absolute right-1 top-1 w-9 h-9 grid place-items-center rounded-ctl text-muted hover:bg-hover">{show ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}</button>
          </div>
          {err && <p id="login-err" className="text-sub text-danger mt-1.5 flex items-center gap-1" role="alert"><CircleAlert className="w-3.5 h-3.5" />{err}</p>}
        </div>
        <button type="submit" disabled={dangNhap.isPending || !!biKhoa}
          className="h-11 rounded-ctl bg-brand hover:bg-brand-hover text-ink text-body font-semibold flex items-center justify-center gap-2 transition-colors duration-fast disabled:bg-disabled-bg disabled:text-disabled-ink disabled:cursor-not-allowed">
          {dangNhap.isPending ? <span className="spin w-4 h-4 rounded-full border-2 border-current border-t-transparent" /> : <LogIn className="w-[18px] h-[18px]" />}
          {dangNhap.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
        <p className="text-sub text-muted">Quên mật khẩu? Liên hệ Superadmin để đặt lại. Lần đầu đăng nhập, bạn sẽ được yêu cầu đổi mật khẩu tạm.</p>
      </form>

      <div className="mt-8 pt-6 border-t border-line">
        <p className="text-sub text-muted mb-2">Không phải tài khoản Web?</p>
        <div className="grid grid-cols-2 gap-2">
          <a href="/" className="h-10 rounded-ctl border border-line-strong bg-surface hover:bg-hover text-chip font-medium flex items-center justify-center gap-2 transition-colors duration-fast"><Smartphone className="w-4 h-4" />App công nhân</a>
          <Link to="/tv" className="h-10 rounded-ctl border border-line-strong bg-surface hover:bg-hover text-chip font-medium flex items-center justify-center gap-2 transition-colors duration-fast"><Tv className="w-4 h-4" />Chế độ TV</Link>
        </div>
      </div>
    </AuthFrame>
  );
}
