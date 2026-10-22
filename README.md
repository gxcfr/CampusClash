# 🎮 CampusClash MUJ — Instant Campus Arcade (Milestone 1)

> Zero downloads. Zero logins. Zero cloud CV costs. Hyper-local real-time arcade platform for Manipal University Jaipur students.

[![Live on Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://fast-citrine-c4l6bp5.tmp.now)
[![Built with React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite_6-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![WebAssembly CV](https://img.shields.io/badge/MediaPipe-Tasks_Vision-FF6F00?style=for-the-badge&logo=google&logoColor=white)](https://developers.google.com/mediapipe)

---

## ⚡ Architecture & Features

### 1. Edge Computer Vision (Zero Cloud Bills)
- Hand gesture detection runs **100% client-side** in the browser via WebAssembly using `@mediapipe/tasks-vision`.
- Street Cricket finger mapping:
  - Extended fingers 1–5 = **1–5 runs**.
  - Fist (0 fingers) or Thumb-only = **6 runs (Maximum!)**.
- Statistical mode filtering over the final 2.0s delivery window.

### 2. Direct Peer-to-Peer AV Mesh
- 1v1 video and audio stream directly browser-to-browser via WebRTC using Google STUN (`stun:stun.l.google.com:19302`).
- Zero paid media servers (no Agora, Twilio, or LiveKit costs).
- **The 3-Phase Authoritative Game Loop**:
  - **Phase 1 (5s Secret Delivery)**: Local camera active, opponent's video blurred & audio muted.
  - **Phase 2 (0s Reveal)**: Choices resolved. Wicket or runs scored. Video/audio unmasked instantly for live facial reaction!
  - **Phase 3 (10s Banter)**: Unmuted banter window with "Next Ball" button.

### 3. Zero-Database Auth
- Zero logins or sign-ups.
- Guest handles are stored strictly in `localStorage`.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation
```bash
git clone <your-repo-url>
cd CampusClash
npm install
```

### Run Locally
```bash
npm run dev
```
Starts:
- **Client**: `http://localhost:5173`
- **Game & Signaling Server**: `http://localhost:3001`

### Build for Production
```bash
npm run build
```

---

## 📂 Project Structure
```
├── server/
│   └── gameServer.ts            # Authoritative Hand Cricket state machine & WebRTC signaling
├── src/
│   ├── components/
│   │   ├── HandCricketArena.tsx # Split-screen WebRTC arena & scoreboard
│   │   ├── MainLobby.tsx        # Interactive campus game matrix & guest profile
│   │   └── UsernameModal.tsx    # Zero-DB guest identity modal
│   ├── hooks/
│   │   ├── useHandDetection.ts  # MediaPipe WASM edge vision hook
│   │   └── useWebRTC.ts         # Native WebRTC peer-to-peer AV mesh
│   ├── services/
│   │   └── peerManager.ts       # Serverless P2P mesh adapter for cloud deployments
│   ├── types/
│   │   └── game.ts              # Game types & room state interfaces
│   ├── utils/
│   │   └── audio.ts             # Web Audio API arcade sound synthesizer
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── vercel.json                  # Vercel SPA rewrites
└── package.json
```

---

## 📜 License
MIT © 2026 CampusClash MUJ
