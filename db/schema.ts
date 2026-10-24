import {
  pgTable,
  text,
  timestamp,
  numeric,
  integer,
  boolean,
  uuid,
  pgEnum,
  unique,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Enums
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "preparing",
  "served",
  "completed",
  "cancelled",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid",
  "paid",
  "refunded",
]);

export const staffRoleEnum = pgEnum("staff_role", [
  "owner",
  "manager",
  "cashier",
  "kitchen",
]);

export const tableStatusEnum = pgEnum("table_status", [
  "available",
  "occupied",
  "reserved",
]);

// 1. Stores (ร้านค้า)
export const stores = pgTable("stores", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").notNull(), // maps to auth.users.id
  name: text("name").notNull(),
  slug: text("slug").unique(), // URL identifier เช่น scansip, cafe-amazon
  logoUrl: text("logo_url"),
  promptPayNumber: text("promptpay_number"),
  openingTime: text("opening_time").default("08:00"),
  closingTime: text("closing_time").default("18:00"),
  currency: text("currency").default("THB"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

// 2. Categories (หมวดหมู่อาหาร/เครื่องดื่ม)
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

// 3. Menu Items (รายการอาหารและเครื่องดื่ม)
export const menuItems = pgTable("menu_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  categoryId: uuid("category_id")
    .references(() => categories.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  isAvailable: boolean("is_available").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

// 4. Tables (โต๊ะในร้าน)
export const tables = pgTable("tables", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  tableNumber: integer("table_number").notNull(),
  status: tableStatusEnum("status").default("available").notNull(),
  // Stable bill round ID, independent of the renewable customer QR credential.
  currentSessionToken: text("current_session_token"),
  currentQrToken: text("current_qr_token"),
  qrExpiresAt: timestamp("qr_expires_at", { withTimezone: true }),
  sessionStartedAt: timestamp("session_started_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [unique("tables_store_number_unique").on(table.storeId, table.tableNumber)]).enableRLS();

// Each receipt records one atomic payment, including later top-ups in the same round.
export const billPayments = pgTable("bill_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  billId: text("bill_id").notNull(),
  method: text("method").$type<"cash" | "transfer">().notNull(),
  amountCents: integer("amount_cents").notNull(),
  receivedCents: integer("received_cents").notNull(),
  changeCents: integer("change_cents").notNull(),
  receivedBy: uuid("received_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (payment) => [
  index("bill_payments_store_bill_idx").on(payment.storeId, payment.billId),
  check("bill_payments_amount_check", sql`${payment.amountCents} >= 0 and ${payment.receivedCents} >= ${payment.amountCents} and ${payment.changeCents} = ${payment.receivedCents} - ${payment.amountCents}`),
  check("bill_payments_method_check", sql`${payment.method} in ('cash', 'transfer') and (${payment.method} = 'cash' or ${payment.changeCents} = 0)`),
]).enableRLS();

// Persistent counters work across Vercel instances; no chat text is stored here.
export const chatRateLimits = pgTable("chat_rate_limits", {
  id: text("id").primaryKey(),
  windowKey: text("window_key").notNull(),
  count: integer("count").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull(),
}, (limit) => [check("chat_rate_limits_count_check", sql`${limit.count} >= 0`)]).enableRLS();

// 5. Orders (คำสั่งซื้อ)
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  tableId: uuid("table_id").references(() => tables.id, { onDelete: "set null" }),
  tableNumber: integer("table_number"), // Snapshot of table number
  orderNumber: text("order_number").notNull(),
  sessionToken: text("session_token"), // Links order to a specific active table session
  requestKey: uuid("request_key"),
  requestHash: text("request_hash"),
  status: orderStatusEnum("status").default("pending").notNull(),
  paymentStatus: paymentStatusEnum("payment_status").default("unpaid").notNull(),
  paymentId: uuid("payment_id").references(() => billPayments.id),
  // New API opts in explicitly so an older deployment remains compatible during rollout.
  servingRequired: boolean("serving_required").default(false).notNull(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  customerNote: text("customer_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (order) => [
  index("orders_payment_id_idx").on(order.paymentId),
  uniqueIndex("orders_request_key_unique").on(order.storeId, order.tableNumber, order.sessionToken, order.requestKey),
]).enableRLS();

// Requests belong to one QR round; they never mark a bill paid or close a table.
export const serviceRequests = pgTable("service_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  tableId: uuid("table_id").references(() => tables.id, { onDelete: "cascade" }).notNull(),
  tableNumber: integer("table_number").notNull(),
  sessionToken: text("session_token").notNull(),
  kind: text("kind").$type<"assistance" | "bill">().notNull(),
  status: text("status").$type<"pending" | "resolved">().default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (request) => [
  check("service_requests_kind_check", sql`${request.kind} in ('assistance', 'bill')`),
  check("service_requests_status_check", sql`${request.status} in ('pending', 'resolved')`),
  uniqueIndex("service_requests_pending_unique").on(request.tableId, request.sessionToken, request.kind).where(sql`${request.status} = 'pending'`),
  index("service_requests_store_status_idx").on(request.storeId, request.status, request.createdAt),
  index("service_requests_session_idx").on(request.tableId, request.sessionToken, request.createdAt),
]).enableRLS();

// 6. Order Items (รายการย่อยในคำสั่งซื้อ)
export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .references(() => orders.id, { onDelete: "cascade" })
    .notNull(),
  menuItemId: uuid("menu_item_id")
    .references(() => menuItems.id, { onDelete: "set null" }),
  menuName: text("menu_name").notNull(), // Snapshot in case menu name changes
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  specialInstruction: text("special_instruction"),
  status: text("status").$type<"pending" | "preparing" | "ready">().default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

// 7. Staff (พนักงานร้าน)
export const staff = pgTable("staff", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id")
    .references(() => stores.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id"), // maps to auth.users.id if registered
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: staffRoleEnum("role").default("cashier").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

// --- Relations ---

export const storesRelations = relations(stores, ({ many }) => ({
  categories: many(categories),
  menuItems: many(menuItems),
  tables: many(tables),
  orders: many(orders),
  staff: many(staff),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  store: one(stores, {
    fields: [categories.storeId],
    references: [stores.id],
  }),
  menuItems: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  store: one(stores, {
    fields: [menuItems.storeId],
    references: [stores.id],
  }),
  category: one(categories, {
    fields: [menuItems.categoryId],
    references: [categories.id],
  }),
  orderItems: many(orderItems),
}));

export const tablesRelations = relations(tables, ({ one, many }) => ({
  store: one(stores, {
    fields: [tables.storeId],
    references: [stores.id],
  }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  store: one(stores, {
    fields: [orders.storeId],
    references: [stores.id],
  }),
  table: one(tables, {
    fields: [orders.tableId],
    references: [tables.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
}));

export const staffRelations = relations(staff, ({ one }) => ({
  store: one(stores, {
    fields: [staff.storeId],
    references: [stores.id],
  }),
}));
