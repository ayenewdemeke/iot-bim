"use client";

import { useEffect, useState } from "react";
import ReferencePointModal from "../viewer/ReferencePointModal";

type ModelRow = {
  id: number;
  fileName: string;
  status: "processing" | "success" | "failed";
  progress: string | null;
  createdAt: string;
  updatedAt: string;
  urn: string;
  error: string | null;
};

const API = "/api/aps";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ModelRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [showRefPointModal, setShowRefPointModal] = useState(false);
  const [existingRefPoint, setExistingRefPoint] = useState<any>(null);

  const load = async () => {
    const res = await fetch(`${API}/models`);
    setRows(await res.json());
  };

  const refreshOne = async (id: number) => {
    await fetch(`${API}/models/${id}/refresh`, { method: "POST" });
    await load();
  };

  const openRefPointModal = async (id: number) => {
    setSelectedModelId(id);
    
    // Fetch existing reference point if any
    try {
      const res = await fetch(`/api/aps/models/${id}/reference-point`);
      const data = await res.json();
      setExistingRefPoint(data.hasReferencePoint ? data.referencePoint : null);
    } catch (err) {
      console.error("Failed to fetch reference point:", err);
      setExistingRefPoint(null);
    }
    
    setShowRefPointModal(true);
  };

  const handleRefPointSave = () => {
    setShowRefPointModal(false);
    setSelectedModelId(null);
    setExistingRefPoint(null);
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API}/upload`, { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } finally {
      setBusy(false);
    }
  };

  // initial load
  useEffect(() => {
    load();
  }, []);

  // auto-refresh processing items every 5s
  useEffect(() => {
    const t = setInterval(async () => {
      const processing = rows.filter(r => r.status === "processing");
      if (!processing.length) return;
      await Promise.all(processing.map(r => fetch(`${API}/models/${r.id}/refresh`, { method: "POST" })));
      await load();
    }, 5000);
    return () => clearInterval(t);
  }, [rows]);

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <h2>Upload model</h2>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button disabled={!file || busy} onClick={upload}>
          {busy ? "Uploading..." : "Upload"}
        </button>
        <button onClick={load}>Reload list</button>
      </div>

      <div style={{ marginTop: 20 }}>
        {rows.map(r => (
          <div key={r.id} style={{ border: "1px solid #ddd", padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div><b>{r.fileName}</b> (id: {r.id})</div>
                <div>Status: {r.status} | Progress: {r.progress ?? "-"}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Updated: {new Date(r.updatedAt).toLocaleString()}
                </div>
                {r.status === "failed" && r.error && (
                  <div style={{ marginTop: 8, color: "crimson", whiteSpace: "pre-wrap" }}>
                    {r.error}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={() => refreshOne(r.id)}>Refresh status</button>
                {r.status === "success" && (
                  <>
                    <a href={`/viewer?modelId=${r.id}`} style={{ textDecoration: "underline" }}>
                      Open in Viewer
                    </a>
                    <button onClick={() => openRefPointModal(r.id)}>
                      Set/Change Ref Point
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reference Point Modal */}
      {selectedModelId && (
        <ReferencePointModal
          modelId={selectedModelId.toString()}
          isOpen={showRefPointModal}
          onClose={() => {
            setShowRefPointModal(false);
            setSelectedModelId(null);
            setExistingRefPoint(null);
          }}
          onSave={handleRefPointSave}
          existingRefPoint={existingRefPoint}
        />
      )}
    </div>
  );
}
