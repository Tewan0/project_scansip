ALTER TABLE "tables" ADD COLUMN "current_qr_token" text;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "qr_expires_at" timestamp with time zone;