-- =============================================================================
-- Adira Reads: Sync staff → auth.users.raw_app_meta_data
-- =============================================================================
-- The custom_access_token_hook (00002) injects claims into the JWT at token
-- issuance, but supabase.auth.getUser() on the server reads from the user's
-- raw_app_meta_data column in auth.users, NOT from the JWT. That means the
-- role/school_id/staff_id claims are invisible to Server Components and
-- Server Actions that rely on user.app_metadata.
--
-- This migration adds a trigger that keeps raw_app_meta_data in sync with the
-- staff table, so app_metadata is always readable server-side.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_staff_to_auth_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.auth_uid IS NOT NULL THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'school_id', NEW.school_id,
      'staff_id', NEW.staff_id,
      'role', NEW.role::text,
      'is_tilt_admin', (NEW.role::text = 'tilt_admin')
    )
    WHERE id::text = NEW.auth_uid;
  END IF;
  RETURN NEW;
END;
$$;

GRANT UPDATE ON auth.users TO postgres;

DROP TRIGGER IF EXISTS trg_sync_staff_metadata ON public.staff;
CREATE TRIGGER trg_sync_staff_metadata
  AFTER INSERT OR UPDATE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_staff_to_auth_metadata();
