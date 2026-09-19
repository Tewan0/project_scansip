/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef, forwardRef } from "react";
import { toPng, toBlob, toSvg } from "html-to-image";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { QRCodeSVG } from "qrcode.react";
import {
  QrCode,
  Armchair,
  Palette,
  ChevronDown,
  Share2,
  FileText,
  Image as ImageIcon,
  PenTool,
  Eye,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Download,
  Archive,
  Loader2,
  AlertCircle,
} from "lucide-react";

export type ExportFormat = "PNG" | "PDF" | "SVG";

// Helper functions for all 10 presets
const getCardContainerClass = (preset: string) => {
  switch (preset) {
    case "ดาร์กมินิมอล":
      return "bg-inverse-surface border-inverse-surface text-inverse-on-surface";
    case "ขาวดำคอนทราสต์สูง":
      return "bg-white border-black text-black";
    case "เขียวธรรมชาติ":
      return "bg-[#f1f7ed] border-[#8aa678] text-[#29422a]";
    case "อิฐอบอุ่น":
      return "bg-[#fff3e8] border-[#d9845b] text-[#5c2d1f]";
    case "น้ำเงินโมเดิร์น":
      return "bg-[#edf5f9] border-[#77a9c2] text-[#173c52]";
    case "ชมพูพาสเทล":
      return "bg-[#fff0f3] border-[#e5a3b2] text-[#5c2d3a]";
    case "เหลืองซันไชน์":
      return "bg-[#fff9df] border-[#e5c65c] text-[#594a18]";
    case "เทาโมโนโครม":
      return "bg-[#f1f2f3] border-[#9da3a8] text-[#30363b]";
    case "มิ้นต์สดชื่น":
      return "bg-[#eaf8f3] border-[#83c9b0] text-[#1d5142]";
    case "สีเอกลักษณ์แบรนด์":
    default:
      return "bg-[#fff7ef] border-[#c88b62] text-[#3c220e]";
  }
};

const getBrandIconAndTextClass = (preset: string) => {
  switch (preset) {
    case "ดาร์กมินิมอล":
      return "text-inverse-primary";
    case "ขาวดำคอนทราสต์สูง":
      return "text-black";
    case "เขียวธรรมชาติ":
      return "text-[#4f7d4b]";
    case "อิฐอบอุ่น":
      return "text-[#b85c3c]";
    case "น้ำเงินโมเดิร์น":
      return "text-[#31718f]";
    case "ชมพูพาสเทล":
      return "text-[#c45c78]";
    case "เหลืองซันไชน์":
      return "text-[#b08a1c]";
    case "เทาโมโนโครม":
      return "text-[#59636b]";
    case "มิ้นต์สดชื่น":
      return "text-[#348c72]";
    case "สีเอกลักษณ์แบรนด์":
    default:
      return "text-[#9b5a32]";
  }
};

const getTableNumberClass = (preset: string) => {
  switch (preset) {
    case "ดาร์กมินิมอล":
      return "text-white";
    case "ขาวดำคอนทราสต์สูง":
      return "text-black";
    case "เขียวธรรมชาติ":
      return "text-[#3f6b3f]";
    case "อิฐอบอุ่น":
      return "text-[#a94f35]";
    case "น้ำเงินโมเดิร์น":
      return "text-[#245e7b]";
    case "ชมพูพาสเทล":
      return "text-[#aa4965]";
    case "เหลืองซันไชน์":
      return "text-[#8f7414]";
    case "เทาโมโนโครม":
      return "text-[#454d53]";
    case "มิ้นต์สดชื่น":
      return "text-[#28745d]";
    case "สีเอกลักษณ์แบรนด์":
    default:
      return "text-[#3c220e]";
  }
};

// Reusable QR Card component using QRCodeSVG
interface QrTableCardProps {
  tableNumber: number;
  preset: string;
  storeName?: string;
  tableTargetUrl: string;
}

const QrTableCard = forwardRef<HTMLDivElement, QrTableCardProps>(
  ({ tableNumber, preset, storeName = "ScanSip", tableTargetUrl }, ref) => {
    const formattedTable = String(tableNumber).padStart(2, "0");

    return (
      <div
        ref={ref}
        className={`w-[280px] h-[400px] rounded-2xl shadow-xl border flex flex-col items-center justify-between py-stack-lg px-stack-md relative z-10 transition-all duration-300 ${getCardContainerClass(
          preset
        )}`}
      >
        <div className="text-center w-full">
          <div className="flex items-center justify-center gap-1.5 mb-unit">
            <Coffee className={`w-6 h-6 ${getBrandIconAndTextClass(preset)}`} />
            <span
              className={`font-headline-md text-headline-md font-bold tracking-tight ${getBrandIconAndTextClass(
                preset
              )}`}
            >
              {storeName}
            </span>
          </div>
          <div className="h-[1px] w-12 bg-border-subtle mx-auto mb-stack-md"></div>
          <p
            className={`font-label-md text-label-md uppercase tracking-widest ${
              preset === "ดาร์กมินิมอล"
                ? "text-inverse-on-surface"
                : "text-on-surface-variant"
            }`}
          >
            โต๊ะ
          </p>
          <p
            className={`font-headline-xl text-headline-xl font-bold mt-unit ${getTableNumberClass(
              preset
            )}`}
          >
            {formattedTable}
          </p>
        </div>

        {/* Dynamic Vector QR Code Container */}
        <div className="w-[160px] h-[160px] bg-white border-2 border-border-subtle rounded-xl flex items-center justify-center p-2 shadow-xs">
          <QRCodeSVG
            key={`qr-table-${tableNumber}`}
            value={tableTargetUrl}
            size={144}
            level="M"
            fgColor="#3c220e"
            bgColor="#ffffff"
          />
        </div>

        <div className="text-center mt-stack-md">
          <p
            className={`font-body-sm text-body-sm ${
              preset === "ดาร์กมินิมอล"
                ? "text-inverse-on-surface"
                : "text-on-surface-variant"
            }`}
          >
            สแกนเพื่อดูเมนู
            <br />
            และสั่งอาหารได้ทันที
          </p>
        </div>
      </div>
    );
  }
);
QrTableCard.displayName = "QrTableCard";

export default function QrCodeGeneratorPage() {
  const [tableCount, setTableCount] = useState(6);
  const [tableCountInput, setTableCountInput] = useState("6");
  const [tableCountError, setTableCountError] = useState<string | null>(null);

  const [currentTable, setCurrentTable] = useState(4);
  const [preset, setPreset] = useState("สีเอกลักษณ์แบรนด์");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("PNG");

  // Download states
  const [isSingleDownloading, setIsSingleDownloading] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  // Card DOM refs
  const cardRef = useRef<HTMLDivElement>(null);
  const bulkCardRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const handlePrevTable = () => {
    setCurrentTable((prev) => (prev > 1 ? prev - 1 : tableCount));
  };

  const handleNextTable = () => {
    setCurrentTable((prev) => (prev < tableCount ? prev + 1 : 1));
  };

  const handleTableCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setTableCountInput(rawVal);

    if (rawVal === "") {
      setTableCountError("จำนวนโต๊ะต้องอยู่ระหว่าง 1 ถึง 50 โต๊ะ");
      return;
    }

    const val = Number(rawVal);
    if (!Number.isInteger(val) || val < 1 || val > 50) {
      setTableCountError("จำนวนโต๊ะต้องอยู่ระหว่าง 1 ถึง 50 โต๊ะ");
      return;
    }

    setTableCountError(null);
    setTableCount(val);
    if (currentTable > val) {
      setCurrentTable(val);
    }
  };

  const formattedTable = String(currentTable).padStart(2, "0");

  const [origin, setOrigin] = useState("http://172.20.10.3:3000");
  const [storeSlug, setStoreSlug] = useState("scansip");

  // Array of all tables in the store (clamped 1 to 50)
  const safeTableCount = Math.max(1, Math.min(50, tableCount));
  const tables = Array.from({ length: safeTableCount }, (_, i) => ({ tableNumber: i + 1 }));

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        setOrigin("http://172.20.10.3:3000");
      } else {
        setOrigin(window.location.origin);
      }
    }

    fetch("/api/store")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.slug) {
          setStoreSlug(json.data.slug);
        }
      })
      .catch(() => {});
  }, []);

  // Generate dynamic QR code target URL: ${baseUrl}/r/${storeSlug}?table=${tableNumber}
  const getTableTargetUrl = (t: number) => `${origin}/r/${storeSlug}?table=${t}`;
  const currentTableTargetUrl = getTableTargetUrl(currentTable);

  // Single Table Download Handler (Supports PNG, SVG, PDF)
  const handleDownloadSingle = async () => {
    if (
      !cardRef.current ||
      isSingleDownloading ||
      isBulkDownloading ||
      Boolean(tableCountError)
    ) {
      return;
    }

    try {
      setIsSingleDownloading(true);
      const tableNumber = currentTable;

      if (exportFormat === "PNG") {
        const dataUrl = await toPng(cardRef.current, {
          pixelRatio: 2,
          cacheBust: true,
          style: { transform: "none" },
        });
        saveAs(dataUrl, `table-${tableNumber}-qr.png`);
      } else if (exportFormat === "SVG") {
        const svgDataUrl = await toSvg(cardRef.current, {
          cacheBust: true,
          style: { transform: "none" },
        });
        saveAs(svgDataUrl, `table-${tableNumber}-qr.svg`);
      } else if (exportFormat === "PDF") {
        const dataUrl = await toPng(cardRef.current, {
          pixelRatio: 2,
          cacheBust: true,
          style: { transform: "none" },
        });

        // A4 portrait dimensions: 210mm x 297mm
        // Card dimensions: 120mm x 171.4mm (maintaining 280x400 aspect ratio)
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const cardWidth = 120;
        const cardHeight = (400 / 280) * cardWidth;
        const x = (210 - cardWidth) / 2;
        const y = (297 - cardHeight) / 2;

        pdf.addImage(dataUrl, "PNG", x, y, cardWidth, cardHeight);
        pdf.save(`table-${tableNumber}-qr.pdf`);
      }
    } catch (error) {
      console.error("Single table QR download error:", error);
      alert("ไม่สามารถดาวน์โหลดการ์ด QR Code ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSingleDownloading(false);
    }
  };

  // Bulk Download Handler (Supports PNG ZIP, SVG ZIP, PDF Multi-Page Document)
  const handleDownloadBulk = async () => {
    if (
      isBulkDownloading ||
      isSingleDownloading ||
      Boolean(tableCountError) ||
      tableCount < 1 ||
      tableCount > 50
    ) {
      return;
    }

    try {
      setIsBulkDownloading(true);
      setBulkProgress({ current: 0, total: tableCount });

      if (exportFormat === "PDF") {
        // Single multi-page A4 PDF containing all tables ready for printing
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const cardWidth = 120;
        const cardHeight = (400 / 280) * cardWidth;
        const x = (210 - cardWidth) / 2;
        const y = (297 - cardHeight) / 2;

        for (const table of tables) {
          setBulkProgress({ current: table.tableNumber, total: tableCount });

          const element =
            document.getElementById(`qr-card-export-${table.tableNumber}`) ||
            bulkCardRefs.current[table.tableNumber];
          if (!element) continue;

          const dataUrl = await toPng(element, {
            pixelRatio: 2,
            cacheBust: true,
            style: { transform: "none" },
          });

          if (table.tableNumber > 1) {
            pdf.addPage("a4", "portrait");
          }
          pdf.addImage(dataUrl, "PNG", x, y, cardWidth, cardHeight);
        }

        pdf.save("all-tables-qr.pdf");
      } else if (exportFormat === "SVG") {
        // Bulk SVG packaged into a single ZIP file
        const zip = new JSZip();

        for (const table of tables) {
          setBulkProgress({ current: table.tableNumber, total: tableCount });

          const element =
            document.getElementById(`qr-card-export-${table.tableNumber}`) ||
            bulkCardRefs.current[table.tableNumber];
          if (!element) continue;

          const svgDataUrl = await toSvg(element, {
            cacheBust: true,
            style: { transform: "none" },
          });

          let svgContent: string;
          if (svgDataUrl.startsWith("data:image/svg+xml;charset=utf-8,")) {
            svgContent = decodeURIComponent(
              svgDataUrl.replace("data:image/svg+xml;charset=utf-8,", "")
            );
          } else if (svgDataUrl.startsWith("data:image/svg+xml;base64,")) {
            svgContent = atob(svgDataUrl.replace("data:image/svg+xml;base64,", ""));
          } else {
            const res = await fetch(svgDataUrl);
            svgContent = await res.text();
          }

          zip.file(`table-${table.tableNumber}-qr.svg`, svgContent);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, "all-tables-qr-svg.zip");
      } else {
        // Bulk PNG packaged into a single ZIP file
        const zip = new JSZip();

        for (const table of tables) {
          setBulkProgress({ current: table.tableNumber, total: tableCount });

          const element =
            document.getElementById(`qr-card-export-${table.tableNumber}`) ||
            bulkCardRefs.current[table.tableNumber];
          if (!element) continue;

          const dataUrl = await toPng(element, {
            pixelRatio: 2,
            cacheBust: true,
            style: { transform: "none" },
          });

          // Strip header and add base64 to JSZip
          const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
          zip.file(`table-${table.tableNumber}-qr.png`, base64Data, { base64: true });
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, "all-tables-qr.zip");
      }
    } catch (error) {
      console.error("Bulk QR download error:", error);
      alert("เกิดข้อผิดพลาดในการดาวน์โหลดการ์ดทั้งหมด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsBulkDownloading(false);
      setBulkProgress(null);
    }
  };

  return (
    <div className="p-gutter max-w-[1200px] w-full mx-auto">
      {/* Hidden container for bulk export rendering */}
      <div
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          pointerEvents: "none",
          zIndex: -999,
        }}
        aria-hidden="true"
      >
        {tables.map((table) => {
          const qrUrl = getTableTargetUrl(table.tableNumber);
          return (
            <div
              key={table.tableNumber}
              id={`qr-card-export-${table.tableNumber}`}
              ref={(el) => {
                bulkCardRefs.current[table.tableNumber] = el;
              }}
            >
              <QrTableCard
                tableNumber={table.tableNumber}
                preset={preset}
                storeName="ScanSip"
                tableTargetUrl={qrUrl}
              />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter">
        {/* Generator Setup (Left Column) */}
        <div className="xl:col-span-4 flex flex-col gap-stack-lg">
          {/* Batch Generation Card */}
          <div className="bg-surface-card rounded-xl border border-border-subtle p-stack-lg shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2 mb-stack-md">
              <QrCode className="w-5 h-5 text-primary shrink-0" />
              <h2 className="font-headline-md text-headline-md text-on-background font-bold">
                สร้าง QR Code
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
                  จำนวนโต๊ะทั้งหมด (1 - 50 โต๊ะ)
                </label>
                <input
                  className={`w-full h-[36px] px-3 border rounded-lg font-body-md text-body-md text-on-background focus:outline-none transition-all bg-surface-bright ${
                    tableCountError
                      ? "border-error focus:border-error focus:ring-2 focus:ring-error/20"
                      : "border-border-subtle focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                  }`}
                  id="table-count"
                  type="number"
                  min={1}
                  max={50}
                  value={tableCountInput}
                  onChange={handleTableCountChange}
                />
                {tableCountError && (
                  <p className="text-xs text-error font-body-sm mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{tableCountError}</span>
                  </p>
                )}
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
                {
                  format: "PNG" as ExportFormat,
                  label: "PNG (รูปภาพความละเอียดสูง)",
                  icon: ImageIcon,
                  color: "text-blue-500",
                },
                {
                  format: "PDF" as ExportFormat,
                  label: "PDF (เอกสารพร้อมพิมพ์ A4)",
                  icon: FileText,
                  color: "text-red-500",
                },
                {
                  format: "SVG" as ExportFormat,
                  label: "SVG (ไฟล์เวกเตอร์)",
                  icon: PenTool,
                  color: "text-amber-500",
                },
              ].map(({ format, label, icon: IconComponent, color }) => (
                <label
                  key={format}
                  className={`flex items-center gap-stack-sm cursor-pointer p-stack-sm rounded-lg transition-colors ${
                    exportFormat === format ? "bg-primary/5 font-medium" : "hover:bg-surface-container-low"
                  }`}
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
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Preview Area (Right Column) */}
        <div className="xl:col-span-8">
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
                  disabled={isBulkDownloading || Boolean(tableCountError)}
                  className="h-[32px] px-stack-md border border-border-subtle bg-surface-card text-primary font-label-md text-label-md rounded-lg hover:bg-surface-container-low transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
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
                  disabled={isBulkDownloading || Boolean(tableCountError)}
                  className="h-[32px] px-stack-md border border-border-subtle bg-surface-card text-primary font-label-md text-label-md rounded-lg hover:bg-surface-container-low transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
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

              {/* Physical Card Stand preview */}
              <QrTableCard
                ref={cardRef}
                tableNumber={currentTable}
                preset={preset}
                storeName="ScanSip"
                tableTargetUrl={currentTableTargetUrl}
              />
            </div>

            {/* Bottom Actions */}
            <div className="p-3 sm:px-stack-lg sm:py-stack-md border-t border-border-subtle flex flex-wrap items-center justify-end gap-2 sm:gap-stack-md bg-surface-bright">
              {/* Format Selector Dropdown on Download Bar */}
              <div className="flex items-center gap-1.5 bg-surface-card border border-border-subtle rounded-lg px-2.5 h-[36px] shadow-2xs">
                <span className="font-label-md text-label-md text-on-surface-variant text-xs">
                  ฟอร์แมต:
                </span>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  disabled={isSingleDownloading || isBulkDownloading || Boolean(tableCountError)}
                  className="bg-transparent font-label-md text-label-md text-primary font-semibold focus:outline-none cursor-pointer pr-1 disabled:opacity-50"
                >
                  <option value="PNG">PNG (รูปภาพ)</option>
                  <option value="PDF">PDF (พร้อมพิมพ์ A4)</option>
                  <option value="SVG">SVG (เวกเตอร์)</option>
                </select>
              </div>

              {/* Bulk Download button */}
              <button
                type="button"
                onClick={handleDownloadBulk}
                disabled={isBulkDownloading || isSingleDownloading || Boolean(tableCountError)}
                className="h-[36px] px-stack-md border border-border-subtle bg-surface-card text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-1.5 cursor-pointer font-label-md text-label-md rounded-lg disabled:opacity-50"
              >
                {isBulkDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>
                      กำลังสร้าง {exportFormat} ({bulkProgress?.current || 0}/{tableCount})...
                    </span>
                  </>
                ) : (
                  <>
                    {exportFormat === "PDF" ? (
                      <FileText className="w-4 h-4 text-primary" />
                    ) : (
                      <Archive className="w-4 h-4 text-primary" />
                    )}
                    <span>
                      {exportFormat === "PDF"
                        ? "ดาวน์โหลดทุกโต๊ะ (.PDF รวมทุกหน้า)"
                        : exportFormat === "SVG"
                        ? "ดาวน์โหลดทุกโต๊ะ (.ZIP รวม SVG)"
                        : "ดาวน์โหลดทุกโต๊ะ (.ZIP)"}
                    </span>
                  </>
                )}
              </button>

              {/* Single Download button */}
              <button
                type="button"
                onClick={handleDownloadSingle}
                disabled={isSingleDownloading || isBulkDownloading || Boolean(tableCountError)}
                className="h-[36px] px-stack-md bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary-container transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSingleDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังส่งออก {exportFormat}...</span>
                  </>
                ) : (
                  <>
                    {exportFormat === "PDF" ? (
                      <FileText className="w-4 h-4" />
                    ) : exportFormat === "SVG" ? (
                      <PenTool className="w-4 h-4" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>ดาวน์โหลดโต๊ะ {formattedTable} ({exportFormat})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
