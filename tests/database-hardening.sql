-- Run with an administrative connection after migrations 0012 and 0013.
-- The probe table and all settings are rolled back; no shop rows are modified.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE public.scansip_security_probe (id integer);
DO $$
DECLARE
  valid_indexes integer;
  protected_tables integer;
  plan json;
BEGIN
  IF has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Client execute privileges remain';
  END IF;
  IF NOT has_function_privilege('postgres', 'public.rls_auto_enable()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Owner execute privilege missing';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.scansip_security_probe'::regclass) THEN
    RAISE EXCEPTION 'Automatic RLS trigger failed';
  END IF;
  SELECT count(*) INTO protected_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND c.relname IN ('stores', 'staff', 'tables', 'categories', 'menu_items', 'orders',
                     'order_items', 'bill_payments', 'service_requests', 'chat_rate_limits')
    AND c.relrowsecurity
    AND NOT has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
    AND NOT has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE');
  IF protected_tables <> 10 THEN RAISE EXCEPTION 'Table access protection changed'; END IF;

  SELECT count(*) INTO valid_indexes
  FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND i.indisvalid AND i.indisready
    AND c.relname IN ('categories_store_id_idx', 'menu_items_store_id_idx',
      'menu_items_category_id_idx', 'order_items_order_id_idx',
      'order_items_menu_item_id_idx', 'orders_table_id_idx', 'staff_store_id_idx');
  IF valid_indexes <> 7 THEN RAISE EXCEPTION 'Expected seven valid indexes'; END IF;

  -- Confirm index eligibility, not a speed benchmark on the small live tables.
  PERFORM set_config('enable_seqscan', 'off', true);
  EXECUTE 'EXPLAIN (FORMAT JSON) SELECT * FROM public.order_items
           WHERE order_id = ''11111111-1111-4111-8111-111111111111''::uuid' INTO plan;
  IF plan::text NOT LIKE '%order_items_order_id_idx%' THEN
    RAISE EXCEPTION 'Order-item lookup cannot use the new index';
  END IF;
END;
$$;
ROLLBACK;
SELECT 'PASS: function grants, automatic RLS, table protection and FK indexes' AS verification,
       to_regclass('public.scansip_security_probe') IS NULL AS probe_rolled_back;
