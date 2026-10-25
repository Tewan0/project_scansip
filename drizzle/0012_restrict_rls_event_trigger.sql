-- Supabase's internal RLS event trigger is not a client-facing RPC.
-- Leave the trigger, owner privileges and function body unchanged.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END;
$$;
