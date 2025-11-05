# StreamLab (Option A — Local MVP)

A simulated media-processing dashboard inspired by Disney Media Engineering’s Processing Tools.
Runs **entirely locally**: React + TypeScript (Vite) for the UI and Node + Express for a mock pipeline API.

## Demo Flow
1) **Upload** a sample (“fake” upload).
2) Watch the job progress through stages: **Transcode → Thumbnail → QC → Package**.
3) Open **Job Detail** to see logs and **QC markers**.
4) **Publish** the job to the **Catalog**, then play the pre-baked HLS in the browser with a marker overlay.

## Tech Highlights
- **React + TypeScript + Vite + Tailwind** UI
- **Express** mock API simulating a pipeline (random failures, retries, logs)
- **hls.js** playback + **QC markers** overlay
- **Accessible-first**: focus states, keyboardable buttons/links, ARIA labels

## Getting Started

### 1) API (Mock Pipeline)
```bash
cd api
npm install
npm run dev
```
This starts the API at **http://localhost:4000**.

### 2) Web (React App)
Open a second terminal:
```bash
cd web
npm install
npm run dev
```
This starts the web app at **http://localhost:5173** (Vite default).

## Pages
- **/upload** – Create a job (simulated file upload).
- **/jobs** – View all jobs and their stage statuses.
- **/jobs/:id** – Inspect logs, stages, and replay from the last failed stage.
- **/catalog** – See published items and play HLS with QC markers.

## Notes
- This is a **simulation**. There’s no real transcoding; we ship a **pre-baked HLS** URL and fabricated QC markers.
- You can upgrade to **Option B** later by swapping the API with AWS (S3/SQS/Lambda/DynamoDB).

## Demo Script (60–90s)
1) Create a job on **Upload**.
2) Open **Jobs** – watch stages update live.
3) Click a job → **Job Detail** – show logs, a failure + retry, and QC markers.
4) **Publish** → **Catalog** – play the stream and click a QC marker to seek.
