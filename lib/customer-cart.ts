export type CartLine = { menuItemId: string; name: string; quantity: number; note: string };
export type CartDraft = { items: CartLine[]; customerNote: string };
type CartSnapshot = { draft: CartDraft; ready: boolean; persistent: boolean };
type CartStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const MAX_CART_QUANTITY = 99;
export const MAX_CART_LINES = 50;
const emptyDraft = (): CartDraft => ({ items: [], customerNote: "" });
export const SERVER_CART_SNAPSHOT: CartSnapshot = { draft: emptyDraft(), ready: false, persistent: true };

export function cartStorageKey(store: string, table: string, session: string) {
  return session ? "scansip-cart:v1:" + JSON.stringify([store, table, session]) : "";
}

export function parseCartDraft(raw: string | null): CartDraft {
  if (!raw) return emptyDraft();
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Array.isArray(data.items)) return emptyDraft();
    const seen = new Set<string>();
    const items: CartLine[] = [];
    for (const line of data.items) {
      if (!line || typeof line.menuItemId !== "string" || !line.menuItemId || line.menuItemId.length > 100 ||
        !Number.isInteger(line.quantity) || line.quantity < 1 || seen.has(line.menuItemId)) continue;
      seen.add(line.menuItemId);
      items.push({ menuItemId: line.menuItemId, name: typeof line.name === "string" ? line.name.slice(0, 200) : "เมนูเดิม",
        quantity: Math.min(line.quantity, MAX_CART_QUANTITY), note: typeof line.note === "string" ? line.note.slice(0, 300) : "" });
      if (items.length === MAX_CART_LINES) break;
    }
    return { items, customerNote: typeof data.customerNote === "string" ? data.customerNote.slice(0, 500) : "" };
  } catch { return emptyDraft(); }
}

// Save only draft selections. Prices and availability always come from the current menu.
export function createCartStore(storage: CartStorage | null, key: string) {
  let snapshot: CartSnapshot;
  const listeners = new Set<() => void>();
  function read(): CartSnapshot {
    try { return { draft: parseCartDraft(storage && key ? storage.getItem(key) : null), ready: true, persistent: Boolean(storage && key) }; }
    catch { return { draft: emptyDraft(), ready: true, persistent: false }; }
  }
  snapshot = read();
  function publish(next: CartSnapshot) { snapshot = next; listeners.forEach(listener => listener()); }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    reload() { publish(read()); },
    update(updater: (previous: CartDraft) => CartDraft) {
      const draft = updater(snapshot.draft);
      let persistent = Boolean(storage && key);
      try {
        if (storage && key) {
          if (!draft.items.length && !draft.customerNote) storage.removeItem(key);
          else storage.setItem(key, JSON.stringify({ version: 1, ...draft }));
        }
      } catch { persistent = false; }
      // Update memory even when storage is blocked; do not prevent ordering.
      publish({ draft, ready: true, persistent });
    },
  };
}
