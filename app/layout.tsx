import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-noto-sans-thai",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ScanSip - แดชบอร์ดเจ้าของร้าน",
  description: "ระบบจัดการร้านอาหารและคาเฟ่อัจฉริยะ สแกนสั่งอาหารผ่าน QR Code",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${notoSansThai.variable} font-sans h-full antialiased`}>
      <body className="min-h-full bg-background text-on-background font-body-md flex flex-col">{children}</body>
    </html>
  );
}
