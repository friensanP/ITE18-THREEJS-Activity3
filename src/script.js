import * as THREE from 'three';
import * as dat from 'lil-gui';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// Debug
const gui = new dat.GUI();
const parameters = {
    count: 1000,
    size: 0.05,
    radius: 3,
    branches: 3,
    spin: 2,
    randomness: 0.3,
    randomnessPower: 2,
    insideColor: '#ffea00',
    outsideColor: '#be0aff',
    showDuck: true,  // Checkbox to toggle visibility of Duck model
    showFox: true,   // Checkbox to toggle visibility of Fox model
    showGalaxy: true // Checkbox to toggle visibility of Galaxy
};

// Add the visibility checkboxes in the GUI
gui.add(parameters, 'showDuck').name('Show Duck').onChange(() => {
    if (duckModel) duckModel.visible = parameters.showDuck;
});

gui.add(parameters, 'showFox').name('Show Fox').onChange(() => {
    if (gltfModel) gltfModel.visible = parameters.showFox;
});

gui.add(parameters, 'showGalaxy').name('Show Galaxy').onChange(() => {
    galaxy.visible = parameters.showGalaxy;
});

// Base
const canvas = document.querySelector('canvas.webgl');
const scene = new THREE.Scene();

// Material
const material = new THREE.MeshToonMaterial({
    color: parameters.materialColor
});

// Raycaster and mouse setup
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// GLTF Loader
const gltfLoader = new GLTFLoader();
let mixer = null;

// Objects Distance
const objectsDistance = 4;

// Load the Fox Model
let gltfModel = null;
gltfLoader.load(
    '/models/Fox/glTF/Fox.gltf',
    (gltf) => {
        console.log('Model loaded:', gltf);
        gltfModel = gltf.scene;
        gltfModel.scale.set(0.03, 0.03, 0.03);
        scene.add(gltfModel);
        gltfModel.position.set(-2, -objectsDistance * 1.3, 0);
        mixer = new THREE.AnimationMixer(gltfModel);

        if (gltf.animations.length > 2) {
            const action = mixer.clipAction(gltf.animations[2]);
            action.play();
        }
    },
    undefined,
    (error) => console.error('Error loading the Fox model:', error)
);

// Load the Duck Model
let duckModel = null;
gltfLoader.load(
    '/models/Duck/glTF-Binary/Duck.glb',
    (gltf) => {
        duckModel = gltf.scene;

        // Increase the base scale of the Duck model
        duckModel.scale.set(0.2, 0.2, 0.2); // Adjusted scale to make the duck bigger
        duckModel.position.set(2, -objectsDistance * 2.2, 0); // Match mesh3's position

        duckModel.rotation.y = Math.PI * 1.5;

        scene.add(duckModel);
    },
    undefined,
    (error) => console.error('Error loading the Duck model:', error)
);

// Galaxy
const galaxyGeometry = new THREE.BufferGeometry();
const positions = [];
const colors = [];
const colorInside = new THREE.Color(parameters.insideColor);
const colorOutside = new THREE.Color(parameters.outsideColor);

for (let i = 0; i < parameters.count; i++) {
    const radius = Math.random() * parameters.radius;
    const spinAngle = radius * parameters.spin;
    const branchAngle = (i % parameters.branches) / parameters.branches * Math.PI * 2;

    const x = Math.cos(branchAngle + spinAngle) * radius;
    const y = Math.random() * parameters.randomness - parameters.randomness / 2;
    const z = Math.sin(branchAngle + spinAngle) * radius;

    positions.push(x, y, z);

    const mixedColor = colorInside.clone();
    mixedColor.lerp(colorOutside, radius / parameters.radius);
    colors.push(mixedColor.r, mixedColor.g, mixedColor.b);
}

galaxyGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
galaxyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

const particlesMaterial = new THREE.PointsMaterial({
    size: parameters.size,
    vertexColors: true
});

const galaxy = new THREE.Points(galaxyGeometry, particlesMaterial);
galaxy.position.set(2, 0, 0);
scene.add(galaxy);

// Lights
const ambientLight = new THREE.AmbientLight('#ffffff', 0.3);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight('#ffffff', 0.7);
directionalLight.position.set(1, 2, 3);
scene.add(directionalLight);

// Sizes
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};

window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Cursor
const cursor = { x: 0, y: 0 };
window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / sizes.width) * 2 - 1;
    mouse.y = -(event.clientY / sizes.height) * 2 + 1;
});

// Camera
const cameraGroup = new THREE.Group();
scene.add(cameraGroup);

const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 1000); // Increased far plane to 1000
camera.position.set(0, 0, 6); // Positioned camera a bit farther from the center to see the stars
cameraGroup.add(camera);

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Scroll
let scrollY = window.scrollY;
window.addEventListener('scroll', () => (scrollY = window.scrollY));

// Animation
const clock = new THREE.Clock();
let previousTime = 0;

// Create waving spheres around the Duck model
const sphereCount = 5; // Number of spheres
const spheres = [];
const sphereBasePositions = [];
const baseSphereColor = new THREE.Color('#ffea00'); // Red by default
const hoverSphereColor = new THREE.Color('#be0aff'); // Blue when hovered
const frequencyMultipliers = [0.3, 0.8, 1.4, 1.1, 0.5]; // Different frequencies for each sphere

const duckModelPosition = new THREE.Vector3(2, -6, 0); // Position where Duck model is located

const sphereMaterial = new THREE.MeshBasicMaterial({ color: baseSphereColor });

for (let i = 0; i < sphereCount; i++) {
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 32, 32), 
        sphereMaterial.clone() // Clone material for individual colors
    );

    // Randomize X and Z positions around the Duck model
    const x = Math.random() * 2 - 1;
    const z = Math.random() * 2 - 1;

    // Adjust the y position to move the spheres a little lower
    sphere.position.set(duckModelPosition.x + x, duckModelPosition.y - 2, duckModelPosition.z + z);
    sphereBasePositions.push(sphere.position.clone());
    scene.add(sphere);
    spheres.push(sphere);
}

// Starfield Background
const starCount = 10000; // Number of stars
const starGeometry = new THREE.BufferGeometry();
const starPositions = [];

// Randomly position the stars
for (let i = 0; i < starCount; i++) {
    const x = (Math.random() - 0.5) * 1000;  // Random positions in a wide space
    const y = (Math.random() - 0.5) * 1000;
    const z = (Math.random() - 0.5) * 1000;
    starPositions.push(x, y, z);
}

starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));

// Material for the stars (using white color)
const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2, // Size of each star
    opacity: 0.8, // Slightly transparent for a realistic look
    transparent: true
});

// Create the starfield
const starField = new THREE.Points(starGeometry, starMaterial);
scene.add(starField);

const tick = () => {
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - previousTime;
    previousTime = elapsedTime;

    // Animate galaxy
    galaxy.rotation.y = elapsedTime * 0.03;
    galaxy.rotation.x = elapsedTime * 0.03;

    

    // Animate spheres waving up and down with different frequencies
    spheres.forEach((sphere, index) => {
        const frequency = frequencyMultipliers[index];
        const basePosition = sphereBasePositions[index];
        sphere.position.y = basePosition.y + Math.sin(elapsedTime * frequency) * 1.5;
    });

    // Animate camera with scroll
    cameraGroup.position.y = -scrollY / sizes.height * objectsDistance;

    // Raycaster interactions
    raycaster.setFromCamera(mouse, camera);
    if (duckModel) {
        const intersects = raycaster.intersectObject(duckModel);

        // Adjust hover scale for the bigger duck
        const hoverScale = 1.5; // Scale when hovered
        const baseScale = 1;  // Base scale when not hovered
        duckModel.scale.set(
            intersects.length ? hoverScale : baseScale,
            intersects.length ? hoverScale : baseScale,
            intersects.length ? hoverScale : baseScale
        );
    }

    // Raycasting for spheres (color change)
    const intersects = raycaster.intersectObjects(spheres);
    spheres.forEach((sphere) => {
        sphere.material.color.set(baseSphereColor); // Reset to red
    });
    intersects.forEach((intersect) => {
        intersect.object.material.color.set(hoverSphereColor); // Change to blue
    });

    if (mixer) mixer.update(deltaTime);

    renderer.render(scene, camera);
    window.requestAnimationFrame(tick);
};

tick();
