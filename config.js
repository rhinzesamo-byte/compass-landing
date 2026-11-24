/* ------------------------------------------------------------------
   CLARITY & CONFIDENCE COMPASS — PAGE SETTINGS
   This is the ONLY file you need to edit after deploying Apps Script.
   ------------------------------------------------------------------ */
window.COMPASS_CONFIG = {
  // Paste your Apps Script Web App URL here (the one ending in /exec).
  // While this is empty, the checkout runs in DEMO MODE and saves nothing.
  APPS_SCRIPT_URL: "",

  // Cloudflare Turnstile SITE key (public). Leave empty to turn Turnstile off.
  // The SECRET key never goes here — it goes in Apps Script → Script Properties.
  TURNSTILE_SITE_KEY: "",

  // QR codes shown on the payment step (first one is shown by default).
  // The real amount always comes from your Sheet, never from here.
  PAYMENT_OPTIONS: [
    { id: "gcash",    label: "GCash",    qr: "assets/gcash-qr.png",    payee: "RH****S A. · GCash" },
    { id: "maribank", label: "MariBank", qr: "assets/maribank-qr.png", payee: "RHINZES AMO · MariBank (****2947)" }
  ]
};
