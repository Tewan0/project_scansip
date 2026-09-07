/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";

export default function QrCodeGeneratorPage() {
  const [tableCount, setTableCount] = useState(12);
  const [currentTable, setCurrentTable] = useState(4);
  const [preset, setPreset] = useState("Brand Primary");
  const [exportFormat, setExportFormat] = useState("PDF (Print Ready)");
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePrevTable = () => {
    setCurrentTable((prev) => (prev > 1 ? prev - 1 : tableCount));
  };

  const handleNextTable = () => {
    setCurrentTable((prev) => (prev < tableCount ? prev + 1 : 1));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 600);
  };

  const formattedTable = String(currentTable).padStart(2, "0");

  // Generate dynamic QR code image URL for the specific table
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https://scansip.app/table/${currentTable}&color=3c220e`;

  return (
    <div className="p-gutter max-w-[1200px] w-full mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Generator Setup (Left Column) */}
        <div className="lg:col-span-4 flex flex-col gap-stack-lg">
          {/* Batch Generation Card */}
          <div className="bg-surface-card rounded-xl border border-border-subtle p-stack-lg shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2 mb-stack-md">
              <span className="material-symbols-outlined text-primary text-[22px]">
                qr_code_2
              </span>
              <h2 className="font-headline-md text-headline-md text-on-background font-bold">
                Batch Generation
              </h2>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-stack-lg">
              Instantly generate unique QR codes for your tables. These codes link directly to your digital menu.
            </p>
            <div className="flex flex-col gap-stack-md">
              <div>
                <label
                  className="flex items-center gap-1 font-label-md text-label-md text-on-background mb-unit"
                  htmlFor="table-count"
                >
                  <span className="material-symbols-outlined text-[15px]">table_restaurant</span>
                  Number of Tables
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
                  <span className="material-symbols-outlined text-[15px]">palette</span>
                  Design Preset
                </label>
                <div className="relative">
                  <select
                    className="w-full h-[36px] px-3 border border-border-subtle rounded-lg font-body-md text-body-md text-on-background focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all bg-surface-bright appearance-none pr-10 cursor-pointer"
                    id="design-preset"
                    value={preset}
                    onChange={(e) => setPreset(e.target.value)}
                  >
                    <option>Brand Primary</option>
                    <option>Minimal Dark</option>
                    <option>High Contrast</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[20px]">
                    expand_more
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="mt-stack-sm w-full h-[40px] bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary-container transition-colors duration-200 flex items-center justify-center gap-unit cursor-pointer disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">
                  auto_awesome
                </span>
                {isGenerating ? "Generating..." : "Generate Codes"}
              </button>
            </div>
          </div>

          {/* Export Options Card */}
          <div className="bg-surface-card rounded-xl border border-border-subtle p-stack-lg shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2 mb-stack-md">
              <span className="material-symbols-outlined text-primary text-[22px]">
                ios_share
              </span>
              <h2 className="font-headline-md text-headline-md text-on-background font-bold">
                Export Options
              </h2>
            </div>
            <div className="flex flex-col gap-stack-sm">
              {[
                { format: "PDF (Print Ready)", icon: "picture_as_pdf", color: "text-red-500" },
                { format: "PNG (Digital Assets)", icon: "image", color: "text-blue-500" },
                { format: "SVG (Vector)", icon: "draw", color: "text-amber-500" },
              ].map(({ format, icon, color }) => (
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
                  <span className={`material-symbols-outlined text-[18px] ${color}`}>
                    {icon}
                  </span>
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
                <span className="material-symbols-outlined text-primary text-[22px]">
                  visibility
                </span>
                <h2 className="font-headline-md text-headline-md text-on-background font-bold">
                  Preview: Table {formattedTable}
                </h2>
              </div>
              <div className="flex items-center gap-stack-sm">
                <button
                  type="button"
                  onClick={handlePrevTable}
                  className="h-[32px] px-stack-md border border-border-subtle bg-surface-card text-primary font-label-md text-label-md rounded-lg hover:bg-surface-container-low transition-colors flex items-center justify-center cursor-pointer"
                  title="Previous Table"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
                <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center px-1">
                  {currentTable} of {tableCount}
                </span>
                <button
                  type="button"
                  onClick={handleNextTable}
                  className="h-[32px] px-stack-md border border-border-subtle bg-surface-card text-primary font-label-md text-label-md rounded-lg hover:bg-surface-container-low transition-colors flex items-center justify-center cursor-pointer"
                  title="Next Table"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
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
                  preset === "Minimal Dark"
                    ? "bg-inverse-surface border-inverse-surface text-inverse-on-surface"
                    : preset === "High Contrast"
                    ? "bg-white border-black text-black"
                    : "bg-surface-card border-border-subtle text-on-background"
                }`}
              >
                <div className="text-center w-full">
                  <div className="flex items-center justify-center gap-unit mb-unit">
                    <span
                      className={`material-symbols-outlined text-[24px] ${
                        preset === "Minimal Dark" ? "text-inverse-primary" : "text-primary"
                      }`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      coffee
                    </span>
                    <span
                      className={`font-headline-md text-headline-md font-bold tracking-tight ${
                        preset === "Minimal Dark" ? "text-inverse-primary" : "text-primary"
                      }`}
                    >
                      ScanSip
                    </span>
                  </div>
                  <div className="h-[1px] w-12 bg-border-subtle mx-auto mb-stack-md"></div>
                  <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">
                    Table
                  </p>
                  <p
                    className={`font-headline-xl text-headline-xl font-bold mt-unit ${
                      preset === "Minimal Dark" ? "text-white" : "text-primary"
                    }`}
                  >
                    {formattedTable}
                  </p>
                </div>

                {/* QR Code Container */}
                <div className="w-[160px] h-[160px] bg-white border-2 border-border-subtle rounded-xl flex items-center justify-center p-2 shadow-xs">
                  <img
                    alt={`QR Code for Table ${formattedTable}`}
                    className="w-full h-full object-contain"
                    src={qrUrl}
                    onError={(e) => {
                      // Fallback image from mockup
                      (e.target as HTMLImageElement).src =
                        "https://lh3.googleusercontent.com/aida-public/AB6AXuCYY4abvFMhZhHCl610Df5kH1kvBhso-vyVC-aDefLsnE7pV5HXee3sYifesn5OaCFbmhkuvTJU7uAc7VRkWyvNe-AwDhvWpamDWafkdLmd11b6RpVwTl_F9tFEC2cvPljWLA7JsBUs1QeOzwqlWaYjmuOWTsZbvioK2QZ3Q4u1nSLbeCj9YTPZJ2fXqQfJ2buq3-IziEtRDl8bjB-DB9K59MAql3SMB86gXBooruZ4X9um0YjpSxKegA";
                    }}
                  />
                </div>

                <div className="text-center mt-stack-md">
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Scan to view menu
                    <br />
                    and order
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
                className="h-[36px] px-stack-md border border-border-subtle bg-surface-card text-primary font-label-md text-label-md rounded-lg hover:bg-surface-container-low transition-colors flex items-center gap-unit cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download Table {formattedTable}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="h-[36px] px-stack-md bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary-container transition-colors flex items-center gap-unit shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                Print Sheet
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
