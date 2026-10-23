import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";

function runtime(overrides = {}) {
  const slots = [], cleanups = []; let cursor = 0;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }];
    },
    useRef(value) { return react.useState(() => ({ current: value }))[0]; },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((dep, n) => dep !== slots[i][n])) { slots[i] = deps; cleanups.push(effect()); }
    },
  };
  const f = fixture("owner", {
    react,
    "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"].map(name => [name, name])),
    "@/components/ui/button": { Button: "Button" },
    ...overrides,
  });
  return { ...f, render(fn) { cursor = 0; return fn(); }, dispose() { cleanups.forEach(fn => fn?.()); } };
}
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : []; }
function text(tree) { return typeof tree === "string" ? tree : Array.isArray(tree) ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : ""; }

test("confirmation waits for an explicit choice, rejects overlapping prompts, and cancels on dismiss or unmount", async () => {
  const r = runtime();
  const useConfirmation = r.load("hooks/use-confirmation.tsx").useConfirmation;
  const render = () => r.render(useConfirmation);
  let current = render(), ran = 0;
  const result = current.confirm({ title: "ลบเมนู", description: "ลบกาแฟ?", confirmLabel: "ลบ" }).then(ok => { if (ok) ran++; return ok; });
  assert.equal(ran, 0);
  assert.equal(await current.confirm({ title: "อีกอัน", description: "ไม่ควรแทนที่" }), false);
  current = render(); assert.match(text(current.confirmationDialog), /ลบกาแฟ/);
  const cancel = nodes(current.confirmationDialog).find(node => node.type === "Button" && text(node) === "ยกเลิก");
  const content = nodes(current.confirmationDialog).find(node => node.type === "DialogContent");
  assert.equal(content.props.initialFocus, cancel.props.ref);
  cancel.props.onClick(); assert.equal(await result, false); assert.equal(ran, 0);
  assert.equal(render().confirmationDialog, null);

  const yes = render().confirm({ title: "ลบ", description: "กาแฟ" });
  nodes(render().confirmationDialog).find(node => node.type === "Button" && text(node) === "ยืนยัน").props.onClick();
  assert.equal(await yes, true);
  const dismissed = render().confirm({ title: "ปิดโต๊ะ", description: "QR จะหมดอายุ" });
  render().confirmationDialog.props.onOpenChange(false); assert.equal(await dismissed, false);
  const unmounted = render().confirm({ title: "ลบ", description: "ออกจากหน้า" });
  r.dispose(); assert.equal(await unmounted, false);
});

test("edit menu blocks closing and double submit while saving, preserves errors, then closes after success", async () => {
  let finish, sent = 0, closed = 0, saved = 0;
  const r = runtime({ "@/app/actions/menu": { updateMenuItem: () => { sent++; return new Promise(resolve => { finish = resolve; }); } } });
  const Edit = r.load("app/dashboard/menu/EditMenuItemModal.tsx").default;
  const item = { id: "coffee", name: "กาแฟ", price: "50.25", categoryId: null, isAvailable: true };
  const render = () => r.render(() => Edit({ item, isOpen: true, categories: [], onClose() { closed++; }, onSuccess() { saved++; } }));
  let tree = render();
  const submit = nodes(tree).find(node => node.type === "form").props.onSubmit;
  const pending = submit({ preventDefault() {} });
  await submit({ preventDefault() {} }); assert.equal(sent, 1);
  tree = render(); assert.equal(nodes(tree).find(node => node.type === "fieldset").props.disabled, true);
  tree.props.onOpenChange(false); assert.equal(closed, 0);
  finish({ success: false, error: "บันทึกไม่ได้" }); await pending;
  tree = render(); assert.match(text(tree), /บันทึกไม่ได้/);
  assert.ok(nodes(tree).some(node => node.type === "input" && node.props.value === "กาแฟ"));
  assert.equal(closed, 0); assert.equal(saved, 0);
  const retry = nodes(tree).find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
  finish({ success: true, data: item }); await retry;
  assert.equal(sent, 2); assert.equal(saved, 1); assert.equal(closed, 1);
  r.dispose();
});

test("logout button prompts for confirmation before signing out and cancels cleanly", async () => {
  let submitted = 0;
  const r = runtime();
  const LogoutButton = r.load("components/logout-button.tsx").LogoutButton;
  const render = () => r.render(() => LogoutButton({
    children: "ออกจากระบบ",
    onConfirm() { submitted++; }
  }));

  let tree = render();
  assert.equal(submitted, 0);
  assert.equal(tree.props.children[1], null); // no dialog initially

  // Find the button and click it
  const btn = nodes(tree).find(node => node.type === "button");
  assert.ok(btn);

  let defaultPrevented = false;
  const event = { preventDefault() { defaultPrevented = true; } };
  const clickPromise = btn.props.onClick(event);
  assert.equal(defaultPrevented, true);

  // Dialog should now be open
  tree = render();
  const dialog = tree.props.children[1];
  assert.ok(dialog);
  assert.match(text(dialog), /ยืนยันการออกจากระบบ/);
  assert.match(text(dialog), /คุณต้องการออกจากระบบใช่หรือไม่/);

  // Cancel first
  const cancelBtn = nodes(dialog).find(node => node.type === "Button" && text(node) === "ยกเลิก");
  assert.ok(cancelBtn);
  cancelBtn.props.onClick();
  await clickPromise;

  // Nothing submitted, dialog closed
  assert.equal(submitted, 0);
  tree = render();
  assert.equal(tree.props.children[1], null);

  // Click again, this time confirm
  const btn2 = nodes(tree).find(node => node.type === "button");
  const clickPromise2 = btn2.props.onClick({ preventDefault() {} });
  tree = render();
  const dialog2 = tree.props.children[1];
  const confirmBtn = nodes(dialog2).find(node => node.type === "Button" && text(node) === "ออกจากระบบ");
  assert.ok(confirmBtn);
  confirmBtn.props.onClick();
  await clickPromise2;

  // Confirmed! Submitted count incremented
  assert.equal(submitted, 1);
  r.dispose();
});

