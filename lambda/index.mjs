// lambda/index.mjs
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const REGION = process.env.AWS_REGION || "us-west-1";
const TABLE = process.env.TABLE_NAME;
const BUCKET = process.env.BUCKET_NAME;
const QUEUE_URL = process.env.QUEUE_URL;

// Only use the stub when explicitly opted-in
const USE_STUB_HLS = String(process.env.USE_STUB_HLS || "0") === "1";
const SAMPLE_HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const s3 = new S3Client({ region: REGION });
const sqs = new SQSClient({ region: REGION });

const SAMPLE_QC = [
  { time: 12, type: "loudness", note: "Loudness spike detected" },
  { time: 47, type: "black_frame", note: "Possible black frame" },
  { time: 83, type: "caption", note: "Caption missing period" },
];

async function getJob(jobId) {
  const r = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { pk: `JOB#${jobId}`, sk: "META" },
    })
  );
  return r.Item || null;
}

async function putWhole(job) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { pk: `JOB#${job.id}`, sk: "META", ...job },
    })
  );
}

function markStage(job, name, changes) {
  const st = job.stages.find((s) => s.name === name);
  if (!st) throw new Error(`Stage not found: ${name}`);
  Object.assign(st, changes);
  job.updatedAt = Date.now();
}

function log(job, msg) {
  job.logs ||= [];
  job.logs.push(`[${new Date().toISOString()}] ${msg}`);
}

async function sendNext(type, jobId, attempt = 1) {
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify({ type, jobId, attempt }),
    })
  );
}

// ---------------- STAGES ----------------
async function handleTranscode(jobId) {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  markStage(job, "Transcode", { status: "processing", startedAt: Date.now() });
  log(job, "Transcode started.");
  await putWhole(job);

  // Stub “transcode”: write a marker object so the Open button works
  const outKey = `outputs/${job.id}/transcoded.txt`;
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: outKey,
      Body: `transcoded at ${new Date().toISOString()} from ${
        job.source?.key ?? "sample"
      }`,
      ContentType: "text/plain",
    })
  );

  job.artifacts = {
    ...(job.artifacts || {}),
    transcoded: { bucket: BUCKET, key: outKey },
  };
  markStage(job, "Transcode", { status: "complete", endedAt: Date.now() });
  log(job, `Transcode complete (stub): s3://${BUCKET}/${outKey}`);
  await putWhole(job);

  await sendNext("Thumbnail", job.id, 1);
}

async function handleThumbnail(jobId) {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  markStage(job, "Thumbnail", { status: "processing", startedAt: Date.now() });
  log(job, "Thumbnail started.");
  await putWhole(job);

  // Stub thumbnail artifact
  const key = `outputs/${job.id}/thumb.txt`;
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: `thumbnail placeholder for ${
        job.source?.key ?? "sample"
      } (${new Date().toISOString()})`,
      ContentType: "text/plain",
    })
  );
  job.artifacts = {
    ...(job.artifacts || {}),
    thumbnail: { bucket: BUCKET, key },
  };

  markStage(job, "Thumbnail", { status: "complete", endedAt: Date.now() });
  log(job, "Thumbnail complete (stub).");
  await putWhole(job);

  await sendNext("QC", job.id, 1);
}

async function handleQC(jobId) {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  markStage(job, "QC", { status: "processing", startedAt: Date.now() });
  log(job, "QC started.");
  await putWhole(job);

  job.qcMarkers = SAMPLE_QC;
  markStage(job, "QC", { status: "complete", endedAt: Date.now() });
  log(job, "QC complete (stub).");
  await putWhole(job);

  await sendNext("Package", job.id, 1);
}

async function handlePackage(jobId) {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  markStage(job, "Package", { status: "processing", startedAt: Date.now() });
  log(job, "Package started.");
  await putWhole(job);

  // ONLY attach the stub HLS if explicitly enabled, and never overwrite a real one
  if (USE_STUB_HLS && !job.artifacts?.hls) {
    job.artifacts = {
      ...(job.artifacts || {}),
      hls: SAMPLE_HLS,
      hlsStub: true,
    };
    log(job, "Attached stub HLS (demo).");
  }

  markStage(job, "Package", { status: "complete", endedAt: Date.now() });
  job.status = "ready_to_publish";
  log(job, "Package complete. Ready to publish.");
  await putWhole(job);
}

// --------------- HANDLER ----------------
export const handler = async (event) => {
  for (const rec of event.Records || []) {
    let msg;
    try {
      msg = JSON.parse(rec.body);
    } catch {
      continue;
    }
    const { type, jobId } = msg;

    try {
      if (type === "Transcode") await handleTranscode(jobId);
      else if (type === "Thumbnail") await handleThumbnail(jobId);
      else if (type === "QC") await handleQC(jobId);
      else if (type === "Package") await handlePackage(jobId);
      else console.warn("Unknown message type:", type);
    } catch (err) {
      console.error(`Stage ${type} failed for ${jobId}:`, err);
      throw err; // let SQS/Lambda retry & DLQ
    }
  }
  return { ok: true };
};
