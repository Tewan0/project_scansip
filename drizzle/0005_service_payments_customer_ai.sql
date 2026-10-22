CREATE TABLE "bill_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"bill_id" text NOT NULL,
	"method" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"received_cents" integer NOT NULL,
	"change_cents" integer NOT NULL,
	"received_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_payments_amount_check" CHECK ("bill_payments"."amount_cents" >= 0 and "bill_payments"."received_cents" >= "bill_payments"."amount_cents" and "bill_payments"."change_cents" = "bill_payments"."received_cents" - "bill_payments"."amount_cents"),
	CONSTRAINT "bill_payments_method_check" CHECK ("bill_payments"."method" in ('cash', 'transfer') and ("bill_payments"."method" = 'cash' or "bill_payments"."change_cents" = 0))
);
--> statement-breakpoint
ALTER TABLE "bill_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "chat_rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"window_key" text NOT NULL,
	"count" integer NOT NULL,
	"last_used_at" timestamp with time zone NOT NULL,
	CONSTRAINT "chat_rate_limits_count_check" CHECK ("chat_rate_limits"."count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "chat_rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_id" uuid;--> statement-breakpoint
-- Preserve historical orders without inventing a delivery timestamp.
ALTER TABLE "orders" ADD COLUMN "serving_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "serving_required" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_payments_store_bill_idx" ON "bill_payments" USING btree ("store_id","bill_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_id_bill_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."bill_payments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."bill_payments", "public"."chat_rate_limits" FROM anon, authenticated, PUBLIC;
