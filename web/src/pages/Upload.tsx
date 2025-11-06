import { useState, type ChangeEvent } from "react";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";

export default function Upload() {
  const [title, setTitle] = useState("Inside Out — Sample");
  const [chaos, setChaos] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const nav = useNavigate();

  const MAX_SIZE = 500 * 1024 * 1024;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (f) {
      if (!f.type.startsWith("video/")) {
        setMessage("❌ Please choose a video file.");
        e.currentTarget.value = "";
        setFile(null);
        return;
      }
      if (f.size > MAX_SIZE) {
        setMessage("❌ File too large for demo (max 500 MB).");
        e.currentTarget.value = "";
        setFile(null);
        return;
      }
      if (title === "Inside Out — Sample" || title.trim() === "") {
        const base = f.name.replace(/\.[^.]+$/, "");
        setTitle(base);
      }
    }
    setFile(f);
  };

  const create = async () => {
    try {
      setBusy(true);
      setMessage("");

      let s3Key: string | null = null;
      let contentType: string | undefined;
      let size: number | undefined;

      if (file) {
        const key = `raw/${crypto.randomUUID()}-${file.name}`;

        // ask API for presigned URL
        const { data: up } = await api.post("/upload-url", {
          key,
          contentType: file.type || "application/octet-stream",
        });
        if (!up?.url) {
          throw new Error(
            "API did not return a presigned URL. Check VITE_API_URL and server logs."
          );
        }

        // upload file directly to S3
        const putRes = await fetch(up.url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
        if (!putRes.ok) {
          throw new Error(`S3 upload failed with ${putRes.status}`);
        }

        s3Key = key;
        contentType = file.type;
        size = file.size;
        setMessage("✅ File uploaded to S3 successfully.");
      } else {
        setMessage("ℹ️ No file selected, job will use sample data.");
      }

      // create job
      const { data: job } = await api.post("/jobs", {
        title,
        chaosEnabled: chaos,
        s3Key,
        sourceMeta: { contentType, size },
      });
      if (!job?.id) {
        throw new Error("API did not return a job id.");
      }

      nav(`/jobs/${job.id}`);
    } catch (err) {
      console.error(err);
      setMessage("❌ Upload failed. See console for details.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-semibold mb-4">Upload Source File</h2>

      <label className="block mb-2 font-medium" htmlFor="title">
        Title
      </label>
      <input
        id="title"
        className="w-full border rounded px-3 py-2 mb-4"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="My Awesome Trailer"
      />

      <label className="block mb-2 font-medium" htmlFor="file">
        Select file
      </label>
      <input
        id="file"
        type="file"
        accept="video/*"
        className="mb-4"
        onChange={handleFileChange}
      />

      <div className="flex items-center gap-2 mb-6">
        <input
          id="chaos"
          type="checkbox"
          checked={chaos}
          onChange={(e) => setChaos(e.target.checked)}
        />
        <label htmlFor="chaos">Enable Chaos Mode (random stage failures)</label>
      </div>

      <button
        onClick={create}
        disabled={busy}
        className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50"
        aria-busy={busy}
      >
        {busy ? "Uploading…" : "Create Job"}
      </button>

      {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
    </div>
  );
}
