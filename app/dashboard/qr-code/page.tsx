/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import {
  QrCode,
  Armchair,
  Palette,
  ChevronDown,
  Sparkles,
  Share2,
  FileText,
  Image as ImageIcon,
  PenTool,
  Eye,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Download,
} from "lucide-react";

export default function QrCodeGeneratorPage() {
  const [tableCount, setTableCount] = useState(12);
  const [currentTable, setCurrentTable] = useState(4);
  const [preset, setPreset] = useState("สีเอกลักษณ์แบรนด์");
  const [exportFormat, setExportFormat] = useState("PDF (พร้อมพิมพ์)");
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePrevTable = () => {
    setCurrentTable((prev) => (prev > 1 ? prev - 1 : tableCount));
  };

  const handleNextTable = () => {
    setCurrentTable((prev) => (prev < tableCount ? prev + 1 : 1));
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 600);
  };

  const formattedTable = String(currentTable).padStart(2, "0");

  const [origin, setOrigin] = useState("http://172.20.10.3:3000");
  const [storeSlug, setStoreSlug] = useState("scansip");

  useEffect(() => {
    if (typeof window !== "undefined") {
      // If user accesses via localhost on desktop, default to local WiFi IP so mobile can scan
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        setOrigin("http://172.20.10.3:3000");
      } else {
        setOrigin(window.location.origin);
      }
    }

    // Fetch store slug of current owner
    fetch("/api/store")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.slug) {
          setStoreSlug(json.data.slug);
        }
      })
      .catch(() => {});
  }, []);

  // Generate dynamic QR code image URL: includes store slug so tables never collide between stores
  const tableTargetUrl = `${origin}/r/${storeSlug}/table/${currentTable}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(tableTargetUrl)}&color=3c220e`;

  return (
    <div className="p-gutter max-w-[1200px] w-full mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Generator Setup (Left Column) */}
        <div className="lg:col-span-4 flex flex-col gap-stack-lg">
          {/* Batch Generation Card */}
          <div className="bg-surface-card rounded-xl border border-border-subtle p-stack-lg shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2 mb-stack-md">
              <QrCode className="w-5 h-5 text-primary shrink-0" />
              <h2 className="font-headline-md text-headline-md text-on-background font-bold">
                สร้าง QR Code รายโต๊ะ
              </h2>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-stack-lg">
              สร้างคิวอาร์โค้ดประจำโต๊ะสำหรับให้ลูกค้าสแกนเพื่อเปิดดูเมนูและสั่งอาหารได้ทันที
            </p>
            <div className="flex flex-col gap-stack-md">
              <div>
                <label
                  className="flex items-center gap-1 font-label-md text-label-md text-on-background mb-unit"
                  htmlFor="table-count"
                >
                  <Armchair className="w-4 h-4 text-on-surface-variant" />
                  จำนวนโต๊ะทั้งหมด
                </label>
                <input
                  className="w-full h-[36px] px-3 border border-border-subtle rounded-lg font-body-md text-body-md text-on-background focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all bg-surface-bright"
                  id="table-count"
                  type="number"
                  min="1"
                  max="100"
                  value={tableCount}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setTableCount(val);
                    if (currentTable > val) setCurrentTable(val);
                  }}
                />
              </div>

              <div>
                <label
                  className="flex items-center gap-1 font-label-md text-label-md text-on-background mb-unit"
                  htmlFor="design-preset"
                >
                  <Palette className="w-4 h-4 text-on-surface-variant" />
                  สไตล์การแสดงผล
                </label>
                <div className="relative">
                  <select
                    className="w-full h-[36px] px-3 border border-border-subtle rounded-lg font-body-md text-body-md text-on-background focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all bg-surface-bright appearance-none pr-10 cursor-pointer"
                    id="design-preset"
                    value={preset}
                    onChange={(e) => setPreset(e.target.value)}
                  >
                    <option>สีเอกลักษณ์แบรนด์</option>
                    <option>ดาร์กมินิมอล</option>
                    <option>ขาวดำคอนทราสต์สูง</option>
                    <option>เขียวธรรมชาติ</option>
                    <option>อิฐอบอุ่น</option>
                    <option>น้ำเงินโมเดิร์น</option>
                    <option>ชมพูพาสเทล</option>
                    <option>เหลืองซันไชน์</option>
                    <option>เทาโมโนโครม</option>
                    <option>มิ้นต์สดชื่น</option>
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                </div>
              </div>

              {/* <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="mt-stack-sm w-full h-[40px] bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary-container transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                {isGenerating ? "กำลังสร้างโค้ด..." : "สร้างคิวอาร์โค้ด"}
              </button> */}
            </div>
          </div>

          {/* Export Options Card */}
          <div className="bg-surface-card rounded-xl border border-border-subtle p-stack-lg shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2 mb-stack-md">
              <Share2 className="w-5 h-5 text-primary shrink-0" />
              <h2 className="font-headline-md text-headline-md text-on-background font-bold">
                ตัวเลือกดาวน์โหลด
              </h2>
            </div>
            <div className="flex flex-col gap-stack-sm">
              {[
                { format: "PDF (พร้อมพิมพ์)", icon: FileText, color: "text-red-500" },
                { format: "PNG (รูปภาพความละเอียดสูง)", icon: ImageIcon, color: "text-blue-500" },
                { format: "SVG (ไฟล์เวกเตอร์)", icon: PenTool, color: "text-amber-500" },
              ].map(({ format, icon: IconComponent, color }) => (
                <label
                  key={format}
                  className="flex items-center gap-stack-sm cursor-pointer p-stack-sm rounded-lg hover:bg-surface-container-low transition-colors"
                >
                  <input
                    className="text-primary focus:ring-primary h-4 w-4 border-border-subtle accent-primary cursor-pointer"
                    name="export-format"
                    type="radio"
                    checked={exportFormat === format}
                    onChange={() => setExportFormat(format)}
                  />
                  <IconComponent className={`w-4 h-4 ${color}`} />
                  <span className="font-body-sm text-body-sm text-on-background">
                    {format}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Preview Area (Right Column) */}
        <div className="lg:col-span-8">
          <div className="bg-surface-card rounded-xl border border-border-subtle h-full min-h-[500px] flex flex-col shadow-[0_4px_12px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="px-stack-lg py-stack-md border-b border-border-subtle flex justify-between items-center bg-surface-bright">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary shrink-0" />
                <h2 className="font-headline-md text-headline-md text-on-background font-bold">
                  ตัวอย่าง: โต๊ะ {formattedTable}
                </h2>
              </div>
              <div className="flex items-center gap-stack-sm">
                <button
                  type="button"
                  onClick={handlePrevTable}
                  className="h-[32px] px-stack-md border border-border-subtle bg-surface-card text-primary font-label-md text-label-md rounded-lg hover:bg-surface-container-low transition-colors flex items-center justify-center cursor-pointer"
                  title="โต๊ะก่อนหน้า"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center px-1">
                  {currentTable} จาก {tableCount}
                </span>
                <button
                  type="button"
                  onClick={handleNextTable}
                  className="h-[32px] px-stack-md border border-border-subtle bg-surface-card text-primary font-label-md text-label-md rounded-lg hover:bg-surface-container-low transition-colors flex items-center justify-center cursor-pointer"
                  title="โต๊ะถัดไป"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Card Preview Surface */}
            <div className="flex-1 p-gutter bg-surface-container-low flex items-center justify-center relative overflow-hidden">
              {/* Abstract decorative background element */}
              <div
                className="absolute inset-0 opacity-5 pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 50% 50%, #3c220e 2px, transparent 2px)",
                  backgroundSize: "24px 24px",
                }}
              ></div>

              {/* Physical Card Stand representation */}
              <div
                className={`w-[280px] h-[400px] rounded-2xl shadow-xl border flex flex-col items-center justify-between py-stack-lg px-stack-md relative z-10 transition-all duration-300 hover:scale-[1.02] ${
                  preset === "ดาร์กมินิมอล"
                    ? "bg-inverse-surface border-inverse-surface text-inverse-on-surface"
                    : preset === "ขาวดำคอนทราสต์สูง"
                    ? "bg-white border-black text-black"
                    : preset === "เขียวธรรมชาติ"
                    ? "bg-[#f1f7ed] border-[#8aa678] text-[#29422a]"
                    : preset === "อิฐอบอุ่น"
                    ? "bg-[#fff3e8] border-[#d9845b] text-[#5c2d1f]"
                    : preset === "น้ำเงินโมเดิร์น"
                    ? "bg-[#edf5f9] border-[#77a9c2] text-[#173c52]"
                    : preset === "ชมพูพาสเทล"
                    ? "bg-[#fff0f3] border-[#e5a3b2] text-[#5c2d3a]"
                    : preset === "เหลืองซันไชน์"
                    ? "bg-[#fff9df] border-[#e5c65c] text-[#594a18]"
                    : preset === "เทาโมโนโครม"
                    ? "bg-[#f1f2f3] border-[#9da3a8] text-[#30363b]"
                    : preset === "มิ้นต์สดชื่น"
                    ? "bg-[#eaf8f3] border-[#83c9b0] text-[#1d5142]"
                    : preset === "สีเอกลักษณ์แบรนด์"
                    ? "bg-[#fff7ef] border-[#c88b62] text-[#3c220e]"
                    : "bg-surface-card border-border-subtle text-on-background"
                }`}
              >
                <div className="text-center w-full">
                  <div className="flex items-center justify-center gap-1.5 mb-unit">
                    <Coffee
                      className={`w-6 h-6 ${
                        preset === "ดาร์กมินิมอล"
                          ? "text-inverse-primary"
                          : preset === "เขียวธรรมชาติ"
                          ? "text-[#4f7d4b]"
                          : preset === "อิฐอบอุ่น"
                          ? "text-[#b85c3c]"
                          : preset === "น้ำเงินโมเดิร์น"
                          ? "text-[#31718f]"
                          : preset === "ชมพูพาสเทล"
                          ? "text-[#c45c78]"
                          : preset === "เหลืองซันไชน์"
                          ? "text-[#b08a1c]"
                          : preset === "เทาโมโนโครม"
                          ? "text-[#59636b]"
                          : preset === "มิ้นต์สดชื่น"
                          ? "text-[#348c72]"
                          : preset === "สีเอกลักษณ์แบรนด์"
                          ? "text-[#9b5a32]"
                          : "text-primary"
                      }`}
                    />
                    <span
                      className={`font-headline-md text-headline-md font-bold tracking-tight ${
                        preset === "ดาร์กมินิมอล"
                          ? "text-inverse-primary"
                          : preset === "เขียวธรรมชาติ"
                          ? "text-[#4f7d4b]"
                          : preset === "อิฐอบอุ่น"
                          ? "text-[#b85c3c]"
                          : preset === "น้ำเงินโมเดิร์น"
                          ? "text-[#31718f]"
                          : preset === "ชมพูพาสเทล"
                          ? "text-[#c45c78]"
                          : preset === "เหลืองซันไชน์"
                          ? "text-[#b08a1c]"
                          : preset === "เทาโมโนโครม"
                          ? "text-[#59636b]"
                          : preset === "มิ้นต์สดชื่น"
                          ? "text-[#348c72]"
                          : preset === "สีเอกลักษณ์แบรนด์"
                          ? "text-[#9b5a32]"
                          : "text-primary"
                      }`}
                    >
                      ScanSip
                    </span>
                  </div>
                  <div className="h-[1px] w-12 bg-border-subtle mx-auto mb-stack-md"></div>
                  <p
                    className={`font-label-md text-label-md uppercase tracking-widest ${
                      preset === "ดาร์กมินิมอล" ? "text-inverse-on-surface" : "text-on-surface-variant"
                    }`}
                  >
                    โต๊ะ
                  </p>
                  <p
                    className={`font-headline-xl text-headline-xl font-bold mt-unit ${
                      preset === "ดาร์กมินิมอล"
                        ? "text-white"
                        : preset === "เขียวธรรมชาติ"
                        ? "text-[#3f6b3f]"
                        : preset === "อิฐอบอุ่น"
                        ? "text-[#a94f35]"
                        : preset === "น้ำเงินโมเดิร์น"
                        ? "text-[#245e7b]"
                        : preset === "ชมพูพาสเทล"
                        ? "text-[#aa4965]"
                        : preset === "เหลืองซันไชน์"
                        ? "text-[#8f7414]"
                        : preset === "เทาโมโนโครม"
                        ? "text-[#454d53]"
                        : preset === "มิ้นต์สดชื่น"
                        ? "text-[#28745d]"
                        : preset === "สีเอกลักษณ์แบรนด์"
                        ? "text-[#3c220e]"
                        : "text-primary"
                    }`}
                  >
                    {formattedTable}
                  </p>
                </div>

                {/* QR Code Container */}
                <div className="w-[160px] h-[160px] bg-white border-2 border-border-subtle rounded-xl flex items-center justify-center p-2 shadow-xs">
                  <img
                    alt={`QR Code สำหรับโต๊ะ ${formattedTable}`}
                    className="w-full h-full object-contain"
                    src={qrUrl}
                    onError={(e) => {
                      // Fallback generator without google mock image
                      (e.target as HTMLImageElement).src = `https://quickchart.io/qr?text=${encodeURIComponent(tableTargetUrl)}&size=160`;
                    }}
                  />
                </div>

                <div className="text-center mt-stack-md">
                  <p
                    className={`font-body-sm text-body-sm ${
                      preset === "ดาร์กมินิมอล" ? "text-inverse-on-surface" : "text-on-surface-variant"
                    }`}
                  >
                    สแกนเพื่อดูเมนู
                    <br />
                    และสั่งอาหารได้ทันที
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="px-stack-lg py-stack-md border-t border-border-subtle flex justify-end gap-stack-md bg-surface-bright">
              <button
                type="button"
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = qrUrl;
                  link.download = `scansip_table_${formattedTable}.png`;
                  link.click();
                }}
                className="h-[36px] px-stack-md border border-border-subtle bg-surface-card text-primary font-label-md text-label-md rounded-lg hover:bg-surface-container-low transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                ดาวน์โหลดโต๊ะ {formattedTable}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
