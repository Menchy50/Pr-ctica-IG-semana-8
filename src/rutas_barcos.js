import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import earthImg from "./earth.png";
import rutasCsvUrl from "./rutas_ferry.csv";

let scene, renderer, camera;
let camcontrols1;
let mapsx,
  mapsy,
  scale = 4;
let ferryMap = {};

const clock = new THREE.Clock();
let barcos = [];
const VELOCIDAD_BARCOS = 0.005;
const LONGITUD_MINIMA = 0.0015; 
const UMBRAL_RUTA_CORTA = 0.006;
const RADIO_ZONA = 0.015;
const MAX_BARCOS_CORTOS_ZONA = 1;
const TOLERANCIA_DUPLICADO = 0.002;

const BARCO_Z = 0.001;
const ESCALA_VISTA_BARCO = 0.002;

let barcoSeguido = null;
const raycaster = new THREE.Raycaster();
const pointerDownPos = { x: 0, y: 0 };
let uiSelectBarco, uiEstadoTexto;

init();
animate();

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    200
  );
  camera.position.set(0, 0, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.display = "block";
  document.body.appendChild(renderer.domElement);

  camcontrols1 = new OrbitControls(camera, renderer.domElement);
  camcontrols1.enablePan = true;
  camcontrols1.screenSpacePanning = true;
  camcontrols1.mouseButtons = {
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE
  };
  camcontrols1.enableDamping = true;
  camcontrols1.dampingFactor = 0.05;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(5, 5, 10);
  scene.add(dirLight);

  crearUI();
  configurarEventos();

  new THREE.TextureLoader().load(
    earthImg,
    function (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;

      const aspecto = texture.image.width / texture.image.height;
      mapsy = scale;
      mapsx = mapsy * aspecto;

      Plano(0, 0, 0, mapsx, mapsy, texture);
      cargarRutas();
    },
    undefined,
    function (err) {
      console.error("Error cargando earth.png:", err);
    }
  );
}

function crearUI() {
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;top:12px;left:12px;z-index:10;background:rgba(15,23,42,0.85);" +
    "color:#f8fafc;padding:10px 12px;border-radius:8px;font-family:sans-serif;" +
    "font-size:13px;display:flex;flex-direction:column;gap:8px;max-width:300px;" +
    "border:1px solid rgba(255,255,255,0.15);";

  panel.addEventListener("pointerdown", (e) => e.stopPropagation());
  panel.addEventListener("pointerup", (e) => e.stopPropagation());

  uiEstadoTexto = document.createElement("div");
  uiEstadoTexto.textContent = "Vista: Mapa completo";
  uiEstadoTexto.style.fontWeight = "600";

  const filaBotones = document.createElement("div");
  filaBotones.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";

  const btnMapaZ = document.createElement("button");
  btnMapaZ.textContent = "Vista General";
  btnMapaZ.style.cssText =
    "padding:5px 8px;cursor:pointer;border:none;border-radius:4px;" +
    "background:#0ea5e9;color:#fff;font-weight:600;";
  btnMapaZ.addEventListener("click", activarVistaMapaZ);

  const btnSiguiente = document.createElement("button");
  btnSiguiente.textContent = "Siguiente barco";
  btnSiguiente.style.cssText =
    "padding:5px 8px;cursor:pointer;border:none;border-radius:4px;" +
    "background:#f59e0b;color:#111827;font-weight:600;";
  btnSiguiente.addEventListener("click", () => {
    if (barcos.length === 0) return;
    const idxActual = barcoSeguido ? barcos.indexOf(barcoSeguido) : -1;
    const siguiente = barcos[(idxActual + 1) % barcos.length];
    seguirBarco(siguiente);
  });

  uiSelectBarco = document.createElement("select");
  uiSelectBarco.style.cssText =
    "padding:4px 6px;border-radius:4px;border:1px solid #475569;" +
    "background:#1e293b;color:#f8fafc;width:100%;";
  uiSelectBarco.innerHTML = '<option value="">-- Elegir barco / ruta --</option>';
  uiSelectBarco.addEventListener("change", (e) => {
    if (e.target.value === "") {
      activarVistaMapaZ();
    } else {
      const idx = parseInt(e.target.value, 10);
      if (barcos[idx]) seguirBarco(barcos[idx]);
    }
  });

  filaBotones.appendChild(btnMapaZ);
  filaBotones.appendChild(btnSiguiente);
  panel.appendChild(uiEstadoTexto);
  panel.appendChild(uiSelectBarco);
  panel.appendChild(filaBotones);
  document.body.appendChild(panel);
}

function poblarSelectorBarcos() {
  if (!uiSelectBarco) return;
  uiSelectBarco.innerHTML = '<option value="">-- Ver mapa desde vista general --</option>';
  barcos.forEach((barco, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = `${barco.nombre} (${barco.id})`;
    uiSelectBarco.appendChild(opt);
  });
}

function configurarEventos() {
  const dom = renderer.domElement;

  dom.addEventListener("pointerdown", (e) => {
    pointerDownPos.x = e.clientX;
    pointerDownPos.y = e.clientY;
  });

  dom.addEventListener("pointerup", (e) => {
    if (e.button !== 0 || barcos.length === 0) return;

    const dist = Math.hypot(
      e.clientX - pointerDownPos.x,
      e.clientY - pointerDownPos.y
    );
    if (dist > 5) return;

    const rect = dom.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.setFromCamera(mouse, camera);
    const meshes = barcos.map((b) => b.mesh);
    const intersects = raycaster.intersectObjects(meshes, true);

    if (intersects.length > 0) {
      const barcoElegido = intersects[0].object.userData.barco;
      if (barcoElegido) seguirBarco(barcoElegido);
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.key.toLowerCase() === "z") {
      activarVistaMapaZ();
    }
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function seguirBarco(barco) {
  barcoSeguido = barco;
  barco.mesh.scale.setScalar(ESCALA_VISTA_BARCO);

  camcontrols1.enabled = false;
  camera.near = 0.00005;
  camera.far = 30;
  camera.updateProjectionMatrix();

  actualizarCamaraBarco();

  if (uiEstadoTexto) uiEstadoTexto.textContent = `A bordo: ${barco.nombre}`;
  if (uiSelectBarco) uiSelectBarco.value = String(barcos.indexOf(barco));
}

function activarVistaMapaZ() {
  barcoSeguido = null;

  camera.up.set(0, 1, 0);
  camera.near = 0.01;
  camera.far = 200;
  camera.updateProjectionMatrix();

  camera.position.set(0, 0, 5);
  camcontrols1.target.set(0, 0, 0);
  camcontrols1.enabled = true;
  camcontrols1.update();

  if (uiEstadoTexto) uiEstadoTexto.textContent = "Vista: Mapa completo";
  if (uiSelectBarco) uiSelectBarco.value = "";
}

function actualizarCamaraBarco() {
  if (!barcoSeguido) return;

  const s = ESCALA_VISTA_BARCO;
  const pos = barcoSeguido.mesh.position;
  const ang = barcoSeguido.anguloActual;

  const dirX = Math.cos(ang);
  const dirY = Math.sin(ang);

  camera.up.set(0, 0, 1);

  camera.position.set(
    pos.x + dirX * (0.05 * s),
    pos.y + dirY * (0.05 * s),
    pos.z + 0.42 * s
  );

  camera.lookAt(
    pos.x + dirX * (3.5 * s),
    pos.y + dirY * (3.5 * s),
    0
  );
}

function crearModeloBarcoBase() {
  const grupo = new THREE.Group();

  const formaCasco = new THREE.Shape();
  formaCasco.moveTo(-0.45, -0.16);
  formaCasco.lineTo(0.15, -0.16);
  formaCasco.quadraticCurveTo(0.38, -0.12, 0.5, 0);
  formaCasco.quadraticCurveTo(0.38, 0.12, 0.15, 0.16);
  formaCasco.lineTo(-0.45, 0.16);
  formaCasco.closePath();

  const geoCasco = new THREE.ExtrudeGeometry(formaCasco, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2
  });
  const matCasco = new THREE.MeshStandardMaterial({
    color: 0xc1121f,
    roughness: 0.5
  });
  const casco = new THREE.Mesh(geoCasco, matCasco);
  casco.position.z = 0.015;
  grupo.add(casco);

  const matBlanco = new THREE.MeshStandardMaterial({
    color: 0xf8f9fa,
    roughness: 0.4
  });
  const cabina = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.24, 0.11),
    matBlanco
  );
  cabina.position.set(-0.06, 0, 0.205);
  grupo.add(cabina);

  const puente = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.2, 0.08),
    matBlanco
  );
  puente.position.set(0.08, 0, 0.3);
  grupo.add(puente);

  const matCristal = new THREE.MeshStandardMaterial({
    color: 0x1d3557,
    roughness: 0.2
  });
  const cristales = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.205, 0.035),
    matCristal
  );
  cristales.position.set(0.175, 0, 0.305);
  grupo.add(cristales);

  const matChimenea = new THREE.MeshStandardMaterial({
    color: 0xf77f00,
    roughness: 0.5
  });
  const chimenea = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.042, 0.11, 12),
    matChimenea
  );
  chimenea.rotation.x = Math.PI / 2;
  chimenea.position.set(-0.2, 0, 0.315);
  grupo.add(chimenea);

  return grupo;
}

function latLonToPlano(lat, lon, anchoPlano, altoPlano) {
  const pctX = (lon + 180) / 360;
  const pctY = (lat + 90) / 180;

  const x = (pctX - 0.5) * anchoPlano;
  const y = (pctY - 0.5) * altoPlano;

  return new THREE.Vector3(x, y, BARCO_Z);
}

function cargarRutas() {
  const data =
    typeof rutasCsvUrl === "object" && rutasCsvUrl.default
      ? rutasCsvUrl.default
      : rutasCsvUrl;

  if (typeof data === "string" && !data.includes("\n")) {
    fetch(data)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((texto) => procesarTextoCSV(texto))
      .catch((err) => console.error("Error cargando el CSV:", err));
  } else {
    procesarTextoCSV(data);
  }
}

function procesarTextoCSV(data) {
  if (typeof data !== "string") return;

  const lines = data.replace(/\r/g, "").trim().split("\n");
  const filasDatos = lines.slice(1);

  ferryMap = {};

  filasDatos.forEach((linea) => {
    if (!linea.trim()) return;

    const cols = linea.split(",");
    let id_ruta, nombre_ruta, lat, lon;

    if (cols.length >= 4) {
      id_ruta = cols[0].replace(/"/g, "").trim();
      nombre_ruta = cols[1].replace(/"/g, "").trim();
      lat = parseFloat(cols[2].replace(/"/g, "").trim());
      lon = parseFloat(cols[3].replace(/"/g, "").trim());
    } else if (cols.length === 3) {
      id_ruta = cols[0].replace(/"/g, "").trim();
      nombre_ruta = `Ruta ${id_ruta}`;
      lat = parseFloat(cols[1].replace(/"/g, "").trim());
      lon = parseFloat(cols[2].replace(/"/g, "").trim());
    }

    if (
      !isNaN(lat) &&
      !isNaN(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    ) {
      if (!ferryMap[id_ruta]) {
        ferryMap[id_ruta] = {
          nombre: nombre_ruta,
          puntos: []
        };
      }
      ferryMap[id_ruta].puntos.push(latLonToPlano(lat, lon, mapsx, mapsy));
    }
  });

  dibujarRutas(ferryMap);
}

function obtenerCentroRuta(puntos) {
  const centro = new THREE.Vector3();
  puntos.forEach((p) => centro.add(p));
  return centro.divideScalar(puntos.length);
}

function dibujarRutas(mapaRutas) {
  const materialLinea = new THREE.LineBasicMaterial({ color: 0x00ffff });
  const modeloBarcoBase = crearModeloBarcoBase();
  const rutasConBarco = [];

  Object.keys(mapaRutas).forEach((id) => {

    const ruta = mapaRutas[id];
    const puntos = ruta.puntos;
    if (!puntos || puntos.length < 2) return;

    const distancias = [0];
    let longitudTotal = 0;
    for (let i = 0; i < puntos.length - 1; i++) {
      longitudTotal += puntos[i].distanceTo(puntos[i + 1]);
      distancias.push(longitudTotal);
    }

    if (longitudTotal < LONGITUD_MINIMA) return;

    const pInicio = puntos[0];
    const pFin = puntos[puntos.length - 1];
    const centro = obtenerCentroRuta(puntos);
    const esCorta = longitudTotal < UMBRAL_RUTA_CORTA;

    const esDuplicada = rutasConBarco.some((info) => {
      const mismoSentido =
        pInicio.distanceTo(info.inicio) < TOLERANCIA_DUPLICADO &&
        pFin.distanceTo(info.fin) < TOLERANCIA_DUPLICADO;
      const sentidoInverso =
        pInicio.distanceTo(info.fin) < TOLERANCIA_DUPLICADO &&
        pFin.distanceTo(info.inicio) < TOLERANCIA_DUPLICADO;
      return mismoSentido || sentidoInverso;
    });

    if (esDuplicada) return;

    const geometry = new THREE.BufferGeometry().setFromPoints(puntos);
    const linea = new THREE.Line(geometry, materialLinea);
    linea.name = `ruta_${id}`;
    scene.add(linea);

    if (esCorta) {
      const barcosCercanos = rutasConBarco.filter(
        (info) => info.esCorta && info.centro.distanceTo(centro) < RADIO_ZONA
      ).length;

      if (barcosCercanos >= MAX_BARCOS_CORTOS_ZONA) return;
    }

    rutasConBarco.push({
      inicio: pInicio,
      fin: pFin,
      centro: centro,
      esCorta: esCorta
    });

    crearBarcoEnRuta(
      id,
      ruta.nombre,
      puntos,
      distancias,
      longitudTotal,
      modeloBarcoBase
    );
  });

  poblarSelectorBarcos();
}

function obtenerEstadoEnRuta(puntos, distancias, d) {
  let i = 0;
  while (i < distancias.length - 2 && distancias[i + 1] < d) {
    i++;
  }

  const pInicio = puntos[i];
  const pFin = puntos[i + 1];
  const longitudTramo = distancias[i + 1] - distancias[i];
  const t = longitudTramo > 0 ? (d - distancias[i]) / longitudTramo : 0;

  const pos = new THREE.Vector3().lerpVectors(pInicio, pFin, t);
  const dx = pFin.x - pInicio.x;
  const dy = pFin.y - pInicio.y;
  const angulo = dx !== 0 || dy !== 0 ? Math.atan2(dy, dx) : 0;

  return { pos, angulo };
}

function crearBarcoEnRuta(
  id,
  nombre,
  puntos,
  distancias,
  longitudTotal,
  modeloBase
) {
  const distanciaInicial = Math.random() * longitudTotal;
  const { pos, angulo } = obtenerEstadoEnRuta(
    puntos,
    distancias,
    distanciaInicial
  );

  const mesh = modeloBase.clone();
  mesh.position.set(pos.x, pos.y, BARCO_Z);
  mesh.rotation.z = angulo;
  scene.add(mesh);

  const barcoObj = {
    id: id,
    nombre: nombre,
    mesh: mesh,
    puntos: puntos,
    distancias: distancias,
    longitudTotal: longitudTotal,
    distanciaActual: distanciaInicial,
    anguloActual: angulo
  };

  mesh.traverse((child) => {
    child.userData.barco = barcoObj;
  });

  barcos.push(barcoObj);
}

function actualizarBarcos(delta) {
  const dt = Math.min(delta, 0.1);

  let escalaDinamica;
  if (barcoSeguido) {
    escalaDinamica = ESCALA_VISTA_BARCO;
  } else {
    const distanciaCamara = camera.position.distanceTo(camcontrols1.target);
    escalaDinamica = THREE.MathUtils.clamp(
      distanciaCamara * 0.01,
      0.0008,
      0.008
    );
  }

  barcos.forEach((barco) => {
    barco.mesh.scale.setScalar(escalaDinamica);

    const nuevaDist = barco.distanciaActual + VELOCIDAD_BARCOS * dt;
    const dioLaVuelta = nuevaDist >= barco.longitudTotal;
    barco.distanciaActual = dioLaVuelta
      ? nuevaDist % barco.longitudTotal
      : nuevaDist;

    const { pos, angulo } = obtenerEstadoEnRuta(
      barco.puntos,
      barco.distancias,
      barco.distanciaActual
    );

    barco.mesh.position.set(pos.x, pos.y, BARCO_Z);

    if (dioLaVuelta) {
      barco.anguloActual = angulo;
    } else {
      let diff = angulo - barco.anguloActual;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      barco.anguloActual += diff * Math.min(1, dt * 6);
    }

    barco.mesh.rotation.z = barco.anguloActual;
  });
}

function Plano(px, py, pz, sx, sy, txt) {
  const geometry = new THREE.PlaneGeometry(sx, sy, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: txt,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(px, py, pz);
  scene.add(mesh);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  actualizarBarcos(delta);

  if (barcoSeguido) {
    actualizarCamaraBarco();
  } else {
    camcontrols1.update();
  }

  renderer.render(scene, camera);
}
