/* ------------------------------------------------------------------
   CLARITY & CONFIDENCE COMPASS — PAGE SETTINGS
   ------------------------------------------------------------------ */
window.COMPASS_CONFIG = {
  // Your Google Form for reservations (name, email, Messenger/phone,
  // payment reference number, payment screenshot).
  RESERVATION_FORM_URL: "https://forms.gle/q7g4gMo9UgZPDU3W8",

  // QR codes shown on the payment step (first one is shown by default).
  PAYMENT_OPTIONS: [
    { id: "gcash",    label: "GCash",    qr: "assets/gcash-qr.png",    payee: "RH****S A. · GCash" },
    { id: "maribank", label: "MariBank", qr: "assets/maribank-qr.png", payee: "RHINZES AMO · MariBank (****2947)" }
  ]
};
