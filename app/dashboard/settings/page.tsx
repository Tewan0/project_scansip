"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [storeName, setStoreName] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("scansip_store_info");
        if (stored) return JSON.parse(stored).storeName || "The Coffee Corner";
      } catch {
        // ignore
      }
    }
    return "The Coffee Corner";
  });

  const [promptPayNumber, setPromptPayNumber] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("scansip_store_info");
        if (stored) return JSON.parse(stored).promptPayNumber || "081-234-5678";
      } catch {
        // ignore
      }
    }
    return "081-234-5678";
  });

  const [openingTime, setOpeningTime] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("scansip_store_info");
        if (stored) return JSON.parse(stored).openingTime || "08:00";
      } catch {
        // ignore
      }
    }
    return "08:00";
  });

  const [closingTime, setClosingTime] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("scansip_store_info");
        if (stored) return JSON.parse(stored).closingTime || "18:00";
      } catch {
        // ignore
      }
    }
    return "18:00";
  });

  const [currency, setCurrency] = useState("THB (฿)");
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "scansip_store_info",
        JSON.stringify({
          storeName,
          promptPayNumber,
          openingTime,
          closingTime,
        })
      );
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-stack-md md:p-margin-page">
      <div className="max-w-3xl mx-auto space-y-stack-lg">
        {saved && (
          <div className="p-stack-sm rounded-lg bg-status-success/10 border border-status-success/30 text-status-success flex items-center gap-2 text-xs">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            <span>Settings successfully saved!</span>
          </div>
        )}

        <div className="bg-surface-card rounded-xl border border-border-subtle p-gutter shadow-xs">
          <div className="flex items-center gap-2 mb-stack-sm">
            <span className="material-symbols-outlined text-primary text-[22px]">
              storefront
            </span>
            <h2 className="font-headline-md text-headline-md font-bold text-primary">
              Store Information
            </h2>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-stack-lg">
            Manage your cafe/restaurant details and payment settings.
          </p>

          <form onSubmit={handleSave} className="space-y-stack-md">
            <div>
              <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface mb-unit">
                <span className="material-symbols-outlined text-[16px]">store</span>
                Store Name
              </label>
              <input
                className="w-full h-[36px] px-3 font-body-md text-body-md bg-surface border border-border-subtle rounded-lg focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-on-surface"
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />
            </div>

            <div>
              <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface mb-unit">
                <span className="material-symbols-outlined text-[16px]">payments</span>
                PromptPay Number (Payment Recipient)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                    payments
                  </span>
                </div>
                <input
                  className="w-full h-[36px] pl-10 pr-3 font-body-md text-body-md bg-surface border border-border-subtle rounded-lg focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-on-surface"
                  type="text"
                  required
                  value={promptPayNumber}
                  onChange={(e) => setPromptPayNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
              <div>
                <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface mb-unit">
                  <span className="material-symbols-outlined text-[16px]">alarm_on</span>
                  Opening Time
                </label>
                <input
                  className="w-full h-[36px] px-3 font-body-md text-body-md bg-surface border border-border-subtle rounded-lg focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-on-surface"
                  type="time"
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                />
              </div>
              <div>
                <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface mb-unit">
                  <span className="material-symbols-outlined text-[16px]">alarm_off</span>
                  Closing Time
                </label>
                <input
                  className="w-full h-[36px] px-3 font-body-md text-body-md bg-surface border border-border-subtle rounded-lg focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-on-surface"
                  type="time"
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface mb-unit">
                <span className="material-symbols-outlined text-[16px]">currency_exchange</span>
                Currency Display
              </label>
              <select
                className="w-full h-[36px] px-3 font-body-md text-body-md bg-surface border border-border-subtle rounded-lg focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-on-surface cursor-pointer"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option>THB (฿)</option>
                <option>USD ($)</option>
              </select>
            </div>

            <div className="pt-stack-md border-t border-border-subtle flex justify-end">
              <button
                type="submit"
                className="px-stack-lg h-9 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary/90 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
