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
--
-- Or via config.toml for local dev:
--   [auth.hook.custom_access_token]
--   enabled = true
--   uri = "pg-functions://postgres/public/custom_access_token_hook"
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
  staff_record RECORD;
  user_id uuid;
BEGIN
  -- Extract the user ID from the event
  user_id := (event -> 'user_id')::text::uuid;

  -- Look up the staff record by auth UID
  SELECT s.school_id, s.role, s.staff_id
  INTO staff_record
  FROM public.staff s
  WHERE s.auth_uid = user_id::text
    AND s.is_active = TRUE
  LIMIT 1;

  -- Start with existing claims
  claims := event -> 'claims';

  IF staff_record IS NOT NULL THEN
    -- Inject school_id and role into app_metadata
    claims := jsonb_set(
      claims,
      '{app_metadata, school_id}',
      to_jsonb(staff_record.school_id)
    );
    claims := jsonb_set(
      claims,
      '{app_metadata, role}',
      to_jsonb(staff_record.role::text)
    );
    claims := jsonb_set(
      claims,
      '{app_metadata, is_tilt_admin}',
      to_jsonb(staff_record.role::text = 'tilt_admin')
    );
    claims := jsonb_set(
      claims,
      '{app_metadata, staff_id}',
      to_jsonb(staff_record.staff_id)
    );
  ELSE
    -- No staff record found — set safe defaults (no school access)
    claims := jsonb_set(claims, '{app_metadata, school_id}', '0');
    claims := jsonb_set(claims, '{app_metadata, role}', '"tutor"');
    claims := jsonb_set(claims, '{app_metadata, is_tilt_admin}', 'false');
  END IF;

  -- Return the modified event with updated claims
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Grant execute permission to supabase_auth_admin (required for auth hooks)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Ensure the function is accessible
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
