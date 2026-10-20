-- Repair legacy duplicate rows before enforcing one table number per store.
-- Keep the live session, or the oldest row if all copies are idle.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
LOCK TABLE public.tables, public.orders IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
DO $$
DECLARE
  duplicate_group record;
  keeper_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tables
    GROUP BY store_id, table_number
    HAVING count(*) > 1 AND count(*) FILTER (
      WHERE status <> 'available' OR current_session_token IS NOT NULL OR session_started_at IS NOT NULL
    ) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple live sessions share a table number; resolve them before merging';
  END IF;

  FOR duplicate_group IN
    SELECT store_id, table_number FROM public.tables
    GROUP BY store_id, table_number HAVING count(*) > 1
  LOOP
    SELECT id INTO keeper_id FROM public.tables
    WHERE store_id = duplicate_group.store_id AND table_number = duplicate_group.table_number
    ORDER BY (status <> 'available' OR current_session_token IS NOT NULL OR session_started_at IS NOT NULL) DESC,
      created_at, id
    LIMIT 1;

    -- Preserve historical orders and their snapshots when removing idle copies.
    UPDATE public.orders AS o SET table_id = keeper_id
    FROM public.tables AS redundant
    WHERE o.table_id = redundant.id
      AND redundant.store_id = duplicate_group.store_id
      AND redundant.table_number = duplicate_group.table_number
      AND redundant.id <> keeper_id;

    DELETE FROM public.tables
    WHERE store_id = duplicate_group.store_id AND table_number = duplicate_group.table_number
      AND id <> keeper_id AND status = 'available'
      AND current_session_token IS NULL AND session_started_at IS NULL;
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_store_number_unique" UNIQUE("store_id","table_number");
