# OMEGA — Primera cuenta administrativa (v1.3)

Proyecto original: `C:\Users\ivanm\Desktop\OMEGA-256D-HYPERSPACE\Obj4K9D\holograma-gemini`

## Orden correcto

1. Ejecutar `INSTALAR-OMEGA-ADMIN.cmd` desde el ZIP descomprimido. Crea copias y comprueba TypeScript. **No lee ni cambia `.env.local`.**
2. En [Supabase](https://supabase.com/dashboard) crear/seleccionar TU proyecto de OMEGA (si aún no existe). En **SQL Editor**, ejecutar `db/01-omega-roles.sql`.
3. En Supabase → Project Settings → API obtener **Project URL** y **Publishable key**. Establecer estas variables (y solo estas) en el `.env.local` del proyecto y en Vercel → Project → Settings → Environment Variables → Production:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
   ```

   La publishable key se usa del lado del cliente y no es una `service_role`. **Nunca publiques `SUPABASE_SERVICE_ROLE_KEY`.**
4. En Supabase → Authentication → URL Configuration, colocar **Site URL** = `https://holograma-gemini.vercel.app`; agregar Redirect URLs `https://holograma-gemini.vercel.app/auth/callback` y `http://127.0.0.1:3000/auth/callback`. Activa confirmación de correo. Probar el enlace real de confirmación; si aún no hay correo transaccional fiable, configurar SMTP antes de ventas.
5. Desplegar la app actualizada a Vercel tras verificar `npm run build`. El instalador **no publica** por sí solo.
6. Abrir **Cuenta y planes**, registrar TU correo personal de administrador y verificarlo por el email recibido. No envíes aquí la dirección, contraseña ni códigos.
7. Ejecutar `PREPARAR-PRIMER-ADMIN.cmd` desde la carpeta extraída, escribir el correo verificado (nunca la contraseña), y copiar el SQL que se abre al **SQL Editor** del mismo proyecto. Alternativamente edita `db/02-nombrar-primer-admin.sql` sustituyendo `REEMPLAZA_CON_TU_CORREO`. Esta operación requiere una cuenta ya verificada.
8. Cerrar sesión, iniciar sesión y entrar de nuevo en Cuenta y planes. Debe aparecer **Administrador OMEGA**. Configurar y verificar MFA TOTP para habilitar operaciones administrativas. **No permitimos autoasignarse roles desde la web.**

## Verificación del servidor

`GET /api/omega-admin/status` sin sesión responde 401. Con token de usuario no admin responde 403. Con token de admin verificado responde 200 con `role: admin` y `mfa`.

`GET /api/omega-admin/health` necesita admin + MFA AAL2. Rechaza 401/403 a otros usuarios.

## Seguridad

- No crear rol admin a todo el que se registra.
- Nunca confiar en `user_metadata` o en un botón visual para dar privilegios.
- La tabla `omega_user_roles` permite solamente SELECT a usuarios autenticados, y únicamente de su propia fila gracias a RLS.
- Para nuevas operaciones de administración hay que llamar **en el servidor** a `omegaAdminGate(request, true)`; no basta con esconder botones.
- La instalación se limita al repositorio; no crea por sí misma usuarios reales, cuentas Supabase, claves ni despliegues públicos.
- No activa Stripe, pagos ni IA de pago.
