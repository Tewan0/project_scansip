ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "menu_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staff" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tables" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- All application data goes through authenticated Next.js handlers using Drizzle.
-- No direct browser Data API access is needed, including for the public menu.
REVOKE ALL ON TABLE public.categories, public.menu_items, public.order_items,
  public.orders, public.staff, public.stores, public.tables FROM anon, authenticated, PUBLIC;
--> statement-breakpoint
-- Upload handlers verify ownership and use the server-only Storage client.
DROP POLICY IF EXISTS "Allow public upload to menu-photos" ON storage.objects;
