<div align="center">

# OFUQ Platform · أفق

### Turn your idea into a real project

A project-incubation platform that guides entrepreneurs from raw idea to launch through a structured, four-stage journey — with a mentor reviewing every step.

<br>

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase&logoColor=black)
![i18n](https://img.shields.io/badge/i18n-AR%20%2F%20EN-3b82f6?style=flat)

</div>

---

## 🎥 Video Walkthrough

A full walkthrough of the platform and how it works end to end:

<div align="center">

[![OFUQ Platform walkthrough on YouTube](https://img.youtube.com/vi/5HeElQ53ESI/maxresdefault.jpg)](https://youtu.be/5HeElQ53ESI)

**▶️ [Watch the walkthrough](https://youtu.be/5HeElQ53ESI)**

</div>

---

## ✨ Overview

OFUQ (Arabic for *"horizon"*) solves a simple problem: a first-time founder has an idea but no clear path to execute it and no one to review their work. The platform gives them a **defined 4-stage roadmap**, where each stage is a concrete checklist plus a space to attach proof of work (a GitHub / Figma / Drive link). A mentor reviews each submission and either approves it or sends it back with a note.

Stages are **gated** — a user can't move to the next stage until the mentor approves the previous one. That's what makes the journey genuinely structured rather than just a to-do list.

Everything updates in **real time**: when a mentor approves an idea, the student gets a notification and their status changes instantly, no page reload needed.

---

## 🎯 Roles

The platform has three permission levels, each with its own dashboard:

| Role | Capabilities |
|------|--------------|
| **Entrepreneur (User)** | Registers, submits a project idea, picks their group, tracks their stages, submits proof of completion for each stage, and receives notifications on mentor decisions. |
| **Professor (Mentor)** | Creates groups with join codes, and reviews ideas and stage submissions **only for students in their own groups**. |
| **Super Admin** | Full visibility: manages professors, all groups, unassigned students, transfers students between groups, and reviews every project. |

> Professor accounts are created from the Super Admin panel using a **secondary Firebase App instance** — a neat trick that lets the admin create the new account without being signed out of their own session.

---

## 🛤️ The Project Journey — Four Stages

Each stage has its own checklist, and the final stage **requires a GitHub link** to the project:

| # | Stage | Checklist |
|---|-------|-----------|
| 💡 1 | **Idea & Planning** | Market research · Business Model Canvas · SWOT analysis · Target audience |
| 🏗️ 2 | **Foundation** | Database design · Team formation · Financial plan · Legal structure |
| 🎨 3 | **Design & Development** | UI wireframes · Prototype build · User testing · Feedback integration |
| 🚀 4 | **Launch** | Marketing plan · Official launch · Social media setup · **GitHub repo (required)** |

---

## ⚙️ How It Works (Flow)

```
User registers
      ↓
Submit idea  ──►  status: pending
      ↓
Mentor review ──►  accept (Stage 1 unlocks)  /  reject (revise & resubmit)
      ↓
Complete stage (checklist + summary + proof link) ──► status: submitted
      ↓
Mentor review ──►  approve (next stage unlocks)  /  reject (resubmit)
      ↓
... repeats across all four stages ...
      ↓
Stage 4 approved ──►  status: completed  🎉
```

On every mentor decision, a **notification** is pushed to the user and appears in their dashboard immediately.

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | HTML5 + CSS3 + Vanilla JavaScript — no framework, no build step |
| **Auth** | Firebase Authentication (Email / Password) |
| **Database** | Cloud Firestore (real-time) |
| **Sync** | `onSnapshot` listeners → local CACHE → synchronous reads |
| **Font** | Tajawal (Google Fonts) |
| **Languages** | Arabic (default · RTL) / English (LTR) — built-in i18n system |
| **Theme** | Dark / Light — persisted in `localStorage` |

The project is **fully static** — just drop it on any static host (GitHub Pages / Firebase Hosting / Netlify); no server required.

---

## 📁 Project Structure

```
OFUQ-platform/
├── index.html          # Landing page — intro, how it works, stage preview
├── auth.html           # Login / Register (+ professor invitation system)
├── dashboard.html      # Entrepreneur dashboard (Home · Idea · Tracking)
├── admin.html          # Professor / Admin panel
├── css/
│   └── styles.css      # All styling + theme variables + RTL/LTR support
└── js/
    ├── app.js          # Firebase core · DB object · auth guard · i18n · settings
    ├── dashboard.js     # User dashboard logic
    └── admin.js         # Professor / Admin panel logic
```

---

## 🗄️ Data Model (Firestore)

The platform relies on five collections:

**`users`**
```js
{ id, name, email, role: 'user' | 'professor' | 'admin', groupId, createdAt }
```

**`projects`**
```js
{
  id, userId, userName, projectName, description, category,
  status: 'pending' | 'accepted' | 'rejected' | 'completed',
  adminNote, currentStage, groupId, createdAt,
  stages: [
    { stageNumber, status: 'locked'|'in_progress'|'submitted'|'approved'|'rejected',
      completionItems[], summary, proofLink, adminNote, submittedAt, reviewedAt }
  ]
}
```

**`groups`**
```js
{ id, name, code: 'GRP-XXXX', professorId, professorName, createdAt }
```

**`notifications`**
```js
{ id, userId, type: 'success'|'danger', message, read, createdAt }
```

**`invitations`** — if a user's email is found here on registration, their role is assigned automatically (used to invite professors).
```js
{ email, role }
```

---

## 🚀 Local Setup

**1. Clone the repository**
```bash
git clone https://github.com/ABAlsharif/OFUQ-platform.git
cd OFUQ-platform
```

**2. Set up a Firebase project**

Create a project on the [Firebase Console](https://console.firebase.google.com), enable **Authentication (Email/Password)** and **Cloud Firestore**, then drop your config into `js/app.js`:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

> 🔓 **Note:** Firebase Web API keys are **designed to be public** in client-side code, so exposing one is not a vulnerability. Real security comes entirely from **Firestore Security Rules** — make sure they're configured so no one can read/write data that isn't theirs before going live.

**3. Run it**

The project is static, so any simple local server works:
```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

**4. Create your first Super Admin**

Register a normal account from `auth.html`, then manually change that user's `role` field to `admin` in the Firestore Console.

---

## 🌟 Highlights

- **Gated stages:** a stage only unlocks after the mentor approves the previous one.
- **Real-time sync:** decisions and notifications appear without a reload (4-second auto-refresh + live listeners).
- **Fully bilingual:** instant switch between Arabic and English, flipping page direction (RTL/LTR).
- **Dark / Light theme** persisted across sessions.
- **Group system with join codes** (`GRP-XXXX`) linking students to their professor.
- **In-app notification system** per user.
- **Clean role hierarchy:** student / professor / admin, each seeing only what's theirs.

---

## 👤 Author

**Abubakr Alsharif** · [GitHub @ABAlsharif](https://github.com/ABAlsharif)

<div align="center">

Built to help entrepreneurs start their journey 🚀

</div>
