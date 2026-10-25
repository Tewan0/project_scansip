export type CartLine = { lineId: string; menuItemId: string; name: string; quantity: number; note: string };
export type CartDraft = { items: CartLine[]; customerNote: string; requestId?: string };
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
    const seenLineIds = new Set<string>();
    const items: CartLine[] = [];
    for (const line of data.items) {
      if (!line || typeof line.menuItemId !== "string" || !line.menuItemId || line.menuItemId.length > 100 ||
        !Number.isInteger(line.quantity) || line.quantity < 1) continue;
      // Older drafts have no line IDs. Preserve every selection, its order and
      // its note exactly: a pending checkout must retry the same payload.
      let lineId = typeof line.lineId === "string" && line.lineId.length > 0 && line.lineId.length <= 100
        ? line.lineId : "restored-" + items.length;
      if (seenLineIds.has(lineId)) lineId = "restored-" + items.length;
      while (seenLineIds.has(lineId)) lineId += "-";
      seenLineIds.add(lineId);
      items.push({ lineId, menuItemId: line.menuItemId, name: typeof line.name === "string" ? line.name.slice(0, 200) : "เมนูเดิม",
        quantity: Math.min(line.quantity, MAX_CART_QUANTITY), note: typeof line.note === "string" ? line.note.slice(0, 300) : "" });
      if (items.length === MAX_CART_LINES) break;
    }
    const requestId = typeof data.requestId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.requestId) ? data.requestId : undefined;
    return { items, customerNote: typeof data.customerNote === "string" ? data.customerNote.slice(0, 500) : "", ...(requestId && items.length ? { requestId } : {}) };
  } catch { return emptyDraft(); }
}

// Merge only new additions with the same menu and trimmed note. Editing a note
// keeps its row in place, even if it becomes identical to another row.
export function addCartLine(draft: CartDraft, selection: Omit<CartLine, "lineId">): CartDraft | null {
  if (draft.requestId || !Number.isInteger(selection.quantity) ||
    selection.quantity < 1 || selection.quantity > MAX_CART_QUANTITY) return null;
  const note = selection.note.slice(0, 300).trim();
  const existing = draft.items.find(line => line.menuItemId === selection.menuItemId && line.note.trim() === note);
  if (existing) {
    if (existing.quantity + selection.quantity > MAX_CART_QUANTITY) return null;
    return { ...draft, items: draft.items.map(line => line.lineId === existing.lineId
      ? { ...line, quantity: line.quantity + selection.quantity } : line) };
  }
  if (draft.items.length >= MAX_CART_LINES) return null;
  return { ...draft, items: [...draft.items, { ...selection, lineId: crypto.randomUUID(), note }] };
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
  const controller = {
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
    beginCheckout() {
      // A retry must reuse the same draft/key, including after a page reload.
      if (!snapshot.draft.items.length) throw new Error("ตะกร้าว่าง");
      if (!snapshot.draft.requestId) controller.update(previous => ({ ...previous, requestId: crypto.randomUUID() }));
      return snapshot.draft;
    },
    releaseCheckout() {
      controller.update(({ items, customerNote }) => ({ items, customerNote }));
    },
  };
  return controller;
}
