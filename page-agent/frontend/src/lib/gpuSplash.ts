/*
 * 玄策 · GPU 粒子系统（GPGPU 模拟 + birds 式几何渲染）
 * 模拟：fbalda/particle-logo 物理（返回吸引 + 阻尼 + 锁定）+ 流场/螺旋；
 *       每粒子相位（pos.w）由速度驱动累加（复刻 three.js webgl_gpgpu_birds）。
 * 渲染：复刻 birds —— 每粒子 3 三角形小几何体（身体+双翼），顶点 shader 内
 *       用速度构建朝向矩阵（maty×matz）旋转、翼尖 sin(phase) 扇动、
 *       落位后收敛为小菱形；片段 shader 按深度明暗（近亮远暗）增强立体。
 */
import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js'
import { makeSoftSprite } from './softSprite'

const RETURN_ACCEL = 40.0 // 向 origin 的返回加速度（更大=更快聚拢=更密集）
const PERP_DECEL = 9.0 // 垂直方向阻尼（防环绕摆荡）
const SETTLE_EPS = 0.15 // 到达锁定容差（更紧=粒子更贴近目标位）
const FLOAT_AMP = 0.08 // 散开阶段漂浮幅度（极小=粒子紧贴目标位）
const SWIRL = 9.0 // 螺旋聚拢切向加速度（随成形衰减，产生盘旋收拢轨迹）
const BREATHE = 0.012 // 成形后呼吸位移幅度（让立绘保持微生命，避免死板静止）

/* 模拟计算公共段：输入 pos/vel/origin，输出 npos/nvel/nphase/nsettled/k
 * pos.w = 相位（速度驱动，翅膀扇动节奏）；vel.w = 落位标志
 */
const simCore = /* glsl */ `
  const float RETURN_ACCEL = ${RETURN_ACCEL.toFixed(1)};
  const float PERP_DECEL = ${PERP_DECEL.toFixed(1)};
  const float SETTLE_EPS = ${SETTLE_EPS.toFixed(3)};
  const float FLOAT_AMP = ${FLOAT_AMP.toFixed(2)};
  const float SWIRL = ${SWIRL.toFixed(1)};
  const float BREATHE = ${BREATHE.toFixed(3)};
  uniform float uDt;
  uniform float uT;
  uniform float uProg; // 0 散开 → 1 成形（easeOutExpo 在 CPU 端算好）

  void main() {
    vec2 vUv = gl_FragCoord.xy / resolution.xy;
    vec4 pos = texture2D(uPosTex, vUv);
    vec4 vel = texture2D(uVelTex, vUv);
    vec4 origin = texture2D(uOriginTex, vUv);

    // 错峰：stagger 0~0.3 的热粒子先行，0~1 的主体随后
    float delay = origin.w * 0.55;
    float local = clamp((uProg - delay) / (1.0 - delay + 1e-4), 0.0, 1.0);
    float k = 1.0 - pow(1.0 - local, 3.0);

    vec3 toOrigin = origin.xyz - pos.xyz;
    float dist = length(toOrigin);
    vec3 dir = dist < 1e-5 ? vec3(0.0) : toOrigin / dist;

    // 垂直阻尼：压掉切向速度，防环绕摆荡
    vec3 perp = vec3(-dir.y, dir.x, 0.0);
    float perpSpeed = dot(perp, vel.xyz);
    float speed = length(vel.xyz);
    vec3 perpDec = speed > 1e-4 ? perp * PERP_DECEL * (perpSpeed / speed) : vec3(0.0);

    // 螺旋聚拢：切向加速度，随成形衰减（1-k），盘旋收拢更有气势
    vec3 swirl = perp * SWIRL * (1.0 - k);

    // 散开阶段漂浮噪声（幅度随成形衰减，弱化为补足流动场的细节抖动）
    float floatAmt = (1.0 - k) * FLOAT_AMP;
    vec3 jitter = vec3(
      sin(uT * 0.7 + origin.x * 5.1 + origin.w * 13.0),
      cos(uT * 0.6 + origin.y * 4.7 + origin.w * 7.0),
      sin(uT * 0.5 + origin.z * 3.3)
    ) * floatAmt * 0.4;

    // 散开阶段流动场（群像盘旋）：同区域粒子共享流向 → 一致性的群流感
    vec3 flow = vec3(
      sin(origin.x * 2.1 + uT * 0.5) * 0.6 + sin(origin.y * 3.7 - uT * 0.8) * 0.4,
      cos(origin.y * 2.3 + uT * 0.6) * 0.6 + cos(origin.x * 4.1 + uT * 0.5) * 0.4,
      sin(origin.z * 3.1 + uT * 0.7) * 0.5
    ) * floatAmt * 1.2;

    // 已落位粒子锁定在 origin（防抖）
    vec3 accel = vel.w > 0.5 ? vec3(0.0) : dir * RETURN_ACCEL * k * k + flow + jitter + swirl - perpDec;

    vec3 nvel = vel.xyz + accel * uDt;
    vec3 npos = pos.xyz + nvel * uDt;
    float nsettled = vel.w;

    // 到达锁定（fbalda 预测式）：距 origin 小于「本帧位移 + 容差」且朝其运动 → 吸附
    float originSpeed = dot(dir, vel.xyz);
    if (nsettled < 0.5 && dist < length(nvel) * uDt + SETTLE_EPS && originSpeed > 0.0) {
      npos = origin.xyz;
      nvel = vec3(0.0);
      nsettled = 1.0;
    }

    // 成形后微呼吸：围绕 origin 缓慢浮动，让立绘有「活着」的墨感
    if (nsettled > 0.5) {
      npos += vec3(
        sin(uT * 0.8 + origin.x * 3.1 + origin.w * 11.0) * BREATHE,
        cos(uT * 0.7 + origin.y * 3.7 + origin.w * 7.0) * BREATHE,
        sin(uT * 0.6 + origin.z * 2.9) * BREATHE * 0.5
      );
    }

    // 翅膀相位（birds 同款：随速度累加；落位后缓慢呼吸摆动）
    float nphase = pos.w + uDt * (1.0 + length(nvel) * 3.0 + max(nvel.y, 0.0) * 6.0);
    if (nsettled > 0.5) nphase = pos.w + uDt * 0.6;
    nphase = mod(nphase, 6.2831);
  }
`

/* pos 变量输出：新位置 + 相位 */
const simPosFragment = `
  precision highp float;
` + simCore + /* glsl */ `
    gl_FragColor = vec4(npos, nphase);
  }
`

/* vel 变量输出：新速度 + 落位标志 */
const simVelFragment = `
  precision highp float;
` + simCore + /* glsl */ `
    gl_FragColor = vec4(nvel, nsettled);
  }
`

/* origin 恒等 shader：origin 纹理只读，不参与模拟写出 */
const originIdentity = /* glsl */ `
  precision highp float;
  void main() {
    vec2 vUv = gl_FragCoord.xy / resolution.xy;
    gl_FragColor = texture2D(uOriginTex, vUv);
  }
`

/* 复刻 birds：每粒子 3 三角形（身体 + 左右翼），顶点 shader 内朝向旋转 + 翼扇动 */
const renderVertex = /* glsl */ `
  uniform sampler2D uPosTex;
  uniform sampler2D uVelTex;
  uniform sampler2D uColorTex;
  attribute vec2 reference;
  attribute float birdVertex;
  varying vec3 vColor;
  varying float vPosZ;
  varying float vSettled;
  varying float vPhase;
  void main() {
    vec4 posData = texture2D(uPosTex, reference);
    vec3 pos = posData.xyz;
    float phase = posData.w;
    vec4 velData = texture2D(uVelTex, reference);
    vec3 velocity = velData.xyz;
    float settled = velData.w;
    vec4 col = texture2D(uColorTex, reference);

    vec3 newPosition = position;
    // 翼尖扇动（birds：birdVertex 4 / 7 为两翼翼尖）
    if (birdVertex == 4.0 || birdVertex == 7.0) {
      newPosition.y += sin(phase) * 0.024;
    }
    // 飞行中放大（群鸟气势），落位后收敛为小菱形构成人物
    newPosition *= mix(3.2, 1.0, settled);

    // 朝向：复刻 birds maty(偏航)×matz(俯仰)，速度过零时正面朝相机
    vec3 v = velocity;
    if (length(v) < 1e-4) v = vec3(0.0, 0.0, 1.0);
    v = normalize(v);
    float xz = length(v.xz);
    float x = sqrt(max(1.0 - v.y * v.y, 0.0));
    float cosry = xz < 1e-4 ? 1.0 : v.x / xz;
    float sinry = xz < 1e-4 ? 0.0 : v.z / xz;
    float cosrz = x;
    float sinrz = v.y;
    mat3 maty = mat3(cosry, 0.0, -sinry, 0.0, 1.0, 0.0, sinry, 0.0, cosry);
    mat3 matz = mat3(cosrz, sinrz, 0.0, -sinrz, cosrz, 0.0, 0.0, 0.0, 1.0);
    newPosition = maty * matz * newPosition;
    newPosition += pos;

    vColor = col.rgb;
    vPosZ = pos.z;
    vSettled = settled;
    vPhase = col.a;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`

const renderFragment = /* glsl */ `
  uniform float uOpacity;
  uniform float uTime;
  varying vec3 vColor;
  varying float vPosZ;
  varying float vSettled;
  varying float vPhase;
  void main() {
    // 深度明暗（近亮远暗 → 立体层次）
    float zf = 0.72 + 0.28 * (1.0 - clamp(vPosZ, 0.0, 1.05) / 1.05);
    // 成形后微闪烁（生命感）
    float flick = vSettled > 0.5 ? 0.8 + 0.2 * sin(uTime * 2.0 + vPhase * 6.2831) : 1.0;
    gl_FragColor = vec4(vColor * zf, uOpacity * flick * (vSettled > 0.5 ? 1.0 : 0.9));
  }
`

const glowVertex = /* glsl */ `
  uniform sampler2D uPosTex;
  uniform float uPixelRatio;
  uniform float uSize;
  attribute vec2 aIndex;
  void main() {
    vec4 pos = texture2D(uPosTex, aIndex);
    vec4 mv = modelViewMatrix * vec4(pos.xyz, 1.0);
    gl_PointSize = uSize * uPixelRatio * (220.0 / max(0.01, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`

const glowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform sampler2D uMap;
  void main() {
    vec4 sprite = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(uColor, sprite.a * uOpacity);
  }
`

export interface GpuSplashData {
  positions: Float32Array // 目标位（世界坐标）
  sourceColors: Float32Array // 原图色彩 rgb
  hotFlags: Uint8Array // 1 = 热区
  aspect: number
}

/* 每粒子 3 三角形（9 顶点）本地几何 —— 复刻 birds BirdGeometry，未缩放（shader 内缩放） */
function buildBirdGeometry(total: number, size: number): THREE.BufferGeometry {
  const wingsSpan = 20
  const local = [
    0, 0, -20, 0, 4, -20, 0, 0, 30, // body: 0,1,2
    0, 0, -15, -wingsSpan, 0, 0, 0, 0, 15, // wingL: 3,4,5
    0, 0, 15, wingsSpan, 0, 0, 0, 0, -15, // wingR: 6,7,8
  ]
  const n = total * 9
  const posArr = new Float32Array(n * 3)
  const vtxArr = new Float32Array(n)
  const refArr = new Float32Array(n * 2)
  for (let i = 0; i < total; i++) {
    const ri = ((i % size) + 0.5) / size
    const ci = (Math.floor(i / size) + 0.5) / size
    for (let k = 0; k < 9; k++) {
      const o = (i * 9 + k) * 3
      posArr[o] = local[k * 3]
      posArr[o + 1] = local[k * 3 + 1]
      posArr[o + 2] = local[k * 3 + 2]
      vtxArr[i * 9 + k] = k
      refArr[(i * 9 + k) * 2] = ri
      refArr[(i * 9 + k) * 2 + 1] = ci
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
  geo.setAttribute('birdVertex', new THREE.BufferAttribute(vtxArr, 1))
  geo.setAttribute('reference', new THREE.BufferAttribute(refArr, 2))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0.6), 6)
  return geo
}

export class GpuSplash {
  readonly total: number
  readonly aspect: number
  readonly points: THREE.Mesh
  readonly glow: THREE.Points | null
  private gpgpu: GPUComputationRenderer
  private posVar: any
  private velVar: any
  private colorTex: THREE.DataTexture
  private glowGeo: THREE.BufferGeometry | null = null
  private glowMat: THREE.ShaderMaterial | null = null
  private sprite: THREE.Texture
  private disposed = false

  constructor(private renderer: THREE.WebGLRenderer, data: GpuSplashData, private scene: THREE.Scene) {
    this.total = data.positions.length / 3
    this.aspect = data.aspect

    const size = Math.ceil(Math.sqrt(this.total))
    const makeTex = (fill: (arr: Float32Array, i: number) => void): THREE.DataTexture => {
      const arr = new Float32Array(size * size * 4)
      for (let i = 0; i < this.total; i++) fill(arr, i)
      const tex = new THREE.DataTexture(arr, size, size, THREE.RGBAFormat, THREE.FloatType)
      tex.needsUpdate = true
      return tex
    }

    const rng = Math.random
    const originTex = makeTex((arr, i) => {
      const o = i * 4, p = i * 3
      arr[o] = data.positions[p]
      arr[o + 1] = data.positions[p + 1]
      arr[o + 2] = data.positions[p + 2]
      // stagger：热粒子 0~0.3 先行，主体 0~1
      arr[o + 3] = data.hotFlags[i] === 1 ? rng() * 0.3 : 0.3 + rng() * 0.7
    })

    const posInit = makeTex((arr, i) => {
      const o = i * 4
      const theta = rng() * Math.PI * 2
      const rp = 1.5 + rng() * 1.5
      arr[o] = Math.cos(theta) * rp
      arr[o + 1] = Math.sin(theta) * rp
      arr[o + 2] = 0.5 + (rng() - 0.5) * 3.2
      arr[o + 3] = rng() * 6.2831 // 初始相位
    })
    const velInit = makeTex(() => {})

    this.gpgpu = new GPUComputationRenderer(size, size, renderer)
    this.posVar = this.gpgpu.addVariable('uPosTex', simPosFragment, posInit)
    this.velVar = this.gpgpu.addVariable('uVelTex', simVelFragment, velInit)
    const originVar = this.gpgpu.addVariable('uOriginTex', originIdentity, originTex)
    this.gpgpu.setVariableDependencies(this.posVar, [this.posVar, this.velVar, originVar])
    this.gpgpu.setVariableDependencies(this.velVar, [this.posVar, this.velVar, originVar])
    this.gpgpu.setVariableDependencies(originVar, [originVar])
    const err = this.gpgpu.init()
    if (err) throw new Error('GPGPU init failed: ' + err)
    ;(window as any).__splash = this // TEMP-DEBUG
    ;(window as any).__THREE = THREE // TEMP-DEBUG

    // 三个变量的 shader 各自带 uniforms，统一注入时间/进度
    for (const v of (this.gpgpu as any).variables as any[]) {
      const u = v.material.uniforms
      u.uDt = { value: 1 / 60 }
      u.uT = { value: 0 }
      u.uProg = { value: 0 }
    }

    // 色彩纹理：RGBA32F，rgb = 原图色彩，a = 每粒子随机相位（闪烁节奏）
    this.colorTex = makeTex((arr, i) => {
      const o = i * 4, c = i * 3
      arr[o] = data.sourceColors[c]
      arr[o + 1] = data.sourceColors[c + 1]
      arr[o + 2] = data.sourceColors[c + 2]
      arr[o + 3] = Math.random()
    })

    // 主体渲染：birds 式几何体（每粒子 3 三角形）
    const geo = buildBirdGeometry(this.total, size)
    this.sprite = makeSoftSprite()
    const posTex0 = this.gpgpu.getCurrentRenderTarget(this.posVar).texture
    const velTex0 = this.gpgpu.getCurrentRenderTarget(this.velVar).texture
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uPosTex: { value: posTex0 },
        uVelTex: { value: velTex0 },
        uColorTex: { value: this.colorTex },
        uOpacity: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: renderVertex,
      fragmentShader: renderFragment,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    })
    this.points = new THREE.Mesh(geo, mat)
    scene.add(this.points)

    // 热区辉光层：仅 hot 粒子子集，Additive 金色
    const hotIdx: number[] = []
    for (let i = 0; i < this.total; i++) if (data.hotFlags[i] === 1) hotIdx.push(((i % size) + 0.5) / size, (Math.floor(i / size) + 0.5) / size)
    if (hotIdx.length > 0) {
      const ggeo = new THREE.BufferGeometry()
      ggeo.setAttribute('aIndex', new THREE.Float32BufferAttribute(hotIdx, 2))
      ggeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0.6), 6)
      this.glowGeo = ggeo
      this.glowMat = new THREE.ShaderMaterial({
        uniforms: {
          uPosTex: { value: posTex0 },
          uMap: { value: this.sprite },
          uPixelRatio: { value: Math.sqrt(Math.min(window.devicePixelRatio, 2)) },
          uSize: { value: 0.075 },
          uColor: { value: new THREE.Color(0xd9a845) },
          uOpacity: { value: 0.5 },
        },
        vertexShader: glowVertex,
        fragmentShader: glowFragment,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      })
      this.glow = new THREE.Points(ggeo, this.glowMat)
      scene.add(this.glow)
    } else {
      this.glow = null
    }
  }

  /** 每帧更新：推进模拟 + 同步渲染纹理 */
  update(prog: number, dt: number, elapsed: number): void {
    if (this.disposed) return
    for (const v of (this.gpgpu as any).variables as any[]) {
      const u = v.material.uniforms
      if (u.uProg) {
        u.uProg.value = prog
        u.uDt.value = dt
        u.uT.value = elapsed
      }
    }
    this.gpgpu.compute()
    const posTex = this.gpgpu.getCurrentRenderTarget(this.posVar).texture
    const velTex = this.gpgpu.getCurrentRenderTarget(this.velVar).texture
    const mat = this.points.material as THREE.ShaderMaterial
    mat.uniforms.uPosTex.value = posTex
    mat.uniforms.uVelTex.value = velTex
    mat.uniforms.uTime.value = elapsed
    if (this.glow && this.glowMat) this.glowMat.uniforms.uPosTex.value = posTex
  }

  setGlowOpacity(opacity: number): void {
    if (this.glowMat) this.glowMat.uniforms.uOpacity.value = opacity
  }

  setOpacity(opacity: number): void {
    ;(this.points.material as THREE.ShaderMaterial).uniforms.uOpacity.value = opacity
  }

  dispose(): void {
    this.disposed = true
    this.scene.remove(this.points)
    this.points.geometry.dispose()
    ;(this.points.material as THREE.ShaderMaterial).dispose()
    if (this.glow && this.glowGeo && this.glowMat) {
      this.scene.remove(this.glow)
      this.glowGeo.dispose()
      this.glowMat.dispose()
    }
    this.colorTex.dispose()
    this.sprite.dispose()
    this.gpgpu.dispose()
  }
}
