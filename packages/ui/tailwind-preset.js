/**
 * Preset Tailwind v3.4 dùng chung [D12] [D14] — chuyển từ khối `@theme inline` (v4) của ui-demo.
 * Giữ nguyên TÊN class của demo (bg-brand, text-ink, border-line, rounded-card, text-body…)
 * để code giao diện chép từ ui-demo chạy được mà không phải đổi class.
 * @type {import('tailwindcss').Config}
 */
const mau = (bien) => `rgb(var(--${bien}) / <alpha-value>)`;

export default {
  content: [],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: mau('brand'), hover: mau('brand-hover'), soft: mau('brand-soft'), ink: mau('brand-text'), gray: mau('brand-gray') },
        page: mau('bg'),
        surface: mau('surface'),
        line: { DEFAULT: mau('border'), strong: mau('border-strong') },
        ink: mau('text'),
        muted: mau('text-muted'),
        hover: mau('row-hover'),
        group: mau('group-bg'),
        thead: mau('thead-bg'),
        'empty-bg': mau('empty-bg'), 'empty-ink': mau('empty-text'), 'empty-bar': mau('empty-bar'),
        'warn-bg': mau('warn-bg'), 'warn-ink': mau('warn-text'), 'warn-bar': mau('warn-bar'),
        'adjust-bg': mau('adjust-bg'), 'adjust-ink': mau('adjust-text'),
        'support-bg': mau('support-bg'), 'support-ink': mau('support-text'),
        'open-bg': mau('open-bg'), 'open-ink': mau('open-text'),
        'closed-bg': mau('closed-bg'), 'closed-ink': mau('closed-text'),
        'locked-bg': mau('locked-bg'), 'locked-ink': mau('locked-text'),
        danger: { DEFAULT: mau('danger'), bg: mau('danger-bg') },
        success: mau('success'),
        ondark: mau('on-dark'),
        'disabled-bg': mau('disabled-bg'), 'disabled-ink': mau('disabled-text'),
        toast: mau('toast-bg'),
        tv: { bg: mau('tv-bg'), surface: mau('tv-surface'), border: mau('tv-border'), text: mau('tv-text'), muted: mau('tv-muted') },
      },
      fontFamily: {
        sans: ['var(--font)'],
        mono: ['var(--font-code)'],
      },
      fontSize: {
        title: ['var(--fs-title)', 'var(--lh-title)'],
        h: ['var(--fs-h)', '24px'],
        body: ['var(--fs-body)', 'var(--lh-body)'],
        chip: ['var(--fs-chip)', '18px'],
        th: ['var(--fs-th)', '16px'],
        sub: ['var(--fs-sub)', '16px'],
        qty: ['var(--fs-qty)', '20px'],
        tag: ['var(--fs-tag)', '16px'],
      },
      borderRadius: {
        card: 'var(--r-card)',
        ctl: 'var(--r-ctl)',
        pill: 'var(--r-pill)',
        sheet: 'var(--r-sheet)',
      },
      boxShadow: {
        pop: 'var(--sh-pop)',
        bar: 'var(--sh-bar)',
      },
      spacing: {
        header: 'var(--header-h)',
        row: 'var(--row-h)',
      },
      transitionDuration: {
        fast: 'var(--dur)',
      },
    },
  },
};
