// Coordinate system utilities for Autodesk Viewer
// Use these to understand and debug model coordinate transformations

export function inspectModelCoordinates(viewer: any, model: any) {
  console.log('=== MODEL COORDINATE SYSTEM INFO ===');
  
  // Global offset applied by viewer
  const data = model.getData();
  console.log('Full model data:', data);
  
  if (data?.globalOffset) {
    console.log('Global Offset:', data.globalOffset);
  } else {
    console.log('Global Offset: NONE');
  }
  
  // Placement transform
  if (data?.placementTransform) {
    console.log('Placement Transform:', data.placementTransform);
  } else {
    console.log('Placement Transform: NONE');
  }
  
  // Model bounds in viewer coordinates
  const bounds = model.getBoundingBox();
  console.log('Model Bounding Box:', {
    min: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
    max: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
    center: bounds.center()
  });
  
  // Reference point transform (Revit specific)
  if (data?.refPointTransform) {
    console.log('Reference Point Transform:', data.refPointTransform);
  } else {
    console.log('Reference Point Transform: NONE');
  }
  
  // Model units
  const unitScale = model.getUnitScale();
  const unitString = model.getUnitString();
  console.log('Model Units:', { unitScale, unitString });
  
  // Metadata - try different methods
  model.getMetadata('', (metadata: any) => {
    console.log('Model Root Metadata:', metadata);
  }, () => {
    console.log('Metadata: Not available');
  });
  
  console.log('=== END COORDINATE INFO ===');
}

export function createCoordinateAxes(THREE: any, viewer: any, overlayName: string, origin = {x: 0, y: 0, z: 0}, size = 10) {
  // Create XYZ axes at specified origin
  const axes = new THREE.Group();
  
  // X axis - Red
  const xGeom = new THREE.BufferGeometry();
  xGeom.setAttribute('position', new THREE.Float32BufferAttribute([
    origin.x, origin.y, origin.z,
    origin.x + size, origin.y, origin.z
  ], 3));
  const xLine = new THREE.Line(xGeom, new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 }));
  axes.add(xLine);
  
  // Y axis - Green
  const yGeom = new THREE.BufferGeometry();
  yGeom.setAttribute('position', new THREE.Float32BufferAttribute([
    origin.x, origin.y, origin.z,
    origin.x, origin.y + size, origin.z
  ], 3));
  const yLine = new THREE.Line(yGeom, new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 }));
  axes.add(yLine);
  
  // Z axis - Blue
  const zGeom = new THREE.BufferGeometry();
  zGeom.setAttribute('position', new THREE.Float32BufferAttribute([
    origin.x, origin.y, origin.z,
    origin.x, origin.y, origin.z + size
  ], 3));
  const zLine = new THREE.Line(zGeom, new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 3 }));
  axes.add(zLine);
  
  viewer.impl.addOverlay(overlayName, axes);
  viewer.impl.invalidate(true, true, true);
  
  console.log(`Created coordinate axes at (${origin.x}, ${origin.y}, ${origin.z})`);
}

export function createMarker(THREE: any, viewer: any, overlayName: string, position: {x: number, y: number, z: number}, color = 0xffff00, size = 1) {
  // Create a visible sphere marker at specific coordinates
  const geometry = new THREE.SphereGeometry(size, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.set(position.x, position.y, position.z);
  
  viewer.impl.addOverlay(overlayName, sphere);
  viewer.impl.invalidate(true, true, true);
  
  console.log(`Created marker at (${position.x}, ${position.y}, ${position.z})`);
  return sphere;
}
