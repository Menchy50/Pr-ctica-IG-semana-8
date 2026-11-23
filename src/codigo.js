import * as THREE from "three";
import * as TWEEN from "@tweenjs/tween.js";
import AmmoLib from "ammojs-typed";

let scene, renderer, camera;
let Ammo, physicsWorld, transformAux1;
let objetos = [];
let rectangulos = [];
let circulo;
let ultimoPaso = -1;
let clock = new THREE.Clock();

AmmoLib().then(function (AmmoCargado) {
  Ammo = AmmoCargado;

  initPhysics();
  init();
  animationLoop();
});

function initPhysics() {
  const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();

  physicsWorld = new Ammo.btDiscreteDynamicsWorld(
    dispatcher,
    broadphase,
    solver,
    collisionConfiguration
  );
  physicsWorld.setGravity(new Ammo.btVector3(0, -9.8, 0));
  transformAux1 = new Ammo.btTransform();
}

function init() {
  scene = new THREE.Scene();

  const luzAmbiental = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(luzAmbiental);

  const luzDireccional = new THREE.DirectionalLight(0xffffff, 1);
  luzDireccional.position.set(10, 20, 10);
  scene.add(luzDireccional);
  
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(5, 7, 15);
  camera.lookAt(6, 0, -4);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  rectangulos.push(Cubo(13.0, 0.5, -3.5, 4, 1, 2, 0, -180, 0, 0));
  rectangulos.push(Cubo(12.0, 0.5,  0.0, 4, 1, 2, 0, -210, 0, 0));
  rectangulos.push(Cubo(9.0,  0.5,  2.5, 4, 1, 2, 0, -240, 0, 0));
  rectangulos.push(Cubo(5.5,  0.5,  3.0, 4, 1, 2, 0, -270, 0, 0));
  rectangulos.push(Cubo(2.5,  0.5,  2.0, 4, 1, 2, 0, -300, 0, 0));
  rectangulos.push(Cubo(0.0,  0.5,  0.0, 4, 1, 2, 0,   30, 0, 0));
  rectangulos.push(Cubo(-1.0, 0.5, -4.0, 4, 1, 2, 0,    0, 0, 0));
  rectangulos.push(Cubo(0.0,  0.5, -8.0, 4, 1, 2, 0,  -30, 0, 0));
  rectangulos.push(Cubo(3.0,  0.5, -11.0,4, 1, 2, 0,  -60, 0, 0));
  rectangulos.push(Cubo(6.5,  0.5, -11.5,4, 1, 2, 0,  -90, 0, 0));
  rectangulos.push(Cubo(10.0, 0.5, -10.0,4, 1, 2, 0, -120, 0, 0));
  rectangulos.push(Cubo(12.5, 0.5, -7.0, 4, 1, 2, 0, -150, 0, 0));

  circulo = Circulo(13.3, 2.5, -3.5, 1.5, 16, 16, 0xffaa00, 0);

  circulo.userData.centroX = 6.0;
  circulo.userData.centroZ = -4.0;
  circulo.userData.radioAnillo = 7.0;
  circulo.userData.speed = 0.0005;
  circulo.userData.alturaBase = 2.5;
  circulo.userData.alturaSalto = 3.5;
}

function Cubo(px, py, pz, sx, sy, sz, rx = 0, ry = 0, rz = 0, masa = 0) {
  let geometry = new THREE.BoxGeometry(sx, sy, sz);
  let material = new THREE.MeshNormalMaterial();
  let mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(px, py, pz);
  mesh.rotation.set(
    THREE.MathUtils.degToRad(rx),
    THREE.MathUtils.degToRad(ry),
    THREE.MathUtils.degToRad(rz)
  );
  scene.add(mesh);

  let transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(px, py, pz));
  transform.setRotation(
    new Ammo.btQuaternion(
      mesh.quaternion.x,
      mesh.quaternion.y,
      mesh.quaternion.z,
      mesh.quaternion.w
    )
  );

  let motionState = new Ammo.btDefaultMotionState(transform);
  let colShape = new Ammo.btBoxShape(
    new Ammo.btVector3(sx * 0.5, sy * 0.5, sz * 0.5)
  );

  let localInertia = new Ammo.btVector3(0, 0, 0);
  if (masa > 0) {
    colShape.calculateLocalInertia(masa, localInertia);
  }

  let rbInfo = new Ammo.btRigidBodyConstructionInfo(
    masa,
    motionState,
    colShape,
    localInertia
  );
  let body = new Ammo.btRigidBody(rbInfo);

  physicsWorld.addRigidBody(body);

  mesh.userData.physicsBody = body;

  mesh.userData.posInicial = { x: px, y: py, z: pz };
  mesh.userData.rotInicial = {
    x: mesh.quaternion.x,
    y: mesh.quaternion.y,
    z: mesh.quaternion.z,
    w: mesh.quaternion.w,
  };
  mesh.userData.cayendo = false;
  mesh.userData.subiendo = false;

  objetos.push(mesh);

  return mesh;
}

function Circulo(px, py, pz, radio, nx, ny, col, masa = 1) {
  let geometry = new THREE.SphereGeometry(radio, nx, ny);
  let material = new THREE.MeshStandardMaterial({
    color: col,
  });

  let mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(px, py, pz);
  scene.add(mesh);

  let transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(px, py, pz));
  transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));

  let motionState = new Ammo.btDefaultMotionState(transform);
  let colShape = new Ammo.btSphereShape(radio);

  let localInertia = new Ammo.btVector3(0, 0, 0);
  if (masa > 0) {
    colShape.calculateLocalInertia(masa, localInertia);
  }

  let rbInfo = new Ammo.btRigidBodyConstructionInfo(
    masa,
    motionState,
    colShape,
    localInertia
  );
  let body = new Ammo.btRigidBody(rbInfo);

  physicsWorld.addRigidBody(body);

  mesh.userData.physicsBody = body;
  objetos.push(mesh);

  return mesh;
}

function soltarRectangulo(mesh) {
  if (!mesh || mesh.userData.cayendo || mesh.userData.subiendo) return;
  mesh.userData.cayendo = true;

  const body = mesh.userData.physicsBody;
  if (!body) return;

  physicsWorld.removeRigidBody(body);

  const masa = 2;
  const localInertia = new Ammo.btVector3(0, 0, 0);
  body.getCollisionShape().calculateLocalInertia(masa, localInertia);

  body.setCollisionFlags(0);
  body.setMassProps(masa, localInertia);
  body.updateInertiaTensor();
  body.clearForces();

  physicsWorld.addRigidBody(body);
  body.activate(true);
}

function soltarRectangulo(mesh) {
  if (!mesh || mesh.userData.cayendo || mesh.userData.subiendo) return;
  mesh.userData.cayendo = true;

  const body = mesh.userData.physicsBody;
  if (!body) return;

  physicsWorld.removeRigidBody(body);

  const masa = 2;
  const localInertia = new Ammo.btVector3(0, 0, 0);
  body.getCollisionShape().calculateLocalInertia(masa, localInertia);

  body.setCollisionFlags(0);
  body.setMassProps(masa, localInertia);
  body.updateInertiaTensor();

  physicsWorld.addRigidBody(body);
  body.activate(true);
}

function subirRectangulo(mesh) {
  if (!mesh || !mesh.userData.cayendo || mesh.userData.subiendo) return;

  mesh.userData.cayendo = false;
  mesh.userData.subiendo = true;

  const body = mesh.userData.physicsBody;
  if (body) {
    physicsWorld.removeRigidBody(body);

    const zero = new Ammo.btVector3(0, 0, 0);
    body.setLinearVelocity(zero);
    body.setAngularVelocity(zero);
    body.setMassProps(0, zero);
    body.setCollisionFlags(1);

    physicsWorld.addRigidBody(body);
  }

  mesh.quaternion.set(
    mesh.userData.rotInicial.x,
    mesh.userData.rotInicial.y,
    mesh.userData.rotInicial.z,
    mesh.userData.rotInicial.w
  );

  const alturaInicio = Math.max(mesh.position.y, -30);
  mesh.position.y = alturaInicio;

  const posActual = {
    x: mesh.position.x,
    y: alturaInicio,
    z: mesh.position.z,
  };
  const destino = mesh.userData.posInicial;

  new TWEEN.Tween(posActual)
    .to({ x: destino.x, y: destino.y, z: destino.z }, 2000)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onUpdate(() => {
      mesh.position.set(posActual.x, posActual.y, posActual.z);

      if (body) {
        let transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(
          new Ammo.btVector3(posActual.x, posActual.y, posActual.z)
        );
        transform.setRotation(
          new Ammo.btQuaternion(
            mesh.quaternion.x,
            mesh.quaternion.y,
            mesh.quaternion.z,
            mesh.quaternion.w
          )
        );
        body.setWorldTransform(transform);
        body.getMotionState().setWorldTransform(transform);
      }
    })
    .onComplete(() => {
      mesh.userData.subiendo = false;
    })
    .start();
}

function animationLoop(timestamp) {
  requestAnimationFrame(animationLoop);

  const deltaTime = clock.getDelta();

  if (circulo && timestamp) {
    const segundos = timestamp * 0.001;
    const tiempoSalto = 0.6;
    const tiempoPausa = 0.7;
    const duracionCiclo = tiempoSalto + tiempoPausa;

    const pasoActual = Math.floor(segundos / duracionCiclo);

    if (pasoActual !== ultimoPaso) {
      ultimoPaso = pasoActual;

      circulo.material.color.setHex(Math.random() * 0xffffff);
    }
    const tiempoEnCiclo = segundos % duracionCiclo;
    const progresoSalto = Math.min(tiempoEnCiclo / tiempoSalto, 1.0);

    const indiceActual = pasoActual % rectangulos.length;

    if (progresoSalto > 0.25) {
      soltarRectangulo(rectangulos[indiceActual]);
    }

    if (pasoActual >= 6) {
      const indiceAtras = (indiceActual - 6 + rectangulos.length) % rectangulos.length;
      subirRectangulo(rectangulos[indiceAtras]);
    }

    const pasoAngular = (Math.PI * 2) / 12;
    const angulo = (pasoActual + progresoSalto) * pasoAngular;

    circulo.position.x =
      circulo.userData.centroX + Math.cos(angulo) * circulo.userData.radioAnillo;
    circulo.position.z =
      circulo.userData.centroZ + Math.sin(angulo) * circulo.userData.radioAnillo;

    const bote = Math.sin(progresoSalto * Math.PI) * circulo.userData.alturaSalto;
    circulo.position.y = circulo.userData.alturaBase + bote;
  }

  if (physicsWorld) {
    physicsWorld.stepSimulation(deltaTime, 10);

    for (let rect of rectangulos) {
      if (rect.userData.cayendo && rect.userData.physicsBody) {
        let ms = rect.userData.physicsBody.getMotionState();
        if (ms) {
          ms.getWorldTransform(transformAux1);
          let p = transformAux1.getOrigin();
          let q = transformAux1.getRotation();
          rect.position.set(p.x(), p.y(), p.z());
          rect.quaternion.set(q.x(), q.y(), q.z(), q.w());
        }
      }
    }
  }

  TWEEN.update();
  renderer.render(scene, camera);
}
