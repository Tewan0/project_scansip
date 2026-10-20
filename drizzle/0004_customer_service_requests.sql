CREATE TABLE "service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"table_number" integer NOT NULL,
	"session_token" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "service_requests_kind_check" CHECK ("service_requests"."kind" in ('assistance', 'bill')),
	CONSTRAINT "service_requests_status_check" CHECK ("service_requests"."status" in ('pending', 'resolved'))
);
--> statement-breakpoint
ALTER TABLE "service_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_requests_pending_unique" ON "service_requests" USING btree ("table_id","session_token","kind") WHERE "service_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "service_requests_store_status_idx" ON "service_requests" USING btree ("store_id","status","created_at");--> statement-breakpoint
CREATE INDEX "service_requests_session_idx" ON "service_requests" USING btree ("table_id","session_token","created_at");
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."service_requests" FROM anon, authenticated, PUBLIC;
