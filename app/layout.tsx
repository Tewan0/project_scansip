import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeController } from "@/components/theme-toggle";
import { themeInitScript } from "@/lib/theme";

const prompt = localFont({
  src: [
    { path: "./fonts/prompt/Prompt-Light.ttf", weight: "300", style: "normal" },
    { path: "./fonts/prompt/Prompt-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/prompt/Prompt-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/prompt/Prompt-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/prompt/Prompt-Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/prompt/Prompt-ExtraBold.ttf", weight: "800", style: "normal" },
    { path: "./fonts/prompt/Prompt-Black.ttf", weight: "900", style: "normal" },
  ],
  variable: "--font-prompt",
  preload: false,
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
    <html lang="th" suppressHydrationWarning className={cn("h-full", "antialiased", prompt.variable, "font-sans")}>
      <head>
        <script id="scansip-theme" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground font-body-md flex flex-col font-sans">
        <ThemeController />
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}

