ALTER TABLE "orders" ADD COLUMN "cancelled_by" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_by_label" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancellation_reason" text;