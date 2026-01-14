"use client";

import { useState, useEffect } from "react";

interface ReferencePointModalProps {
  modelId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  existingRefPoint?: {
    model: { x: number; y: number; z: number };
    gps: { lat: number; lon: number; elev: number };
  } | null;
}

export default function ReferencePointModal({
  modelId,
  isOpen,
  onClose,
  onSave,
  existingRefPoint,
}: ReferencePointModalProps) {
  const [formData, setFormData] = useState({
    refModelX: "",
    refModelY: "",
    refModelZ: "",
    refGpsLat: "",
    refGpsLon: "",
    refGpsElev: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (existingRefPoint) {
      setFormData({
        refModelX: existingRefPoint.model.x.toString(),
        refModelY: existingRefPoint.model.y.toString(),
        refModelZ: existingRefPoint.model.z.toString(),
        refGpsLat: existingRefPoint.gps.lat.toString(),
        refGpsLon: existingRefPoint.gps.lon.toString(),
        refGpsElev: existingRefPoint.gps.elev.toString(),
      });
    }
  }, [existingRefPoint]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const payload = {
        refModelX: parseFloat(formData.refModelX),
        refModelY: parseFloat(formData.refModelY),
        refModelZ: parseFloat(formData.refModelZ),
        refGpsLat: parseFloat(formData.refGpsLat),
        refGpsLon: parseFloat(formData.refGpsLon),
        refGpsElev: parseFloat(formData.refGpsElev),
      };

      // Validate all fields are numbers
      if (Object.values(payload).some(isNaN)) {
        setError("All fields must be valid numbers");
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/aps/models/${modelId}/reference-point`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save reference point");
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save reference point");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "30px",
          borderRadius: "8px",
          width: "90%",
          maxWidth: "600px",
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "20px" }}>
          Set Reference Point
        </h2>
        
        <p style={{ marginBottom: "20px", color: "#666" }}>
          Define a reference point to map between APS model coordinates and real-world GPS coordinates.
          This is required for GPS-based sensor tracking.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ marginBottom: "12px", fontSize: "16px" }}>
              Model Coordinates (in model units)
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                  X
                </label>
                <input
                  type="text"
                  value={formData.refModelX}
                  onChange={(e) =>
                    setFormData({ ...formData, refModelX: e.target.value })
                  }
                  placeholder="e.g., -4419.8"
                  required
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                  Y
                </label>
                <input
                  type="text"
                  value={formData.refModelY}
                  onChange={(e) =>
                    setFormData({ ...formData, refModelY: e.target.value })
                  }
                  placeholder="e.g., 9053.7"
                  required
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                  Z
                </label>
                <input
                  type="text"
                  value={formData.refModelZ}
                  onChange={(e) =>
                    setFormData({ ...formData, refModelZ: e.target.value })
                  }
                  placeholder="e.g., 0"
                  required
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ marginBottom: "12px", fontSize: "16px" }}>
              GPS Coordinates
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                  Latitude
                </label>
                <input
                  type="text"
                  value={formData.refGpsLat}
                  onChange={(e) =>
                    setFormData({ ...formData, refGpsLat: e.target.value })
                  }
                  placeholder="e.g., 46.90220894"
                  required
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                  Longitude
                </label>
                <input
                  type="text"
                  value={formData.refGpsLon}
                  onChange={(e) =>
                    setFormData({ ...formData, refGpsLon: e.target.value })
                  }
                  placeholder="e.g., -96.7957167"
                  required
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                  Elevation (m)
                </label>
                <input
                  type="text"
                  value={formData.refGpsElev}
                  onChange={(e) =>
                    setFormData({ ...formData, refGpsElev: e.target.value })
                  }
                  placeholder="e.g., 932.66"
                  required
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: "12px",
                backgroundColor: "#fee",
                color: "#c33",
                borderRadius: "4px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: "10px 20px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                backgroundColor: "white",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 20px",
                border: "none",
                borderRadius: "4px",
                backgroundColor: saving ? "#999" : "#007bff",
                color: "white",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving..." : "Save Reference Point"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
