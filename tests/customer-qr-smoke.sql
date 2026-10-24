-- Rollback-only schema/renewal smoke test; never writes application tables.
BEGIN;
CREATE TEMP TABLE tables (LIKE public.tables INCLUDING ALL) ON COMMIT DROP;
CREATE TEMP TABLE orders (LIKE public.orders INCLUDING ALL) ON COMMIT DROP;
ALTER TABLE pg_temp.tables ADD COLUMN IF NOT EXISTS current_qr_token text;
ALTER TABLE pg_temp.tables ADD COLUMN IF NOT EXISTS qr_expires_at timestamptz;
DO $$
DECLARE
  test_shop uuid := gen_random_uuid();
  test_table_id uuid := gen_random_uuid();
  test_order_id uuid := gen_random_uuid();
  test_opened_at timestamptz := clock_timestamp() - interval '24 hours';
  test_original_round text := 'temporary-bill-round';
BEGIN
  IF (SELECT n.nspname NOT LIKE 'pg_temp_%' FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid='tables'::regclass) THEN
    RAISE EXCEPTION 'Must only write temporary tables';
  END IF;
  INSERT INTO pg_temp.tables(id,store_id,table_number,status,current_session_token,session_started_at,current_qr_token,qr_expires_at)
  VALUES(test_table_id,test_shop,1,'occupied',test_original_round,test_opened_at,'temporary-old-qr',test_opened_at + interval '24 hours');
  INSERT INTO pg_temp.orders(id,store_id,table_id,table_number,order_number,session_token,total_amount)
  VALUES(test_order_id,test_shop,test_table_id,1,'#TEST',test_original_round,50);
  PERFORM id FROM pg_temp.tables WHERE id=test_table_id FOR UPDATE;
  UPDATE pg_temp.tables SET current_qr_token='temporary-new-qr',qr_expires_at=clock_timestamp() + interval '24 hours'
  WHERE id=test_table_id AND current_qr_token='temporary-old-qr';
  IF NOT FOUND THEN RAISE EXCEPTION 'Renewal did not update'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_temp.tables t JOIN pg_temp.orders o ON o.session_token=t.current_session_token AND o.store_id=t.store_id
    WHERE t.id=test_table_id AND t.current_session_token=test_original_round AND t.session_started_at=test_opened_at
    AND t.status='occupied' AND t.current_qr_token='temporary-new-qr' AND t.qr_expires_at > clock_timestamp()
    AND o.id=test_order_id AND o.payment_status='unpaid' AND o.total_amount=50) THEN
    RAISE EXCEPTION 'Renewal changed round or order';
  END IF;
  UPDATE pg_temp.tables SET current_qr_token='stale-request-must-not-win' WHERE id=test_table_id AND current_qr_token='temporary-old-qr';
  IF FOUND THEN RAISE EXCEPTION 'Stale renewal unexpectedly matched'; END IF;
END $$;
SELECT 'PASS: QR columns, renewal, stable round/order and stale guard on temporary tables' AS verification;
ROLLBACK;
