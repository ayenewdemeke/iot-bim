"use client";

import { useSearchParams } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState, Suspense } from "react";
import { io, Socket } from "socket.io-client";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import ReferencePointModal from "./ReferencePointModal";

declare global {
  interface Window {
    Autodesk: any;
    THREE: any;
  }
}

function ViewerContent() {
  const params = useSearchParams();
  const modelId = params.get("modelId");

  const divRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const actorsRef = useRef<Map<string, any>>(new Map()); // Map of actorId -> 3D model object
  const socketRef = useRef<Socket | null>(null);
  const globalOffsetRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });

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
        // Failed to check reference point
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
              globalOffsetRef.current = globalOffset;
              
              console.log('[Global Offset]', globalOffset);

              const APS_THREE = window.THREE;
              if (!APS_THREE) {
                return;
              }

              const overlayName = "actors";

              // Reset overlay scene cleanly
              try { viewer.impl.removeOverlayScene(overlayName); } catch {}
              viewer.impl.createOverlayScene(overlayName);

              // Function to load a model for a specific actor
              const loadActorModel = (actorId: string, modelPath: string, callback?: () => void) => {
                // Check if actor already loaded or being loaded
                if (actorsRef.current.has(actorId)) {
                  if (callback) callback();
                  return;
                }

                // Mark as loading immediately to prevent duplicates
                actorsRef.current.set(actorId, null);
                console.log(`[Actor] Loading model for ${actorId}: ${modelPath}`);

                const loader = new GLTFLoader();
                
                loader.load(
                  modelPath,
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
                    
                    // Adjust scale based on model units
                    let modelUnitScale = 1;
                    if (typeof model.getUnitScale === 'function') {
                      modelUnitScale = model.getUnitScale();
                    }
                    
                    // Simple scale: convert from model units to overlay units
                    const scaleFactor = 1 / modelUnitScale;
                    
                    // Apply additional scale reduction for equipment models (they seem to be 1000x too large)
                    const additionalScale = modelPath.includes('equipment') ? 0.001 : 1;
                    convertedModel.scale.set(scaleFactor * additionalScale, scaleFactor * additionalScale, scaleFactor * additionalScale);

                    // Keep actor upright (rotate 90 degrees around X-axis)
                    convertedModel.rotation.x = Math.PI / 2;
                    
                    // Set initial position at origin
                    convertedModel.position.set(0, 0, 0);

                    // Add to scene immediately
                    viewer.impl.addOverlay(overlayName, convertedModel);
                    actorsRef.current.set(actorId, convertedModel);
                    
                    console.log(`[Actor] Loaded ${actorId} with model ${modelPath}`);
                    
                    viewer.impl.invalidate(true, true, true);
                    if (callback) callback();
                  },
                  undefined,
                  (error: any) => {
                    console.error(`[Actor] Failed to load model for ${actorId} (${modelPath}):`, error);
                    // Remove from actors map on error so it can be retried
                    actorsRef.current.delete(actorId);
                  }
                );
              };

              // ---- Socket stream drives actor positions ----
              const socket = io({ transports: ["websocket"] });
              socketRef.current = socket;

              socket.on("pose", (msg: any) => {
                const actorId = msg.actorId || 'worker_1';
                const modelPath = msg.modelPath || '/models/model.glb';
                
                // Log sensor coordinates with full precision
                if (msg.sourceType === 'gps' && msg.gps) {
                  console.log(`[${actorId}] lat: ${msg.gps.lat}, lon: ${msg.gps.lon}, alt: ${msg.gps.elev} m`);
                } else if (msg.sourceType === 'model') {
                  console.log(`[${actorId}] x: ${msg.x}, y: ${msg.y}, z: ${msg.z}`);
                }
                
                // Load model for this actor if not already loaded
                loadActorModel(actorId, modelPath, () => {
                  // Update position after model is loaded
                  const actorModel = actorsRef.current.get(actorId);
                  if (!actorModel) return;

                  // Subtract global offset to convert Revit coords to viewer coords
                  const overlayX = msg.x - globalOffsetRef.current.x;
                  const overlayY = msg.y - globalOffsetRef.current.y;
                  const overlayZ = msg.z - globalOffsetRef.current.z;
                  
                  actorModel.position.set(overlayX, overlayY, overlayZ);
                  
                  // Apply rotation around Y-axis (keeping X-axis rotation for upright pose)
                  if (msg.rotation !== undefined) {
                    actorModel.rotation.y = msg.rotation * (Math.PI / 180); // convert degrees to radians
                  }
                  
                  viewer.impl.invalidate(true, true, true);
                });
              });
            });
          },
          (err: any) => {/* Document load failed */}
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

      actorsRef.current.clear();
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

export default function ViewerPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>Loading viewer...</div>}>
      <ViewerContent />
    </Suspense>
  );
}
