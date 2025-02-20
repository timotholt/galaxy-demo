import * as THREE from 'three';

// Create scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Galaxy parameters
const params = {
    particles: 50000,
    size: 0.02,
    radius: 5,
    branches: 5,
    spin: 1,
    randomness: 0.2,
    randomnessPower: 3,
    insideColor: '#ff6030',
    outsideColor: '#1b3984',
    animationDuration: 3 // seconds for full expansion
};

// Create galaxy geometry
let geometry = null;
let material = null;
let points = null;
let startTime = Date.now();

// Create circular texture for particles
const textureLoader = new THREE.TextureLoader();
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

function generateGalaxy() {
    if (points !== null) {
        geometry.dispose();
        material.dispose();
        scene.remove(points);
    }

    geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(params.particles * 3);
    const colors = new Float32Array(params.particles * 3);
    const scales = new Float32Array(params.particles);
    const randomness = new Float32Array(params.particles * 3);
    const finalPositions = new Float32Array(params.particles * 3);

    const insideColor = new THREE.Color(params.insideColor);
    const outsideColor = new THREE.Color(params.outsideColor);

    for (let i = 0; i < params.particles; i++) {
        const i3 = i * 3;

        // Position
        const radius = Math.random() * params.radius;
        const spinAngle = radius * params.spin;
        const branchAngle = ((i % params.branches) / params.branches) * Math.PI * 2;

        // Store final positions
        const randX = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1);
        const randY = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1);
        const randZ = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1);

        finalPositions[i3] = Math.cos(branchAngle + spinAngle) * radius + randX;
        finalPositions[i3 + 1] = randY;
        finalPositions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randZ;

        // Start all particles at center
        positions[i3] = 0;
        positions[i3 + 1] = 0;
        positions[i3 + 2] = 0;

        // Store randomness
        randomness[i3] = randX;
        randomness[i3 + 1] = randY;
        randomness[i3 + 2] = randZ;

        // Color
        const mixedColor = insideColor.clone();
        mixedColor.lerp(outsideColor, radius / params.radius);

        colors[i3] = mixedColor.r;
        colors[i3 + 1] = mixedColor.g;
        colors[i3 + 2] = mixedColor.b;

        // Random scale for variety
        scales[i] = Math.random() * 2 + 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    
    // Store final positions and randomness in userData for animation
    geometry.userData.finalPositions = finalPositions;
    geometry.userData.randomness = randomness;

    material = new THREE.PointsMaterial({
        size: params.size,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        transparent: true,
        alphaMap: particleTexture
    });

    points = new THREE.Points(geometry, material);
    scene.add(points);
    startTime = Date.now(); // Reset animation time
}

// Generate galaxy
generateGalaxy();

// Set up camera
camera.position.x = 0;
camera.position.y = -0.20;
camera.position.z = 3.35;

// Controls
const moveSpeed = 0.1;
const keys = {
    w: false, s: false, a: false, d: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    q: false, e: false  // Add Q/E for up/down movement
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
});

document.addEventListener('wheel', (event) => {
    camera.position.z += event.deltaY * 0.01;
    camera.position.z = Math.max(2, Math.min(10, camera.position.z));
});

// Position display elements
const posX = document.getElementById('pos-x');
const posY = document.getElementById('pos-y');
const posZ = document.getElementById('pos-z');

function updatePositionDisplay() {
    posX.textContent = camera.position.x.toFixed(2);
    posY.textContent = camera.position.y.toFixed(2);
    posZ.textContent = camera.position.z.toFixed(2);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Calculate animation progress
    const elapsedTime = (Date.now() - startTime) / 1000;
    const progress = Math.min(elapsedTime / params.animationDuration, 1);
    const easeProgress = 1 - Math.cos(progress * Math.PI * 0.5); // Smooth easing

    // Update particle positions
    if (progress < 1) {
        const positions = points.geometry.attributes.position.array;
        const finalPositions = points.geometry.userData.finalPositions;
        
        for (let i = 0; i < params.particles; i++) {
            const i3 = i * 3;
            positions[i3] = finalPositions[i3] * easeProgress;
            positions[i3 + 1] = finalPositions[i3 + 1] * easeProgress;
            positions[i3 + 2] = finalPositions[i3 + 2] * easeProgress;
        }
        
        points.geometry.attributes.position.needsUpdate = true;
    }

    // Movement
    const moveVector = new THREE.Vector3();
    if (keys.w || keys.arrowup) moveVector.z -= moveSpeed;
    if (keys.s || keys.arrowdown) moveVector.z += moveSpeed;
    if (keys.a || keys.arrowleft) moveVector.x -= moveSpeed;
    if (keys.d || keys.arrowright) moveVector.x += moveSpeed;
    if (keys.q) moveVector.y += moveSpeed;  // Move up
    if (keys.e) moveVector.y -= moveSpeed;  // Move down

    moveVector.applyQuaternion(camera.quaternion);
    camera.position.add(moveVector);

    // Rotation
    targetX = mouseX * 0.001;
    targetY = mouseY * 0.001;

    points.rotation.y += 0.002;
    points.rotation.x += (targetY - points.rotation.x) * 0.05;
    points.rotation.z += (targetX - points.rotation.z) * 0.05;

    // Update position display
    updatePositionDisplay();

    renderer.render(scene, camera);
}

animate();
