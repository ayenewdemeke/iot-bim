"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function PracticePage() {
    const mountRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!mountRef.current) return;

        // 1) Scene
        const scene = new THREE.Scene();

        // 2) Camera
        const camera = new THREE.PerspectiveCamera(
            75,
            mountRef.current.clientWidth / mountRef.current.clientHeight,
            0.1,
            1000
        );
        camera.position.z = 3;
        camera.position.set(1.5, 1, 3);
        camera.lookAt(0, 0, 0);

        // 3) Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(
            mountRef.current.clientWidth,
            mountRef.current.clientHeight
        );

        // --- Add a cube ---
        const geometry = new THREE.BoxGeometry(1, 1, 1); // size: 1x1x1
        const material = new THREE.MeshStandardMaterial({ color: "orange" }); // reacts to light
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);

        // --- Add a light so we can actually see it ---
        const light = new THREE.DirectionalLight("white", 2);
        light.position.set(2, 2, 2);
        scene.add(light);

        // Optional: a tiny bit of ambient light to soften shadows
        const ambient = new THREE.AmbientLight("white", 0.3);
        scene.add(ambient);

        mountRef.current.appendChild(renderer.domElement);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; // smoother feel
        controls.dampingFactor = 0.08;
        controls.target.set(0, 0, 0); // what you orbit around
        controls.update();

        const handleResize = () => {
            if (!mountRef.current) return;

            const w = mountRef.current.clientWidth;
            const h = mountRef.current.clientHeight;

            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        };

        window.addEventListener("resize", handleResize);

        // 4) Draw once (no animation yet)
        let frameId = 0;

        const animate = () => {
            // spin a little each frame
            cube.rotation.x += 0.01;
            cube.rotation.y += 0.01;

            controls.update();
            renderer.render(scene, camera);
            frameId = requestAnimationFrame(animate);
        };

        animate();

        // Cleanup (important in Next/React)
        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener("resize", handleResize);
            controls.dispose();
            renderer.dispose();
            mountRef.current?.removeChild(renderer.domElement);
        };
    }, []);

    return (
        <div
            ref={mountRef}
            style={{
                width: "100%",
                height: "80vh",
                border: "1px solid #333",
                borderRadius: 12,
            }}
        />
    );
}
