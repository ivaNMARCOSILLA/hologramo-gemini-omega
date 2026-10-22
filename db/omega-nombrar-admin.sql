-- PRECONDICIONES: 1) Haber ejecutado 01-omega-roles.sql
-- 2) Registrarse en la sección «Cuenta y planes» de HOLOGRAMA-GEMINI
-- 3) Haber verificado el correo desde el mensaje de Supabase.
-- Cambia UNICAMENTE el correo entre comillas, NUNCA tu contraseña.
-- Ejecuta esta consulta en el SQL Editor del proyecto Supabase correcto.
DO $omega$
DECLARE
  v_email text := 'REEMPLAZA_CON_TU_CORREO';
  v_user_id uuid;
BEGIN
  IF v_email = 'REEMPLAZA_CON_TU_CORREO' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'Escribe tu correo de administrador verificado antes de ejecutar.';
  END IF;

  SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = lower(v_email)
      AND email_confirmed_at IS NOT NULL
    ORDER BY created_at LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'El correo no tiene una cuenta verificada. Regístrate y verifica primero.';
  END IF;

  INSERT INTO public.omega_user_roles(user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id)
  DO UPDATE SET role='admin', updated_at=now();

  RAISE NOTICE 'Se ha asignado ADMIN a una cuenta verificada en este proyecto.';
END
$omega$;

-- Revisión posterior (no revela contraseñas ni tokens):
select r.role, u.email_confirmed_at is not null as correo_verificado,
       r.created_at, r.updated_at
from public.omega_user_roles r
join auth.users u on u.id = r.user_id
where r.role = 'admin';
