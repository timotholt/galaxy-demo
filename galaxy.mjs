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
    bloomStrength: 0.5,     // Reduced from 0.8
    bloomRadius: 0.5,       // Reduced from 0.75
    bloomThreshold: 0.3,    // Increased from 0.2
    maxBrightness: 0.3,     // Maximum brightness multiplier for any particle
    centerBrightness: 0.1,  // Additional brightness reduction for center particles
    pulseSpeed: 2.0,
    maxBloomStrength: 1.2,
    minBloomStrength: 0.4,
    particleLifetime: 5.0,
    emissionRate: 1000,
    maxParticles: 20000,     // Reduced from 50000
    rotationSpeed: 0.6,
    speedVariation: 0.5,     // How much particle speeds can vary
    rotationVariation: 0.5,   // How much rotation speeds can vary
    
    // Bass controls emission with bigger bursts on downbeats
    bassThreshold: 0.3,
    downbeatMultiplier: 3.0,
    normalBeatMultiplier: 1.0
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
    const size = THREE.MathUtils.lerp(params.minSize, params.size, sizeFactor) * 3; // Reduced from 50x to 3x
    
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
    
    // Calculate color mix factor
    const mixColor = radius / params.radius;
    
    return {
        position: position,
        velocity: velocity,
        mixFactor: mixColor,
        size: size,
        age: 0,
        alive: true,
        speedFactor: speedFactor,
        rotationFactor: rotationFactor
    };
}

function updateParticles(deltaTime, particlesToAdd) {
    const positions = geometry.attributes.position.array;
    const colors = geometry.attributes.color.array;
    const sizes = geometry.attributes.size.array;
    let needsPositionUpdate = false;
    let needsColorUpdate = false;
    let needsSizeUpdate = false;
    
    // Pre-allocate new particles
    if (particlesToAdd > 0) {
        const newParticles = [];
        for(let i = 0; i < particlesToAdd; i++) {
            newParticles.push(generateParticle());
        }
        
        // Batch add all new particles
        for(const particle of newParticles) {
            const index = particleSystem.positions.length;
            particleSystem.positions.push(particle.position);
            particleSystem.velocities.push(particle.velocity);
            particleSystem.ages.push(particle.age);
            particleSystem.alive.push(particle.alive);
            particleSystem.speedFactors.push(particle.speedFactor);
            particleSystem.rotationFactors.push(particle.rotationFactor);
            particleSystem.mixFactors.push(particle.mixFactor);
            particleSystem.sizes.push(particle.size);
            
            // Set initial size in buffer
            sizes[index] = particle.size;
        }
        needsPositionUpdate = true;
        needsColorUpdate = true;
        needsSizeUpdate = true;
    }
    
    // Update existing particles
    for(let i = 0; i < particleSystem.positions.length; i++) {
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
        sizes[i] = particleSystem.sizes[i];
        needsPositionUpdate = true;
        needsSizeUpdate = true;
        
        // Update age
        particleSystem.ages[i] += deltaTime;
        if (particleSystem.ages[i] >= params.particleLifetime) {
            particleSystem.alive[i] = false;
        }
    }
    
    // Batch remove dead particles at the end
    if (particleSystem.positions.some((_, i) => !particleSystem.alive[i])) {
        particleSystem.positions = particleSystem.positions.filter((_, i) => particleSystem.alive[i]);
        particleSystem.velocities = particleSystem.velocities.filter((_, i) => particleSystem.alive[i]);
        particleSystem.ages = particleSystem.ages.filter((_, i) => particleSystem.alive[i]);
        particleSystem.alive = particleSystem.alive.filter(alive => alive);
        particleSystem.speedFactors = particleSystem.speedFactors.filter((_, i) => particleSystem.alive[i]);
        particleSystem.rotationFactors = particleSystem.rotationFactors.filter((_, i) => particleSystem.alive[i]);
        particleSystem.mixFactors = particleSystem.mixFactors.filter((_, i) => particleSystem.alive[i]);
        particleSystem.sizes = particleSystem.sizes.filter((_, i) => particleSystem.alive[i]);
        needsPositionUpdate = true;
        needsColorUpdate = true;
        needsSizeUpdate = true;
    }
    
    // Only update buffers that changed
    if (needsPositionUpdate) {
        geometry.attributes.position.needsUpdate = true;
    }
    if (needsColorUpdate) {
        geometry.attributes.color.needsUpdate = true;
    }
    if (needsSizeUpdate) {
        geometry.attributes.size.needsUpdate = true;
    }
}

function updateParticleColors(time, forcedBlend = null) {
    const paletteCount = colorPalettes.length;
    const cycleTime = time * params.colorCycleSpeed;
    const paletteIndex = Math.floor(cycleTime % paletteCount);
    const nextPaletteIndex = (paletteIndex + 1) % paletteCount;
    const blend = forcedBlend !== null ? forcedBlend : (cycleTime % 1);
    
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

function updateBackgroundColor(time, forcedBlend = null) {
    const paletteCount = colorPalettes.length;
    const cycleTime = time * params.colorCycleSpeed;
    const paletteIndex = Math.floor(cycleTime) % paletteCount;
    const nextPaletteIndex = (paletteIndex + 1) % paletteCount;
    const blend = forcedBlend !== null ? forcedBlend : cycleTime % 1;
    
    // Get darker versions of the palette colors for background
    const currentColor = new THREE.Color(colorPalettes[paletteIndex].outside).multiplyScalar(0.0);
    const nextColor = new THREE.Color(colorPalettes[nextPaletteIndex].outside).multiplyScalar(0.0);
    
    // Smoothly interpolate between colors
    const targetBackgroundColor = new THREE.Color();
    targetBackgroundColor.copy(currentColor).lerp(nextColor, blend);
    scene.background = targetBackgroundColor;
}

function generateGalaxy() {
    if (points !== null) {
        geometry.dispose();
        material.dispose();
        scene.remove(points);
    }

    geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(params.particles * 3);
    const colors = new Float32Array(params.particles * 3);
    const sizes = new Float32Array(params.particles);
    
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
    
    const insideColor = new THREE.Color(params.insideColor);
    const outsideColor = new THREE.Color(params.outsideColor);

    for(let i = 0; i < params.particles; i++) {
        const i3 = i * 3;
        const radius = Math.random() * params.radius;
        const spinAngle = radius * params.spin;
        const branchAngle = (i % params.branches) / params.branches * Math.PI * 2;
        
        const randomX = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1);
        const randomY = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1);
        const randomZ = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1);

        positions[i3    ] = Math.cos(branchAngle + spinAngle) * radius + randomX;
        positions[i3 + 1] = randomY * params.height;
        positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

        // Color
        const mixedColor = insideColor.clone();
        const centerDistance = radius / params.radius;
        mixedColor.lerp(outsideColor, centerDistance);
        
        // Apply brightness clamping
        const brightness = Math.min(1.0 - (centerDistance * params.centerBrightness), params.maxBrightness);
        mixedColor.multiplyScalar(brightness);

        colors[i3    ] = mixedColor.r;
        colors[i3 + 1] = mixedColor.g;
        colors[i3 + 2] = mixedColor.b;
    }
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

// Audio setup
let audioContext = null;
let analyzer = null;
let audioElement = null;
let audioSource = null;
let isAudioInitialized = false;
let dataArray = null;
let hasInteracted = false;
let lastFileHandle = null;

// Load and play the last file if it exists
function loadLastFile() {
    const fileInput = document.getElementById('audioFile');
    // Trigger file input to load the last selected file
    if (fileInput.files && fileInput.files[0]) {
        handleAudioFile(fileInput.files[0]);
    }
}

function handleAudioFile(file) {
    if (!file) return;
    
    // Clean up old audio context and connections
    if (audioContext) {
        audioContext.close();
        audioContext = null;
        analyzer = null;
        audioSource = null;
    }
    
    // Clean up old audio element
    if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
        audioElement.remove();
        audioElement = null;
    }

    // Create new audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 1024; // Increased for better BPM detection
    dataArray = new Uint8Array(analyzer.frequencyBinCount);
    initBPMDetection();
    
    // Create new audio element
    audioElement = new Audio();
    audioElement.addEventListener('ended', () => {
        audioElement.currentTime = 0;
        audioElement.play();
    });
    
    // Use URL.createObjectURL for the audio source
    const fileUrl = URL.createObjectURL(file);
    audioElement.src = fileUrl;
    
    // Wait for audio to be loaded before connecting
    audioElement.addEventListener('canplay', () => {
        // Create new audio source
        audioSource = audioContext.createMediaElementSource(audioElement);
        audioSource.connect(analyzer);
        analyzer.connect(audioContext.destination);
        
        // Start playback
        audioElement.play().catch(console.error);
        isAudioInitialized = true;
    }, { once: true }); // Only handle the first canplay event
    
    // Clean up old URL when loading new one
    audioElement.addEventListener('error', () => {
        URL.revokeObjectURL(fileUrl);
    }, { once: true });
}

// BPM detection
let bpmTimeData = null;
let lastPeakTime = 0;
let intervalTimes = [];
let beatCount = 0;
const minBPM = 60;
const maxBPM = 200;
const minPeakInterval = (60 / maxBPM) * 1000;
const maxPeakInterval = (60 / minBPM) * 1000;
const energyThreshold = 0.5; // Lowered threshold
let currentBPM = 120;
let isDownbeat = false;
let debugText = '';

function initBPMDetection() {
    bpmTimeData = new Float32Array(analyzer.fftSize);
}

function detectBPM() {
    if (!analyzer || !bpmTimeData) return;
    
    analyzer.getFloatTimeDomainData(bpmTimeData);
    
    let energy = 0;
    for (let i = 0; i < bpmTimeData.length; i++) {
        energy += bpmTimeData[i] * bpmTimeData[i];
    }
    energy = Math.sqrt(energy / bpmTimeData.length);
    
    const now = performance.now();
    
    // Check if this is a peak
    if (energy > energyThreshold && (now - lastPeakTime) > minPeakInterval) {
        const interval = now - lastPeakTime;
        
        if (interval < maxPeakInterval) {
            intervalTimes.push(interval);
            if (intervalTimes.length > 20) {
                intervalTimes.shift();
            }
            
            // Track beat count for downbeat detection
            beatCount = (beatCount + 1) % 4;
            isDownbeat = (beatCount === 0);
            
            debugText = `Beat ${beatCount + 1}, Energy: ${energy.toFixed(2)}`;
            
            if (intervalTimes.length > 3) {
                const sortedIntervals = [...intervalTimes].sort((a, b) => a - b);
                const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
                const bpm = Math.round(60000 / medianInterval);
                
                if (bpm >= minBPM && bpm <= maxBPM) {
                    currentBPM = bpm;
                }
            }
        }
        lastPeakTime = now;
    }
    
    return { bpm: currentBPM, isDownbeat, energy };
}

// Setup audio file handling
document.getElementById('audioFile').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        handleAudioFile(file);
    }
});

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
            fpsElement.textContent = `FPS: ${fps} | BPM: ${currentBPM} | ${debugText}`;
            frameCount = 0;
            lastTime = currentTime;
        }
    }
    
    let emissionMultiplier = 0;
    let particleCountMultiplier = 1.0;
    let colorBlend = null;
    
    if (isAudioInitialized && analyzer) {
        analyzer.getByteFrequencyData(dataArray);
        
        const bass = Math.pow(average(dataArray.slice(1, 3)) / 255, 3);
        const mids = Math.pow(average(dataArray.slice(4, 21)) / 255, 2);
        const highs = Math.pow(average(dataArray.slice(21, 32)) / 255, 2);
        
        // Detect BPM and downbeats
        const bpmInfo = detectBPM();
        
        // Bass controls emission with bigger bursts on downbeats
        if (bass > params.bassThreshold) {
            emissionMultiplier = bass * (bpmInfo.isDownbeat ? params.downbeatMultiplier : params.normalBeatMultiplier);
        }
        
        // Mids control color transitions for both particles and background
        colorBlend = mids;
        updateParticleColors(time, colorBlend);
        updateBackgroundColor(time, colorBlend);
        
        // Highs control max particles
        particleCountMultiplier = 0.5 + highs * 1.5;
        params.maxParticles = Math.floor(20000 * particleCountMultiplier);
        
        // Update pulse and bloom
        const pulse = bass * 2.0 + 0.5;
        const bloomStrength = params.bloomStrength * (1 + mids * 2.0);
        material.uniforms.globalSize.value = pulse;
        bloomPass.strength = THREE.MathUtils.lerp(params.minBloomStrength, params.maxBloomStrength * 2, pulse);
    }
    
    // Update particles with dynamic emission rate
    const baseEmissionRate = 1000; // Increased base rate
    const effectiveEmissionRate = Math.floor(baseEmissionRate * emissionMultiplier);
    const particlesToAdd = Math.min(
        Math.floor(effectiveEmissionRate * deltaTime),
        params.maxParticles - particleSystem.positions.length
    );
    
    // Update particles
    updateParticles(deltaTime, particlesToAdd);
    
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
    
    // Render
    composer.render();
}

// Utility function to calculate average of array
function average(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Initialize everything
function init() {
    // Set up file input handler
    const fileInput = document.getElementById('audioFile');
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleAudioFile(file);
        }
    });
    
    // Wait for first interaction
    document.addEventListener('click', () => {
        if (!hasInteracted) {
            hasInteracted = true;
            loadLastFile();
        }
    }, { once: true }); // Only need to handle first click
    
    // Start animation
    animate();
}

init();
