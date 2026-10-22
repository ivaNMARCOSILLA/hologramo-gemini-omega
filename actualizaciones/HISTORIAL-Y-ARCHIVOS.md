# Mi espacio: conversaciones, archivos y programación

- Conversaciones: guardar, reabrir, continuar, nueva conversación y eliminar. Guardado explícito por cuenta en este navegador, máximo 20 conversaciones y 30 mensajes por conversación; no hay sincronización con Supabase ni otros dispositivos. Los cambios deben guardarse antes de cambiar de conversación. No se almacenan los adjuntos; volver a adjuntarlos para otra consulta.
- Archivos: máximo 3 por petición. Texto, Markdown, CSV, JSON, logs, código y configuraciones de texto, hasta 10 000 caracteres por archivo. Imágenes PNG, JPEG y WebP hasta 256 000 bytes por archivo. PDF, Office, ZIP, audio y vídeo no se procesan en esta versión. No se generan enlaces públicos para compartir archivos.
- Privacidad: los adjuntos se envían al servidor y a DeepSeek al pulsar Enviar, no al seleccionarlos. El navegador usa un espacio local separado por identificador de cuenta para las conversaciones guardadas. Quien tenga acceso al perfil del navegador puede inspeccionar su almacenamiento; no es una bóveda cifrada. Borrar datos del sitio borra este historial local.
- Los archivos son datos no confiables: su análisis nunca despacha acciones de control del programa, aunque un documento o respuesta del modelo las solicite.
- Código: 84 opciones por familias, compartidas entre selector y validación en servidor. Extensiones de descarga correspondientes. Son opciones de generación de texto, no compiladores instalados ni garantía de corrección; el código no se ejecuta automáticamente.
- Imágenes: la documentación oficial actual de Chat Completions admite image_url como entrada (incluidos data URLs). Este endpoint devuelve texto; no ofrece generación de imágenes. No se ha añadido otro proveedor ni una función ficticia de generación. La compatibilidad efectiva y los errores del modelo contratado requieren prueba con una clave real.

Fuentes consultadas: https://api-docs.deepseek.com/api/create-chat-completion y https://api-docs.deepseek.com/api/list-models

## Publicación

Ejecutar el actualizador de PowerShell desde la carpeta existente, después PUBLICAR-VERCEL.cmd -Scope garcia-fills. Sin dependencias nuevas ni cambios en .env.local. OMEGA_SITE_URL y los redirects de Supabase deben estar configurados para https://iaweboriginal.com.

Se mantienen las autorizaciones existentes: la cuenta puede guardar conversaciones, pero las consultas a la IA siguen requiriendo administrador y MFA. No se habilita consumo de pago público por cambiar estos controles de interfaz.

Las pruebas de proveedor usan respuestas simuladas; las pruebas de navegador usan autenticación y respuestas simuladas. No prueban una cuenta real, la clave real ni el análisis de un documento en producción.
