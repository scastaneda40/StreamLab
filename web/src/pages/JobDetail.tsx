import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useParams, Link, useNavigate } from "react-router-dom";
import PlayerWithMarkers from "../components/PlayerWithMarkers";

type Stage = {
  name: string;
  status: string;
  startedAt: number | null;
  endedAt: number | null;
};
type TranscodedArtifact = { bucket: string; key: string };
type SourceMeta = {
  bucket: string;
  key: string;
  contentType?: string;
  size?: number;
};

type Job = {
  id: string;
  title: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  stages: Stage[];
  logs: string[];
  artifacts: {
    hls?: string; // real (or stub if Lambda set it AND you wanted it)
    hlsStub?: boolean; // marker so UI can warn if needed
    transcoded?: TranscodedArtifact;
  };
  qcMarkers: { time: number; type: string; note: string }[];
  source?: SourceMeta;
};

export default function JobDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  // Redirect if ID is missing
  useEffect(() => {
    if (!id) {
      nav("/jobs");
    }
  }, [id, nav]);

  const q = useQuery({
    queryKey: ["job", id],
    queryFn: async () => (await api.get(`/jobs/${id}`)).data as Job,
    refetchInterval: 1500,
    enabled: !!id, // Only run query if id is available
  });

  const replay = useMutation({
    mutationFn: async () => (await api.post(`/jobs/${id}/replay`)).data,
  });
  const publish = useMutation({
    mutationFn: async () => (await api.post(`/jobs/${id}/publish`)).data,
    onSuccess: () => nav("/catalog"),
  });

  const job = q.data;
  if (!id || !job) return <p>Loading…</p>; // Show loading or redirect if id is missing

  const openSigned = async (key: string, bucket?: string) => {
    const params = new URLSearchParams({ key });
    if (bucket) params.set("bucket", bucket);
    const { data } = await api.get(`/view-url?${params.toString()}`);
    window.open(data.url, "_blank", "noopener,noreferrer");
  };

  const isStub = (url?: string) =>
    !!url && url.includes("test-streams.mux.dev");
  const hasRealHls = !!job.artifacts?.hls && !isStub(job.artifacts.hls);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{job.title}</h2>
          <div className="text-sm text-slate-600">Status: {job.status}</div>
        </div>
        <Link to="/jobs" className="underline">
          Back to Jobs
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white border rounded p-4">
            <h3 className="font-medium mb-2">Stages</h3>
            <ol className="space-y-2">
              {job.stages.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-28 text-sm">{s.name}</span>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      s.status === "complete"
                        ? "bg-green-100 text-green-800"
                        : s.status === "processing"
                        ? "bg-yellow-100 text-yellow-800"
                        : s.status === "failed"
                        ? "bg-red-100 text-red-800"
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {s.status}
                  </span>
                </li>
              ))}
            </ol>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => replay.mutate()}
                className="px-3 py-2 rounded bg-slate-900 text-white"
              >
                Replay from Failure
              </button>

              <button
                onClick={() => publish.mutate()}
                disabled={job.status !== "ready_to_publish"}
                className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50"
                aria-disabled={job.status !== "ready_to_publish"}
              >
                Publish
              </button>
            </div>

            {job.source && (
              <div className="mt-4 text-sm">
                <div className="font-medium">Source</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="px-2 py-1 bg-slate-100 rounded">
                    s3://{job.source.bucket}/{job.source.key}
                  </code>
                  {job.source.contentType && (
                    <span className="text-slate-600">
                      ({job.source.contentType}
                      {typeof job.source.size === "number"
                        ? ` · ${(job.source.size / (1024 * 1024)).toFixed(
                            1
                          )} MB`
                        : ""}
                      )
                    </span>
                  )}
                  <button
                    onClick={() =>
                      openSigned(job.source!.key, job.source!.bucket)
                    }
                    className="text-indigo-600 underline"
                  >
                    Open
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Prefer REAL HLS; otherwise play the uploaded source directly */}
          {hasRealHls ? (
            <div className="bg-white border rounded p-4">
              <h3 className="font-medium mb-3">Playback (HLS) + QC markers</h3>
              <PlayerWithMarkers
                src={job.artifacts.hls!}
                markers={job.qcMarkers}
              />
            </div>
          ) : job.source?.key &&
            job.source.contentType?.startsWith("video/") ? (
            <DirectSourcePlayer
              bucket={job.source.bucket}
              keyKey={job.source.key}
            />
          ) : job.artifacts?.hls ? (
            // If we only have the stub HLS, we can still show it but label it clearly
            <div className="bg-white border rounded p-4">
              <div className="text-xs text-slate-600 mb-2">
                Preview is using a demo HLS stream (not your upload).
              </div>
              <PlayerWithMarkers
                src={job.artifacts.hls}
                markers={job.qcMarkers}
              />
            </div>
          ) : null}

          {job.artifacts.transcoded && (
            <div className="bg-white border rounded p-4">
              <h3 className="font-medium mb-2">Transcoded Output</h3>
              <div className="text-sm flex items-center gap-2 flex-wrap">
                <code className="px-2 py-1 bg-slate-100 rounded">
                  s3://{job.artifacts.transcoded.bucket}/
                  {job.artifacts.transcoded.key}
                </code>
                <button
                  onClick={() =>
                    openSigned(
                      job.artifacts.transcoded!.key,
                      job.artifacts.transcoded!.bucket
                    )
                  }
                  className="text-indigo-600 underline"
                >
                  Open
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white border rounded p-4">
            <h3 className="font-medium mb-2">Logs</h3>
            <ul className="text-sm max-h-72 overflow-auto space-y-1">
              {job.logs.map((l, i) => (
                <li key={i} className="font-mono">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function DirectSourcePlayer({
  bucket,
  keyKey,
}: {
  bucket: string;
  keyKey: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const params = new URLSearchParams({ key: keyKey, bucket });
      const { data } = await api.get(`/view-url?${params.toString()}`);
      if (alive) setUrl(data.url);
    })();
    return () => {
      alive = false;
    };
  }, [bucket, keyKey]);

  if (!url)
    return <div className="bg-white border rounded p-4">Preparing video…</div>;

  return (
    <div className="bg-white border rounded p-4">
      <h3 className="font-medium mb-3">Source Playback (no HLS yet)</h3>
      <video controls style={{ width: "100%", maxHeight: 420 }} src={url} />
      <p className="text-xs text-slate-600 mt-2">
        Playing the uploaded source directly. When HLS is available, this will
        switch to the HLS player automatically.
      </p>
    </div>
  );
}
