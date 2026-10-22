// OMEGA_UNICO_OPENROUTER_V10: motor Ollama desconectado del producto; no se ejecutan acciones.
export async function POST() { return Response.json({ error:'La generacion de codigo utiliza OMEGA IA / OpenRouter desde la interfaz.', executed:false }, { status:410, headers:{'Cache-Control':'no-store'} }); }
