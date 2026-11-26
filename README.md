# Clarity & Confidence Compass — Landing Page

Sales page and checkout for the 4-week Taglish course by Rhinzes Amo.

- **Page:** plain HTML/CSS/JS (no build step). Open `index.html` or deploy the folder as-is.
- **Reservations:** buyers pay by GCash / MariBank InstaPay QR, then fill in the Google Form linked in `config.js` (`RESERVATION_FORM_URL`). Responses go to the Form's linked Google Sheet. The owner checks each payment by hand.
- **Settings:** `config.js` holds the form link and the QR codes. No backend is needed.

The Apps Script backend (`apps-script/`, [SETUP.md](SETUP.md)) is no longer used by the page.
