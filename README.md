
# Backyard Beats

BackyardBeats is a full-stack music discovery platform (React + Express + MySQL) focused on showcasing local artists. It includes a React frontend, an Express/Sequelize backend, media uploads, user authentication, artist onboarding, event management, playlists and ratings.

## Quick summary

- Frontend: React (Create React App) — main entry: `src/App.js`
- Backend: Express + Sequelize + MySQL — main entry: `src/server/index.js`
- Dev workflow: run the frontend (`npm start`) and backend (`npm run dev`) concurrently
- Database: MySQL (defaults shown below), Sequelize used for ORM + `mysql2` pool for raw queries

## Table of contents

1. Prerequisites
2. Installation
3. Environment variables
4. Running the app (development)
5. Production / build
6. Project structure (short)
7. Important backend routes and API surface
8. Database and migrations
9. Troubleshooting
10. Contributing

---

## 1) Prerequisites

- Node.js (recommended LTS) and npm
- MySQL server
- (Optional) `nodemon` is used as a dev dependency; the `npm run dev` script uses it

Windows PowerShell note: the commands below are written for PowerShell where needed.

---

## 2) Installation

From the project root:

```powershell
npm install
```

This installs both frontend and backend dependencies (the repo is a single package.json at the root).

### Database

Create a MySQL database for development. The project contains a sample SQL file at `src/backyardbeatsDB.sql` you can import to get started.

Example using the mysql CLI (PowerShell):

```powershell
# Adjust user/password/host as needed
mysql -u root -p < src\backyardbeatsDB.sql
```

Or open the `.sql` file in your MySQL client and run it.

---

## 3) Environment variables

The server reads a few common env vars (defaults are provided in code):

- `DB_NAME` (default: `backyardbeatsDB`)
- `DB_USER` (default: `root`)
- `DB_PASS` (default shown in code, change for production)
- `DB_HOST` (default: `localhost`)
- `PORT` (server port; default in `src/server/index.js` is `3001`)
- `FRONTEND_ORIGIN` (default: `http://localhost:3000` — used by CORS)
- `JWT_SECRET` (default: `devsecret` in `auth.middleware.js`; set a strong secret for prod)

Check `src/server/db.js` and `src/server/index.js` for defaults and additional options.

To set env vars in PowerShell for a run:

```powershell
$env:DB_USER = 'root'; $env:DB_PASS = 'yourpass'; $env:PORT = '5000'; npm run dev
```

---

## 4) Running the app (development)

Open two terminals.

Terminal 1 — start the backend (nodemon):

```powershell
npm run dev
```

Terminal 2 — start the frontend (Create React App):

```powershell
npm start
```

Notes about the dev proxy: the `package.json` in this repo has a `proxy` set to `http://localhost:5000`. The server default port is `3001` (see `src/server/index.js`). To avoid proxy mismatches either:

- Start the server on port 5000: ` $env:PORT=5000; npm run dev` (PowerShell) — OR —
- Update `package.json`'s `proxy` field to `http://localhost:3001` so CRA will forward API requests to the server's actual port.

If you see CORS or network errors, check the proxy and `FRONTEND_ORIGIN` env var.

---

## 5) Production / build

Create a production build of the frontend:

```powershell
npm run build
```

You can serve the `build` folder with any static host, or integrate with the Express server if you choose (not included by default).

---

## 6) Project structure (short)

- `/public` — static public files
- `/public_assets` — images and tracks used by `mockData`
- `/src` — frontend source
	- `src/App.js` — React routes and main layout
	- `src/components` — presentational and shared components
	- `src/pages` — route pages (Home, ArtistDetail, ArtistOnboarding, etc.)
- `/src/server` — backend
	- `src/server/index.js` — Express bootstrap, route mounting, static uploads
	- `src/server/db.js` — Sequelize + mysql2 pool and env defaults
	- `src/server/routes` — route modules (artists, tracks, events, auth, ratings, etc.)
	- `src/server/controllers` — controllers for business logic
	- `src/server/middleware` — authentication, upload handling, role checks
	- `src/server/uploads` — folder where uploaded files are stored (served at `/uploads`)

There are also helper files and a mock server (`mockServer.js`) used for local asset serving during development.

---

## 7) Important backend routes (mounted in `src/server/index.js`)

- `/artistOnboard` - artist onboarding endpoints (check `src/server/routes/artistOnboard.routes.js`)
- `/artists` - public and admin artist endpoints
- `/tracks` - upload and serve tracks
- `/events` - events CRUD
- `/users` - user management
- `/` - ratings routes (note: ratings route file mounts paths like `/artist/:id`)
- `/districts` - districts data
- `/auth` - login/register and JWT issuance
- `/favorites` - favorite artists management
- `/profile` - user profile endpoints
- `/fan` and `/fan/playlists` - fan-specific routes and playlist management
- `/public` - public, non-auth endpoints
- `/uploads/*` - static file serving for uploaded media

Also included: `/health` — basic health check endpoint.

Authentication: many routes use JWT auth middleware (`src/server/middleware/auth.middleware.js`) — include `Authorization: Bearer <token>` on protected requests.

---

## 8) Database and migrations

- The project uses MySQL with Sequelize. The connection defaults are defined in `src/server/db.js`.
- A starter SQL dump exists at `src/backyardbeatsDB.sql` (import to create tables/data as provided).

If you add migrations or seeders, keep them in `src/server/migrations` or follow your chosen convention.

---

## 9) Troubleshooting & common gotchas

- Invalid artist id errors (example seen during onboarding):
	- Confirm where the server expects the artist id: check the controller that returns `"Invalid artist id"` (it may read `req.params.id`, `req.params.artistId`, or `req.body.artistId`).
	- If uploading `FormData`, do NOT manually set the `Content-Type` header — let the browser/axios set the multipart boundary.
	- Ensure a valid JWT is sent for protected routes: `Authorization: Bearer <token>`.
	- Check request URL vs route: some endpoints expect the id in the URL (e.g., `/artists/:id/whatever`) rather than in the body.

- Proxy mismatch: `package.json` proxy is `http://localhost:5000` but the server default port is `3001`. Either start the server with `PORT=5000` or change the proxy to `http://localhost:3001`.

- Database connection failures: check `DB_HOST`, `DB_USER`, `DB_PASS`, and `DB_NAME` env vars. `src/server/db.js` prints a helpful message when it connects or fails.

- File uploads and static serving: uploaded files are served from `/uploads` (see `src/server/index.js`). Verify files are saved to `src/server/uploads` and that the server has read permissions.

Helpful debugging steps:

1. Open browser DevTools Network tab and inspect the failing request (URL, headers, body, response). Confirm the exact payload and where the id is sent.
2. Check server logs — the server includes a simple request logger that prints `--> METHOD PATH` for incoming requests.
3. Add console.log on the server controller that validates the id to see what it received.

---

## 10) Contributing

- Follow the existing code style. Frontend uses CRA structure and Bootstrap. Backend is organized by routes/controllers/middleware.
- Open an issue or PR for any bugfixes or features.

---

## Quick commands

Install:

```powershell
npm install
```

Start server (dev - nodemon):

```powershell
npm run dev
```

Start frontend (dev):

```powershell
npm start
```

Run tests (frontend CRA tests):

```powershell
npm test
```

Build production frontend bundle:

```powershell
npm run build
```

---

