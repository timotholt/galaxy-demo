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
    size: 0.05,         // Max particle size
    minSize: 0.01,      // Min particle size
    radius: 5,
    height: 0.8,        // Vertical spread of the galaxy
    branches: 5,
    spin: 1,
    randomness: 0.2,
    randomnessPower: 3,
    insideColor: '#ff6030',   // Warm orange
    outsideColor: '#1b3984',  // Cool blue
    colorCycleSpeed: 0.3,     // How fast colors change
    bloomStrength: 0.8,
    bloomRadius: 0.75,
    bloomThreshold: 0.2,
    pulseSpeed: 2.0,
    maxBloomStrength: 1.2,
    minBloomStrength: 0.4,
    particleLifetime: 5.0,
    emissionRate: 1000,
    maxParticles: 50000,
    rotationSpeed: 0.6,
    speedVariation: 0.5,     // How much particle speeds can vary
    rotationVariation: 0.5   // How much rotation speeds can vary
};

// Color palettes that we'll interpolate between
const colorPalettes = [
    { inside: '#ff6030', outside: '#1b3984' },  // Orange to Blue
    { inside: '#ff1b84', outside: '#30ff60' },  // Pink to Green
    { inside: '#6030ff', outside: '#84ff1b' },  // Purple to Lime
    { inside: '#ff3060', outside: '#1b84ff' }   // Red to Light Blue
];

// Particle system
let particleSystem = {
    positions: [],      // Array of Vector3
    velocities: [],     // Array of Vector3
    colors: [],        // Array of Color
    ages: [],          // Array of numbers (seconds)
    alive: [],         // Array of booleans
    speedFactors: [],  // Array of numbers
    rotationFactors: [], // Array of numbers
    mixFactors: [],     // Array of numbers
    sizes: []           // Array of numbers
};

function generateParticle() {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * params.radius;
    const branchAngle = (angle + ((Math.PI * 2) / params.branches) * Math.floor(Math.random() * params.branches)) % (Math.PI * 2);
    
    // Start from center
    const position = new THREE.Vector3(0, 0, 0);
    
    // Calculate target position with spin and height
    const spinAngle = radius * params.spin;
    const heightScale = 1 - (radius / params.radius); // More height variation near center
    const targetX = Math.cos(branchAngle + spinAngle) * radius;
    const targetY = (Math.random() - 0.5) * params.height * heightScale;
    const targetZ = Math.sin(branchAngle + spinAngle) * radius;
    
    // Add spherical randomness
    const randomAngle = Math.random() * Math.PI * 2;
    const randomRadius = Math.pow(Math.random(), params.randomnessPower) * params.randomness * radius;
    const randomX = Math.cos(randomAngle) * randomRadius;
    const randomY = (Math.random() - 0.5) * params.randomness * radius;
    const randomZ = Math.sin(randomAngle) * randomRadius;
    
    // Calculate size based on radius (smaller at edges)
    const sizeFactor = Math.pow(1 - (radius / params.radius), 0.5); // Square root for more medium-sized particles
    const size = THREE.MathUtils.lerp(params.minSize, params.size, sizeFactor);
    
    // Randomize speed
    const speedFactor = 1 + (Math.random() - 0.5) * params.speedVariation;
    const rotationFactor = 1 + (Math.random() - 0.5) * params.rotationVariation;
    
    // Calculate velocity with added randomness
    const velocity = new THREE.Vector3(
        targetX + randomX,
        targetY + randomY,
        targetZ + randomZ
    );
    velocity.multiplyScalar(speedFactor / params.particleLifetime);
    
    // Add tangential velocity for rotation
    const tangentialVelocity = new THREE.Vector3(-velocity.z, 0, velocity.x);
    tangentialVelocity.normalize().multiplyScalar(radius * params.rotationSpeed * rotationFactor);
    velocity.add(tangentialVelocity);
    
    // Calculate color
    const mixColor = radius / params.radius;
    const color = new THREE.Color(params.insideColor).lerp(new THREE.Color(params.outsideColor), mixColor);
    
    return {
        position: position,
        velocity: velocity,
        color: color,
        mixFactor: mixColor,
        size: size,
        age: 0,
        alive: true,
        speedFactor: speedFactor,
        rotationFactor: rotationFactor
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
        particleSystem.ages.push(particle.age);
        particleSystem.alive.push(particle.alive);
        particleSystem.speedFactors.push(particle.speedFactor);
        particleSystem.rotationFactors.push(particle.rotationFactor);
        particleSystem.mixFactors.push(particle.mixFactor);
        particleSystem.sizes.push(particle.size);
    }
    
    // Update positions array directly
    const positions = geometry.attributes.position.array;
    const sizes = geometry.attributes.size.array;
    
    // Update existing particles
    for(let i = particleSystem.positions.length - 1; i >= 0; i--) {
        if (!particleSystem.alive[i]) continue;
        
        // Update position
        const pos = particleSystem.positions[i];
        const vel = particleSystem.velocities[i];
        pos.add(vel.clone().multiplyScalar(deltaTime));
        
        // Update buffer
        const idx = i * 3;
        positions[idx] = pos.x;
        positions[idx + 1] = pos.y;
        positions[idx + 2] = pos.z;
        
        // Update size
        sizes[i] = particleSystem.sizes[i];
        
        // Update age
        particleSystem.ages[i] += deltaTime;
        
        // Kill old particles
        if (particleSystem.ages[i] >= params.particleLifetime) {
            particleSystem.alive[i] = false;
            
            // Remove dead particle
            particleSystem.positions.splice(i, 1);
            particleSystem.velocities.splice(i, 1);
            particleSystem.ages.splice(i, 1);
            particleSystem.alive.splice(i, 1);
            particleSystem.speedFactors.splice(i, 1);
            particleSystem.rotationFactors.splice(i, 1);
            particleSystem.mixFactors.splice(i, 1);
            particleSystem.sizes.splice(i, 1);
        }
    }
    
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
}

// Update particle colors based on current palette
function updateParticleColors(time) {
    const paletteCount = colorPalettes.length;
    const cycleTime = time * params.colorCycleSpeed;
    const paletteIndex = Math.floor(cycleTime % paletteCount);
    const nextPaletteIndex = (paletteIndex + 1) % paletteCount;
    const blend = (cycleTime % 1);
    
    // Interpolate between current and next palette
    const currentInside = new THREE.Color(colorPalettes[paletteIndex].inside);
    const currentOutside = new THREE.Color(colorPalettes[paletteIndex].outside);
    const nextInside = new THREE.Color(colorPalettes[nextPaletteIndex].inside);
    const nextOutside = new THREE.Color(colorPalettes[nextPaletteIndex].outside);
    
    // Set current interpolated colors as actual Color objects
    const insideColor = currentInside.lerp(nextInside, blend);
    const outsideColor = currentOutside.lerp(nextOutside, blend);
    
    // Update all particle colors
    const colors = geometry.attributes.color.array;
    for(let i = 0; i < particleSystem.positions.length; i++) {
        const mixColor = particleSystem.mixFactors[i];
        const color = insideColor.clone().lerp(outsideColor, mixColor);
        const idx = i * 3;
        colors[idx] = color.r;
        colors[idx + 1] = color.g;
        colors[idx + 2] = color.b;
    }
    geometry.attributes.color.needsUpdate = true;
}

function generateGalaxy() {
    if (points !== null) {
        geometry.dispose();
        material.dispose();
        scene.remove(points);
    }

    geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(params.maxParticles * 3);
    const colors = new Float32Array(params.maxParticles * 3);
    const sizes = new Float32Array(params.maxParticles);
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    material = new THREE.ShaderMaterial({
        uniforms: {
            globalSize: { value: 1.0 }
        },
        vertexShader: `
            uniform float globalSize;
            attribute float size;
            varying vec3 vColor;
            
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                gl_PointSize = size * globalSize * (300.0 / length(mvPosition.xyz));
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            
            void main() {
                float r = length(gl_PointCoord - vec2(0.5));
                if (r > 0.5) discard;
                float alpha = 0.6 * (1.0 - r * 2.0);
                gl_FragColor = vec4(vColor, alpha);
            }
        `,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        vertexColors: true
    });

    points = new THREE.Points(geometry, material);
    scene.add(points);
    
    // Reset particle system
    particleSystem = {
        positions: [],
        velocities: [],
        ages: [],
        alive: [],
        speedFactors: [],
        rotationFactors: [],
        mixFactors: [],
        sizes: []
    };
}

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
    if (event.key.toLowerCase() === 'f') {
        showFPS = !showFPS;
        fpsElement.style.display = showFPS ? 'block' : 'none';
    }
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

// FPS counter
let showFPS = false;
let frameCount = 0;
let lastTime = performance.now();
const fpsElement = document.createElement('div');
fpsElement.style.position = 'fixed';
fpsElement.style.top = '10px';
fpsElement.style.left = '10px';
fpsElement.style.color = '#00ff00';
fpsElement.style.fontFamily = 'monospace';
fpsElement.style.fontSize = '16px';
fpsElement.style.fontWeight = 'bold';
fpsElement.style.textShadow = '1px 1px 1px black';
fpsElement.style.display = 'none';
document.body.appendChild(fpsElement);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const time = Date.now() * 0.001;
    const deltaTime = 1/60;
    
    // Update FPS counter
    if (showFPS) {
        frameCount++;
        const currentTime = performance.now();
        const elapsed = currentTime - lastTime;
        if (elapsed >= 1000) {
            const fps = Math.round((frameCount * 1000) / elapsed);
            fpsElement.textContent = `FPS: ${fps}`;
            frameCount = 0;
            lastTime = currentTime;
        }
    }
    
    // Update particles
    updateParticles(deltaTime);
    
    // Update colors
    updateParticleColors(time);
    
    // Pulsing effect with clamped brightness
    const pulse = Math.sin(time * params.pulseSpeed) * 0.5 + 0.5;
    material.uniforms.globalSize.value = pulse * 0.3 + 0.7;
    
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
