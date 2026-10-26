import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { imageFile } from "./image-fixtures.mjs";

const ui = names => Object.fromEntries(names.map(name => [name, name]));
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const text = tree => typeof tree === "string" ? tree : Array.isArray(tree) ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : "";
async function page(file) {
  const slots = [], effects = [], calls = []; let cursor = 0;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }];
    },
    useRef(value) { return react.useState(() => ({ current: value }))[0]; },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((dep, n) => dep !== slots[i].deps[n])) {
        const old = slots[i]; slots[i] = { deps };
        effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
    useTransition() { return [false, fn => fn()]; },
  };
  const f = fixture("owner", {
    react,
    "next/navigation": { useRouter: () => ({ push() {} }) },
    "@/components/theme-toggle": { ThemeToggle: "ThemeToggle" },
    "@/components/logout-button": { LogoutButton: "LogoutButton" },
    "@/utils/supabase/client": { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { email: "owner@example.com" } } }) } }) },
    "@/app/actions/owner-auth": { checkSlugAvailability: async () => ({ available: true }) },
    "@/hooks/use-confirmation": { useConfirmation: () => ({ confirm: async () => true, confirmationDialog: null }) },
    "@/components/ui/button": ui(["Button"]), "@/components/ui/badge": ui(["Badge"]),
    "@/components/ui/input": ui(["Input"]), "@/components/ui/label": ui(["Label"]),
    "@/components/ui/skeleton": ui(["Skeleton"]),
    "@/components/ui/avatar": ui(["Avatar", "AvatarImage", "AvatarFallback"]),
    "@/components/ui/card": ui(["Card", "CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter"]),
    "@/components/ui/dialog": ui(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"]),
  }, { fetch: async (url, options) => {
    calls.push({ url, options });
    if (options) return Response.json({ success: true, url: "https://example.com/logo.png" });
    return Response.json({ success: true, data: url === "/api/store" ? { name: "Cafe", slug: "cafe" } : [] });
  } });
  const Page = f.load(file).default;
  const props = { isOpen: true, item: { id: "item", name: "Coffee", price: "50", isAvailable: true }, categories: [], onClose() {}, onSuccess() {} };
  const render = () => { cursor = 0; return Page(props); };
  render(); effects.splice(0).forEach(fn => fn());
  await new Promise(resolve => setTimeout(resolve, 0));
  let tree = render();
  if (file === "app/dashboard/menu/page.tsx") {
    nodes(tree).find(node => node.type === "Button" && text(node).includes("เพิ่มเมนูใหม่")).props.onClick();
    tree = render();
  }
  return { f, calls, render, dispose() { slots.forEach(slot => slot?.cleanup?.()); } };
}

for (const file of ["app/owner/onboarding/page.tsx", "app/dashboard/settings/page.tsx", "app/dashboard/menu/page.tsx", "app/dashboard/menu/EditMenuItemModal.tsx"]) {
  test(file + " rejects oversized, empty and unsupported images before upload or preview", async () => {
    const p = await page(file);
    try {
      const { IMAGE_ACCEPT, IMAGE_UPLOAD_ERROR } = p.f.load("lib/image-upload.ts");
      for (const bad of [imageFile({ size: 4 * 1024 * 1024 + 1 }), new File([], "empty.png", { type: "image/png" }), new File(["<svg/>"], "x.svg", { type: "image/svg+xml" })]) {
        const input = nodes(p.render()).find(node => node.props.type === "file");
        assert.equal(input.props.accept, IMAGE_ACCEPT);
        const target = { files: [bad], value: "chosen-file" };
        await input.props.onChange({ target });
        assert.equal(target.value, "");
        assert.ok(text(p.render()).includes(IMAGE_UPLOAD_ERROR));
        assert.equal(p.calls.filter(call => call.options?.method === "POST").length, 0);
        assert.equal(nodes(p.render()).some(node => node.props.src?.startsWith("blob:")), false);
      }
      // A supported image above the old 1 MB limit can still be chosen.
      await nodes(p.render()).find(node => node.props.type === "file").props.onChange({ target: { files: [imageFile({ size: 2 * 1024 * 1024 })] } });
      assert.equal(text(p.render()).includes(IMAGE_UPLOAD_ERROR), false);
      if (file.includes("menu/")) assert.ok(nodes(p.render()).some(node => node.props.src?.startsWith("blob:")));
      else assert.equal(p.calls.filter(call => call.options?.method === "POST").length, 1);
    } finally { p.dispose(); }
  });
}

test("configured Server Action transport covers the shared multipart limit and stays below Vercel", () => {
  const f = fixture();
  const policy = f.load("lib/image-upload.ts");
  const config = f.load("next.config.ts").default;
  assert.equal(policy.UPLOAD_FILE_BYTES, 4 * 1024 * 1024);
  assert.equal(config.experimental.serverActions.bodySizeLimit, policy.UPLOAD_BODY_BYTES);
  assert.ok(policy.UPLOAD_BODY_BYTES > policy.UPLOAD_FILE_BYTES);
  assert.ok(policy.UPLOAD_BODY_BYTES < 4_500_000);
});
