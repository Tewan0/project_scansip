"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createCartStore, SERVER_CART_SNAPSHOT } from "@/lib/customer-cart";

// The page is keyed by store/table/session so a different QR gets a fresh controller.
export function useCustomerCart(key: string) {
  const [store] = useState(() => {
    let storage: Storage | null = null;
    try { if (typeof window !== "undefined") storage = window.localStorage; } catch { /* Private/blocked storage. */ }
    return createCartStore(storage, key);
  });
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => SERVER_CART_SNAPSHOT);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) store.reload(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, store]);
  return { ...snapshot, updateDraft: store.update };
}
