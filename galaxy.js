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
    outsideColor: '#1b3984'
};

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
        vertexColors: true
    });

    points = new THREE.Points(geometry, material);
    scene.add(points);
}

// Generate galaxy
generateGalaxy();

// Set up camera
camera.position.z = 6;
camera.position.y = 2;

// Controls
const moveSpeed = 0.1;
const keys = {
    w: false, s: false, a: false, d: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
};

window.addEventListener('keydown', (event) => {
    if (keys.hasOwnProperty(event.key)) {
        keys[event.key] = true;
    }
});

window.addEventListener('keyup', (event) => {
    if (keys.hasOwnProperty(event.key)) {
        keys[event.key] = false;
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

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Movement
    const moveVector = new THREE.Vector3();
    if (keys.w || keys.ArrowUp) moveVector.z -= moveSpeed;
    if (keys.s || keys.ArrowDown) moveVector.z += moveSpeed;
    if (keys.a || keys.ArrowLeft) moveVector.x -= moveSpeed;
    if (keys.d || keys.ArrowRight) moveVector.x += moveSpeed;

    moveVector.applyQuaternion(camera.quaternion);
    camera.position.add(moveVector);

    // Rotation
    targetX = mouseX * 0.001;
    targetY = mouseY * 0.001;

    points.rotation.y += 0.002;
    points.rotation.x += (targetY - points.rotation.x) * 0.05;
    points.rotation.z += (targetX - points.rotation.z) * 0.05;

    renderer.render(scene, camera);
}

animate();
