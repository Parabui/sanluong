/**
 * Quét QR trạm ngay trong app [F12] [D21] — giao diện sheet "Quét mã QR" của ui-demo/app/chon-tram.
 * Dùng `qr-scanner` (iOS Safari không có BarcodeDetector), nạp LƯỜI khi mở sheet.
 */
import { tramIdTuQr } from '@vsn/shared';
import { cn } from '@vsn/ui';
import { Camera } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BigButton, Sheet } from './mobile';

export function QuetQr({ open, onClose, onTramId }: { open: boolean; onClose: () => void; onTramId: (id: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [loi, setLoi] = useState('');

  useEffect(() => {
    if (!open || !video.current) return;
    let huy = false;
    let dung: (() => void) | undefined;
    void import('qr-scanner').then(async ({ default: QrScanner }) => {
      if (huy || !video.current) return;
      const qr = new QrScanner(video.current, (kq) => {
        const id = tramIdTuQr(kq.data);
        if (id) { qr.stop(); onTramId(id); } else setLoi('Mã QR không hợp lệ.');
      }, { returnDetailedScanResult: true, preferredCamera: 'environment', maxScansPerSecond: 5 });
      dung = () => qr.destroy();
      try {
        await qr.start();
      } catch {
        setLoi('Không mở được camera. Vào Cài đặt trình duyệt để cho phép camera, hoặc chọn trạm thủ công.');
      }
    }).catch(() => setLoi('Không tải được trình quét QR — chọn trạm thủ công.'));
    return () => { huy = true; dung?.(); };
  }, [open, onTramId]);

  const dong = () => { setLoi(''); onClose(); };

  return (
    <Sheet open={open} onClose={dong} title="Quét mã QR">
      <div className="relative aspect-square rounded-card bg-[#111418] overflow-hidden grid place-items-center">
        <video ref={video} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
        <div className="relative w-2/3 aspect-square pointer-events-none">
          {['top-0 left-0 border-t-4 border-l-4 rounded-tl-xl', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl'].map((c) => (
            <span key={c} className={cn('absolute w-10 h-10 border-brand', c)} />
          ))}
          <span className="absolute inset-x-3 top-1/2 h-0.5 bg-brand live-dot" />
        </div>
        <span className="absolute bottom-3 text-[14px] text-ondark/90 flex items-center gap-1.5"><Camera className="w-4 h-4" />Đang tìm mã QR…</span>
      </div>
      <p className={cn('text-[14px] mt-3', loi ? 'text-danger' : 'text-muted')} role={loi ? 'alert' : undefined}>
        {loi || 'Không có quyền camera? Vào Cài đặt trình duyệt để cho phép, hoặc chọn trạm thủ công.'}
      </p>
      <BigButton variant="secondary" className="w-full mt-3" onClick={dong}>Chọn thủ công</BigButton>
    </Sheet>
  );
}
