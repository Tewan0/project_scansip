ALTER TABLE "orders" ADD COLUMN "request_key" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "request_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_request_key_unique" ON "orders" USING btree ("store_id","table_number","session_token","request_key");