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

// Create galaxy geometry
let geometry = null;
let material = null;
let points = null;

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
    minBloomStrength: 0.4,
    particleLifetime: 5.0,    // How long particles live in seconds
    emissionRate: 1000,       // Particles per second
    maxParticles: 50000,      // Maximum particles in system
    rotationSpeed: 0.6        // Rotation speed parameter
};

// Particle system
let particleSystem = {
    positions: [],      // Array of Vector3
    velocities: [],     // Array of Vector3
    colors: [],        // Array of Color
    ages: [],          // Array of numbers (seconds)
    alive: []          // Array of booleans
};

function generateParticle() {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * params.radius;
    const branchAngle = (angle + ((Math.PI * 2) / params.branches) * Math.floor(Math.random() * params.branches)) % (Math.PI * 2);
    
    // Start from center
    const position = new THREE.Vector3(0, 0, 0);
    
    // Calculate target position with spin
    const spinAngle = radius * params.spin;
    const targetX = Math.cos(branchAngle + spinAngle) * radius;
    const targetY = Math.random() * 0.2 - 0.1;
    const targetZ = Math.sin(branchAngle + spinAngle) * radius;
    
    // Calculate velocity (direction from center to target)
    const velocity = new THREE.Vector3(targetX, targetY, targetZ);
    velocity.multiplyScalar(1.0 / params.particleLifetime); // Speed to reach target over lifetime
    
    // Add tangential velocity for rotation
    const tangentialVelocity = new THREE.Vector3(-targetZ, 0, targetX);
    tangentialVelocity.normalize().multiplyScalar(radius * params.rotationSpeed);
    velocity.add(tangentialVelocity);
    
    // Calculate color
    const mixColor = radius / params.radius;
    const color = new THREE.Color(params.insideColor).lerp(new THREE.Color(params.outsideColor), mixColor);
    
    return {
        position: position,
        velocity: velocity,
        color: color,
        age: 0,
        alive: true
    };
}

function updateParticles(deltaTime) {
    // Add new particles
    const particlesToAdd = Math.min(
        Math.floor(params.emissionRate * deltaTime),
        params.maxParticles - particleSystem.positions.length
    );
    
    for(let i = 0; i < particlesToAdd; i++) {
        const particle = generateParticle();
        particleSystem.positions.push(particle.position);
        particleSystem.velocities.push(particle.velocity);
        particleSystem.colors.push(particle.color);
        particleSystem.ages.push(particle.age);
        particleSystem.alive.push(particle.alive);
    }
    
    // Update existing particles
    for(let i = particleSystem.positions.length - 1; i >= 0; i--) {
        if (!particleSystem.alive[i]) continue;
        
        // Update position
        particleSystem.positions[i].add(particleSystem.velocities[i].clone().multiplyScalar(deltaTime));
        
        // Update age
        particleSystem.ages[i] += deltaTime;
        
        // Kill old particles
        if (particleSystem.ages[i] >= params.particleLifetime) {
            particleSystem.alive[i] = false;
            
            // Remove dead particle
            particleSystem.positions.splice(i, 1);
            particleSystem.velocities.splice(i, 1);
            particleSystem.colors.splice(i, 1);
            particleSystem.ages.splice(i, 1);
            particleSystem.alive.splice(i, 1);
        }
    }
    
    // Update geometry
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(
        particleSystem.positions.flatMap(p => [p.x, p.y, p.z]), 3
    ));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(
        particleSystem.colors.flatMap(c => [c.r, c.g, c.b]), 3
    ));
    
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
}

function generateGalaxy() {
    if (points !== null) {
        geometry.dispose();
        material.dispose();
        scene.remove(points);
    }

    geometry = new THREE.BufferGeometry();
    
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
    
    // Reset particle system
    particleSystem = {
        positions: [],
        velocities: [],
        colors: [],
        ages: [],
        alive: []
    };
}

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
    const deltaTime = 1/60; // Fixed timestep
    
    // Update particles
    updateParticles(deltaTime);
    
    // Pulsing effect with clamped brightness
    const pulse = Math.sin(time * params.pulseSpeed) * 0.5 + 0.5;
    material.size = params.size * (pulse * 0.3 + 0.7);
    
    const bloomStrength = THREE.MathUtils.lerp(
        params.minBloomStrength,
        params.maxBloomStrength,
        pulse
    );
    bloomPass.strength = bloomStrength;
    
    // Rotation
    if (points) {
        points.rotation.y += deltaTime * params.rotationSpeed * 0.5;
    }
    
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
        points.rotation.x += (targetY - points.rotation.x) * 0.05;
        points.rotation.z += (targetX - points.rotation.z) * 0.05;
    }
    
    // Update position display
    updatePositionDisplay();
    
    // Render with post-processing
    composer.render();
}

animate();
