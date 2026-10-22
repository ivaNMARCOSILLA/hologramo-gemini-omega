# Registro de usuarios normales

La sección Cuenta permite registrarse con correo y contraseña (mínimo 12 caracteres), confirmar el correo e iniciar sesión. No hay cupo de cuentas en el código. Supabase sí aplica sus límites de usuarios activos, correo, almacenamiento y frecuencia según el plan; no se promete un servicio ilimitado gratuito.

## Configuración de Supabase

1. En Authentication → Providers/Sign In, habilitar Email y permitir nuevas altas. Mantener confirmación de correo.
2. En URL Configuration, usar https://hologramo.es como Site URL y permitir https://hologramo.es/auth/callback como Redirect URL. Para desarrollo, añadir el callback del origen local usado.
3. Configurar SMTP propio para correos a usuarios reales, revisar cuotas y protección contra abuso. El correo de prueba de Supabase no es un servicio de producción sin límites.
4. Ejecutar primero db/omega-roles.sql y después db/ciudad-member-registration.sql en SQL Editor. Este último es repetible, asigna member a cuentas nuevas y antiguas sin rol y conserva los administradores. No usa metadatos enviados por usuarios.
5. Habilitar TOTP en Authentication → MFA. Los usuarios normales pueden usar contraseña o activar MFA; para desactivarlo deben verificar su factor actual. Los endpoints administrativos conservan sus controles de rol y MFA en servidor. Desactivar MFA no permite acceso administrativo.

## Alcance

Registrarse no concede las funciones de IA administrativas, edición remota ni control de dispositivos. Estas conservan sus permisos actuales; no se ha abierto una API de consumo de pago al registro público.

## Verificación real después de publicar

Crear dos cuentas con correos diferentes, confirmar ambos correos, iniciar sesión sin MFA y comprobar el rol member. Activar TOTP en una cuenta, cerrar sesión, volver a entrar y verificar el código. Desactivar TOTP tras verificarlo. Confirmar que ninguna cuenta obtiene controles administrativos y que los endpoints administrativos rechazan su token. Probar también registro duplicado, código incorrecto y sesión cerrada.

La configuración y migración de Supabase requieren acceso al panel del propietario. No se han aplicado automáticamente desde el ZIP. No pegar claves service_role en el navegador, GitHub o chat.
