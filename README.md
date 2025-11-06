# StreamLab: Media Processing Dashboard

## Project Overview

StreamLab is a simulated media-processing dashboard. This application provides a user-friendly interface to manage and monitor a simulated media pipeline, demonstrating key concepts in distributed systems, asynchronous processing, and modern web development.

The project is structured as a full-stack application, with a React-based frontend and a Node.js Express backend. It simulates a media workflow including transcoding, thumbnail generation, quality control (QC), and packaging, showcasing job lifecycle management and real-time status updates.

## Motivation & Key Features

The primary motivation behind StreamLab is to demonstrate a practical application of modern web technologies and cloud services in a media engineering context. Key features include:

- **Simulated Media Pipeline:** Mimics a real-world media processing workflow with configurable stages and simulated failures.
- **Real-time Job Monitoring:** Users can track the status and logs of processing jobs in real-time.
- **Interactive QC Markers:** Visual representation of quality control markers on video playback for precise issue identification.
- **Catalog Management:** Published media assets are made available in a browsable catalog with HLS playback.
- **Scalable Architecture:** Designed with cloud-native principles, leveraging AWS services for robust and scalable operations.

## Technical Stack

### Frontend (`web/`)

- **Framework:** React.js (SPA)
- **Language:** TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS, PostCSS, Autoprefixer
- **State Management/API Client:** `@tanstack/react-query` for data fetching and caching, `axios` for HTTP requests.
- **Video Playback:** `hls.js` for HLS streaming.
- **Routing:** `react-router-dom`
- **Accessibility:** Built with an accessible-first approach, including focus states, keyboard navigation, and ARIA labels.

### Backend (`api/`)

- **Runtime:** Node.js (ESM)
- **Framework:** Express.js
- **Language:** JavaScript
- **API Client:** AWS SDK v3 for JavaScript
- **Database:** Amazon DynamoDB (for job metadata and catalog)
- **Object Storage:** Amazon S3 (for raw uploads and processed artifacts)
- **Messaging Queue:** Amazon SQS (for triggering pipeline stages)
- **Unique ID Generation:** `nanoid`
- **CORS Handling:** `cors` middleware

## Architecture

The application follows a client-server architecture, with the frontend consuming APIs exposed by the backend. The backend, in turn, orchestrates interactions with various AWS cloud services.

```mermaid
graph TD
    User[User] -->|Accesses Web App| Render_Frontend[Render Static Site Frontend]
    Render_Frontend -->|API Requests (HTTPS)| Render_Backend[Render Web Service Backend]
    Render_Backend -->|Interacts with AWS| AWS_Services[AWS Services]
    AWS_Services -- DynamoDB --> DynamoDB_Table[DynamoDB Table StreamLab]
    AWS_Services -- S3 --> S3_Bucket[S3 Bucket streamlab-dev-stephencastaneda]
    AWS_Services -- SQS --> SQS_Queue[SQS Queue streamlab-pipeline]
    SQS_Queue -->|Triggers (e.g., for processing)| Lambda_Processor[AWS Lambda Job Processor - *Future/Option B*]
```

**Key Architectural Decisions:**

- **Separation of Concerns:** Clear distinction between frontend UI and backend API logic.
- **Serverless-first Backend (Conceptual):** While currently an Express app on Render, the design is compatible with a future transition to AWS Lambda + API Gateway (Option B), leveraging DynamoDB, S3, and SQS.
- **Asynchronous Processing:** SQS is used to decouple job creation from actual media processing, allowing for scalable and resilient workflows.
- **Static Frontend Hosting:** Leveraging CDNs (Render's static site hosting) for fast, global content delivery.

## Deployment

This application is deployed on [Render.com](https://render.com/) for both frontend and backend services, utilizing AWS for core infrastructure services (DynamoDB, S3, SQS).

**Live Deployment URL:** [https://streamlab.onrender.com/](https://streamlab.onrender.com/)

### Render Configuration

**1. Frontend Service (`web/`):**

- **Type:** Static Site
- **Root Directory:** `web/`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`
- **Environment Variable:** `VITE_API_URL` = `https://streamlab-api.onrender.com/api` (Replace with your actual backend service URL)

**2. Backend Service (`api/`):**

- **Type:** Web Service (Node.js)
- **Root Directory:** `api/`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment Variables (Critical for AWS Access):**
  - `AWS_REGION`: `us-west-1` (or your deployed region)
  - `TABLE_NAME`: `StreamLab` (your DynamoDB table name)
  - `BUCKET_NAME`: `streamlab-dev-stephencastaneda` (your S3 bucket name)
  - `QUEUE_URL`: `https://sqs.us-west-1.amazonaws.com/477817641496/streamlab-pipeline` (your SQS queue URL)
  - `AWS_ACCESS_KEY_ID`: Your AWS IAM user's Access Key ID
  - `AWS_SECRET_ACCESS_KEY`: Your AWS IAM user's Secret Access Key

### AWS Configuration

Ensure the IAM user associated with `AWS_ACCESS_KEY_ID` has the following permissions:

- **DynamoDB:** `dynamodb:PutItem`, `dynamodb:GetItem`, `dynamodb:Query` on `arn:aws:dynamodb:us-west-1:477817641496:table/StreamLab` and its indexes.
- **S3:** `s3:PutObject`, `s3:GetObject` on `arn:aws:s3:::streamlab-dev-stephencastaneda/*`.
- **SQS:** `sqs:SendMessage` on `arn:aws:sqs:us-west-1:477817641496:streamlab-pipeline`.

Additionally, your S3 bucket (`streamlab-dev-stephencastaneda`) must have a CORS policy configured to allow `PUT`, `POST`, `DELETE` requests from your frontend's origin (`https://streamlab.onrender.com`).

## Getting Started (Local Development)

To run this project locally:

### 1) API (Backend)

```bash
cd api
npm install
npm run dev
```

This starts the API at **http://localhost:4000**.

### 2) Web (Frontend)

Open a second terminal:

```bash
cd web
npm install
npm run dev
```

This starts the web app at **http://localhost:5173** (Vite default). Ensure your `web/vite.config.ts` has the proxy configured for local API calls.

## Demo Flow

1.  **Upload** a video file (simulated upload to S3).
2.  Navigate to **Jobs** to watch the job progress through stages: **Transcode → Thumbnail → QC → Package**.
3.  Open **Job Detail** for a specific job to see detailed logs, observe potential failures and retries, and view **QC markers** on the video player.
4.  Once a job is `ready_to_publish`, click **Publish** to add it to the **Catalog**.
5.  Go to the **Catalog** page to see published items and play the HLS stream with an interactive marker overlay.

## Notes for Reviewers

- This project demonstrates a foundational understanding of full-stack development, cloud service integration (AWS), and modern web application architecture.
- The media processing pipeline is simulated for demonstration purposes; actual transcoding is not performed. A pre-baked HLS URL and fabricated QC markers are used for playback.
- The deployment strategy on Render showcases practical application deployment with continuous integration, while leveraging AWS for managed services.
- Attention has been paid to accessibility (A11y) in the frontend UI.
- **Known Issue:** Clicking "Publish" currently results in duplicate entries in the catalog (e.g., "Inside Out" and your video appearing twice). This is under investigation.
