/**
 * Modal & Drawer — dựng lại trên Radix Dialog (giữ focus, Esc, aria) với style của ui-demo [TDD 14.1].
 * API giữ như demo: <Modal open onClose title footer width>.
 */
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Mô tả cho trình đọc màn hình (ẩn) */
  moTa?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, moTa, children, footer, width }: OverlayProps & { width?: number }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay fixed inset-0 z-50" />
        <div className="fixed inset-0 z-50 grid place-items-center p-4 pointer-events-none">
          <Dialog.Content
            className="pop-in pointer-events-auto bg-surface rounded-card shadow-pop w-full max-h-[calc(100vh-32px)] flex flex-col outline-none"
            style={{ maxWidth: width ?? 'var(--modal-w)' }}
          >
            <div className="px-5 pt-5 pb-1 flex items-start gap-3">
              <Dialog.Title className="text-h font-semibold">{title}</Dialog.Title>
              <Dialog.Close aria-label="Đóng" className="ml-auto -mt-1.5 -mr-2 w-9 h-9 grid place-items-center rounded-ctl hover:bg-hover text-muted">
                <X className="w-[18px] h-[18px]" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">{moTa ?? ''}</Dialog.Description>
            <div className="px-5 pb-5 pt-2 overflow-y-auto scroll-area">{children}</div>
            {footer && <div className="px-5 pb-5 flex justify-end gap-2">{footer}</div>}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Drawer({ open, onClose, title, moTa, children, footer }: OverlayProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay fixed inset-0 z-40" />
        <Dialog.Content className="drawer fixed top-0 right-0 bottom-0 z-50 bg-surface shadow-pop flex flex-col outline-none">
          <div className="h-header px-4 flex items-center border-b border-line shrink-0">
            <Dialog.Title className="text-h font-semibold">{title}</Dialog.Title>
            <Dialog.Close aria-label="Đóng" className="ml-auto w-9 h-9 grid place-items-center rounded-ctl hover:bg-hover text-muted">
              <X className="w-[18px] h-[18px]" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{moTa ?? ''}</Dialog.Description>
          <div className="flex-1 overflow-y-auto scroll-area p-4">{children}</div>
          {footer && <div className="border-t border-line p-4 flex justify-end gap-2">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
