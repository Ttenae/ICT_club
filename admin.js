import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, orderBy, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = s => document.querySelector(s);
let all = [];
let deleteTargetId = null; // Tracks which row we are deleting

/* ---------- Auth ---------- */
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("#loginBtn"), err = $("#loginErr"); err.textContent = ""; btn.disabled = true; btn.textContent = "Signing in...";
  try { await signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#password").value); }
  catch { err.textContent = "Sign in failed. Check your email and password."; }
  finally { btn.disabled = false; btn.textContent = "Sign in"; }
});
$("#logoutBtn").addEventListener("click", () => signOut(auth));
onAuthStateChanged(auth, user => {
  $("#loginView").hidden = !!user; $("#dash").hidden = !user; $("#logoutBtn").hidden = !user;
  if (user) load(); else { all = []; }
});

/* ---------- Data ---------- */
function skeleton() { $("#rows").innerHTML = Array.from({ length: 6 }, () => `<tr class="skel">${"<td><div></div></td>".repeat(9)}</tr>`).join(""); $("#state").textContent = ""; }
async function load() {
  skeleton();
  try {
    const snap = await getDocs(query(collection(db, "registrations"), orderBy("createdAt", "desc")));
    all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    fillFilter("#fGrade", "grade", "All grades"); fillFilter("#fSection", "section", "All sections");
    stats(); render();
  } catch (e) {
    $("#rows").innerHTML = "";
    const s = $("#state"); s.className = "state error";
    s.textContent = e.code === "permission-denied" ? "This account is not an authorized administrator." : "Could not load registrations. Check your connection and try again.";
  }
}
const fillFilter = (sel, key, label) => { const el = $(sel), cur = el.value; const vals = [...new Set(all.map(r => r[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); el.innerHTML = `<option value="">${label}</option>` + vals.map(v => `<option>${esc(v)}</option>`).join(""); el.value = cur; };
function count(el, to) { const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches; if (reduce || !to) { el.textContent = to; return; } const t0 = performance.now(); const tick = t => { const p = Math.min((t - t0) / 800, 1); el.textContent = Math.round(to * p); if (p < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
function stats() { count($("#sTotal"), all.length); count($("#sWeb"), all.filter(r => r.selectedTrack === "Web Development").length); count($("#sPy"), all.filter(r => r.selectedTrack === "Python Programming").length); }

/* ---------- Filter + render ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = r => r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : "";
const filtered = () => { const q = $("#q").value.trim().toLowerCase(), t = $("#fTrack").value, g = $("#fGrade").value, s = $("#fSection").value;
  return all.filter(r => (!q || (r.fullName || "").toLowerCase().includes(q) || (r.studentId || "").toLowerCase().includes(q)) && (!t || r.selectedTrack === t) && (!g || r.grade === g) && (!s || r.section === s)); };
function render() {
  const rows = filtered(), st = $("#state"); st.className = "state";
  $("#rows").innerHTML = rows.map(r => `<tr>
    <td>${esc(r.fullName)}</td>
    <td>${esc(r.studentId)}</td>
    <td>${esc(r.grade)}</td>
    <td>${esc(r.section)}</td>
    <td>${esc(r.phoneNumber)}</td>
    <td>${esc(r.email) || "—"}</td>
    <td><span class="pill ${r.selectedTrack === "Python Programming" ? "py" : ""}">${esc(r.selectedTrack)}</span></td>
    <td>${esc(fmt(r))}</td>
    <td><button class="btn del" data-id="${esc(r.id)}" data-name="${esc(r.fullName)}" aria-label="Delete ${esc(r.fullName)}">Delete</button></td>
  </tr>`).join("");
  st.textContent = rows.length ? "" : (all.length ? "No registrations match your filters." : "No registrations yet. New sign-ups will appear here.");
}
["#q", "#fTrack", "#fGrade", "#fSection"].forEach(s => $(s).addEventListener("input", render));

/* ---------- Custom Delete Modal ---------- */
const modal = $("#deleteModal");
const confirmBtn = $("#confirmDelete");
const cancelBtn = $("#cancelDelete");

$("#rows").addEventListener("click", e => {
  const btn = e.target.closest(".del");
  if (!btn) return;

  deleteTargetId = btn.dataset.id;
  $("#deleteName").textContent = btn.dataset.name;
  modal.hidden = false;
});

cancelBtn.addEventListener("click", () => { modal.hidden = true; deleteTargetId = null; });
modal.addEventListener("click", e => { if (e.target === modal) cancelBtn.click(); }); // Close on backdrop click
document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) cancelBtn.click(); }); // Close on Esc

confirmBtn.addEventListener("click", async () => {
  if (!deleteTargetId) return;

  const originalText = confirmBtn.textContent;
  confirmBtn.disabled = true;
  confirmBtn.textContent = "Deleting...";

  try {
    await deleteDoc(doc(db, "registrations", deleteTargetId));
    all = all.filter(r => r.id !== deleteTargetId);
    stats();
    render();
    modal.hidden = true;
  } catch (err) {
    console.error(err);
    const s = $("#state"); s.className = "state error";
    s.textContent = err.code === "permission-denied"
      ? "You don't have permission to delete registrations."
      : "Could not delete. Please try again.";
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = originalText;
    deleteTargetId = null;
  }
});

/* ---------- CSV ---------- */
const cell = v => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
$("#csvBtn").addEventListener("click", () => {
  const rows = filtered(); if (!rows.length) { $("#state").textContent = "Nothing to export."; return; }
  const head = ["fullName", "studentId", "grade", "section", "phoneNumber", "email", "selectedTrack", "createdAt"];
  const csv = [head.join(","), ...rows.map(r => head.map(h => cell(h === "createdAt" ? fmt(r) : r[h])).join(","))].join("\n");
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" })), download: `oda-ict-registrations-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click(); URL.revokeObjectURL(a.href);
});

/* ---------- Auto-Logout on Tab Switch (1 Minute Timeout) ---------- */
let hiddenTime = 0;

document.addEventListener("visibilitychange", () => {
  // If the user leaves the tab (switches apps/tabs or minimizes)
  if (document.hidden) {
    // Record the exact timestamp they left
    hiddenTime = Date.now();
  } 
  // If the user returns to the tab
  else {
    if (hiddenTime > 0) {
      const timeAway = Date.now() - hiddenTime;
      const oneMinute = 60 * 1000; // 1 minute in milliseconds

      // If they were gone for 1 minute or more, log them out
      if (timeAway >= oneMinute && auth.currentUser) {
        signOut(auth); 
      }
      
      // Reset the timer
      hiddenTime = 0;
    }
  }
});