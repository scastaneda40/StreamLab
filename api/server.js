// api/server.js
import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const REGION = process.env.AWS_REGION || "us-west-1";
const TABLE = process.env.TABLE_NAME || "StreamLab";
const BUCKET = process.env.BUCKET_NAME || "streamlab-dev-yourbucket";
const QUEUE_URL = process.env.QUEUE_URL || ""; // must be set

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const s3 = new S3Client({ region: REGION });
const sqs = new SQSClient({ region: REGION });

const app = express();
app.use(cors());
app.use(express.json());

// Presigned upload
app.post("/api/upload-url", async (req, res) => {
  try {
    const { key, contentType } = req.body || {};
    if (!key) return res.status(400).json({ error: "key required" });

    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType || "application/octet-stream",
    });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 300 });
    res.json({ url });
  } catch (err) {
    console.error("upload-url:", err);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// Presigned view
app.get("/api/view-url", async (req, res) => {
  try {
    const { key, bucket } = req.query;
    if (!key) return res.status(400).json({ error: "key required" });
    const Bucket = (bucket && String(bucket)) || BUCKET;
    const cmd = new GetObjectCommand({ Bucket, Key: String(key) });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 300 });
    res.json({ url });
  } catch (err) {
    console.error("view-url:", err);
    res.status(500).json({ error: "Failed to generate view URL" });
  }
});

// DDB helpers
async function putJob(job) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { pk: `JOB#${job.id}`, sk: "META", ...job },
    })
  );
}
async function getJob(id) {
  const r = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { pk: `JOB#${id}`, sk: "META" } })
  );
  return r.Item || null;
}
async function indexJob(id) {
  await ddb.send(
    new PutCommand({ TableName: TABLE, Item: { pk: "JOBS", sk: `JOB#${id}` } })
  );
}
async function listJobs() {
  const r = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "JOBS" },
      ScanIndexForward: false,
    })
  );
  const ids = (r.Items ?? []).map((i) => i.sk.replace("JOB#", ""));
  const out = [];
  for (const id of ids) {
    const j = await getJob(id);
    if (j) out.push(j);
  }
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}
async function addToCatalog(job) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: "CATALOG",
        sk: `JOB#${job.id}`,
        title: job.title,
        hls: job.artifacts?.hls ?? "",
        qcMarkers: job.qcMarkers ?? [],
      },
    })
  );
}
async function listCatalog() {
  const r = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "CATALOG" },
      ScanIndexForward: false,
    })
  );
  return r.Items ?? [];
}

// SQS
async function enqueue(type, jobId, attempt = 1) {
  if (!QUEUE_URL) throw new Error("QUEUE_URL is not set");
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify({ type, jobId, attempt }),
    })
  );
}

// Routes
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/jobs", async (req, res) => {
  const { title = "Upload", s3Key = null, sourceMeta = {} } = req.body || {};

  const id = nanoid();
  const now = Date.now();
  const STAGES = ["Transcode", "Thumbnail", "QC", "Package"].map((n) => ({
    name: n,
    status: "queued",
    startedAt: null,
    endedAt: null,
  }));

  const job = {
    id,
    title,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    stages: STAGES,
    logs: [`[${new Date().toISOString()}] Job created.`],
    artifacts: {},
    qcMarkers: [],
    source: s3Key ? { bucket: BUCKET, key: s3Key, ...sourceMeta } : null,
  };

  await putJob(job);
  await indexJob(id);

  await enqueue("Transcode", id, 1);
  res.status(201).json(job);
});

app.get("/api/jobs", async (_req, res) => res.json(await listJobs()));

app.get("/api/jobs/:id", async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Not found" });
  res.json(job);
});

app.post("/api/jobs/:id/replay", async (req, res) => {
  const id = req.params.id;
  const job = await getJob(id);
  if (!job) return res.status(404).json({ error: "Not found" });

  let startIndex = job.stages.findIndex((s) => s.status === "failed");
  if (startIndex === -1)
    startIndex = job.stages.findIndex((s) => s.status !== "complete");
  if (startIndex === -1) return res.json(job);

  for (let i = startIndex; i < job.stages.length; i++) {
    job.stages[i].status = "queued";
    job.stages[i].startedAt = null;
    job.stages[i].endedAt = null;
  }
  job.status = "queued";
  job.updatedAt = Date.now();
  job.logs.push(
    `[${new Date().toISOString()}] Replay queued from stage index ${startIndex}.`
  );
  await putJob(job);

  await enqueue(job.stages[startIndex].name, id, 1);
  res.json(job);
});

app.post("/api/jobs/:id/publish", async (req, res) => {
  const id = req.params.id;
  const job = await getJob(id);
  if (!job) return res.status(404).json({ error: "Not found" });
  if (job.status !== "ready_to_publish")
    return res.status(400).json({ error: "Job not ready." });

  job.status = "published";
  job.updatedAt = Date.now();
  job.logs.push(`[${new Date().toISOString()}] Published to catalog.`);
  await putJob(job);
  await addToCatalog(job);

  res.json({ ok: true });
});

app.get("/api/catalog", async (_req, res) => res.json(await listCatalog()));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`StreamLab API listening on http://localhost:${PORT}`);
  console.log("Region:", REGION);
  console.log("DDB Table:", TABLE);
  console.log("S3 Bucket:", BUCKET);
  console.log("SQS Queue:", QUEUE_URL || "(not set)");
});
