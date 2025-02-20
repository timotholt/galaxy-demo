import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Create scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
document.body.appendChild(renderer.domElement);

// Galaxy parameters
const params = {
    particles: 50000,
    size: 0.05,
    radius: 5,
    branches: 5,
    spin: 1,
    randomness: 0.2,
    randomnessPower: 3,
    insideColor: '#ff6030',
    outsideColor: '#1b3984',
    bloomStrength: 0.8,
    bloomRadius: 0.75,
    bloomThreshold: 0.2,
    pulseSpeed: 2.0,
    maxBloomStrength: 1.2,
    minBloomStrength: 0.4
};

// Create circular texture for particles
const particleTexture = new THREE.CanvasTexture((() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 32;
    canvas.height = 32;
    
    // Create a radial gradient for a soft circle
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    
    return canvas;
})());

// Post processing setup
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    params.bloomStrength,
    params.bloomRadius,
    params.bloomThreshold
);

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// Create galaxy geometry
let geometry = null;
let material = null;
let points = null;

function generateGalaxy() {
    if (points !== null) {
        geometry.dispose();
        material.dispose();
        scene.remove(points);
    }

    geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(params.particles * 3);
    const colors = new Float32Array(params.particles * 3);

    const insideColor = new THREE.Color(params.insideColor);
    const outsideColor = new THREE.Color(params.outsideColor);

    for (let i = 0; i < params.particles; i++) {
        const i3 = i * 3;

        // Position
        const radius = Math.random() * params.radius;
        const spinAngle = radius * params.spin;
        const branchAngle = ((i % params.branches) / params.branches) * Math.PI * 2;

        const randomX = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1);
        const randomY = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1);
        const randomZ = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1);

        positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
        positions[i3 + 1] = randomY;
        positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

        // Color
        const mixedColor = insideColor.clone();
        mixedColor.lerp(outsideColor, radius / params.radius);

        colors[i3] = mixedColor.r;
        colors[i3 + 1] = mixedColor.g;
        colors[i3 + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    material = new THREE.PointsMaterial({
        size: params.size,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        transparent: true,
        alphaMap: particleTexture,
        opacity: 0.6
    });

    points = new THREE.Points(geometry, material);
    scene.add(points);
    
    console.log('Galaxy generated:', {
        geometryAttributes: Object.keys(geometry.attributes),
        materialProperties: {
            size: material.size,
            transparent: material.transparent,
            blending: material.blending
        },
        sceneChildren: scene.children.length
    });
}

// Set up camera
camera.position.x = 0;
camera.position.y = -0.20;
camera.position.z = 3.35;

// Position display elements
const posX = document.getElementById('pos-x');
const posY = document.getElementById('pos-y');
const posZ = document.getElementById('pos-z');

function updatePositionDisplay() {
    posX.textContent = camera.position.x.toFixed(2);
    posY.textContent = camera.position.y.toFixed(2);
    posZ.textContent = camera.position.z.toFixed(2);
}

// Generate galaxy
generateGalaxy();

// Controls
const moveSpeed = 0.1;
const keys = {
    w: false, s: false, a: false, d: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    q: false, e: false
};

window.addEventListener('keydown', (event) => {
    if (keys.hasOwnProperty(event.key.toLowerCase())) {
        keys[event.key.toLowerCase()] = true;
    }
});

window.addEventListener('keyup', (event) => {
    if (keys.hasOwnProperty(event.key.toLowerCase())) {
        keys[event.key.toLowerCase()] = false;
    }
});

// Mouse controls
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;
const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;

document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX - windowHalfX);
    mouseY = (event.clientY - windowHalfY);
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('wheel', (event) => {
    camera.position.z += event.deltaY * 0.01;
    camera.position.z = Math.max(2, Math.min(10, camera.position.z));
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const time = Date.now() * 0.001;
    
    // Pulsing effect with clamped brightness
    const pulse = Math.sin(time * params.pulseSpeed) * 0.5 + 0.5; // Normalized to 0-1
    material.size = params.size * (pulse * 0.3 + 0.7); // Less size variation
    
    // Clamp bloom strength between min and max values
    const bloomStrength = THREE.MathUtils.lerp(
        params.minBloomStrength,
        params.maxBloomStrength,
        pulse
    );
    bloomPass.strength = bloomStrength;
    
    // Movement
    const moveVector = new THREE.Vector3();
    if (keys.w || keys.arrowup) moveVector.z -= moveSpeed;
    if (keys.s || keys.arrowdown) moveVector.z += moveSpeed;
    if (keys.a || keys.arrowleft) moveVector.x -= moveSpeed;
    if (keys.d || keys.arrowright) moveVector.x += moveSpeed;
    if (keys.q) moveVector.y += moveSpeed;
    if (keys.e) moveVector.y -= moveSpeed;

    moveVector.applyQuaternion(camera.quaternion);
    camera.position.add(moveVector);

    // Rotation
    targetX = mouseX * 0.001;
    targetY = mouseY * 0.001;

    if (points) {
        points.rotation.y += 0.001;
        points.rotation.x += (targetY - points.rotation.x) * 0.05;
        points.rotation.z += (targetX - points.rotation.z) * 0.05;
    }
    
    // Update position display
    updatePositionDisplay();
    
    // Render with post-processing
    composer.render();
}

animate();
