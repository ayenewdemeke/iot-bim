'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, useAnimations } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface WorkerModelProps {
  isPlaying: boolean;
  position: [number, number, number];
  speed: number;
}

function WorkerModel({ isPlaying, position, speed }: WorkerModelProps) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/worker.glb');
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    // Control animations based on isPlaying state
    if (names.length > 0) {
      names.forEach((name) => {
        const action = actions[name];
        if (action) {
          action.timeScale = speed;
          if (isPlaying) {
            action.paused = false;
            action.play();
          } else {
            action.paused = true;
          }
        }
      });
    }
  }, [actions, names, isPlaying, speed]);

  return (
    <primitive ref={group} object={scene} scale={1} position={position} />
  );
}

export default function WorkerPage() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [position, setPosition] = useState<[number, number, number]>([0, 0, 0]);
  const [speed, setSpeed] = useState(1);
  const [autoMove, setAutoMove] = useState(false);

  // Auto-move effect
  useEffect(() => {
    if (autoMove) {
      const interval = setInterval(() => {
        setPosition((prev) => {
          const newX = prev[0] + 0.05;
          // Reset position when it goes too far
          if (newX > 5) return [-5, prev[1], prev[2]];
          return [newX, prev[1], prev[2]];
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [autoMove]);

  const handleReset = () => {
    setPosition([0, 0, 0]);
    setSpeed(1);
    setIsPlaying(true);
    setAutoMove(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-6xl p-8">
        <h1 className="text-3xl font-semibold text-black dark:text-white mb-4">
          Worker 3D Model Animation
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          Interactive 3D model viewer with conditional animation and movement controls.
        </p>
        
        {/* Control Panel */}
        <div className="mb-4 p-6 bg-white dark:bg-zinc-900 rounded-lg shadow-lg space-y-4">
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                isPlaying
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            
            <button
              onClick={() => setAutoMove(!autoMove)}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                autoMove
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {autoMove ? '⏹ Stop Moving' : '▶ Auto Move'}
            </button>
            
            <button
              onClick={handleReset}
              className="px-6 py-2 rounded-lg font-medium bg-zinc-500 hover:bg-zinc-600 text-white transition-colors"
            >
              ↻ Reset
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Animation Speed: {speed.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Position X: {position[0].toFixed(2)}
              </label>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.1"
                value={position[0]}
                onChange={(e) => setPosition([parseFloat(e.target.value), position[1], position[2]])}
                className="w-full"
                disabled={autoMove}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Position Y: {position[1].toFixed(2)}
              </label>
              <input
                type="range"
                min="-2"
                max="5"
                step="0.1"
                value={position[1]}
                onChange={(e) => setPosition([position[0], parseFloat(e.target.value), position[2]])}
                className="w-full"
                disabled={autoMove}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Position Z: {position[2].toFixed(2)}
              </label>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.1"
                value={position[2]}
                onChange={(e) => setPosition([position[0], position[1], parseFloat(e.target.value)])}
                className="w-full"
                disabled={autoMove}
              />
            </div>
          </div>
        </div>

        <div className="w-full h-[600px] bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800 rounded-lg overflow-hidden shadow-xl">
          <Canvas
            camera={{ position: [0, 1.5, 5], fov: 50 }}
            shadows
          >
            <ambientLight intensity={0.5} />
            <directionalLight
              position={[10, 10, 5]}
              intensity={1}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />
            <spotLight
              position={[-10, 10, -5]}
              angle={0.3}
              penumbra={1}
              intensity={0.5}
              castShadow
            />
            <WorkerModel isPlaying={isPlaying} position={position} speed={speed} />
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={2}
              maxDistance={20}
            />
            <gridHelper args={[20, 20]} />
          </Canvas>
        </div>
        <div className="mt-6 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <p>• <strong>Left Mouse:</strong> Rotate the view</p>
          <p>• <strong>Right Mouse:</strong> Pan the view</p>
          <p>• <strong>Scroll Wheel:</strong> Zoom in/out</p>
        </div>
      </div>
    </div>
  );
}
