import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, request } from "./helpers.mjs";

function setup(role = "owner", cleanupFails = false) {
  const removed = [];
  let f;
  f = fixture(role, { "@/utils/supabase/storage": {
    validateImageUrl(value) {
      if (value === "foreign") throw new (f.load("lib/auth.ts").AccessError)("Foreign logo", 400);
      return value || null;
    },
    async deleteStorageFile(url) {
      assert.notEqual(f.state.stores[0].logoUrl, url, "database must be saved before deletion");
      removed.push(url);
      if (cleanupFails) throw new Error("cleanup unavailable");
      return true;
    },
  } });
  Object.assign(f.state.stores[0], { name: "Cafe", logoUrl: "old-logo", openingTime: "08:00", closingTime: "18:00", currency: "THB" });
  return { ...f, removed, put: f.load("app/api/store/route.ts").PUT };
}

test("settings reject malformed fields before writing or deleting the existing logo", async () => {
  for (const input of [null, [], "settings", {name:" "}, {name:"a".repeat(201)}, {name:5}, {openingTime:"25:99"}, {closingTime:null}, {closingTime:"9:30"}, {promptPayNumber:"abc"}, {promptPayNumber:123}, {promptPayNumber:"1234567890"}, {currency:"USD"}, {slug:""}, {slug:"a".repeat(201)}, {logoUrl:"foreign"}]) {
    const f = setup();
    const body = input && typeof input === "object" && !Array.isArray(input) ? {logoUrl:null, ...input} : input;
    assert.equal((await f.put(request(body))).status, 400, JSON.stringify(input));
    assert.equal(f.state.stores[0].logoUrl, "old-logo");
    assert.equal(f.writes.length, 0); assert.equal(f.removed.length, 0);
  }
});

test("settings normalize values, allow overnight hours and preserve omitted fields", async () => {
  const f = setup();
  const response = await f.put(request({ name:" Cafe updated ", promptPayNumber:"089-123-4567", openingTime:"18:00", closingTime:"02:00" }));
  assert.equal(response.status, 200);
  const store = (await response.json()).data;
  assert.equal(store.name, "Cafe updated"); assert.equal(store.promptPayNumber,"0891234567");
  assert.equal(store.logoUrl,"old-logo"); assert.equal(store.slug,"cafe-a");
  assert.equal(store.closingTime,"02:00"); assert.equal(f.removed.length,0);
  assert.equal((await f.put(request({promptPayNumber:"1234567890123"}))).status,200);
  assert.equal((await f.put(request({promptPayNumber:""}))).status,200);
  assert.equal(f.state.stores[0].promptPayNumber,null);
});

test("logo replacement and removal delete the previous file only after a successful save", async () => {
  for (const logoUrl of ["new-logo", null]) {
    const f = setup();
    assert.equal((await f.put(request({logoUrl}))).status,200);
    assert.equal(f.state.stores[0].logoUrl,logoUrl); assert.deepEqual(f.removed,["old-logo"]);
  }
  const f=setup(); await f.put(request({logoUrl:"old-logo"})); assert.equal(f.removed.length,0);
});

test("failed settings write or duplicate slug retains the old logo; failed cleanup does not fail a saved update", async () => {
  const f=setup(); f.db.update=()=>{throw new Error("database unavailable");};
  assert.equal((await f.put(request({logoUrl:null}))).status,500); assert.equal(f.removed.length,0);
  assert.equal(f.state.stores[0].logoUrl,"old-logo");
  const duplicate=setup(); assert.equal((await duplicate.put(request({slug:"cafe-b",logoUrl:null}))).status,409);
  assert.equal(duplicate.removed.length,0);
  const cleanup=setup("owner",true); assert.equal((await cleanup.put(request({logoUrl:"new-logo"}))).status,200);
  assert.equal(cleanup.state.stores[0].logoUrl,"new-logo");
});

test("non-owners cannot update settings or delete logos", async () => {
  for(const role of ["anonymous","cashier","kitchen"]) {
    const f=setup(role); assert.equal((await f.put(request({logoUrl:null}))).status,role==="anonymous"?401:403);
    assert.equal(f.removed.length,0); assert.equal(f.writes.length,0);
  }
});

function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree,...nodes(tree.props.children)] : []; }
function text(tree) { return typeof tree === "string" ? tree : Array.isArray(tree) ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : ""; }
function settingsPage(fetch) {
  const slots=[], effects=[]; let cursor=0;
  const react={
    useState(initial){const i=cursor++; if(!(i in slots))slots[i]=typeof initial==="function"?initial():initial; return [slots[i],value=>{slots[i]=typeof value==="function"?value(slots[i]):value;}];},
    useRef(value){return react.useState(()=>({current:value}))[0];},
    useEffect(fn,deps){const i=cursor++,old=slots[i]; if(!old||deps.some((dep,n)=>dep!==old[n])){slots[i]=deps;effects.push(fn);}},
  };
  const ui=names=>Object.fromEntries(names.map(name=>[name,name]));
  const f=fixture("owner",{react,
    "@/app/actions/owner-auth":{checkSlugAvailability:async()=>({available:true})},
    "@/components/ui/button":ui(["Button"]),"@/components/ui/badge":ui(["Badge"]),
    "@/components/ui/card":ui(["Card","CardHeader","CardTitle","CardDescription","CardContent","CardFooter"]),
    "@/components/ui/input":ui(["Input"]),"@/components/ui/label":ui(["Label"]),"@/components/ui/skeleton":ui(["Skeleton"]),
    "@/components/ui/avatar":ui(["Avatar","AvatarImage","AvatarFallback"]),
  },{fetch});
  const Page=f.load("app/dashboard/settings/page.tsx").default;
  const render=()=>{cursor=0;return Page();};
  return {render,async ready(){render();effects.splice(0).forEach(fn=>fn());await new Promise(resolve=>setTimeout(resolve,0));return render();}};
}

test("removing a logo in the actual settings form makes no DELETE request and saving sends null", async () => {
  const backend=setup(), calls=[];
  const page=settingsPage(async(url,options)=>{
    calls.push({url,method:options?.method||"GET"});
    if(!options)return Response.json({success:true,data:backend.state.stores[0]});
    assert.equal(options.method,"PUT"); assert.equal(JSON.parse(options.body).logoUrl,null);
    return backend.put(new Request("http://localhost/api/store",options));
  });
  let tree=await page.ready();
  nodes(tree).find(n=>n.type==="Button"&&text(n)==="ลบรูปภาพ").props.onClick();
  assert.equal(calls.length,1);assert.equal(backend.state.stores[0].logoUrl,"old-logo");
  tree=page.render();await nodes(tree).find(n=>n.type==="form").props.onSubmit({preventDefault(){}});
  assert.equal(backend.state.stores[0].logoUrl,null); assert.deepEqual(backend.removed,["old-logo"]);
});

test("failed initial settings load shows retry and never exposes a blank editable form",async()=>{
  const page=settingsPage(async()=>Response.json({success:false},{status:500}));
  const tree=await page.ready();
  assert.ok(nodes(tree).some(n=>n.props.role==="alert"));assert.ok(!nodes(tree).some(n=>n.type==="form"));
  assert.ok(nodes(tree).some(n=>n.type==="Button"&&text(n)==="ลองโหลดอีกครั้ง"));
});
