-- =============================================================================
-- Adira Reads: Custom Claims Hook for JWT
-- =============================================================================
-- Per D-002: JWT carries school_id and role claims for RLS.
-- Per D-015: Multi-tenant from day one — every JWT must carry school_id.
--
-- This function runs as a Supabase Auth hook (custom_access_token_hook).
-- After authentication, it looks up the staff record for the authenticated
-- user and injects school_id, role, and is_tilt_admin into the JWT's
-- app_metadata. The RLS helper functions (current_user_school_id,
-- is_tilt_admin) read these claims.
--
-- SETUP: After running this migration, enable the hook in Supabase dashboard:
--   Authentication > Hooks > Custom Access Token (JWT) > public.custom_access_token_hook
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  app_meta jsonb;
  staff_record RECORD;
  user_id uuid;
BEGIN
  user_id := (event ->> 'user_id')::uuid;

  -- Look up the staff record by auth_uid
  SELECT s.school_id, s.role::text AS role_text, s.staff_id
  INTO staff_record
  FROM public.staff s
  WHERE s.auth_uid = user_id::text AND s.is_active = TRUE
  LIMIT 1;

  claims := event -> 'claims';

  -- Ensure app_metadata exists as an object
  IF claims ? 'app_metadata' THEN
    app_meta := claims -> 'app_metadata';
  ELSE
    app_meta := '{}'::jsonb;
  END IF;

  IF staff_record.staff_id IS NOT NULL THEN
    app_meta := app_meta
      || jsonb_build_object(
        'school_id', staff_record.school_id,
        'role', staff_record.role_text,
        'is_tilt_admin', (staff_record.role_text = 'tilt_admin'),
        'staff_id', staff_record.staff_id
      );
  ELSE
    app_meta := app_meta
      || jsonb_build_object(
        'school_id', 0,
        'role', 'tutor',
        'is_tilt_admin', false
      );
  END IF;

  claims := jsonb_set(claims, '{app_metadata}', app_meta);
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Grant execute permission to supabase_auth_admin (required for auth hooks)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON public.staff TO supabase_auth_admin;

-- Allow auth admin to bypass RLS on the staff table for the hook lookup
DROP POLICY IF EXISTS "auth_admin_read_staff" ON public.staff;
CREATE POLICY "auth_admin_read_staff" ON public.staff
  FOR SELECT TO supabase_auth_admin
  USING (true);

REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
