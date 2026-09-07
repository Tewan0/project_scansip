import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ScanSip - Owner Dashboard",
  description: "Smart Cafe & Restaurant Order Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable} font-sans h-full antialiased`}>
      <body className="min-h-full bg-background text-on-background font-body-md flex flex-col">{children}</body>
    </html>
  );
}
