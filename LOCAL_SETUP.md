# DSS Air Quality Frontend — Local Setup Guide

This guide sets up the frontend with a **local mock API server** (no real backend needed).

---

## Prerequisites

Make sure **Node.js 18+** is installed:
```
node --version   # should print v18.x or higher
npm --version
```
Download from: https://nodejs.org/en/download

---

## Quick Start (2 terminals)

### Terminal 1 — Mock API Server
```powershell
cd "C:\Users\AnilKumar\Downloads\dss-frontend-om-fe\dss-frontend-om-fe"
node mock-server.cjs
```
You should see:
```
╔════════════════════════════════════════╗
║   DSS Mock API Server                  ║
║   http://localhost:3001                ║
║   Login: any username + any password   ║
╚════════════════════════════════════════╝
```

### Terminal 2 — Frontend Dev Server
```powershell
cd "C:\Users\AnilKumar\Downloads\dss-frontend-om-fe\dss-frontend-om-fe"
npm install        # first time only
npm run dev
```
Open: **http://localhost:5173/dss/**

---

## Login

Use **any credentials** — the mock server accepts everything:
- Username: `admin`  (or anything)
- Password: `admin`  (or anything)

---

## What the Mock Server Provides

| Endpoint group     | Data served                                              |
|--------------------|----------------------------------------------------------|
| `/auth/*`          | Auto-login, session cookie, team members                 |
| `/geography/*`     | Lucknow (110 wards) + Gurugram (35 wards)                |
| `/sensors`         | 40+ Lucknow sensors, 15+ Gurugram sensors with PM2.5/PM10 |
| `/sensors/heatmap` | Heatmap points derived from sensor data                  |
| `/sensors/readings`| 24h time-series (auto-generated with realistic variation)|
| `/map/hotspots`    | 5 Lucknow + 4 Gurugram hotspots                          |
| `/map/pollution-grid` | IDW-interpolated PM2.5 grid                           |
| `/map/forecast`    | 72h forecast with AQI categories                         |
| `/map/source-contributions` | Source apportionment pie data                 |
| `/issues`          | 8 issues across Lucknow and Gurugram                     |
| `/dss/triggers`    | 5 DSS triggers with interventions                        |
| `/dss/rules`       | 4 DSS rules (construction, burning, emergency, road dust)|
| `/dss/stats`       | Live counts derived from mock issues/triggers            |
| `/dss/capacity`    | Department resource capacity                             |
| `/dss/simulations` | 30-day simulation results                                |
| `/configurator/*`  | Sensor health monitor and management                     |

---

## Troubleshooting

### "Login fails / redirect loop"
Make sure the mock server is running on port 3001 before opening the app.

### "Map shows no sensors"
Select **Lucknow** or **Gurugram** from the district selector in the app.

### "Port 3001 already in use"
Change the port in `mock-server.cjs` (top of file: `const PORT = 3001`) and in `.env` (`VITE_DSS_API_BASE=http://localhost:XXXX`).

### CORS errors in browser console
The mock server already sets correct CORS headers. If you see errors, ensure:
1. The mock server is running
2. The frontend origin matches (`http://localhost:5173`)

---

## File Overview

| File | Purpose |
|------|---------|
| `mock-server.cjs` | Mock API server — all dummy data lives here |
| `.env` | Points `VITE_DSS_API_BASE` to `http://localhost:3001` |
| `src/data/mockIssueData.ts` | Existing app-side mock data (notifications, airsheds) |
| `src/data/mockDssData.ts` | Existing DSS rules/triggers mock data |
| `src/data/mockSensorData.ts` | Existing sensor static data |
