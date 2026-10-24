-- Apply once before the 24-hour app version. Preserve the original QR issue time,
-- current credential and bill round; only replace the old two-hour deadline.
UPDATE public.tables
SET qr_expires_at = qr_expires_at + interval '22 hours'
WHERE status = 'occupied'
  AND current_qr_token IS NOT NULL
  AND qr_expires_at IS NOT NULL;
