import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipLayer } from "@/components/ui/tooltip";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: { default: "VSN Sản Lượng", template: "%s · VSN Sản Lượng" },
  description: "Nhập nhanh – Đúng số – Đúng tiến độ",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${beVietnam.variable} ${jetbrains.variable}`}>
      <body>
        <ToastProvider>
          {children}
          <TooltipLayer />
        </ToastProvider>
      </body>
    </html>
  );
}
