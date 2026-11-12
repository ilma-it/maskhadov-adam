/**
 * Three.js 3D Viewer for "Умная Теплица" Project
 * Features: 360° Light Rotation & Angle Slider, Studio Environment, Chrome & Glass PBR Shading, Orbit Controls
 */

class SmartGreenhouseViewer {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.container = this.canvas.parentElement;
    this.modelPaths = options.modelPaths || ['3d_teplica.glb', '3d teplica.glb', '3D model.dae'];
    this.currentModelIndex = 0;
    
    // Rotation & Light States
    this.isAutoRotating = true;
    this.isLightRotating = false;
    this.lightAngleDegrees = 45;
    this.lightRadius = 38;
    this.lightHeight = 34;

    this.isWireframe = false;
    this.model = null;
    this.originalMaterials = new Map();
    this.modelRadius = 8;
    this.center = new THREE.Vector3(0, 0, 0);

    // Lifecycle states
    this.isRunning = true;
    this.animationFrameId = null;

    this.onResizeBound = () => this.onResize();
    window.addEventListener('resize', this.onResizeBound);

    this.initScene();
    this.initEnvironment();
    this.initLights();
    this.initControls();
    this.initGrid();
    this.loadNextModel();
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090b0e);
    this.scene.fog = new THREE.FogExp2(0x090b0e, 0.006);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || 720;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    this.camera.position.set(16, 12, 16);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // PBR & Tone mapping configuration
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
  }

  initEnvironment() {
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      pmremGenerator.compileEquirectangularShader();

      const envScene = new THREE.Scene();
      const skyGeo = new THREE.SphereGeometry(100, 32, 16);
      const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec3 dir = normalize(vWorldPosition);
            float y = dir.y;
            vec3 skyColor = vec3(0.76, 0.88, 0.98);
            vec3 horizonColor = vec3(0.96, 0.98, 1.0);
            vec3 groundColor = vec3(0.72, 0.76, 0.64);
            vec3 col = y > 0.0 ? mix(horizonColor, skyColor, pow(y, 0.6)) : mix(horizonColor, groundColor, pow(-y, 0.6));
            gl_FragColor = vec4(col, 1.0);
          }
        `
      });
      const skyMesh = new THREE.Mesh(skyGeo, skyMat);
      envScene.add(skyMesh);

      const envMap = pmremGenerator.fromScene(envScene).texture;
      this.scene.environment = envMap;
      pmremGenerator.dispose();
    } catch (e) {
      console.warn('Environment generation fallback:', e);
    }
  }

  initLights() {
    // 1. Natural daylight ambient
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    // 2. Sky/Ground bounce hemisphere light
    const hemiLight = new THREE.HemisphereLight(0xf4f8ff, 0x3a4235, 0.95);
    hemiLight.position.set(0, 80, 0);
    this.scene.add(hemiLight);

    // 3. Main Rotating Sun/Key Light
    this.dirLight1 = new THREE.DirectionalLight(0xfffbf2, 1.6);
    this.dirLight1.castShadow = true;
    this.dirLight1.shadow.mapSize.width = 2048;
    this.dirLight1.shadow.mapSize.height = 2048;
    this.dirLight1.shadow.camera.near = 0.5;
    this.dirLight1.shadow.camera.far = 180;
    const d = 22;
    this.dirLight1.shadow.camera.left = -d;
    this.dirLight1.shadow.camera.right = d;
    this.dirLight1.shadow.camera.top = d;
    this.dirLight1.shadow.camera.bottom = -d;
    this.dirLight1.shadow.bias = -0.0004;
    this.scene.add(this.dirLight1);

    // 4. Fill light from opposite angle
    this.fillLight = new THREE.DirectionalLight(0xdbe6f2, 0.7);
    this.scene.add(this.fillLight);

    // 5. Front subtle bounce
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.4);
    frontLight.position.set(0, 15, 30);
    this.scene.add(frontLight);

    // Position lights according to initial angle
    this.updateLightPosition(this.lightAngleDegrees);
  }

  updateLightPosition(degrees) {
    this.lightAngleDegrees = degrees;
    const rad = (degrees * Math.PI) / 180;

    // Position key light along 360 circle
    const x = Math.cos(rad) * this.lightRadius;
    const z = Math.sin(rad) * this.lightRadius;
    this.dirLight1.position.set(x, this.lightHeight, z);

    // Position fill light counter to key light
    this.fillLight.position.set(-x * 0.75, this.lightHeight * 0.65, -z * 0.75);

    // Update UI elements
    const slider = document.getElementById('lightAngleSlider');
    const angleText = document.getElementById('lightAngleVal');
    if (slider && document.activeElement !== slider) {
      slider.value = Math.round(degrees);
    }
    if (angleText) {
      angleText.textContent = `${Math.round(degrees)}°`;
    }
  }

  toggleLightRotation() {
    this.isLightRotating = !this.isLightRotating;
    return this.isLightRotating;
  }

  initControls() {
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.01;
    this.controls.minDistance = 1.0;
    this.controls.maxDistance = 300;
    this.controls.autoRotate = this.isAutoRotating;
    this.controls.autoRotateSpeed = 1.2;
  }

  initGrid() {
    const gridHelper = new THREE.GridHelper(60, 60, 0xc7ff56, 0x1f2937);
    gridHelper.position.y = -0.01;
    gridHelper.material.opacity = 0.35;
    gridHelper.material.transparent = true;
    this.scene.add(gridHelper);

    const planeGeo = new THREE.PlaneGeometry(120, 120);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const shadowPlane = new THREE.Mesh(planeGeo, planeMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.02;
    shadowPlane.receiveShadow = true;
    this.scene.add(shadowPlane);
  }

  loadNextModel() {
    if (this.currentModelIndex >= this.modelPaths.length) {
      const statusText = document.getElementById('loadingStatus3d');
      if (statusText) statusText.textContent = 'Ошибка загрузки 3D модели.';
      return;
    }

    const currentPath = this.modelPaths[this.currentModelIndex];
    this.loadModel(currentPath);
  }

  loadModel(modelPath) {
    const loadingOverlay = document.getElementById('loading3d');
    const progressBar = document.getElementById('progressBar3d');
    const statusText = document.getElementById('loadingStatus3d');

    if (statusText) statusText.textContent = 'Загрузка 3D модели...';

    const manager = new THREE.LoadingManager();
    manager.onProgress = (item, loaded, total) => {
      if (!this.isRunning) return;
      const pct = Math.round((loaded / total) * 100);
      if (progressBar) progressBar.style.width = pct + '%';
      if (statusText) statusText.textContent = `Загрузка 3D компонентов: ${pct}%`;
    };

    manager.onLoad = () => {
      if (!this.isRunning) return;
      if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => { 
          if (!this.isRunning) return;
          loadingOverlay.style.display = 'none'; 
        }, 500);
      }
    };

    const isGlb = modelPath.toLowerCase().endsWith('.glb') || modelPath.toLowerCase().endsWith('.gltf');
    const formatName = isGlb ? 'GLB / GLTF 3D' : 'COLLADA .DAE';

    const onModelSuccess = (rootObject) => {
      if (!this.isRunning) return;
      this.model = rootObject;

      let totalPolygons = 0;
      let totalMeshes = 0;

      // 1. Process materials & shadow casting
      this.model.traverse((child) => {
        if (child.isMesh) {
          totalMeshes++;
          if (child.geometry) {
            const count = child.geometry.index ? child.geometry.index.count / 3 : child.geometry.attributes.position.count / 3;
            totalPolygons += Math.round(count);
          }

          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material) {
            this.originalMaterials.set(child, child.material);

            if (Array.isArray(child.material)) {
              child.material.forEach(m => this.tweakMaterial(m));
            } else {
              this.tweakMaterial(child.material);
            }
          }
        }
      });

      // 2. Compute Raw Bounding Box
      const rawBox = new THREE.Box3().setFromObject(this.model);
      const rawSize = new THREE.Vector3();
      rawBox.getSize(rawSize);

      // 3. Auto-normalize scale
      const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
      if (maxDim > 25) {
        const targetDimension = 12.0;
        const scaleFactor = targetDimension / maxDim;
        this.model.scale.set(scaleFactor, scaleFactor, scaleFactor);
      } else if (maxDim < 0.5 && maxDim > 0) {
        const scaleFactor = 8.0 / maxDim;
        this.model.scale.set(scaleFactor, scaleFactor, scaleFactor);
      }

      // 4. Center model and place flush on grid floor
      const scaledBox = new THREE.Box3().setFromObject(this.model);
      const scaledSize = new THREE.Vector3();
      scaledBox.getSize(scaledSize);
      scaledBox.getCenter(this.center);

      this.model.position.x = -this.center.x;
      this.model.position.y = -scaledBox.min.y;
      this.model.position.z = -this.center.z;

      this.scene.add(this.model);

      // 5. Adjust camera to perfectly frame the model
      const finalMaxDim = Math.max(scaledSize.x, scaledSize.y, scaledSize.z);
      this.modelRadius = finalMaxDim > 0 ? finalMaxDim * 0.9 : 8;

      const targetHeight = scaledSize.y * 0.45;
      this.controls.target.set(0, targetHeight, 0);
      this.setCameraPreset('iso');

      // 6. Update HUD stats
      const statsElem = document.getElementById('modelStats');
      if (statsElem) {
        statsElem.innerHTML = `Полигонов: <span>${totalPolygons.toLocaleString()}</span> | Деталей: <span>${totalMeshes}</span> | Формат: <span>${formatName}</span>`;
      }
    };

    const onModelError = (error) => {
      if (!this.isRunning) return;
      console.warn(`Не удалось загрузить ${modelPath}, пробуем следующий вариант...`, error);
      this.currentModelIndex++;
      this.loadNextModel();
    };

    if (isGlb) {
      if (typeof THREE.GLTFLoader === 'undefined') {
        onModelError('GLTFLoader missing');
        return;
      }
      const gltfLoader = new THREE.GLTFLoader(manager);
      gltfLoader.load(
        modelPath,
        (gltf) => onModelSuccess(gltf.scene),
        (xhr) => {
          if (xhr.lengthComputable && progressBar) {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            progressBar.style.width = percent + '%';
            if (statusText) statusText.textContent = `Загрузка 3D модели: ${percent}%`;
          }
        },
        onModelError
      );
    } else {
      if (typeof THREE.ColladaLoader === 'undefined') {
        onModelError('ColladaLoader missing');
        return;
      }
      const daeLoader = new THREE.ColladaLoader(manager);
      daeLoader.setResourcePath('textures/');
      daeLoader.load(
        modelPath,
        (collada) => onModelSuccess(collada.scene),
        (xhr) => {
          if (xhr.lengthComputable && progressBar) {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            progressBar.style.width = percent + '%';
            if (statusText) statusText.textContent = `Загрузка модели: ${percent}%`;
          }
        },
        onModelError
      );
    }
  }

  tweakMaterial(mat) {
    if (!mat) return;
    mat.side = THREE.DoubleSide;
    
    // Clear rogue emissive
    if (mat.emissive) {
      mat.emissive.set(0x000000);
      if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0;
    }

    const name = (mat.name || '').toLowerCase();

    // 1. CHROME / STAINLESS STEEL TANK (Metal_06_1K, Metal_Cladding, etc.)
    if (name.includes('metal_06') || name.includes('metal_cladding') || name.includes('metal') || name.includes('сталь') || name.includes('бак') || name.includes('резервуар')) {
      mat.metalness = 0.92;
      mat.roughness = 0.18;
      if (mat.color) {
        mat.color.setRGB(0.92, 0.94, 0.96);
      }
    } 
    // 2. ULTRA-CLEAR GLASS (Glass_Basic_01)
    else if (name.includes('glass') || name.includes('стекло') || name.includes('window') || name.includes('transp')) {
      mat.transparent = true;
      mat.opacity = 0.24;
      mat.roughness = 0.05;
      mat.metalness = 0.1;
      mat.depthWrite = false;
      if (mat.color) {
        mat.color.setRGB(0.88, 0.94, 0.98);
      }
    }
    // 3. GROUND / EARTH / FOREST FLOOR (Forest_Floor_01_1K)
    else if (name.includes('forest_floor') || name.includes('ground') || name.includes('земля') || name.includes('трава') || name.includes('soil')) {
      mat.roughness = 0.88;
      mat.metalness = 0.0;
      if (mat.color && !mat.map) {
        mat.color.setRGB(0.68, 0.72, 0.54);
      }
    }
    // 4. MARBLE / CONCRETE SLAB (Marble_20_1K, Stone_Frost)
    else if (name.includes('marble') || name.includes('stone') || name.includes('мрамор') || name.includes('бетон') || name.includes('плита')) {
      mat.roughness = 0.45;
      mat.metalness = 0.08;
      if (mat.color && !mat.map) {
        mat.color.setRGB(0.85, 0.87, 0.89);
      }
    }
    // 5. WOOD CHIPS / PLANTERS (Wood_Chips_01_1K)
    else if (name.includes('wood') || name.includes('дерево') || name.includes('chip') || name.includes('грядк') || name.includes('полк')) {
      mat.roughness = 0.85;
      mat.metalness = 0.0;
    }
    // 6. DEFAULT PBR PASS-THROUGH
    else {
      if (mat.roughness !== undefined && mat.roughness < 0.2) mat.roughness = 0.45;
      if (mat.metalness !== undefined && mat.metalness > 0.8 && !name.includes('metal')) mat.metalness = 0.2;
    }
  }

  toggleAutoRotate() {
    this.isAutoRotating = !this.isAutoRotating;
    this.controls.autoRotate = this.isAutoRotating;
    return this.isAutoRotating;
  }

  toggleWireframe() {
    this.isWireframe = !this.isWireframe;
    if (!this.model) return this.isWireframe;

    this.model.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.wireframe = this.isWireframe);
        } else {
          child.material.wireframe = this.isWireframe;
        }
      }
    });
    return this.isWireframe;
  }

  setCameraPreset(preset) {
    const r = this.modelRadius || 8;
    const targetY = this.controls.target.y || 3.0;

    let targetPos = new THREE.Vector3();

    switch (preset) {
      case 'iso':
        targetPos.set(r * 1.35, targetY + r * 0.85, r * 1.35);
        break;
      case 'top':
        targetPos.set(0.001, targetY + r * 2.1, 0.001);
        break;
      case 'front':
        targetPos.set(0, targetY + r * 0.2, r * 1.8);
        break;
      case 'side':
        targetPos.set(r * 1.8, targetY + r * 0.2, 0);
        break;
      default:
        targetPos.set(r * 1.35, targetY + r * 0.85, r * 1.35);
    }

    this.animateCameraTo(targetPos);
  }

  animateCameraTo(targetPos) {
    const startPos = this.camera.position.clone();
    const duration = 450;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      this.camera.position.lerpVectors(startPos, targetPos, ease);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }

  zoom(factor) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = offset.length();
    
    const zoomScale = factor > 0 ? 0.72 : 1.38;
    const newDistance = Math.max(this.controls.minDistance + 0.5, Math.min(this.controls.maxDistance - 10, distance * zoomScale));
    
    offset.setLength(newDistance);
    const newPosition = this.controls.target.clone().add(offset);
    
    this.animateCameraTo(newPosition);
  }

  resetView() {
    this.setCameraPreset('iso');
    this.isAutoRotating = true;
    this.controls.autoRotate = true;
    this.isLightRotating = false;
    this.updateLightPosition(45);
    
    const rotateBtn = document.getElementById('btnRotate3d');
    if (rotateBtn) rotateBtn.classList.add('active');

    const lightBtn = document.getElementById('btnLightRotate3d');
    if (lightBtn) lightBtn.classList.remove('active');
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (this.container.requestFullscreen) {
        this.container.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  destroy() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    window.removeEventListener('resize', this.onResizeBound);

    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }

    if (this.scene) {
      this.scene.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => this.disposeMaterial(m));
            } else {
              this.disposeMaterial(child.material);
            }
          }
        }
      });

      if (this.scene.environment && typeof this.scene.environment.dispose === 'function') {
        this.scene.environment.dispose();
      }

      if (typeof this.scene.clear === 'function') {
        this.scene.clear();
      }
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.renderLists) {
        this.renderer.renderLists.dispose();
      }
      if (this.renderer.forceContextLoss) {
        this.renderer.forceContextLoss();
      }
      this.renderer.domElement = null;
      this.renderer = null;
    }

    // Recreate a clean canvas element so WebGL context is completely detached & garbage collected
    if (this.canvas && this.canvas.parentNode) {
      const freshCanvas = document.createElement('canvas');
      freshCanvas.id = this.canvas.id || 'canvas3d';
      this.canvas.parentNode.replaceChild(freshCanvas, this.canvas);
    }

    this.model = null;
    this.scene = null;
    this.camera = null;
    this.originalMaterials.clear();
  }

  disposeMaterial(mat) {
    if (!mat) return;
    const texKeys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'envMap', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap', 'lightMap'];
    texKeys.forEach(key => {
      if (mat[key] && typeof mat[key].dispose === 'function') {
        mat[key].dispose();
      }
    });
    if (typeof mat.dispose === 'function') {
      mat.dispose();
    }
  }

  onResize() {
    if (!this.isRunning || !this.renderer || !this.camera || !this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  animate() {
    if (!this.isRunning) return;
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    
    // Auto-rotate light around model on 360 degrees
    if (this.isLightRotating) {
      const nextAngle = (this.lightAngleDegrees + 0.65) % 360;
      this.updateLightPosition(nextAngle);
    }

    if (this.controls) {
      this.controls.update();
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

/**
 * Global lifecycle controls for on-demand 3D loading
 */
function open3DViewer() {
  if (window.greenhouseViewer) return;

  const placeholder = document.getElementById('placeholder3d');
  const loadingOverlay = document.getElementById('loading3d');
  const progressBar = document.getElementById('progressBar3d');
  const statusText = document.getElementById('loadingStatus3d');
  const modelStats = document.getElementById('modelStats');
  const hudHint = document.getElementById('hudHintBadge');
  const btnCloseTop = document.getElementById('btnClose3dTop');
  const controlsBar = document.getElementById('controls3dBar');

  if (placeholder) {
    placeholder.style.display = 'none';
  }

  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.opacity = '1';
  }
  if (progressBar) progressBar.style.width = '0%';
  if (statusText) statusText.textContent = 'Подготовка 3D сцены...';

  if (modelStats) {
    modelStats.style.display = 'block';
    modelStats.innerHTML = 'Загрузка <span>GLB / GLTF 3D</span>...';
  }
  if (hudHint) hudHint.style.display = 'flex';
  if (btnCloseTop) btnCloseTop.style.display = 'inline-flex';
  if (controlsBar) controlsBar.style.display = 'flex';

  // Reset controls to active presets
  const rotateBtn = document.getElementById('btnRotate3d');
  if (rotateBtn) rotateBtn.classList.add('active');

  const lightRotateBtn = document.getElementById('btnLightRotate3d');
  if (lightRotateBtn) lightRotateBtn.classList.remove('active');

  const wireBtn = document.getElementById('btnWireframe3d');
  if (wireBtn) wireBtn.classList.remove('active');

  const slider = document.getElementById('lightAngleSlider');
  if (slider) slider.value = 45;
  const angleText = document.getElementById('lightAngleVal');
  if (angleText) angleText.textContent = '45°';

  document.querySelectorAll('[data-preset]').forEach(b => {
    if (b.getAttribute('data-preset') === 'iso') {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  // Launch Three.js application
  window.greenhouseViewer = new SmartGreenhouseViewer('canvas3d', {
    modelPaths: ['3d_teplica.glb', '3d teplica.glb', '3D model.dae']
  });
}

function close3DViewer() {
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }

  if (window.greenhouseViewer) {
    window.greenhouseViewer.destroy();
    window.greenhouseViewer = null;
  }

  const placeholder = document.getElementById('placeholder3d');
  const loadingOverlay = document.getElementById('loading3d');
  const modelStats = document.getElementById('modelStats');
  const hudHint = document.getElementById('hudHintBadge');
  const btnCloseTop = document.getElementById('btnClose3dTop');
  const controlsBar = document.getElementById('controls3dBar');

  if (loadingOverlay) loadingOverlay.style.display = 'none';
  if (modelStats) modelStats.style.display = 'none';
  if (hudHint) hudHint.style.display = 'none';
  if (btnCloseTop) btnCloseTop.style.display = 'none';
  if (controlsBar) controlsBar.style.display = 'none';

  if (placeholder) {
    placeholder.style.display = 'flex';
    placeholder.style.opacity = '1';
  }
}

/**
 * Initialize all 3D UI control buttons once on page load
 */
function init3DViewerControls() {
  // Open 3D button
  const openBtn = document.getElementById('btnOpen3d');
  if (openBtn) {
    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      open3DViewer();
    });
  }

  // Close 3D buttons (Top-right HUD and bottom controls bar)
  const closeBtnTop = document.getElementById('btnClose3dTop');
  if (closeBtnTop) {
    closeBtnTop.addEventListener('click', (e) => {
      e.preventDefault();
      close3DViewer();
    });
  }

  const closeBtnBottom = document.getElementById('btnClose3dBottom');
  if (closeBtnBottom) {
    closeBtnBottom.addEventListener('click', (e) => {
      e.preventDefault();
      close3DViewer();
    });
  }

  // Auto-rotate toggle
  const rotateBtn = document.getElementById('btnRotate3d');
  if (rotateBtn) {
    rotateBtn.addEventListener('click', () => {
      if (!window.greenhouseViewer) return;
      const active = window.greenhouseViewer.toggleAutoRotate();
      rotateBtn.classList.toggle('active', active);
    });
  }

  // 360 Light Rotation Toggle
  const lightRotateBtn = document.getElementById('btnLightRotate3d');
  if (lightRotateBtn) {
    lightRotateBtn.addEventListener('click', () => {
      if (!window.greenhouseViewer) return;
      const active = window.greenhouseViewer.toggleLightRotation();
      lightRotateBtn.classList.toggle('active', active);
    });
  }

  // Light Angle Slider
  const lightSlider = document.getElementById('lightAngleSlider');
  if (lightSlider) {
    lightSlider.addEventListener('input', (e) => {
      if (!window.greenhouseViewer) return;
      const degrees = parseFloat(e.target.value);
      window.greenhouseViewer.isLightRotating = false;
      if (lightRotateBtn) lightRotateBtn.classList.remove('active');
      window.greenhouseViewer.updateLightPosition(degrees);
    });
  }

  // Wireframe Mode
  const wireBtn = document.getElementById('btnWireframe3d');
  if (wireBtn) {
    wireBtn.addEventListener('click', () => {
      if (!window.greenhouseViewer) return;
      const active = window.greenhouseViewer.toggleWireframe();
      wireBtn.classList.toggle('active', active);
    });
  }

  // Camera Presets
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!window.greenhouseViewer) return;
      const preset = e.currentTarget.getAttribute('data-preset');
      window.greenhouseViewer.setCameraPreset(preset);
      document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
    });
  });

  // Zoom Controls
  const zoomInBtn = document.getElementById('btnZoomIn');
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.greenhouseViewer) window.greenhouseViewer.zoom(1);
    });
  }

  const zoomOutBtn = document.getElementById('btnZoomOut');
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.greenhouseViewer) window.greenhouseViewer.zoom(-1);
    });
  }

  // Reset Camera View
  const resetBtn = document.getElementById('btnReset3d');
  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.greenhouseViewer) window.greenhouseViewer.resetView();
    });
  }

  // Fullscreen
  const fsBtn = document.getElementById('btnFullscreen3d');
  if (fsBtn) {
    fsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.greenhouseViewer) window.greenhouseViewer.toggleFullscreen();
    });
  }
}

// Initialize on DOM ready (only attaches event listeners, model loads on click)
document.addEventListener('DOMContentLoaded', () => {
  init3DViewerControls();
});