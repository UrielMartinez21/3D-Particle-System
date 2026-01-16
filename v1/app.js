// ─────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Convierte un hex (#rrggbb) a THREE.Color
function hexToColor(hex) {
  const c = new THREE.Color(hex);
  return c;
}

// Hash simple para ruido determinista por índice
function hash11(i) {
  let x = Math.sin(i * 127.1) * 43758.5453123;
  return x - Math.floor(x);
}

// ─────────────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────────────
const canvas = document.getElementById("c");
const videoEl = document.getElementById("video");

const shapeSelect = document.getElementById("shapeSelect");
const colorPicker = document.getElementById("colorPicker");
const btnFullscreen = document.getElementById("btnFullscreen");
const btnToggleMenu = document.getElementById("btnToggleMenu");
const floatingToggle = document.getElementById("floatingToggle");
const uiPanel = document.querySelector(".ui");

const countRange = document.getElementById("countRange");
const countLabel = document.getElementById("countLabel");

const senseRange = document.getElementById("senseRange");
const senseLabel = document.getElementById("senseLabel");

const smoothRange = document.getElementById("smoothRange");
const smoothLabel = document.getElementById("smoothLabel");

const camStatus = document.getElementById("camStatus");
const handStatus = document.getElementById("handStatus");

// Panel de depuración de mano
const handDebugPanel = document.getElementById("handDebugPanel");
const toggleDebugBtn = document.getElementById("toggleDebug");
const handCanvas = document.getElementById("handCanvas");
const handCtx = handCanvas.getContext("2d");
const thumbCoords = document.getElementById("thumbCoords");
const indexCoords = document.getElementById("indexCoords");
const pinchDistance = document.getElementById("pinchDistance");
const landmarkCount = document.getElementById("landmarkCount");

countLabel.textContent = countRange.value;
senseLabel.textContent = senseRange.value;
smoothLabel.textContent = smoothRange.value;

// ─────────────────────────────────────────────────────────────
// Three.js: escena
// ─────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060a, 0.06);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 200);
camera.position.set(0, 0.2, 6.2);

// Por ahora sin OrbitControls para simplicidad
let controls = null;

// Luz sutil (aunque Points no requiere, ayuda si agregas extras luego)
scene.add(new THREE.AmbientLight(0xffffff, 0.7));

// ─────────────────────────────────────────────────────────────
// Partículas: BufferGeometry + Points
// ─────────────────────────────────────────────────────────────
let COUNT = parseInt(countRange.value, 10);

const geometry = new THREE.BufferGeometry();
let positions = new Float32Array(COUNT * 3);
let baseTemplate = new Float32Array(COUNT * 3);
let targetTemplate = new Float32Array(COUNT * 3);

geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

const material = new THREE.PointsMaterial({
  color: hexToColor(colorPicker.value),
  size: 0.03,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});

const points = new THREE.Points(geometry, material);
scene.add(points);

// Fondo de "partículas lejanas" (opcional)
const dust = makeDust(1200);
scene.add(dust);

function makeDust(n) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 25 * Math.cbrt(Math.random());
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    p[i * 3 + 0] = r * Math.sin(ph) * Math.cos(th);
    p[i * 3 + 1] = r * Math.cos(ph);
    p[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ size: 0.02, opacity: 0.25, transparent: true, depthWrite: false });
  return new THREE.Points(g, m);
}

// ─────────────────────────────────────────────────────────────
// Plantillas de formas (heart / flower / galaxy / saturn)
// ─────────────────────────────────────────────────────────────
function generateTemplate(name, count) {
  const arr = new Float32Array(count * 3);

  if (name === "galaxy") {
    // Galaxia espiral (disco + brazos)
    const arms = 4;
    const maxR = 2.3;
    for (let i = 0; i < count; i++) {
      const t = Math.random();
      const r = maxR * Math.pow(t, 0.55);
      const arm = (i % arms) / arms * Math.PI * 2;
      const twist = r * 1.9;
      const ang = arm + twist + (Math.random() - 0.5) * 0.45;

      const y = (Math.random() - 0.5) * 0.28 * (1 - r / maxR);
      const jitter = (Math.random() - 0.5) * 0.10;

      const x = (r + jitter) * Math.cos(ang);
      const z = (r + jitter) * Math.sin(ang);

      arr[i * 3 + 0] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    }
    return arr;
  }

  if (name === "heart") {
    // Corazón 3D: curva 2D + grosor
    // Param clásico: x=16 sin^3 t, y=13 cos t - 5 cos 2t - 2 cos 3t - cos 4t
    for (let i = 0; i < count; i++) {
      const t = Math.random() * Math.PI * 2;
      const x2 = 16 * Math.pow(Math.sin(t), 3);
      const y2 =
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t);

      // Normaliza y escala
      const x = (x2 / 18) * 2.0;
      const y = (y2 / 18) * 2.0;

      // Grosor 3D
      const z = (Math.random() - 0.5) * 0.7;
      const wob = (Math.random() - 0.5) * 0.05;

      arr[i * 3 + 0] = x + wob;
      arr[i * 3 + 1] = y + wob;
      arr[i * 3 + 2] = z;
    }
    return arr;
  }

  if (name === "flower") {
    // Beautiful multi-layered flower with realistic petals
    const centerCount = Math.floor(count * 0.15);  // Dense center
    const innerPetalCount = Math.floor(count * 0.35); // Inner petals
    const outerPetalCount = count - centerCount - innerPetalCount; // Outer petals
    
    let index = 0;
    
    // Flower center - dense, circular core
    for (let i = 0; i < centerCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.3; // Small center radius
      const height = (Math.random() - 0.5) * 0.15;
      
      arr[index * 3 + 0] = radius * Math.cos(angle) + (Math.random() - 0.5) * 0.1;
      arr[index * 3 + 1] = height;
      arr[index * 3 + 2] = radius * Math.sin(angle) + (Math.random() - 0.5) * 0.1;
      index++;
    }
    
    // Inner petals - 8 main petals
    const innerPetals = 8;
    for (let i = 0; i < innerPetalCount; i++) {
      const petalIndex = Math.floor(Math.random() * innerPetals);
      const petalAngle = (petalIndex / innerPetals) * Math.PI * 2;
      const angleVariation = (Math.random() - 0.5) * 0.4; // Petal width
      const finalAngle = petalAngle + angleVariation;
      
      // Petal shape using modified rose curve
      const t = Math.random() * 0.85 + 0.15; // Distance along petal (0.15 to 1.0)
      const petalWidth = Math.sin(t * Math.PI) * 0.6; // Width varies along petal
      const radius = t * (1.2 + petalWidth * 0.5);
      
      // Add organic curvature
      const curve = Math.sin(t * Math.PI * 2) * 0.15;
      const x = radius * Math.cos(finalAngle) + curve * Math.cos(finalAngle + Math.PI/2);
      const z = radius * Math.sin(finalAngle) + curve * Math.sin(finalAngle + Math.PI/2);
      
      // Petal elevation - higher at tips, lower at center
      const elevation = t * 0.4 + Math.sin(t * Math.PI) * 0.3;
      const y = elevation + (Math.random() - 0.5) * 0.08;
      
      arr[index * 3 + 0] = x;
      arr[index * 3 + 1] = y;
      arr[index * 3 + 2] = z;
      index++;
    }
    
    // Outer petals - 16 secondary petals for fullness
    const outerPetals = 16;
    for (let i = 0; i < outerPetalCount; i++) {
      const petalIndex = Math.floor(Math.random() * outerPetals);
      const petalAngle = (petalIndex / outerPetals) * Math.PI * 2;
      const angleVariation = (Math.random() - 0.5) * 0.3;
      const finalAngle = petalAngle + angleVariation;
      
      // Outer petals are longer and more varied
      const t = Math.random() * 0.9 + 0.1;
      const petalWidth = Math.sin(t * Math.PI) * 0.8;
      let radius = t * (1.8 + petalWidth * 0.3);
      
      // Add some randomness to outer petals
      radius += (Math.random() - 0.5) * 0.4;
      
      // More dramatic curvature for outer petals
      const curve = Math.sin(t * Math.PI * 3) * 0.25;
      const x = radius * Math.cos(finalAngle) + curve * Math.cos(finalAngle + Math.PI/2);
      const z = radius * Math.sin(finalAngle) + curve * Math.sin(finalAngle + Math.PI/2);
      
      // Outer petals droop slightly
      const elevation = t * 0.2 + Math.sin(t * Math.PI) * 0.4 - t * 0.15;
      const y = elevation + (Math.random() - 0.5) * 0.12;
      
      arr[index * 3 + 0] = x;
      arr[index * 3 + 1] = y;
      arr[index * 3 + 2] = z;
      index++;
    }
    
    return arr;
  }

  if (name === "saturn") {
    // Saturno: esfera + anillo
    const sphereCount = Math.floor(count * 0.55);
    const ringCount = count - sphereCount;

    // Esfera (distribución uniforme)
    for (let i = 0; i < sphereCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const th = 2 * Math.PI * u;
      const ph = Math.acos(2 * v - 1);
      const r = 0.95 + (Math.random() - 0.5) * 0.06;

      const x = r * Math.sin(ph) * Math.cos(th);
      const y = r * Math.cos(ph);
      const z = r * Math.sin(ph) * Math.sin(th);

      arr[i * 3 + 0] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    }

    // Anillo
    for (let j = 0; j < ringCount; j++) {
      const i = sphereCount + j;
      const ang = Math.random() * Math.PI * 2;
      const rr = 1.35 + Math.random() * 1.05; // radio anillo
      const thickness = (Math.random() - 0.5) * 0.06;

      // Inclina el anillo
      const x = rr * Math.cos(ang);
      const z = rr * Math.sin(ang);
      let y = thickness;

      // rotación del plano del anillo
      const tilt = 0.55;
      const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
      const z2 = y * Math.sin(tilt) + z * Math.cos(tilt);

      arr[i * 3 + 0] = x;
      arr[i * 3 + 1] = y2;
      arr[i * 3 + 2] = z2;
    }

    // Escala global a "look" bonito
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 0] *= 1.25;
      arr[i * 3 + 1] *= 1.25;
      arr[i * 3 + 2] *= 1.25;
    }

    return arr;
  }

  if (name === "vortex") {
    // Tornado/vortex structure (punta abajo, base ancha arriba)
    const maxHeight = 3.5;
    const maxRadius = 2.0;
    const spiralTurns = 8; // Number of spiral turns
    
    for (let i = 0; i < count; i++) {
      // Height position (0 to 1)
      const h = Math.random();
      const y = h * maxHeight - maxHeight / 2;
      
      // Radius increases as we go UP (inverted tornado shape)
      // h=0 (bottom) = small radius, h=1 (top) = large radius  
      const heightFromBottom = (y + maxHeight / 2) / maxHeight; // 0 at bottom, 1 at top
      const radiusAtHeight = maxRadius * (heightFromBottom * 0.85 + 0.15);
      
      // Spiral angle increases with height
      const spiralAngle = heightFromBottom * spiralTurns * Math.PI * 2;
      
      // Add some randomness to the spiral angle
      const angleVariation = (Math.random() - 0.5) * 0.5;
      const finalAngle = spiralAngle + angleVariation;
      
      // Distance from center with some randomness
      const radiusVariation = Math.random() * 0.7 + 0.3;
      const radius = radiusAtHeight * radiusVariation;
      
      // Add swirl motion
      const swirl = Math.sin(h * Math.PI * 4) * 0.2;
      
      const x = radius * Math.cos(finalAngle) + swirl * Math.cos(finalAngle + Math.PI/2);
      const z = radius * Math.sin(finalAngle) + swirl * Math.sin(finalAngle + Math.PI/2);
      
      arr[i * 3 + 0] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    }
    
    return arr;
  }

  if (name === "uriel") {
    // Palabra URIEL en 3D (corregida orientación vertical)
    const letterWidth = 0.4;
    const letterHeight = 0.8;
    const spacing = 0.6;
    
    // Calcular posición inicial para centrar "URIEL"
    const totalWidth = spacing * 4;
    const startX = totalWidth * 0.5;
    
    const pointsPerLetter = Math.floor(count / 5);
    let currentIndex = 0;
    
    // Función para crear puntos en una línea (Y invertido para orientación correcta)
    function addLine3D(x1, y1, z1, x2, y2, z2, numPoints) {
      for (let i = 0; i < numPoints && currentIndex < count; i++, currentIndex++) {
        const t = i / Math.max(1, numPoints - 1);
        const x = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 0.08;
        const y = -(y1 + (y2 - y1) * t) + (Math.random() - 0.5) * 0.08; // Y invertido
        const z = z1 + (z2 - z1) * t + (Math.random() - 0.5) * 0.1;
        
        arr[currentIndex * 3 + 0] = x;
        arr[currentIndex * 3 + 1] = y;
        arr[currentIndex * 3 + 2] = z;
      }
    }
    
    // Letra U (primera letra)
    const uX = startX - spacing * 4;
    const uY = -letterHeight * 0.5;
    addLine3D(uX, uY, 0, uX, uY + letterHeight, 0, pointsPerLetter * 0.4);
    addLine3D(uX, uY + letterHeight, 0, uX + letterWidth, uY + letterHeight, 0, pointsPerLetter * 0.2);
    addLine3D(uX + letterWidth, uY + letterHeight, 0, uX + letterWidth, uY, 0, pointsPerLetter * 0.4);
    
    // Letra R (segunda letra)
    const rX = startX - spacing * 3;
    const rY = uY;
    addLine3D(rX, rY + letterHeight, 0, rX, rY, 0, pointsPerLetter * 0.25);
    addLine3D(rX, rY, 0, rX + letterWidth * 0.7, rY, 0, pointsPerLetter * 0.2);
    addLine3D(rX + letterWidth * 0.7, rY, 0, rX + letterWidth * 0.7, rY + letterHeight * 0.5, 0, pointsPerLetter * 0.15);
    addLine3D(rX + letterWidth * 0.7, rY + letterHeight * 0.5, 0, rX, rY + letterHeight * 0.5, 0, pointsPerLetter * 0.2);
    addLine3D(rX + letterWidth * 0.3, rY + letterHeight * 0.5, 0, rX + letterWidth * 0.8, rY + letterHeight, 0, pointsPerLetter * 0.2);
    
    // Letra I (tercera letra)
    const iX = startX - spacing * 2;
    const iY = uY;
    addLine3D(iX + letterWidth * 0.2, iY, 0, iX + letterWidth * 0.8, iY, 0, pointsPerLetter * 0.3);
    addLine3D(iX + letterWidth * 0.5, iY, 0, iX + letterWidth * 0.5, iY + letterHeight, 0, pointsPerLetter * 0.4);
    addLine3D(iX + letterWidth * 0.2, iY + letterHeight, 0, iX + letterWidth * 0.8, iY + letterHeight, 0, pointsPerLetter * 0.3);
    
    // Letra E (cuarta letra)
    const eX = startX - spacing;
    const eY = uY;
    addLine3D(eX, eY + letterHeight, 0, eX, eY, 0, pointsPerLetter * 0.3);
    addLine3D(eX, eY, 0, eX + letterWidth * 0.8, eY, 0, pointsPerLetter * 0.25);
    addLine3D(eX, eY + letterHeight * 0.5, 0, eX + letterWidth * 0.6, eY + letterHeight * 0.5, 0, pointsPerLetter * 0.2);
    addLine3D(eX, eY + letterHeight, 0, eX + letterWidth * 0.8, eY + letterHeight, 0, pointsPerLetter * 0.25);
    
    // Letra L (quinta letra)
    const lX = startX;
    const lY = uY;
    addLine3D(lX, lY, 0, lX, lY + letterHeight, 0, pointsPerLetter * 0.6);
    addLine3D(lX, lY + letterHeight, 0, lX + letterWidth * 0.7, lY + letterHeight, 0, pointsPerLetter * 0.4);
    
    return arr;
  }

  // Fallback: esfera
  for (let i = 0; i < count; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const r = 2.0 * Math.cbrt(Math.random());
    arr[i * 3 + 0] = r * Math.sin(ph) * Math.cos(th);
    arr[i * 3 + 1] = r * Math.cos(ph);
    arr[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  return arr;
}

// Inicializa plantilla base/target
function setShape(name) {
  targetTemplate = generateTemplate(name, COUNT);
}
baseTemplate = generateTemplate(shapeSelect.value, COUNT);
targetTemplate = baseTemplate.slice();

// ─────────────────────────────────────────────────────────────
// Hand tracking (MediaPipe)
// ─────────────────────────────────────────────────────────────
let gestureOpen = 0.0;     // 0..1 (cerrado..abierto)
let gestureOpenSm = 0.0;   // suavizado
let handOffset = new THREE.Vector3(0, 0, 0);
let handOffsetSm = new THREE.Vector3(0, 0, 0);

let hasHand = false;

// Función para dibujar los puntos de la mano en el canvas de depuración
function drawHandLandmarks(landmarks) {
  handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  
  if (!landmarks || landmarks.length === 0) {
    landmarkCount.textContent = "0";
    thumbCoords.textContent = "—";
    indexCoords.textContent = "—";
    pinchDistance.textContent = "—";
    return;
  }

  const width = handCanvas.width;
  const height = handCanvas.height;
  
  landmarkCount.textContent = landmarks.length.toString();

  // Dibujar conexiones de la mano
  handCtx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  handCtx.lineWidth = 1;
  
  // Conexiones básicas de la mano (simplificadas)
  const connections = [
    [0, 1, 2, 3, 4], // Pulgar
    [0, 5, 6, 7, 8], // Índice
    [0, 9, 10, 11, 12], // Medio
    [0, 13, 14, 15, 16], // Anular
    [0, 17, 18, 19, 20] // Meñique
  ];
  
  connections.forEach(finger => {
    handCtx.beginPath();
    for (let i = 0; i < finger.length - 1; i++) {
      const start = landmarks[finger[i]];
      const end = landmarks[finger[i + 1]];
      
      if (i === 0) {
        handCtx.moveTo(start.x * width, start.y * height);
      }
      handCtx.lineTo(end.x * width, end.y * height);
    }
    handCtx.stroke();
  });

  // Dibujar todos los puntos
  landmarks.forEach((landmark, index) => {
    const x = landmark.x * width;
    const y = landmark.y * height;
    
    handCtx.beginPath();
    handCtx.arc(x, y, 3, 0, 2 * Math.PI);
    
    // Colorear puntos importantes
    if (index === 4) {
      handCtx.fillStyle = "#ff6b6b"; // Pulgar - rojo
    } else if (index === 8) {
      handCtx.fillStyle = "#4ecdc4"; // Índice - cyan
    } else if (index === 0) {
      handCtx.fillStyle = "#45b7d1"; // Muñeca - azul
    } else {
      handCtx.fillStyle = "rgba(255, 255, 255, 0.6)";
    }
    
    handCtx.fill();
    
    // Numbers removed per user request
  });
  
  // Actualizar información de coordenadas
  if (landmarks[4] && landmarks[8]) {
    const thumb = landmarks[4];
    const index = landmarks[8];
    
    thumbCoords.textContent = `${thumb.x.toFixed(3)}, ${thumb.y.toFixed(3)}`;
    indexCoords.textContent = `${index.x.toFixed(3)}, ${index.y.toFixed(3)}`;
    
    const dx = thumb.x - index.x;
    const dy = thumb.y - index.y;
    const distance = Math.hypot(dx, dy);
    pinchDistance.textContent = distance.toFixed(3);
  }
}

async function initHands() {
  try {
    // Solicita cámara
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    videoEl.srcObject = stream;

    camStatus.textContent = "Cámara: activa";
    camStatus.classList.remove("pill--warn");
    camStatus.classList.add("pill--ok");

    const hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.6
    });

    hands.onResults(onHandResults);

    const cam = new window.Camera(videoEl, {
      onFrame: async () => {
        await hands.send({ image: videoEl });
      },
      width: 640,
      height: 480
    });
    cam.start();
  } catch (err) {
    console.error(err);
    camStatus.textContent = "Cámara: bloqueada / sin permiso";
    camStatus.classList.add("pill--warn");
  }
}

function onHandResults(results) {
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    hasHand = false;
    handStatus.textContent = "Mano: no detectada";
    drawHandLandmarks([]); // Limpiar el canvas de depuración
    return;
  }
  hasHand = true;

  const lm = results.multiHandLandmarks[0];
  
  // Dibujar los landmarks en el panel de depuración
  drawHandLandmarks(lm);

  // Landmarks importantes:
  // 4: pulgar tip, 8: índice tip, 0: muñeca, 9: middle_mcp (base)
  const thumbTip = lm[4];
  const indexTip = lm[8];
  const wrist = lm[0];
  const midMcp = lm[9];

  const dx = thumbTip.x - indexTip.x;
  const dy = thumbTip.y - indexTip.y;
  const pinchDist = Math.hypot(dx, dy);

  // Normaliza con referencia de tamaño de mano (muñeca->middle_mcp)
  const refDx = wrist.x - midMcp.x;
  const refDy = wrist.y - midMcp.y;
  const ref = Math.max(0.02, Math.hypot(refDx, refDy));

  const sens = parseFloat(senseRange.value);
  // Para la mayoría: pinch cerrado ~0.15*ref, abierto ~0.55*ref (aprox)
  const closed = 0.18 * sens;
  const open = 0.58 * sens;
  const norm = clamp((pinchDist / ref - closed) / (open - closed), 0, 1);

  gestureOpen = norm;

  // Posición de mano (centro aproximado: muñeca)
  // Coordenadas MediaPipe: 0..1 (x,y) con origen arriba-izq
  // Convertimos a un offset suave en mundo con mayor rango
  const hx = (wrist.x - 0.5) * 4.0;     // -2.0..2.0 aprox (mayor rango)
  const hy = (0.5 - wrist.y) * 3.0;     // -1.5..1.5 aprox (mayor rango)
  const hz = 0; // Por ahora sin movimiento en Z desde MediaPipe
  handOffset.set(hx, hy, hz);

  handStatus.textContent = `Mano: ${Math.round(gestureOpen * 100)}% abierta`;
}

// ─────────────────────────────────────────────────────────────
// Animación + morph + expansión por gesto
// ─────────────────────────────────────────────────────────────
let t = 0;
let morph = 0; // 0..1 hacia target
let currentShape = shapeSelect.value;

function rebuild(count) {
  COUNT = count;

  positions = new Float32Array(COUNT * 3);
  baseTemplate = generateTemplate(currentShape, COUNT);
  targetTemplate = baseTemplate.slice();

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
}

function requestShape(name) {
  currentShape = name;
  const newTarget = generateTemplate(name, COUNT);

  // Arranca morph desde el estado actual "baseTemplate"
  // Tomamos como base lo que estaba siendo mostrado (aprox: mezcla base/target actual)
  // Para simplificar: fijamos baseTemplate como "la última target" y movemos a nueva target.
  baseTemplate = targetTemplate.slice();
  targetTemplate = newTarget;
  morph = 0;
}

shapeSelect.addEventListener("change", (e) => {
  requestShape(e.target.value);
});

colorPicker.addEventListener("input", (e) => {
  material.color = hexToColor(e.target.value);
});

countRange.addEventListener("input", () => {
  countLabel.textContent = countRange.value;
});

countRange.addEventListener("change", () => {
  rebuild(parseInt(countRange.value, 10));
});

senseRange.addEventListener("input", () => {
  senseLabel.textContent = senseRange.value;
});

smoothRange.addEventListener("input", () => {
  smoothLabel.textContent = smoothRange.value;
});

btnFullscreen.addEventListener("click", async () => {
  const el = document.documentElement;
  try {
    if (!document.fullscreenElement) await el.requestFullscreen();
    else await document.exitFullscreen();
  } catch {}
});

// Toggle del panel de depuración
toggleDebugBtn.addEventListener("click", () => {
  handDebugPanel.classList.toggle("hidden");
});

// Toggle del menú principal
function toggleMainMenu() {
  uiPanel.classList.toggle("hidden");
  floatingToggle.classList.toggle("visible");
}

btnToggleMenu.addEventListener("click", toggleMainMenu);
floatingToggle.addEventListener("click", toggleMainMenu);

// Resize
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// Loop
function animate() {
  requestAnimationFrame(animate);
  t += 0.016;

  if (controls) controls.update();

  // Suavizado del gesto (EMA)
  const smooth = parseFloat(smoothRange.value);
  gestureOpenSm = lerp(gestureOpenSm, gestureOpen, smooth);

  // Suavizado del offset de mano
  handOffsetSm.lerp(handOffset, smooth);

  // Expansión por gesto (cerrado->contraído, abierto->expandido)
  const expansion = lerp(0.75, 3.15, gestureOpenSm);
  points.scale.setScalar(lerp(0.95, 1.25, gestureOpenSm)); // escala general

  // Morph entre formas (suave)
  morph = clamp(morph + 0.02, 0, 1);
  const morphEase = morph * morph * (3 - 2 * morph); // smoothstep

  const posAttr = geometry.getAttribute("position");
  const p = posAttr.array;

  // Micro movimiento "vivo"
  const wobbleAmp = lerp(0.012, 0.045, gestureOpenSm);
  
  // Sensibilidad de movimiento de mano (independiente del gesto)
  const baseDrift = parseFloat(senseRange.value) * 0.167; // Sensibilidad base del slider
  const drift = baseDrift; // Movimiento independiente del gesto

  for (let i = 0; i < COUNT; i++) {
    const ix = i * 3;

    // Interpola plantilla
    const bx = baseTemplate[ix + 0];
    const by = baseTemplate[ix + 1];
    const bz = baseTemplate[ix + 2];

    const tx = targetTemplate[ix + 0];
    const ty = targetTemplate[ix + 1];
    const tz = targetTemplate[ix + 2];

    let x = lerp(bx, tx, morphEase);
    let y = lerp(by, ty, morphEase);
    let z = lerp(bz, tz, morphEase);

    // Expansión radial
    x *= expansion;
    y *= expansion;
    z *= expansion;

    // Ruido suave (barato) por índice
    const n = hash11(i);
    const phase = t * (0.7 + n * 1.8);

    x += Math.sin(phase + n * 10.0) * wobbleAmp;
    y += Math.cos(phase * 1.13 + n * 6.0) * wobbleAmp;
    z += Math.sin(phase * 0.93 + n * 3.0) * wobbleAmp;

    // Desplazamiento por mano (ahora independiente del gesto)
    const handPower = hasHand ? 1.2 : 0.0; // Más fuerte cuando hay mano detectada
    x += handOffsetSm.x * drift * handPower;
    y += handOffsetSm.y * drift * handPower;
    z += handOffsetSm.z * drift * handPower; // Agregar movimiento en Z también

    p[ix + 0] = x;
    p[ix + 1] = y;
    p[ix + 2] = z;
  }

  posAttr.needsUpdate = true;

  // Rotación suave global
  points.rotation.y += 0.0022;
  points.rotation.x = Math.sin(t * 0.25) * 0.08;

  // Dust parallax
  dust.rotation.y -= 0.0007;

  renderer.render(scene, camera);
}

initHands();
animate();