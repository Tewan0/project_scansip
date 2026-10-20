"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { THEME_STORAGE_KEY } from "@/lib/theme";

type Theme = "light" | "dark";
const THEME_EVENT = "scansip-theme-change";
let memoryPreference: Theme | null = null;

function getPreference(): Theme | null {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "dark" || saved === "light" ? saved : memoryPreference;
  } catch { return memoryPreference; }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new Event(THEME_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  return () => window.removeEventListener(THEME_EVENT, callback);
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot() { return null; }

export function ThemeController() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => applyTheme(getPreference() ?? (media.matches ? "dark" : "light"));
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        memoryPreference = null;
        syncTheme();
      }
    };
    syncTheme();
    media.addEventListener("change", syncTheme);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", syncTheme);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const label = theme === "dark" ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด";
  return (
    <Button type="button" variant="outline" size="icon" className={`size-11 shrink-0 ${className}`}
      aria-label={label} title={label} aria-pressed={theme === "dark"}
      onClick={() => {
        const next = getSnapshot() === "dark" ? "light" : "dark";
        memoryPreference = next;
        try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* Use memory if storage is blocked. */ }
        applyTheme(next);
      }}>
      <Sun className="hidden size-4 dark:block" aria-hidden="true" />
      <Moon className="size-4 dark:hidden" aria-hidden="true" />
    </Button>
  );
}
