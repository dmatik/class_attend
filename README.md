# Class Attend 📱✨

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Build Status](https://img.shields.io/github/actions/workflow/status/dmatik/class_attend/build-and-test.yml?label=build)
[![Docker Pulls](https://img.shields.io/docker/pulls/dmatik/class-attend.svg)](https://hub.docker.com/r/dmatik/class-attend)
![Version](https://img.shields.io/badge/version-0.0.6-green)

**Class Attend** is a sleek, mobile-first **attendance tracking application** designed for people who value aesthetics and efficiency. Built as a Progressive Web App (PWA), it offers a premium "Glassmorphism" UI, smooth animations, and complete self-hosting capabilities.

> **Note:** Optimized for Hebrew (RTL) but easily adaptable for other languages.

---

## 📸 Screenshots

![Dashboard Screenshot](./src/assets/screenshot-placeholder.png)
*(Run the app to see the beautiful glassmorphism in action!)*

---

## ✨ Key Features

*   **📱 Mobile-First & PWA Ready:** Install natively on iOS and Android. Detailed manifest and meta tags included.
*   **🎨 Premium Glassmorphism UI:** Built with **Shadcn UI** and **Tailwind CSS**, featuring a clean, airy aesthetic with dark/light mode capabilities.
*   **⚡ Smooth Animations:** Powered by **Framer Motion** for fluid page transitions and interaction feedback.
*   **⏱️ Efficient Tracking:** Quick start/stop attendance functionality with intuitive controls.
*   **🐳 Dockerized & Self-Hostable:** Full Docker support with multi-stage builds for a lightweight footprint.
*   **🔒 Secure & Private:** Data stored locally (JSON-based) or self-hosted; easily deployable behind Cloudflare Zero Trust.
*   **🌍 RTL Support:** Native support for Right-to-Left languages (Hebrew).

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
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/github%20actions-%232671E5.svg?style=for-the-badge&logo=githubactions&logoColor=white)

---

## 🚀 Getting Started

Class Attend is designed to be up and running in minutes. Choose your preferred method below.

### **Option A: Docker (Recommended)** 🐳
The easiest way to run Class Attend is via Docker Compose.
    

    class_attend:
        restart: always
        hostname: class_attend
        container_name: class_attend
        image: dmatik/class-attend:latest
        network_mode: "bridge"
        ports:
            - "5173:5173"
        volumes:
            - <path to your data folder>:/app/data

### **Option B: Local Development** 💻

If you want to contribute or modify the code:

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
    *This starts both the Express backend (API) and the Vite frontend.*

4.  **Visit:** `http://localhost:5173`

---

## 🏗️ Architecture & CI/CD

The project leverages a robust **GitHub Actions** pipeline for continuous delivery:

1.  **Commit:** Code changes pushed to `main` trigger the pipeline.
2.  **Build:** A multi-stage Docker build configures the **Node.js (Alpine)** environment and compiles the React app.
3.  **Publish:** The optimized image is pushed to **Docker Hub**.
4.  **Deploy:** Tools like **Watchtower** can automatically pull the new image and update your running container.

**Project Structure Overview:**
*   `src/`: React Frontend (Vite, Tailwind, Components).
*   `server/`: Lightweight Express server for API & static serving.
*   `data/`: Persistent storage (JSON) mounted via Docker volumes.

---

Made with ❤️ by [dmatik]
