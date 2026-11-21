// render.js — WebGL renderer, scene, camera and the base lights (hemisphere +
// sun) whose colours the weather system animates through the day-night cycle.

export function createRender() {
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d9);
  scene.fog = new THREE.Fog(0x87b5d9, 190, 620);

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1600);
  camera.position.set(0, 6, 14);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5f, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(80, 120, 40);
  scene.add(sun);
  const amb = new THREE.AmbientLight(0x404860, 0.35);
  scene.add(amb);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, sun, hemi, amb, canvas };
}
