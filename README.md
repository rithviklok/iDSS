// force redeploy
# Air Quality DSS

A React + TypeScript Decision Support System for air quality monitoring and management. Built with Vite, React Router, Leaflet maps, and Supabase.

## Prerequisites

- **Node.js** 18+ (recommended: 20+)
- **npm** 9+

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment (Optional)

For Supabase integration, copy the example env file and add your credentials:

```bash
cp .env.example .env
```

Edit `.env` and set:
- `VITE_SUPABASE_URL` – Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` – Your Supabase anonymous key

The app works with mock data if these are not configured.

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production

```bash
npm run build
```

### 5. Preview Production Build

```bash
npm run preview
```

## Available Scripts

| Script   | Command           | Description                    |
|----------|-------------------|--------------------------------|
| `dev`    | `npm run dev`     | Start Vite dev server          |
| `build`  | `npm run build`   | Type-check and build for prod  |
| `lint`   | `npm run lint`    | Run ESLint                     |
| `preview`| `npm run preview` | Preview production build      |

## Demo Login

Use these credentials to log in (mock auth):

| Role   | Username | Password |
|--------|----------|----------|
| Admin  | admin    | admin123 |
| Officer| officer  | officer123 |
| Viewer | viewer   | viewer123 |

## Project Structure

```
src/
├── components/     # Reusable UI components
├── contexts/      # React contexts (Auth, Location)
├── data/          # Mock data and geography
├── hooks/         # Custom hooks
├── pages/         # Route pages
├── services/      # API and Supabase
├── types/         # TypeScript types
├── utils/         # Utilities (e.g. IDW interpolation)
├── App.tsx
├── main.tsx
└── index.css
```

## Tech Stack

- **React 19** + **TypeScript**
- **Vite 7** – Build tool
- **React Router 7** – Routing
- **React Leaflet** – Maps
- **Lucide React** – Icons
- **Supabase** – Backend (optional)
