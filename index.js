// Trusted backend: validates input, optionally verifies membership, and enforces
// uniqueness atomically (document ID = normalized Student ID, created in a transaction).
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

const REQUIRE_MEMBERSHIP = false; // set true to require a doc in members/{NORMALIZED_ID}
const TRACKS = ["Web Development", "Python Programming"];
const normalizeId = v => String(v || "").trim().toUpperCase().replace(/\s+/g, "").replace(/[\/\\]/g, "-");
const str = (v, max) => String(v ?? "").trim().slice(0, max);

exports.registerStudent = onCall({ maxInstances: 10 }, async ({ data = {} }) => {
  const rec = {
    fullName: str(data.fullName, 60), studentId: normalizeId(data.studentId), grade: str(data.grade, 10),
    section: str(data.section, 10), phoneNumber: str(data.phoneNumber, 18), email: str(data.email, 100), selectedTrack: str(data.selectedTrack, 40)
  };
  const bad = (m) => { throw new HttpsError("invalid-argument", m); };
  if (!/^\p{L}[\p{L}\s.'-]{2,59}$/u.test(rec.fullName)) bad("Enter your full name.");
  if (!/^[A-Z0-9-]{3,20}$/.test(rec.studentId)) bad("Invalid Student ID.");
  if (!/^[A-Za-z0-9 ]{1,10}$/.test(rec.grade) || !/^[A-Za-z0-9 ]{1,10}$/.test(rec.section)) bad("Invalid grade or section.");
  if (!/^\+?[0-9\s-]{9,15}$/.test(rec.phoneNumber)) bad("Invalid phone number.");
  if (rec.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rec.email)) bad("Invalid email.");
  if (!TRACKS.includes(rec.selectedTrack)) bad("Choose a valid learning track.");

  await db.runTransaction(async tx => {
    const ref = db.doc(`registrations/${rec.studentId}`);
    const [existing, member] = await Promise.all([tx.get(ref), REQUIRE_MEMBERSHIP ? tx.get(db.doc(`members/${rec.studentId}`)) : null]);
    if (existing.exists) throw new HttpsError("already-exists", "This Student ID is already registered.");
    if (REQUIRE_MEMBERSHIP && !member.exists) throw new HttpsError("permission-denied", "Not on the member list.");
    tx.create(ref, { ...rec, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  return { ok: true };
});
