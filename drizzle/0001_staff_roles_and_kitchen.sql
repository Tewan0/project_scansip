-- Reconcile columns already present on the shared project with Drizzle history.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "session_token" text;
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "slug" text;
--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "current_session_token" text;
--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "session_started_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.stores'::regclass AND conname = 'stores_slug_unique') THEN
    ALTER TABLE "stores" ADD CONSTRAINT "stores_slug_unique" UNIQUE ("slug");
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
UPDATE public.order_items AS item SET status = CASE
  WHEN parent.status IN ('served', 'completed') THEN 'ready'
  WHEN parent.status = 'preparing' THEN 'preparing'
  ELSE 'pending'
END FROM public.orders AS parent WHERE item.order_id = parent.id;

