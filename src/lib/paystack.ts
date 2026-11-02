// Paystack Inline JS SDK loader + checkout helper
// Docs: https://paystack.com/docs/payments/accept-payments/#popup

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: PaystackOptions) => {
        openIframe: () => void;
      };
    };
  }
}

export interface PaystackOptions {
  key: string;
  email: string;
  amount: number;        // ZAR cents (3600 = R36)
  currency: string;      // "ZAR"
  ref: string;
  access_code?: string;  // Optional — from backend
  channels?: string[];
  metadata?: Record<string, unknown>;
  callback: (response: { reference: string; status?: string }) => void;
  onClose: () => void;
}

let scriptLoading: Promise<void> | null = null;

export function loadPaystackSdk(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Paystack can only load in the browser"));
  }
  if (window.PaystackPop) return Promise.resolve();
  if (scriptLoading) return scriptLoading;

  scriptLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoading = null;
      reject(new Error("Failed to load Paystack SDK"));
    };
    document.body.appendChild(script);
  });

  return scriptLoading;
}

export interface CheckoutParams {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  accessCode?: string;
}

export interface CheckoutResult {
  reference: string;
}

/**
 * Open the Paystack checkout overlay.
 * Resolves when the user completes a payment (with the reference).
 * Rejects when the user closes the overlay without paying.
 */
export async function openPaystackCheckout(
  params: CheckoutParams
): Promise<CheckoutResult> {
  await loadPaystackSdk();

  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error(
      "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY is not set. Add it to .env.local."
    );
  }
  if (!window.PaystackPop) {
    throw new Error("Paystack SDK is not available.");
  }

  return new Promise<CheckoutResult>((resolve, reject) => {
    const handler = window.PaystackPop!.setup({
      key: publicKey,
      email: params.email,
      amount: params.amount,        // in kobo/cents
      currency: params.currency,
      ref: params.reference,
      access_code: params.accessCode,
      callback: (response) => {
        resolve({ reference: response.reference || params.reference });
      },
      onClose: () => {
        reject(new Error("Payment cancelled"));
      },
    });
    handler.openIframe();
  });
}