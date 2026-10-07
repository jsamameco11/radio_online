/**
 * Culqi Checkout v4 (card form that returns a single-use token) and Culqi3DS
 * (the issuer's 3-D Secure challenge). Both scripts load once, on demand.
 */

const CHECKOUT_SCRIPT = "https://checkout.culqi.com/js/v4";
const THREE_DS_SCRIPT = "https://3ds.culqi.com";

export interface CulqiToken {
  id: string;
  email: string;
}

type CulqiPaymentMethod = "tarjeta" | "yape" | "bancaMovil" | "agente" | "billetera" | "cuotealo";

interface CulqiCheckoutV4 {
  publicKey: string;
  settings(settings: { title: string; currency: string; amount: number }): void;
  options(options: { lang?: "auto" | "es" | "en"; installments?: boolean; paymentMethods?: Partial<Record<CulqiPaymentMethod, boolean>> }): void;
  open(): void;
  close(): void;
  token?: CulqiToken | null;
  error?: { user_message?: string; merchant_message?: string } | null;
}

/** What the issuer's challenge returns; the backend charges the same token again with it. */
export interface Culqi3DSParameters {
  eci?: string;
  xid?: string;
  cavv?: string;
  protocolVersion?: string;
  directoryServerTransactionId?: string;
}

interface Culqi3DSClient {
  publicKey: string;
  settings: { charge: { totalAmount: number; returnUrl: string; currency: string }; card: { email: string } };
  options: { showModal?: boolean; showLoading?: boolean; showIcon?: boolean; closeModalAction?: () => void };
  initAuthentication(tokenId: string): void;
}

declare global {
  interface Window {
    Culqi?: CulqiCheckoutV4;
    Culqi3DS?: Culqi3DSClient;
    culqi?: () => void;
  }
}

const scripts = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const loaded = scripts.get(src);
  if (loaded) return loaded;

  const loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scripts.delete(src);
      script.remove();
      reject(new Error("No pudimos cargar la pasarela de pago. Revisa tu conexión e inténtalo de nuevo."));
    };
    document.head.appendChild(script);
  });
  scripts.set(src, loading);
  return loading;
}

export interface CulqiCheckoutSettings {
  publicKey: string;
  title: string;
  currency: string;
  amountCents: number;
}

/**
 * Opens Culqi Checkout. Culqi calls back once the card is tokenized (or
 * rejected); closing the form without paying calls nothing.
 */
export async function openCulqiCheckout(
  settings: CulqiCheckoutSettings,
  handlers: { onToken: (token: CulqiToken) => void; onError: (message: string) => void },
): Promise<void> {
  await loadScript(CHECKOUT_SCRIPT);
  const checkout = window.Culqi;
  if (!checkout) throw new Error("No pudimos abrir la pasarela de pago. Recarga la página e inténtalo de nuevo.");

  checkout.publicKey = settings.publicKey;
  checkout.settings({ title: settings.title, currency: settings.currency, amount: settings.amountCents });
  checkout.options({
    lang: "auto",
    installments: false,
    paymentMethods: { tarjeta: true, yape: settings.currency === "PEN", bancaMovil: false, agente: false, billetera: false, cuotealo: false },
  });

  window.culqi = () => {
    const token = window.Culqi?.token;
    const error = window.Culqi?.error;
    window.Culqi?.close();
    if (token?.id) handlers.onToken(token);
    else handlers.onError(error?.user_message || "No pudimos validar tu tarjeta. Revisa los datos e inténtalo de nuevo.");
  };

  checkout.open();
}

/** Runs the issuer's 3-D Secure challenge for a token Culqi asked to authenticate. */
export async function authenticateWithCulqi3DS(input: {
  publicKey: string;
  tokenId: string;
  email: string;
  amountCents: number;
  currency: string;
}): Promise<Culqi3DSParameters> {
  await loadScript(THREE_DS_SCRIPT);
  const client = window.Culqi3DS;
  if (!client) throw new Error("No pudimos abrir la verificación de tu banco. Recarga la página e inténtalo de nuevo.");

  return new Promise<Culqi3DSParameters>((resolve, reject) => {
    const listen = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { parameters3DS?: Culqi3DSParameters; error?: unknown } | null;
      if (data?.parameters3DS) {
        window.removeEventListener("message", listen);
        resolve(data.parameters3DS);
      } else if (data?.error) {
        window.removeEventListener("message", listen);
        reject(new Error("Tu banco no pudo verificar la compra. Inténtalo de nuevo o usa otra tarjeta."));
      }
    };

    client.publicKey = input.publicKey;
    client.settings = {
      charge: { totalAmount: input.amountCents, returnUrl: window.location.href, currency: input.currency },
      card: { email: input.email },
    };
    client.options = {
      showModal: true,
      showLoading: true,
      showIcon: true,
      closeModalAction: () => {
        window.removeEventListener("message", listen);
        reject(new Error("Cerraste la verificación de tu banco. No se cobró nada."));
      },
    };

    window.addEventListener("message", listen);
    client.initAuthentication(input.tokenId);
  });
}
