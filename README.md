# Class Attend 📱✨

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Build Status](https://img.shields.io/github/actions/workflow/status/dmatik/class_attend/build-and-test.yml?label=build)
[![Docker Pulls](https://img.shields.io/docker/pulls/dmatik/class-attend.svg)](https://hub.docker.com/r/dmatik/class-attend)
![Version](https://img.shields.io/badge/version-0.2.5-green)

**Class Attend** is a sleek, mobile-first **attendance and course tracking application** designed for people who value aesthetics and efficiency. Built as a Progressive Web App (PWA), it offers a premium UI, multi-user authentication, smooth animations, and complete self-hosting capabilities with a local SQLite database.

> **Note:** Fully localized in Hebrew (RTL) and English (LTR).

---

## 📸 Screenshots

![Dashboard Screenshot](./src/assets/screenshot-placeholder.png)
*(Run the app to see the interface in action!)*

---

## ✨ Key Features

*   **📱 Mobile-First & PWA Ready:** Install natively on iOS and Android. Detailed manifest, icons, and meta tags included.
*   **👥 Multi-User Support & Roles:** Secure user management with two roles:
    *   **Admin:** Full access to User Management (create users, reset passwords, assign admin/user roles, delete users).
    *   **User:** Full course and attendance management for their own scoped data.
*   **👤 Account Management:** Dedicated Account page to update name, family name, avatar picture, change passwords, and manage passkeys.
*   **🔑 WebAuthn & Passkeys Support:** Fast and secure biometric login using Touch ID, Face ID, Windows Hello, or hardware security keys in addition to username/password.
*   **🗄️ SQLite Database:** Fast, reliable, zero-config local database (`attendance.db`) stored in the `./data` directory with foreign-key cascade deletions and auto-migration from legacy `db.json`.
*   **🔐 Secure Authentication:** JWT-based sessions with bcrypt-hashed passwords. Initial installation seeds a default `admin` / `admin` account ready to use and customize.
*   **📚 Course & Session Management:** Organize multiple courses, schedule days of the week, track attendance status (attended, absent), log reasons, and manage makeup / replacement lessons.
*   **📊 Rich Dashboard & Analytics:** Real-time summary cards tracking remaining sessions, attendances, absences, and subscription usage.
*   **🎨 Clean Modern UI:** Built with **Tailwind CSS** and **Radix UI**, featuring responsive desktop and mobile navigation with Dark / Light theme support.
*   **⚡ Smooth Animations:** Powered by **Framer Motion** for fluid transitions and interactive card feedback.
*   **🐳 Dockerized & Self-Hostable:** Production-ready multi-stage Docker build with persistent data volume support.

---

## 🛠️ Tech Stack

### **Frontend**
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer-Motion-black?style=for-the-badge&logo=framer&logoColor=blue)

### **Backend & DevOps**
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/github%20actions-%232671E5.svg?style=for-the-badge&logo=githubactions&logoColor=white)

---

## 🚀 Getting Started

### **Default Credentials**
When launching the application for the first time, a default administrator is seeded automatically:
*   **Username:** `admin`
*   **Password:** `admin`

> 💡 *You can change the administrator password, name, and avatar picture at any time in the **Account** page (accessed by clicking your user avatar in the top bar).*

---

### **Option A: Docker (Recommended)** 🐳

Create a `docker-compose.yml` file:

```yaml
services:
  class_attend:
    image: dmatik/class-attend:latest
    container_name: class_attend
    restart: always
    ports:
      - "8080:5173"
    volumes:
      - ./data:/app/data
```

Start the container:
```bash
docker compose up -d
```

Visit: `http://localhost:8080`

---

### **Option B: Local Development** 💻

If you want to contribute or develop locally:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/dmatik/class_attend.git
    cd class_attend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev:all
    ```
    *This concurrently runs the Express backend API (port 3001) with SQLite and the Vite dev server (port 5173).*

4.  **Visit:** `http://localhost:5173`

5.  **Run Tests:**
    ```bash
    npm test
    ```

---

## 🏗️ Architecture & Database

*   `src/`: React Frontend (Vite, TypeScript, Tailwind CSS, Radix UI).
*   `server/`: Express backend API with JWT authentication (`server/index.js`) and SQLite initialization & schemas (`server/db.js`).
*   `data/`: Persistent volume directory containing `attendance.db` (SQLite database with tables for `users`, `courses`, and `sessions`).

---

Made with ❤️ by [dmatik](https://github.com/dmatik)
