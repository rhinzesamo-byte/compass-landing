(function () {
  "use strict";
  var CFG = window.COMPASS_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Compass ticks ---------- */
  var ticks = $("#ticks");
  if (ticks) {
    var out = "";
    for (var i = 0; i < 48; i++) {
      if (i % 12 === 0) continue; // leave room for N/E/S/W
      var a = (i / 48) * Math.PI * 2, r1 = 168, r2 = i % 3 === 0 ? 186 : 180;
      out += '<line x1="' + (Math.sin(a) * r1).toFixed(1) + '" y1="' + (-Math.cos(a) * r1).toFixed(1) +
             '" x2="' + (Math.sin(a) * r2).toFixed(1) + '" y2="' + (-Math.cos(a) * r2).toFixed(1) + '"/>';
    }
    ticks.innerHTML = out;
  }

  /* ---------- Compass leaf interaction ---------- */
  var LEAVES = {
    N: "North · What You Love — Week 2 Wednesday",
    E: "East · What the World Needs — Week 3 Monday",
    S: "South · What You Can Be Paid For — Week 3 Wednesday",
    W: "West · What You Are Good At — Week 2 Monday"
  };
  var compass = $("#compass"), caption = $("#compassCaption"), active = null;
  function setLeaf(k) {
    active = active === k ? null : k;
    $$("[data-leaf]").forEach(function (el) { el.classList.toggle("is-active", el.getAttribute("data-leaf") === active); });
    if (compass) compass.classList.toggle("has-active", !!active);
    if (caption) caption.textContent = active ? LEAVES[active] : "Tap a leaf · the Compass Method";
  }
  $$("[data-leaf]").forEach(function (el) {
    el.addEventListener("click", function () { setLeaf(el.getAttribute("data-leaf")); });
  });

  /* ---------- Reveal on scroll ---------- */
  var groups = {};
  $$(".reveal").forEach(function (el) {
    var p = el.parentElement; var key = p ? (p.__rid || (p.__rid = Math.random())) : 0;
    groups[key] = (groups[key] || 0) + 1;
    el.style.setProperty("--d", Math.min(groups[key] - 1, 5) * 0.08 + "s");
  });
  var inTargets = $$(".reveal, .journey, .sheet");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { threshold: 0.14, rootMargin: "0px 0px -40px 0px" });
    inTargets.forEach(function (el) { io.observe(el); });
  } else {
    inTargets.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- Scroll progress + sticky CTA ---------- */
  var bar = $("#progressBar"), sticky = $("#stickyCta"), hero = $(".hero"), enroll = $("#enroll"), ticking = false;
  function onScroll() {
    ticking = false;
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    if (bar) bar.style.transform = "scaleX(" + (max > 0 ? h.scrollTop / max : 0) + ")";
    if (sticky && hero && enroll) {
      var pastHero = hero.getBoundingClientRect().bottom < 0;
      var er = enroll.getBoundingClientRect();
      var atEnroll = er.top < window.innerHeight && er.bottom > 0;
      sticky.classList.toggle("is-shown", pastHero && !atEnroll);
    }
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ---------- Week tabs ---------- */
  var tabs = $$('.journey__tabs [role="tab"]');
  function selectTab(t, focus) {
    tabs.forEach(function (b) {
      var on = b === t;
      b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1;
      $("#" + b.getAttribute("aria-controls")).hidden = !on;
    });
    if (focus) t.focus();
    t.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { selectTab(t); });
    t.addEventListener("keydown", function (e) {
      var n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
      if (n === null) return;
      e.preventDefault(); selectTab(tabs[(n + tabs.length) % tabs.length], true);
    });
  });

  /* ---------- FAQ: one open at a time ---------- */
  $$(".faq details").forEach(function (d) {
    d.addEventListener("toggle", function () {
      if (d.open) $$(".faq details").forEach(function (o) { if (o !== d) o.open = false; });
    });
  });

  /* =====================================================
     BACKEND (Google Apps Script)
     ===================================================== */
  var DEMO = !CFG.APPS_SCRIPT_URL;
  if (DEMO) { var db = $("#demoBanner"); if (db) db.hidden = false; }

  function api(action, payload) {
    if (DEMO) {
      return new Promise(function (res) {
        setTimeout(function () {
          if (action === "createOrder") res({ ok: true, orderId: "CCC-DEMO" + Math.floor(Math.random() * 900 + 100), token: "demo", amount: 1500, currency: "PHP" });
          else if (action === "submitPaymentReference") res({ ok: true, status: "PAYMENT_SUBMITTED" });
          else res({ ok: true, message: action === "resendAccess" ? "If that email has a paid order, your access email is on its way." : "Salamat! We’ll email you when the dates are set." });
        }, 600);
      });
    }
    var body = Object.assign({ action: action }, payload);
    // text/plain avoids a CORS preflight, which Apps Script cannot answer.
    return fetch(CFG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      redirect: "follow"
    }).then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, error: "Can’t reach the server. Check your connection and try again." }; });
  }

  /* ---------- Turnstile (optional) ---------- */
  var tsWidgets = new Map();
  if (CFG.TURNSTILE_SITE_KEY) {
    window.onTurnstileLoad = function () {
      $$("[data-turnstile]").forEach(function (el) {
        tsWidgets.set(el, window.turnstile.render(el, { sitekey: CFG.TURNSTILE_SITE_KEY, theme: "light", size: "flexible" }));
      });
    };
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";
    s.async = true; s.defer = true; document.head.appendChild(s);
  }
  function tsToken(form) {
    var el = $("[data-turnstile]", form);
    if (!CFG.TURNSTILE_SITE_KEY || !el || !window.turnstile) return "";
    return window.turnstile.getResponse(tsWidgets.get(el)) || "";
  }
  function tsReset(form) {
    var el = $("[data-turnstile]", form);
    if (el && window.turnstile && tsWidgets.has(el)) window.turnstile.reset(tsWidgets.get(el));
  }

  /* ---------- Helpers ---------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function msg(form, text, type) {
    var m = $(".form-msg", form); if (!m) return;
    m.textContent = text || ""; m.className = "form-msg" + (type ? " is-" + type : "");
  }
  function busy(form, on) {
    var b = $('button[type="submit"]', form); if (!b) return;
    if (on) { b.dataset.label = b.textContent; b.textContent = "Sandali lang…"; b.disabled = true; }
    else { b.textContent = b.dataset.label || b.textContent; b.disabled = false; }
  }
  function invalid(input, bad) { input.setAttribute("aria-invalid", bad ? "true" : "false"); return bad; }
  function peso(n) { return "₱" + Number(n).toLocaleString("en-PH"); }
  var store = {
    get: function () { try { return JSON.parse(localStorage.getItem("ccc_order") || "null"); } catch (e) { return null; } },
    set: function (v) { try { v ? localStorage.setItem("ccc_order", JSON.stringify(v)) : localStorage.removeItem("ccc_order"); } catch (e) {} }
  };

  /* ---------- Checkout ---------- */
  var s1 = $("#step1"), s2 = $("#step2"), s3 = $("#step3");
  var order = null;
  function showStep(n) {
    [s1, s2, s3].forEach(function (el, i) { el.hidden = i !== n - 1; });
    $$(".stepper li").forEach(function (li) {
      var k = +li.dataset.step;
      li.classList.toggle("is-active", k === n); li.classList.toggle("is-done", k < n);
    });
  }
  function fillPayment(o) {
    $("#payAmount").textContent = peso(o.amount);
    $("#payOrder").textContent = o.orderId;
    $("#doneOrder").textContent = o.orderId;
  }

  /* ---------- QR switcher (GCash / MariBank) ---------- */
  var payOpts = CFG.PAYMENT_OPTIONS || [];
  var qrSwitch = $("#qrSwitch");
  function pickQr(i) {
    var o = payOpts[i]; if (!o) return;
    var img = $("#qrImg");
    img.src = o.qr; img.alt = o.label + " QR code for Rhinzes Amo";
    $("#payPayee").textContent = "Pay to: " + o.payee;
    $$("button", qrSwitch).forEach(function (b, j) { b.setAttribute("aria-pressed", j === i); });
  }
  if (qrSwitch) {
    if (payOpts.length > 1) {
      payOpts.forEach(function (o, i) {
        var b = document.createElement("button");
        b.type = "button"; b.textContent = o.label;
        b.addEventListener("click", function () { pickQr(i); });
        qrSwitch.appendChild(b);
      });
    } else { qrSwitch.hidden = true; }
    pickQr(0);
  }

  // resume a saved order after refresh
  var saved = store.get();
  if (saved && saved.orderId) {
    order = saved; fillPayment(order);
    showStep(saved.submitted ? 3 : 2);
  }

  s1.addEventListener("submit", function (e) {
    e.preventDefault(); msg(s1, "");
    var f = s1.elements;
    var name = f.name.value.trim(), email = f.email.value.trim().toLowerCase(), phone = f.phone.value.trim();
    var bad = invalid(f.name, name.length < 2) | invalid(f.email, !EMAIL_RE.test(email)) | invalid(f.phone, !!phone && !/^[0-9+\-\s()]{7,20}$/.test(phone));
    if (bad) return msg(s1, "Please check your name, email and mobile number.", "error");
    if (!f.consent.checked) return msg(s1, "Please tick the box to continue.", "error");
    if (f.website.value) return; // bot
    var ts = tsToken(s1);
    if (CFG.TURNSTILE_SITE_KEY && !ts) return msg(s1, "Please complete the quick security check.", "error");
    busy(s1, true);
    api("createOrder", { name: name, email: email, phone: phone, website: f.website.value, turnstileToken: ts }).then(function (r) {
      busy(s1, false); tsReset(s1);
      if (!r || !r.ok) return msg(s1, (r && r.error) || "Something went wrong. Please try again.", "error");
      order = { orderId: r.orderId, token: r.token, amount: r.amount };
      store.set(order); fillPayment(order); showStep(2);
      s2.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  });

  s2.addEventListener("submit", function (e) {
    e.preventDefault(); msg(s2, "");
    if (!order) return showStep(1);
    var f = s2.elements, ref = f.reference.value.trim();
    if (invalid(f.reference, !/^[A-Za-z0-9\- ]{6,40}$/.test(ref))) return msg(s2, "Please paste the reference number from your receipt (letters and numbers only).", "error");
    var ts = tsToken(s2);
    if (CFG.TURNSTILE_SITE_KEY && !ts) return msg(s2, "Please complete the quick security check.", "error");
    busy(s2, true);
    api("submitPaymentReference", { orderId: order.orderId, token: order.token, reference: ref, payerName: f.payerName.value.trim(), website: f.website ? f.website.value : "", turnstileToken: ts }).then(function (r) {
      busy(s2, false); tsReset(s2);
      if (!r || !r.ok) return msg(s2, (r && r.error) || "Something went wrong. Please try again.", "error");
      order.submitted = true; store.set(order); showStep(3); s3.focus();
    });
  });

  $("#restart").addEventListener("click", function () {
    store.set(null); order = null; s1.reset(); s2.reset(); showStep(1);
  });

  $$(".copy").forEach(function (b) {
    b.addEventListener("click", function () {
      var t = $("#" + b.dataset.copy).textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () {
        b.textContent = "copied ✓"; setTimeout(function () { b.textContent = "copy"; }, 1600);
      }).catch(function () {});
    });
  });

  /* ---------- Lead + Resend ---------- */
  function miniForm(form, action, fields) {
    form.addEventListener("submit", function (e) {
      e.preventDefault(); msg(form, "");
      var f = form.elements, data = {};
      var email = f.email.value.trim().toLowerCase();
      if (invalid(f.email, !EMAIL_RE.test(email))) return msg(form, "Please enter a valid email.", "error");
      if (fields.indexOf("name") > -1 && invalid(f.name, f.name.value.trim().length < 2)) return msg(form, "Please enter your name.", "error");
      if (f.website.value) return;
      var ts = tsToken(form);
      if (CFG.TURNSTILE_SITE_KEY && !ts) return msg(form, "Please complete the quick security check.", "error");
      data.email = email; if (f.name) data.name = f.name.value.trim();
      data.source = "landing"; data.turnstileToken = ts; data.website = f.website.value;
      busy(form, true);
      api(action, data).then(function (r) {
        busy(form, false); tsReset(form);
        if (!r || !r.ok) return msg(form, (r && r.error) || "Something went wrong. Please try again.", "error");
        msg(form, r.message || "Done!", "ok"); form.reset();
      });
    });
  }
  miniForm($("#leadForm"), "createLead", ["name", "email"]);
  miniForm($("#resend"), "resendAccess", ["email"]);
})();
