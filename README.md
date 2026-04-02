# NetPulse Real

A real speed-test starter project using:
- Frontend: HTML / CSS / JavaScript
- Backend: Node.js / Express

## Important truth

If you run this on **localhost**, the result is **not your real internet speed**.
It measures the connection between your browser and your own machine.

For realistic internet results, deploy it to a **remote VPS/server** and open it through that public domain/IP.

## Project structure

- `client/` → frontend files
- `server/` → backend files and API

## Run locally

1. Extract the zip.
2. Open a terminal in `server/`
3. Run:

```bash
npm install
npm start
```

4. Open:

```bash
http://localhost:3000
```

## Deploy for real testing

Deploy the `server` app to a remote machine or platform that supports Node.js.
Because the server also serves the `client` folder, the same app can host both frontend and backend.

Examples:
- VPS (Ubuntu + Node.js)
- Render
- Railway
- Fly.io

## API endpoints

- `GET /api/ping`
- `GET /api/download?sizeMB=25`
- `POST /api/upload`
- `GET /api/health`

## Notes

- Ping and jitter are measured by repeated small requests.
- Download and upload use timed transfers.
- Recent history is stored in browser localStorage.
