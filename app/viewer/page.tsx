"use client";

import { useSearchParams } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import ReferencePointModal from "./ReferencePointModal";

declare global {
  interface Window {
    Autodesk: any;
    THREE: any;
  }
}

export default function ViewerPage() {
  const params = useSearchParams();
  const modelId = params.get("modelId");

  const divRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const actorRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);

  const [ready, setReady] = useState(false);
  const [showRefPointModal, setShowRefPointModal] = useState(false);
  const [hasRefPoint, setHasRefPoint] = useState(false);
  const [checkingRefPoint, setCheckingRefPoint] = useState(true);

  // Check if reference point exists for this model
  useEffect(() => {
    if (!modelId) return;

    const checkRefPoint = async () => {
      try {
        const res = await fetch(`/api/aps/models/${modelId}/reference-point`);
        const data = await res.json();
        
        if (data.hasReferencePoint) {
          setHasRefPoint(true);
        } else {
          setHasRefPoint(false);
          setShowRefPointModal(true);
        }
      } catch (err) {
        console.error("Failed to check reference point:", err);
      } finally {
        setCheckingRefPoint(false);
      }
    };

    checkRefPoint();
  }, [modelId]);

  const handleRefPointSave = async () => {
    setHasRefPoint(true);
    setShowRefPointModal(false);
  };

  useEffect(() => {
    if (!ready || !divRef.current || !modelId) return;

    let cancelled = false;

    (async () => {
      const urnRes = await fetch(`/api/aps/models/${modelId}/urn`);
      const { urn } = await urnRes.json();

      const getAccessToken = async (cb: any) => {
        const t = await fetch("/api/aps/token").then((r) => r.json());
        cb(t.access_token, t.expires_in);
      };

      window.Autodesk.Viewing.Initializer({ env: "AutodeskProduction", getAccessToken }, () => {
        if (cancelled) return;

        const viewer = new window.Autodesk.Viewing.GuiViewer3D(divRef.current);
        viewer.start();
        viewerRef.current = viewer;

        window.Autodesk.Viewing.Document.load(
          `urn:${urn}`,
          (doc: any) => {
            viewer.loadDocumentNode(doc, doc.getRoot().getDefaultGeometry()).then(() => {
              if (cancelled) return;

              const model = viewer.model;
              
              // Get global offset for coordinate conversion
              const data = model.getData();
              const globalOffset = data?.globalOffset || { x: 0, y: 0, z: 0 };
              console.log('[Viewer] APS Model Global Offset:', globalOffset);

              const APS_THREE = window.THREE;
              if (!APS_THREE) {
                console.error("window.THREE not available (Viewer not fully initialized).");
                return;
              }

              const overlayName = "actors";

              // Reset overlay scene cleanly
              try { viewer.impl.removeOverlayScene(overlayName); } catch {}
              viewer.impl.createOverlayScene(overlayName);

              // ---- Load the actual worker.glb model ----
              const loader = new GLTFLoader();
              
              loader.load(
                '/models/model.glb',
                (gltf: any) => {
                  if (cancelled) return;

                  // Convert loaded model to use APS_THREE (viewer's THREE instance)
                  const convertedModel = new APS_THREE.Group();
                  
                  gltf.scene.traverse((child: any) => {
                    if (child.isMesh) {
                      // Clone geometry and material using APS_THREE
                      const geometry = new APS_THREE.BufferGeometry();
                      
                      // Copy attributes
                      if (child.geometry.attributes.position) {
                        geometry.setAttribute('position', 
                          new APS_THREE.BufferAttribute(child.geometry.attributes.position.array, 3));
                      }
                      if (child.geometry.attributes.normal) {
                        geometry.setAttribute('normal',
                          new APS_THREE.BufferAttribute(child.geometry.attributes.normal.array, 3));
                      }
                      if (child.geometry.attributes.uv) {
                        geometry.setAttribute('uv',
                          new APS_THREE.BufferAttribute(child.geometry.attributes.uv.array, 2));
                      }
                      if (child.geometry.index) {
                        geometry.setIndex(
                          new APS_THREE.BufferAttribute(child.geometry.index.array, 1));
                      }
                      
                      // Create material with proper color and texture handling
                      const materialProps: any = {
                        side: APS_THREE.DoubleSide,
                      };
                      
                      // Copy color if available
                      if (child.material.color) {
                        materialProps.color = new APS_THREE.Color(
                          child.material.color.r,
                          child.material.color.g,
                          child.material.color.b
                        );
                      }
                      
                      // Copy texture if available
                      if (child.material.map) {
                        const texture = new APS_THREE.Texture(child.material.map.image);
                        texture.needsUpdate = true;
                        texture.wrapS = child.material.map.wrapS;
                        texture.wrapT = child.material.map.wrapT;
                        materialProps.map = texture;
                      }
                      
                      // Copy other material properties
                      if (child.material.transparent !== undefined) {
                        materialProps.transparent = child.material.transparent;
                      }
                      if (child.material.opacity !== undefined) {
                        materialProps.opacity = child.material.opacity;
                      }
                      if (child.material.metalness !== undefined) {
                        materialProps.metalness = child.material.metalness;
                      }
                      if (child.material.roughness !== undefined) {
                        materialProps.roughness = child.material.roughness;
                      }
                      
                      const material = new APS_THREE.MeshPhongMaterial(materialProps);
                      
                      // Create mesh with APS_THREE
                      const mesh = new APS_THREE.Mesh(geometry, material);
                      mesh.position.copy(child.position);
                      mesh.rotation.copy(child.rotation);
                      mesh.scale.copy(child.scale);
                      mesh.castShadow = true;
                      mesh.receiveShadow = true;
                      
                      convertedModel.add(mesh);
                    }
                  });
                  
                  // Adjust scale
                  // Make scale unit-agnostic: assume worker.glb is in meters
                  // Autodesk model units: getUnitScale() returns scale to meters (e.g., 0.001 for mm, 1 for m)
                  let modelUnitScale = 1;
                  let modelUnitString = 'm';
                  if (typeof model.getUnitScale === 'function') {
                    modelUnitScale = model.getUnitScale();
                  }
                  if (typeof model.getUnitString === 'function') {
                    modelUnitString = model.getUnitString();
                  }
                  // If model units are not meters, scale worker accordingly
                  // Example: if model is in mm, modelUnitScale = 0.001, so scale worker by 1/0.001 = 1000
                  const scaleFactor = 1 / modelUnitScale;
                  convertedModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
                  console.log('[Viewer] Worker scale factor for model units:', { modelUnitString, modelUnitScale, scaleFactor });
                  
                  // Save model unit string to database only if not already set
                  fetch(`/api/aps/models/${modelId}/unit-scale`)
                    .then(res => res.json())
                    .then(data => {
                      if (!data.modelUnit) {
                        return fetch(`/api/aps/models/${modelId}/unit-scale`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ modelUnit: modelUnitString })
                        });
                      }
                    })
                    .catch(err => console.error('Failed to save model unit:', err));
                  
                  // Rotate to stand upright (90 degrees around X-axis)
                  convertedModel.rotation.x = Math.PI / 2;
                  
                  // Place at origin - will be updated by socket stream
                  convertedModel.position.set(0, 0, 0);
                  
                  actorRef.current = convertedModel;
                  viewer.impl.addOverlay(overlayName, convertedModel);
                  viewer.impl.invalidate(true, true, true);

                  // ---- Socket stream drives the person position ----
                  const socket = io({ transports: ["websocket"] });
                  socketRef.current = socket;

                  socket.on("pose", (msg: any) => {
                    const m = actorRef.current;
                    if (!m) return;

                    // Subtract global offset to convert Revit coords to viewer coords
                    const overlayX = msg.x - globalOffset.x;
                    const overlayY = msg.y - globalOffset.y;
                    const overlayZ = msg.z - globalOffset.z;
                    
                    m.position.set(overlayX, overlayY, overlayZ);
                    
                    console.log('[Overlay] Position - Raw:', { x: msg.x, y: msg.y, z: msg.z }, 
                                'Offset:', globalOffset, 
                                'Final:', { x: overlayX, y: overlayY, z: overlayZ });
                    
                    // Apply rotation around Y-axis (keeping X-axis rotation for upright pose)
                    if (msg.rotation !== undefined) {
                      m.rotation.y = msg.rotation * (Math.PI / 180); // convert degrees to radians
                    }
                    
                    viewer.impl.invalidate(true, true, true);
                  });
                },
                undefined,
                (error: any) => {
                  console.error("Error loading worker3.glb:", error);
                  // Fallback: you could create simple geometry here if needed
                }
              );
            });
          },
          (err: any) => console.error("Document load failed:", err)
        );
      });
    })();

    return () => {
      cancelled = true;

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      const viewer = viewerRef.current;
      if (viewer) {
        try { viewer.impl.removeOverlayScene("actors"); } catch {}
        viewer.finish();
        viewerRef.current = null;
      }

      actorRef.current = null;
    };
  }, [ready, modelId]);

  return (
    <div style={{ height: "100vh" }}>
      <link
        rel="stylesheet"
        href="https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css"
      />
      <Script
        src="https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <div ref={divRef} style={{ width: "100%", height: "100%" }} />
      
      {/* Overlay when reference point is not set */}
      {!hasRefPoint && !checkingRefPoint && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "20px 30px",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            <h3 style={{ margin: 0, marginBottom: "8px" }}>
              Reference Point Required
            </h3>
            <p style={{ margin: 0, color: "#666" }}>
              Please set a reference point to enable GPS tracking.
            </p>
          </div>
        </div>
      )}
      
      {/* Reference Point Modal */}
      {modelId && (
        <ReferencePointModal
          modelId={modelId}
          isOpen={showRefPointModal}
          onClose={() => setShowRefPointModal(false)}
          onSave={handleRefPointSave}
        />
      )}
    </div>
  );
}
