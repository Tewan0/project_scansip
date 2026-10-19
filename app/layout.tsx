import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-noto-sans-thai",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
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
    <html lang="th" className={cn("h-full", "antialiased", notoSansThai.variable, "font-sans")}>
      <body className="min-h-full bg-background text-on-background font-body-md flex flex-col font-sans">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}

