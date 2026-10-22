import { translate, type Locale } from './ciudad-i18n';
const errors = {
 es: {
  deepseek_not_configured:"El asistente no está disponible en este momento. Inténtalo más tarde.",
  deepseek_key_rejected:"El asistente no está disponible en este momento. Inténtalo más tarde.",
  deepseek_insufficient_balance:"El asistente no está disponible en este momento. Inténtalo más tarde.",
  deepseek_rate_limited:'DeepSeek está limitando las consultas. Espera un momento antes de volver a intentarlo.',
  deepseek_model_unavailable:"El asistente no está disponible en este momento. Inténtalo más tarde.",
  deepseek_timeout:'DeepSeek ha tardado demasiado en responder. La solicitud no ha ejecutado ninguna acción.',
  invalid_control_reply:'La IA devolvió una respuesta que no se puede validar. No se ha ejecutado ninguna orden.',
 },
 en: {
  deepseek_not_configured:"The assistant is currently unavailable. Please try again later.",
  deepseek_key_rejected:"The assistant is currently unavailable. Please try again later.",
  deepseek_insufficient_balance:"The assistant is currently unavailable. Please try again later.",
  deepseek_rate_limited:'DeepSeek is rate limiting requests. Please wait before trying again.',
  deepseek_model_unavailable:"The assistant is currently unavailable. Please try again later.",
  deepseek_timeout:'DeepSeek took too long to respond. This request did not execute any action.',
  invalid_control_reply:'The AI response could not be validated. No command was executed.',
 },
 fr: {
  deepseek_not_configured:"L’assistant est momentanément indisponible. Réessayez plus tard.",
  deepseek_key_rejected:"L’assistant est momentanément indisponible. Réessayez plus tard.",
  deepseek_insufficient_balance:"L’assistant est momentanément indisponible. Réessayez plus tard.",
  deepseek_rate_limited:'DeepSeek limite les demandes. Patientez avant de réessayer.',
  deepseek_model_unavailable:"L’assistant est momentanément indisponible. Réessayez plus tard.",
  deepseek_timeout:'DeepSeek a mis trop de temps à répondre. Aucune action exécutée.',
  invalid_control_reply:'La réponse de l’IA est invalide. Aucune commande exécutée.',
 },
 pt: {
  deepseek_not_configured:"O assistente está indisponível neste momento. Tente mais tarde.",
  deepseek_key_rejected:"O assistente está indisponível neste momento. Tente mais tarde.",
  deepseek_insufficient_balance:"O assistente está indisponível neste momento. Tente mais tarde.",
  deepseek_rate_limited:'DeepSeek está a limitar os pedidos. Aguarde antes de tentar novamente.',
  deepseek_model_unavailable:"O assistente está indisponível neste momento. Tente mais tarde.",
  deepseek_timeout:'DeepSeek demorou demasiado a responder. Nenhuma ação foi executada.',
  invalid_control_reply:'A resposta da IA não pôde ser validada. Nenhum comando foi executado.',
 },
};
export function aiErrorMessage(code: string, locale: Locale): string {
 const access = {"es": {"not_admin": "Esta función no está disponible para tu cuenta.", "mfa_required": "Verifica tu segundo factor para continuar."}, "en": {"not_admin": "This feature is not available for your account.", "mfa_required": "Verify your second factor to continue."}, "fr": {"not_admin": "Cette fonction n’est pas disponible pour votre compte.", "mfa_required": "Vérifiez votre second facteur pour continuer."}, "pt": {"not_admin": "Esta função não está disponível para a sua conta.", "mfa_required": "Verifique o segundo fator para continuar."}};
 if (code === 'not_admin' || code === 'mfa_required') return access[locale][code];
 if (code==='auth') return translate(locale,'signIn');
 return Object.hasOwn(errors[locale],code) ? errors[locale][code as keyof typeof errors.es] : translate(locale,'serverMissing');
}
