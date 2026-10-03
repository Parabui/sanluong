/** Đổi mật khẩu — giao diện ui-demo/(auth)/doi-mat-khau · F8 (bắt buộc ở lần đăng nhập đầu / sau khi được đặt lại) */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type DoiMatKhau, LoiApi, QUY_TAC_MAT_KHAU, zDoiMatKhau, zKhongNoiDung, zTaiKhoanToi } from '@vsn/shared';
import { cn, useToast } from '@vsn/ui';
import { ArrowLeft, Check, KeyRound, LogOut, X } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { api, KHOA_TOI } from '../../lib/api';
import { useToi } from '../../lib/xac-thuc';
import { AuthFrame } from './auth-frame';

const zForm = zDoiMatKhau.and(z.object({ nhapLai: z.string() })).refine((d) => d.nhapLai === d.matKhauMoi, {
  path: ['nhapLai'],
  message: 'Mật khẩu nhập lại không khớp.',
});
type Form = z.input<typeof zForm>;

export function DoiMatKhauPage() {
  const tk = useToi();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useForm<Form>({ resolver: zodResolver(zForm), defaultValues: { matKhauHienTai: '', matKhauMoi: '', nhapLai: '' } });
  const { errors, isSubmitted } = form.formState;
  const [hienTai, moi, nhapLai] = useWatch({ control: form.control, name: ['matKhauHienTai', 'matKhauMoi', 'nhapLai'] });

  const doi = useMutation({
    mutationFn: (dto: DoiMatKhau) => api.goi('/auth/doi-mat-khau', { method: 'POST', body: dto, schema: zTaiKhoanToi }),
    onSuccess: (moiTk) => {
      queryClient.setQueryData(KHOA_TOI, moiTk);
      toast('Đã đổi mật khẩu');
      void navigate('/trang-chu', { replace: true });
    },
    onError: (e) => {
      if (e instanceof LoiApi && e.field === 'matKhauHienTai') form.setError('matKhauHienTai', { message: e.message });
    },
  });
  const dangXuat = useMutation({
    mutationFn: () => api.goi('/auth/dang-xuat', { method: 'POST', schema: zKhongNoiDung }),
    onSettled: () => {
      queryClient.clear();
      void navigate('/dang-nhap', { replace: true });
    },
  });

  const rules = [
    ...QUY_TAC_MAT_KHAU.map((q) => ({ ok: q.kiemTra(moi), label: q.moTa })),
    { ok: !!moi && moi !== hienTai, label: 'Khác mật khẩu hiện tại' },
  ];
  const match = !!nhapLai && moi === nhapLai;
  const input = 'w-full h-11 px-3 rounded-ctl border bg-surface text-body outline-none focus:border-brand-ink transition-colors duration-fast';
  const loiChung = doi.error && !(doi.error instanceof LoiApi && doi.error.field) ? doi.error.message : '';

  return (
    <AuthFrame>
      <span className="w-11 h-11 rounded-full bg-brand-soft grid place-items-center"><KeyRound className="w-5 h-5 text-brand-ink" /></span>
      <h2 className="text-[24px] leading-8 font-semibold mt-4">Đổi mật khẩu</h2>
      <p className="text-body text-muted mt-1">
        {tk.phaiDoiMatKhau ? 'Lần đầu đăng nhập hoặc sau khi được đặt lại, bạn phải đổi mật khẩu tạm.' : `Tài khoản ${tk.tenDangNhap}.`}
      </p>

      <form className="mt-6 flex flex-col gap-4" noValidate
        onSubmit={form.handleSubmit(({ matKhauHienTai, matKhauMoi }) => doi.mutate({ matKhauHienTai, matKhauMoi }))}>
        <div>
          <label htmlFor="c" className="block text-chip font-medium mb-1">Mật khẩu hiện tại{tk.phaiDoiMatKhau && ' (tạm)'}</label>
          <input id="c" type="password" autoComplete="current-password" {...form.register('matKhauHienTai')}
            aria-invalid={!!errors.matKhauHienTai} className={cn(input, errors.matKhauHienTai ? 'border-danger' : 'border-line-strong')} />
          {errors.matKhauHienTai && <p className="text-sub text-danger mt-1" role="alert">{errors.matKhauHienTai.message}</p>}
        </div>
        <div>
          <label htmlFor="n" className="block text-chip font-medium mb-1">Mật khẩu mới</label>
          <input id="n" type="password" autoComplete="new-password" {...form.register('matKhauMoi')} aria-describedby="pw-rules" className={cn(input, 'border-line-strong')} />
          <ul id="pw-rules" className="mt-2 flex flex-col gap-1">
            {rules.map((r) => (
              <li key={r.label} className={cn('text-sub flex items-center gap-1.5', r.ok ? 'text-closed-ink' : isSubmitted ? 'text-danger' : 'text-muted')}>
                {r.ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}{r.label}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <label htmlFor="n2" className="block text-chip font-medium mb-1">Nhập lại mật khẩu mới</label>
          <input id="n2" type="password" autoComplete="new-password" {...form.register('nhapLai')}
            className={cn(input, nhapLai && !match ? 'border-danger' : 'border-line-strong')} />
          {nhapLai && !match && <p className="text-sub text-danger mt-1" role="alert">Mật khẩu nhập lại không khớp.</p>}
        </div>
        {loiChung && <p className="text-sub text-danger" role="alert">{loiChung}</p>}
        <button type="submit" disabled={doi.isPending}
          className="h-11 rounded-ctl bg-brand hover:bg-brand-hover text-ink text-body font-semibold transition-colors duration-fast disabled:bg-disabled-bg disabled:text-disabled-ink">
          {doi.isPending ? 'Đang lưu…' : 'Lưu mật khẩu mới'}
        </button>
        {tk.phaiDoiMatKhau ? (
          <button type="button" onClick={() => dangXuat.mutate()} className="text-chip text-muted hover:text-ink inline-flex items-center gap-1.5 self-start">
            <LogOut className="w-4 h-4" />Đăng xuất
          </button>
        ) : (
          <Link to="/trang-chu" className="text-chip text-muted hover:text-ink inline-flex items-center gap-1.5 self-start"><ArrowLeft className="w-4 h-4" />Quay lại</Link>
        )}
      </form>
    </AuthFrame>
  );
}
