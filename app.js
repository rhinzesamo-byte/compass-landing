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

  /* ---------- Reservation form link ---------- */
  var formBtn = $("#formBtn");
  if (formBtn && /^https:\/\//.test(CFG.RESERVATION_FORM_URL || "")) formBtn.href = CFG.RESERVATION_FORM_URL;

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
})();
