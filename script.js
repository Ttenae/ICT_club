import { db } from "./firebase-config.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const form = $("#regForm");
const state = { step: 1, track: "", submitting: false };

/* ---------- Validation (mirrors the Cloud Function) ---------- */
const normalizeId = v => v.trim().toUpperCase().replace(/\s+/g, "").replace(/[\/\\]/g, "-");
const rules = {
  fullName: v => /^\p{L}[\p{L}\s.'-]{2,59}$/u.test(v.trim()) || "Enter your full name (3–60 letters).",
  studentId: v => /^[A-Z0-9-]{3,20}$/.test(normalizeId(v)) || "Use 3–20 letters, numbers, / or -.",
  phoneNumber: v => /^\+?[0-9\s-]{9,15}$/.test(v.trim()) || "Enter a valid phone number.",
  grade: v => /^[A-Za-z0-9 ]{1,10}$/.test(v.trim()) || "Enter your grade.",
  section: v => /^[A-Za-z0-9 ]{1,10}$/.test(v.trim()) || "Enter your section.",
  email: v => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || "Enter a valid email or leave it blank."
};
const showErr = (name, msg) => { const el = $(`[data-err="${name}"]`); if (el) el.textContent = msg || ""; const f = form.elements[name]; if (f && f.closest) f.closest(".field")?.classList.toggle("bad", !!msg); };
const checkField = name => { const r = rules[name](form.elements[name].value); showErr(name, r === true ? "" : r); return r === true; };
Object.keys(rules).forEach(n => {
  const el = form.elements[n];
  el.addEventListener("blur", () => checkField(n));
  el.addEventListener("input", () => { if (el.closest(".field").classList.contains("bad")) checkField(n); });
});

/* ---------- Steps ---------- */
function goStep(n) {
  state.step = n;
  $$(".step").forEach(s => s.classList.toggle("on", +s.dataset.step === n));
  $$(".pstep").forEach(p => p.classList.toggle("on", +p.dataset.p <= n));
  $("#pfill").style.width = n === 2 ? "100%" : "0";
  $("#formStatus").textContent = "";
}
$("#nextBtn").addEventListener("click", () => {
  const ok = Object.keys(rules).map(checkField).every(Boolean);
  if (ok) goStep(2); else $(".field.bad input")?.focus();
});
$("#backBtn").addEventListener("click", () => goStep(1));

/* ---------- Track selection ---------- */
function setTrack(name, { scroll = false } = {}) {
  state.track = name;
  $$(".track").forEach(c => { const on = c.dataset.track === name; c.classList.toggle("selected", on); c.setAttribute("aria-checked", on); });
  $$('input[name="selectedTrack"]').forEach(r => { r.checked = r.value === name; });
  $("#formTitle").textContent = name ? `Start Your ${name} Journey` : "Your Journey Starts Here";
  showErr("selectedTrack", "");
  if (scroll) $("#register").scrollIntoView({ behavior: "smooth", block: "start" });
}
$$(".track").forEach(card => {
  const pick = () => setTrack(card.dataset.track, { scroll: true });
  card.addEventListener("click", pick);
  card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
});
$$('input[name="selectedTrack"]').forEach(r => r.addEventListener("change", () => setTrack(r.value)));

/* ---------- Submit ---------- */
const friendly = err => {
  if (err.code === "permission-denied") return "Registration was refused. This Student ID is already registered, or it is not on the club member list.";
  if (err.message === "timeout" || err.code === "unavailable") return "We could not reach the server. Check your connection and try again.";
  return "Registration failed. Please try again.";
};
function setLoading(on) {
  state.submitting = on;
  $("#submitBtn").disabled = on; $("#backBtn").disabled = on;
  $(".spin").hidden = !on;
  $("#submitLabel").textContent = on ? "Submitting your registration..." : "Complete My Registration";
}
form.addEventListener("submit", async e => {
  e.preventDefault();
  if (state.submitting) return;
  const status = $("#formStatus"); status.className = "status";
  if (!Object.keys(rules).map(checkField).every(Boolean)) { goStep(1); return; }
  if (!state.track) { showErr("selectedTrack", "Choose a learning track."); return; }
  if (!$("#confirm").checked) { showErr("confirm", "Please confirm to continue."); return; }
  showErr("confirm", "");
  const f = form.elements;
  const payload = { fullName: f.fullName.value.trim(), studentId: normalizeId(f.studentId.value), grade: f.grade.value.trim(), section: f.section.value.trim(), phoneNumber: f.phoneNumber.value.trim(), email: f.email.value.trim(), selectedTrack: state.track };
  setLoading(true);
  try {
    // setDoc resolves only after the server accepts the write; the rules reject duplicates and invalid data.
    const save = setDoc(doc(db, "registrations", payload.studentId), { ...payload, createdAt: serverTimestamp() });
    await Promise.race([save, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000))]);
    
    // --- NEW TELEGRAM LOGIC ---
    const telegramBtn = $("#telegramBtn");
    if (payload.selectedTrack === "Web Development") {
      telegramBtn.href = "https://t.me/odawebclass";
    } else if (payload.selectedTrack === "Python Programming") {
      telegramBtn.href = "https://t.me/ICT_python_1";
    }
    // --------------------------

    $("#doneTrack").textContent = payload.selectedTrack; $("#doneId").textContent = payload.studentId;
    $("#formView").hidden = true; $("#successView").hidden = false;
  } catch (err) {
    status.textContent = friendly(err); status.classList.add("error");
  } finally { setLoading(false); }
});
$("#homeBtn").addEventListener("click", () => {
  form.reset(); setTrack(""); goStep(1);
  $("#successView").hidden = true; $("#formView").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* ---------- UI effects ---------- */
const nav = $("#nav"), toTop = $("#toTop");
addEventListener("scroll", () => { nav.classList.toggle("solid", scrollY > 40); toTop.hidden = scrollY < 600; }, { passive: true });
toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
$("#menuBtn").addEventListener("click", e => { const o = nav.classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", o); });
$$("#navLinks a").forEach(a => a.addEventListener("click", () => { nav.classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded", "false"); }));
const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: 0.15 });
$$(".reveal").forEach(el => io.observe(el));
if (matchMedia("(hover:hover) and (pointer:fine)").matches && !matchMedia("(prefers-reduced-motion:reduce)").matches) {
  const glow = $("#cursorGlow"); let raf = 0;
  addEventListener("pointermove", e => { if (raf) return; raf = requestAnimationFrame(() => { glow.style.transform = `translate(${e.clientX - 200}px,${e.clientY - 200}px)`; raf = 0; }); });
  glow.classList.add("on");
}
$("#yr").textContent = new Date().getFullYear();