/**
 * Menu thả xuống — dựng lại trên Radix DropdownMenu (bàn phím, focus, tự lật khi sát mép) với style ui-demo [TDD 14.1].
 */
import * as DM from '@radix-ui/react-dropdown-menu';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { cn } from './cn.js';

export function Menu({
  trigger,
  children,
  align = 'end',
  width = 'w-56',
}: {
  /** Phần tử bấm để mở (Button / IconButton…) — nhận ref và props của Radix */
  trigger: ReactElement;
  children: ReactNode;
  align?: 'start' | 'end';
  width?: string;
}) {
  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild>{trigger}</DM.Trigger>
      <DM.Portal>
        <DM.Content
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn('pop-in bg-surface border border-line rounded-card shadow-pop p-1 z-[60] outline-none', width)}
        >
          {children}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function MenuItem({
  icon: Icon,
  children,
  onSelect,
  danger,
  active,
  disabled,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <DM.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        'w-full min-h-9 px-3 py-1.5 flex items-center gap-2.5 rounded-ctl text-body text-left outline-none cursor-pointer',
        'data-[highlighted]:bg-hover data-[disabled]:text-disabled-ink data-[disabled]:cursor-not-allowed',
        danger && 'text-danger',
        active && 'bg-brand-soft font-semibold',
      )}
    >
      {Icon && <Icon className={cn('w-4 h-4', !danger && 'text-muted')} />}
      {children}
    </DM.Item>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DM.Label className="px-3 pt-2 pb-1 text-tag font-semibold uppercase tracking-[0.06em] text-muted">{children}</DM.Label>;
}

export function MenuSeparator() {
  return <DM.Separator className="h-px bg-line my-1" />;
}
