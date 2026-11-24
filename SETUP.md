# Clarity & Confidence Compass — Setup Guide

> **Landing page = store · Google Sheet = notebook · Apps Script = robot · QR = payment · MailApp = robot that sends access**

## What's in this folder

| File | What it is |
|---|---|
| `index.html`, `styles.css`, `app.js` | The landing page. You don't need to edit these. |
| `config.js` | **The only page file you edit.** Paste your `/exec` URL here. |
| `assets/` | Your logo, photo and MariBank QR. |
| `apps-script/Code.gs` | The robot. Paste it into Apps Script. |

---

## Part 1 — Create the Google Sheet ✅ done for you
Claude already created **Compass Sales Funnel CRM** in your Google Drive with all 6 tabs, headers, dropdowns and Settings:
https://docs.google.com/spreadsheets/d/1CGO_vzJHM8wES1MtDdELwLei9-XHsc7m5kEEaCCVPdE/edit
Keep it **private**. Never share it publicly.

## Part 2 — Open Apps Script
**Extensions → Apps Script**. A new tab opens. *"This is where our little robot lives."*

## Part 3 — Paste the script
1. Open `Code.gs`, delete the sample code.
2. Paste the whole `apps-script/Code.gs` from this folder. **Save.**

## Part 4 — Run setup
1. In the function menu at the top, choose **`setupCRM`** → **Run**.
2. Pick your Google account → review the permissions → **Allow**.
3. Go back to the Sheet. You should see: **Settings · Leads · Orders · Payments · Fulfillment · Logs**, and a **Sales Funnel** menu (refresh the Sheet if the menu isn't there yet).

## Part 5 — Fill the Settings tab (edit only the yellow VALUE column)

| Key | What to put |
|---|---|
| `PRICE_PHP` | `1500` (already filled). The website can't change this. |
| `MAX_SEATS` | `10` (already filled). New orders stop when 10 people have submitted or paid. |
| `COURSE_DATES` | e.g. `Week 1 starts Monday, January 5, 2027` |
| `ACCESS_URL` | Link where members join the course (any platform). Can stay empty for now (see below). |
| `ACCESS_CODE` | Optional join code or password, if your platform uses one |
| `QUIZ_URL` | Your Archetype Quiz link |
| `WORKBOOK_URL` | Your Compass Workbook link |
| `SUPPORT_EMAIL` | Where buyers can reply |
| `ADMIN_EMAIL` | Your email, if you want a notice for each payment reference |

*"The Settings tab is the control panel."* Change the price, links or dates here — never in the code.

**Details not final yet?** That's fine. You can sell now. While `ACCESS_URL` is empty, marking a buyer `PAID` sends a **"Payment confirmed, your seat is saved"** email (EmailStatus = `CONFIRMATION_SENT`). When your dates, course platform, quiz and workbook are ready: fill them in Settings → **Sales Funnel → Send Access to Everyone Waiting**. Every PAID buyer gets the full access email in one click.

## Part 6 — Deploy the Web App
1. **Deploy → New deployment →** gear icon → **Web app**.
2. **Execute as:** Me · **Who has access:** Anyone.
3. **Deploy** → copy the URL ending in **`/exec`** (not `/dev`).

## Part 7 — Connect the page
Open `config.js` and paste the URL:
```js
APPS_SCRIPT_URL: "https://script.google.com/macros/s/XXXX/exec",
```
The yellow "Demo mode" banner on the checkout disappears once this is set.

## Part 8 — Test an order
Open the page → fill your name + a test email → **Continue to Payment**.
✅ A new row appears in **Orders** with `AWAITING_PAYMENT`. If not, stop and see *Troubleshooting*.

## Part 9 — Test the payment reference
On the QR step, enter `TEST123456` → **Submit**.
✅ Orders shows `PAYMENT_SUBMITTED`, and a row appears in **Payments**.
*"This does NOT mean paid. It only means the buyer sent a reference."*

## Part 10 — Approve a payment (the real-life flow)
1. Open your **MariBank app**. Find the transfer: right amount (₱1,500), matching reference.
2. In **Orders**, find the buyer → change **PaymentStatus** to **`PAID`**.
3. The robot sends the welcome email automatically. No extra button.

> If the Payments tab says **⚠ SAME REFERENCE USED ON ANOTHER ORDER**, someone may be reusing a receipt. Check carefully before marking PAID. Use `REJECTED` if the money isn't there.

## Part 11 — Check the email
✅ `PaymentStatus = PAID` and `EmailStatus = SENT`, plus a row in **Fulfillment**.
If `EmailStatus = FAILED`, the order **stays PAID**. Read the reason in **Fulfillment** (usually: the daily email limit), fix it, then resend.

## Part 12 — Resend access
Buyer says "wala pa yung email"? Click their row in **Orders** → **Sales Funnel → Resend Access for Selected Order**. Only PAID orders work.
Buyers can also use **"Already paid? Resend Access"** at the bottom of the page. It only ever sends to the email on the paid order.

---

## Security (already built in)
- **Sheet stays private.** The page only talks to the `/exec` URL.
- **Price is set by the Sheet**, not the browser. Payment status is set **only by you**.
- **Rate limits** on every form, a hidden bot-trap field, **LockService** on every write, and protection against spreadsheet formula injection.
- **Turnstile (optional, before a big launch):**
  1. Create a Turnstile widget at Cloudflare for your domain.
  2. Put the **site key** in `config.js` → `TURNSTILE_SITE_KEY`.
  3. Apps Script → **Project Settings → Script Properties** → add `TURNSTILE_SECRET` = your **secret key**.
  4. In Settings, set `REQUIRE_TURNSTILE` to `TRUE` — only after step 3.

Nothing is "unhackable" or "DDoS-proof". This stack is right for a founding batch of 5–10 and small launches. For big traffic, put a proper server or payment provider in front.

## After you change Code.gs
**Deploy → Manage deployments →** pencil icon → **Version: New version → Deploy**. The `/exec` URL stays the same.

## Troubleshooting
| Problem | Check |
|---|---|
| Tabs didn't appear | Did `setupCRM` run and did you click **Allow**? Is the script attached to *this* Sheet? |
| Orders not saving | Is it the `/exec` URL? Access = **Anyone**? Did you redeploy after editing? Check **Logs** tab + Apps Script **Executions**. |
| Email not sending | PaymentStatus exactly `PAID`? `ACCESS_URL` filled? **Sales Funnel → Check email quota**. |
| "Security check failed" | `TURNSTILE_SECRET` in Script Properties? Domain allowed in Cloudflare? Set `REQUIRE_TURNSTILE` to `FALSE` while testing. |
| "Founding batch is full" | Raise `MAX_SEATS`, or set old test orders to `CANCELLED`. |
| Can the robot verify GCash/MariBank screenshots? | **No.** A screenshot can be fake. You check the real transfer in your bank app. |

## Before you launch
- [ ] Choose course dates → fill `COURSE_DATES`
- [ ] Choose your course platform → fill `ACCESS_URL`
- [ ] Ask Coach Russ Juson and Ravi Katta for permission (credits are not on the page yet)
- [ ] Delete test rows from Orders / Payments
- [ ] Run one full test with a friend (order → reference → PAID → email), then mark it `CANCELLED`
- [ ] Turn on Turnstile if you'll share the link publicly
