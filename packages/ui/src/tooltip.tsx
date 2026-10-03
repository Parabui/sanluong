
import { useEffect, useRef } from 'react';

/**
 * Tooltip toàn cục: mọi phần tử có `data-tip='...'` tự hiện tooltip khi hover / focus bàn phím.
 * `data-tip-when='collapsed'` → chỉ hiện khi sidebar đang thu gọn (hiện bên phải phần tử).
 */
export function TooltipLayer() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tip = ref.current!;
    const hide = () => tip.classList.add('hidden');
    const show = (el: HTMLElement) => {
      const collapsedOnly = el.dataset.tipWhen === 'collapsed';
      if (collapsedOnly && !document.querySelector('.app-shell.collapsed')) return hide();
      tip.textContent = el.dataset.tip ?? '';
      tip.classList.remove('hidden');
      const a = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      if (collapsedOnly) {
        tip.style.left = a.right + 8 + 'px';
        tip.style.top = a.top + (a.height - h) / 2 + 'px';
        return;
      }
      tip.style.left = Math.min(Math.max(8, a.left + a.width / 2 - w / 2), innerWidth - w - 8) + 'px';
      tip.style.top = (a.top - h - 6 < 8 ? a.bottom + 6 : a.top - h - 6) + 'px';
    };
    const over = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest?.<HTMLElement>('[data-tip]');
      if (el && el.dataset.tip) show(el);
      else hide();
    };
    const focus = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      const el = t.closest?.<HTMLElement>('[data-tip]');
      if (el && el.dataset.tip && t.matches(':focus-visible')) show(el);
      else hide();
    };
    document.addEventListener('mouseover', over);
    document.addEventListener('focusin', focus);
    document.addEventListener('scroll', hide, true);
    document.addEventListener('mousedown', hide);
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('scroll', hide, true);
      document.removeEventListener('mousedown', hide);
    };
  }, []);

  return (
    <div ref={ref} role='tooltip' className='hidden fixed z-[90] max-w-xs px-2.5 py-1.5 rounded-ctl bg-toast text-ondark text-sub shadow-pop pointer-events-none' />
  );
}
