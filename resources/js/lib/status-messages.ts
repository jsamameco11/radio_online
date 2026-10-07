/** Fortify flashes status codes; people read them in Spanish. */
const statusMessages: Record<string, string> = {
  "password-updated": "Actualizamos tu contraseña.",
  "profile-information-updated": "Guardamos tu perfil.",
  "verification-link-sent": "Te enviamos un nuevo enlace de verificación.",
  "two-factor-authentication-enabled": "Escanea el código QR y confírmalo para terminar de activar la verificación en dos pasos.",
  "two-factor-authentication-confirmed": "La verificación en dos pasos está activa. Guarda tus códigos de recuperación.",
  "two-factor-authentication-disabled": "Desactivaste la verificación en dos pasos.",
  "recovery-codes-generated": "Generamos códigos de recuperación nuevos. Los anteriores ya no sirven.",
};

export function statusMessage(status: string | null): string | null {
  return status ? (statusMessages[status] ?? status) : null;
}
