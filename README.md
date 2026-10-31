# ODA ICT Club Registration (free Spark plan)

Vanilla HTML/CSS/JS + Firebase Auth, Firestore and Hosting. No Cloud Functions, no billing.

- Registration: the browser writes `registrations/{NORMALIZED_STUDENT_ID}`. Firestore Security Rules validate every field, require a server timestamp, refuse duplicates (a document ID can only be created once) and block updates and deletes.
- Optional member check: add `members/{ID}` docs, then uncomment the `exists(...members...)` line in `firestore.rules`.
- Admin: `admin.html` signs in with Firebase Auth; reading needs an `admins/{uid}` document.

## Setup
1. Create a Firebase project. Enable Authentication → Email/Password and add your admin user(s).
2. Create Firestore. Test mode is fine for the first minute, but you MUST publish `firestore.rules` before sharing the site.
3. Add a Web app; paste its config into `firebase-config.js`.
4. Create collection `admins`; add a document whose ID is each admin's UID.
5. Deploy: `npm i -g firebase-tools && firebase login && firebase init` (Firestore + Hosting, keep existing files, public dir `.`), then `firebase deploy`.
   No CLI? Paste `firestore.rules` into Firestore → Rules → Publish, and run the site on any static host.
