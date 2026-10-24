import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, request } from "./helpers.mjs";

const requestId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const product="11111111-1111-1111-1111-111111111111";
const payload={storeSlug:"cafe-a",tableNumber:1,sessionToken:"round-a",requestId,items:[{menuItemId:product,quantity:2,specialInstruction:"no ice"}],customerNote:"share"};
function setup(){
  const f=fixture("anonymous");
  f.state.tables.push({id:"table-a",storeId:"shop-a",tableNumber:1,status:"occupied",currentSessionToken: "round-a", sessionStartedAt: new Date()});
  f.state.menuItems.push({id:product,storeId:"shop-a",name:"Coffee",price:"50.00",isAvailable:true});
  return {...f,post:f.load("app/api/orders/route.ts").POST};
}

test("lost-response retry returns the original order and lines, even after menu changes",async()=>{
  const f=setup();const first=await (await f.post(request(payload))).json();
  f.state.menuItems=[];
  const response=await f.post(request(payload));assert.equal(response.status,201);
  const replay=await response.json();
  assert.equal(replay.data.id,first.data.id);assert.equal(replay.data.totalAmount,"100.00");
  assert.equal(replay.data.items[0].id,first.data.items[0].id);
  assert.equal(f.state.orders.length,1);assert.equal(f.state.orderItems.length,1);
  assert.equal(replay.data.requestHash,undefined);assert.equal(replay.data.sessionToken,undefined);
});

test("same request key with changed selections is rejected instead of silently submitting another order",async()=>{
  const f=setup();await f.post(request(payload));
  for(const body of [{...payload,customerNote:"different"},{...payload,items:[{menuItemId:product,quantity:3}]}]) {
    assert.equal((await f.post(request(body))).status,409);
  }
  assert.equal(f.state.orders.length,1);
});

test("a deliberate new request creates a second order, while legacy requests still work",async()=>{
  const f=setup();await f.post(request(payload));
  assert.equal((await f.post(request({...payload,requestId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}))).status,201);
  const {requestId:unused,...legacy}=payload;void unused;
  assert.equal((await f.post(request(legacy))).status,201);
  assert.equal(f.state.orders.length,3);
});

test("replay still requires the current QR; keys are scoped to store, table and round",async()=>{
  const f=setup();await f.post(request(payload));
  f.state.tables[0].currentSessionToken="round-b";
  assert.equal((await f.post(request(payload))).status,403);
  assert.equal((await f.post(request({...payload,sessionToken:"round-b"}))).status,201);
  f.state.tables.push({id:"table-b",storeId:"shop-a",tableNumber:2,status:"occupied",currentSessionToken: "round-c", sessionStartedAt: new Date()});
  assert.equal((await f.post(request({...payload,tableNumber:2,sessionToken:"round-c"}))).status,201);
  assert.equal((await f.post(request({...payload,storeSlug:"cafe-b"}))).status,403);
  assert.equal(f.state.orders.length,3);
});

test("invalid keys and rejected menus cannot reserve a key or create an order",async()=>{
  const f=setup();
  for(const key of [null,"",123,"forged-key"])assert.equal((await f.post(request({...payload,requestId:key}))).status,400);
  f.state.menuItems[0].isAvailable=false;assert.equal((await f.post(request(payload))).status,400);
  assert.equal(f.state.orders.length,0);
  f.state.menuItems[0].isAvailable=true;assert.equal((await f.post(request(payload))).status,201);
});
