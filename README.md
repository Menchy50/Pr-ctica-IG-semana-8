# Práctica: Visualizador 3D de Rutas Marítimas y Ferrís en España con Three.js

**Autor:** Mencey Montesdeoca Álamo
**Asignatura:** Informática Gráfica

## Descripción

Este repositorio contiene el desarrollo de un visualizador 3D interactivo de rutas marítimas y tráfico de ferris en España, Portugal, el Estrecho de Gibraltar y las Islas Canarias, implementado íntegramente en JavaScript utilizando la librería **Three.js** y ejecutado en un entorno web interactivo (CodeSandbox). El proyecto integra la proyección cartográfica de coordenadas reales sobre un mapamundi equirectangular, la lectura y depuración de datos geográficos en formato CSV, el modelado procedural en 3D de barcos navegando a velocidad uniforme, filtros antiaglomeración para estuarios y un sistema dual de cámara entre la vista cenital del mapa y la perspectiva en primera persona a bordo de cualquier embarcación.

## Tareas Desarrolladas

### Tarea 1: Mapa Mundial Equirectangular, Proyección de Coordenadas y Navegación

* **Descripción:** Configuración base del entorno gráfico WebGL, carga de la textura global terrestre, conversión de coordenadas geográficas a espacio tridimensional y habilitación del desplazamiento libre sobre el mapa.

* **Metodología y Funcionamiento:**

  * Se configuró una `PerspectiveCamera` posicionada perpendicularmente al plano `$XY$` desde el eje `$+Z$` (`$z = 5$`, con un plano cercano reducido a `$0.005$` para permitir acercamientos profundos sobre las islas) junto a un `WebGLRenderer` con `antialias: true`.

  * Tras comprobar la distorsión vertical de recortes regionales en proyección Web Mercator, se optó por una textura global equirectangular (`earth.png`) configurada con `THREE.SRGBColorSpace` y ajustada mediante la función `Plano` respetando su relación de aspecto real (`scale` en `4`).

  * Se implementó la función `latLonToPlano` para transformar pares de latitud `$[-90^\circ, 90^\circ]$` y longitud `$[-180^\circ, 180^\circ]$` en posiciones centradas en `$(0, 0)$`, validando su precisión mediante marcadores esféricos de prueba (`ponerPunto`) situados sobre Gran Canaria (`$27.96^\circ$`, `$-15.58^\circ$`).

  * Se personalizó `OrbitControls` activando `screenSpacePanning` e inercia (`enableDamping`), asignando el clic izquierdo al arrastre lateral (`PAN`), la rueda al zoom (`DOLLY`) y el clic derecho a la rotación 3D (`ROTATE`).

* **Resultado:**
  ![Mapa mundial](SistemaPlanetario.png)
  

### Tarea 2: Lectura de Datos CSV, Rutas de España y Control de Aglomeración

* **Descripción:** Procesamiento asíncrono de trayectos marítimos reales desde `rutas_ferry.csv`, ampliación del conjunto de datos con rutas en Canarias y la Península, y filtrado inteligente para evitar solapamientos en puertos y ríos.

* **Metodología y Funcionamiento:**

  * Se programaron las funciones `cargarRutas` y `procesarTextoCSV` para soportar tanto lectura directa de módulos como peticiones `fetch`, parseando identificadores, nombres y coordenadas de rutas de 3 o 4 columnas.

  * Se integraron rutas marítimas extraídas de OpenStreetMap (`route=ferry` mediante Overpass Turbo) junto con `$12$` rutas interinsulares en las Islas Canarias (`can_1` a `can_12`) y `$8$` trayectos atlánticos de ida y vuelta entre Cádiz y Huelva y los puertos canarios (`pen_1` a `pen_8`), incorporando puntos intermedios en mar abierto para bordear cabos y costas.

  * Las trayectorias se renderizaron sobre el mapa mediante `THREE.BufferGeometry().setFromPoints` y `THREE.Line`, aplicando `polygonOffset` en el material del mapa base para evitar artefactos de superposición.

  * Para resolver la aglomeración en estuarios cortos (como Lisboa) y evitar embarcaciones en zonas fluviales interiores, se implementaron filtros por longitud mínima (`LONGITUD_MINIMA`), detección de trayectos duplicados o de sentido inverso (`TOLERANCIA_DUPLICADO`), lista de exclusión (`RUTAS_EXCLUIDAS`) y límite de barcos locales dentro de un radio geográfico (`UMBRAL_RUTA_CORTA`, `RADIO_ZONA`).

* **Resultado:**
  Está en el archivo rutas_ferry.csv
  

### Tarea 3: Modelado 3D de Ferrís y Animación a Velocidad Uniforme

* **Descripción:** Creación procedural de un modelo tridimensional de ferry con primitivas de Three.js y programación de un sistema de navegación que mantiene la misma velocidad lineal en todas las rutas.

* **Metodología y Funcionamiento:**

  * Se diseñó la función `crearModeloBarcoBase` agrupando en un `THREE.Group` un casco curvado extruido (`ExtrudeGeometry` con biselado), cabina blanca y puente de mando (`BoxGeometry`), cristales frontales y chimenea cilíndrica (`CylinderGeometry`), iluminados mediante `AmbientLight` y `DirectionalLight`.

  * Para evitar que rutas cortas y transatlánticas tardasen lo mismo, se precalculó la distancia acumulada por tramos y la longitud total de cada trayectoria; en `actualizarBarcos`, todos los barcos avanzan a una tasa fija (`VELOCIDAD_BARCOS`) sincronizada con `THREE.Clock` e interpolan su posición con `lerpVectors`.

  * Se asignó una distancia inicial aleatoria para repartir los ferris a lo largo de las rutas, calculando su orientación mediante `$\text{atan2}(\Delta y, \Delta x)$` con suavizado angular en los vértices y escala dinámica adaptada a la distancia de la cámara (`THREE.MathUtils.clamp`).

* **Resultado:**
  ![Modelo 3D Barco](SistemaPlanetario.png)
  

### Tarea 4: Selección con Raycaster y Modos de Cámara ("Vista Mapa Eje Z" y "A Bordo")

* **Descripción:** Desarrollo de una interfaz HTML interactiva y un sistema de cámaras dinámico para alternar entre la vista panorámica desde el eje `$+Z$` y la perspectiva en primera persona desde el puente del barco.

* **Metodología y Funcionamiento:**

  * Se construyó un panel flotante HTML (`crearUI`) con selector desplegable de rutas activas, botón de salto rápido (*Siguiente barco*) y botón de retorno al mapa, aislando sus pulsaciones del canvas mediante `stopPropagation()`.

  * Se implementó detección de clics en 3D con `THREE.Raycaster` evaluando `pointerdown` y `pointerup` con un umbral de `$5$` píxeles para distinguir un clic sobre un ferry de un arrastre de cámara.

  * Se estructuraron dos modos de cámara controlables desde la interfaz o mediante las teclas `Z` y `Esc`:

    * **Vista Mapa (Eje `$Z$`):** Restablece `camera.up` a `$(0, 1, 0)$`, coloca la cámara en `$(0, 0, 5)$` enfocando al centro del mapa y reactiva `OrbitControls`.

    * **Vista a Bordo (Percepción del Barco):** Desactiva `OrbitControls`, alinea `camera.up` con `$(0, 0, 1)$`, reduce `camera.near` a `$0.00005$` para evitar recortes sobre la proa y actualiza `camera.position` y `camera.lookAt` sobre el puente siguiendo el rumbo del ferry elegido.

* **Resultado:**
  ![Vista desde el barco](SistemaPlanetario.png)
  ![Vista general](SistemaPlanetario.png)
  

### Fuentes consultadas

Textura equirectangular terrestre (`earth.png`): https://gis.humboldt.edu/Archive/GISData/2019/WGS84_Geographic/3DTextures

Consulta y exportación de rutas marítimas (`route=ferry`) en OpenStreetMap: https://overpass-turbo.eu/ y https://www.openstreetmap.org/

Documentación oficial de Three.js (`OrbitControls`, `ExtrudeGeometry`, `Raycaster`, `BufferGeometry`): https://threejs.org/docs/

Gestión de eventos del navegador y carga de datos con Fetch API: https://developer.mozilla.org/es/docs/Web/API/EventTarget/addEventListener y https://developer.mozilla.org/es/docs/Web/API/Fetch_API
