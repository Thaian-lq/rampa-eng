
export type Method = 'analitico' | 'euler' | 'rk4'
export type ForceMode = 'constante' | 'rampa'
export type Regime = -1 | 0 | 1

export interface Params {
  F: number
  phi: number
  mode: ForceMode
  rate: number
  m: number
  theta: number
  muS: number
  muK: number
  g: number
  v0: number
  b: number
  T: number
  method: Method
  dt: number
}

export interface Forces {
  F: number
  Fpar: number
  Fperp: number
  Ppar: number
  Pperp: number
  N: number
  lifted: boolean
  D: number
}

export interface Sample {
  t: number
  x: number
  v: number
  a: number
  F: number
  Fpar: number
  Ppar: number
  N: number
  f: number
  visc: number
  Fnet: number
  regime: Regime
  ek: number
  ep: number
  wF: number
  eDiss: number
}

export interface Result {
  samples: Sample[]
  xEnd: number
  vEnd: number
  xMin: number
  xMax: number
  vMaxAbs: number
  moved: boolean
  lifted: boolean
  tStart: number
  tStop: number
  method: Method
  steps: number
  energyResidualPct: number
}

const RAD = Math.PI / 180
const MAX_STEPS = 400_000
const sign = (x: number): Regime => (x > 0 ? 1 : x < 0 ? -1 : 0)

export function appliedF(p: Params, t: number) {
  return p.mode === 'rampa' ? Math.max(0, p.F + p.rate * t) : p.F
}

export function forces(p: Params, t: number): Forces {
  const F = appliedF(p, t)
  const Fpar = F * Math.cos(p.phi * RAD)
  const Fperp = F * Math.sin(p.phi * RAD)
  const Ppar = -p.m * p.g * Math.sin(p.theta * RAD)
  const Pperp = p.m * p.g * Math.cos(p.theta * RAD)
  const Nraw = Pperp - Fperp
  return { F, Fpar, Fperp, Ppar, Pperp, N: Math.max(0, Nraw), lifted: Nraw < -1e-12, D: Fpar + Ppar }
}

const muK = (p: Params) => Math.min(p.muK, p.muS)

export function staticHolds(p: Params, t: number) {
  const c = forces(p, t)
  return Math.abs(c.D) <= p.muS * c.N + 1e-12
}

export function accel(p: Params, t: number, v: number, s: Regime) {
  if (s === 0) return 0
  const c = forces(p, t)
  return (c.D - s * muK(p) * c.N - p.b * v) / p.m
}

function stepMove(p: Params, t: number, x: number, v: number, h: number, s: Regime, method: 'euler' | 'rk4'): [number, number] {
  if (method === 'euler') return [x + h * v, v + h * accel(p, t, v, s)]
  const a1 = accel(p, t, v, s)
  const v2 = v + (h / 2) * a1
  const a2 = accel(p, t + h / 2, v2, s)
  const v3 = v + (h / 2) * a2
  const a3 = accel(p, t + h / 2, v3, s)
  const v4 = v + h * a3
  const a4 = accel(p, t + h, v4, s)
  return [x + (h / 6) * (v + 2 * v2 + 2 * v3 + v4), v + (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4)]
}

function initialRegime(p: Params): Regime {
  if (p.v0 !== 0) return sign(p.v0)
  return staticHolds(p, 0) ? 0 : sign(forces(p, 0).D)
}

class Recorder {
  samples: Sample[] = []
  lifted = false
  p: Params
  constructor(p: Params) { this.p = p }
  push(t: number, x: number, v: number, s: Regime) {
    const p = this.p
    const c = forces(p, t)
    if (c.lifted) this.lifted = true
    const f = s === 0 ? -c.D : -s * muK(p) * c.N
    const visc = -p.b * v
    const Fnet = s === 0 ? 0 : c.D + f + visc
    const prev = this.samples[this.samples.length - 1]
    let wF = 0, eDiss = 0
    if (prev) {
      const h = t - prev.t
      wF = prev.wF + 0.5 * h * (prev.Fpar * prev.v + c.Fpar * v)
      const dPrev = -(prev.f * prev.v + prev.visc * prev.v)
      const dNow = -(f * v + visc * v)
      eDiss = prev.eDiss + 0.5 * h * (dPrev + dNow)
    }
    this.samples.push({
      t, x, v, a: Fnet / p.m, F: c.F, Fpar: c.Fpar, Ppar: c.Ppar, N: c.N, f, visc, Fnet, regime: s,
      ek: 0.5 * p.m * v * v, ep: p.m * p.g * x * Math.sin(p.theta * RAD), wF, eDiss,
    })
  }
}

function finish(rec: Recorder, method: Method, steps: number, tStart: number, tStop: number): Result {
  const s = rec.samples
  const last = s[s.length - 1]
  const xs = s.map((q) => q.x)
  const balance = last.ek - s[0].ek + last.ep - s[0].ep + last.eDiss
  const scale = Math.max(Math.abs(last.wF), s[0].ek, last.eDiss, ...s.map((q) => q.ek), ...s.map((q) => Math.abs(q.ep - s[0].ep)), 1e-9)
  return {
    samples: s,
    xEnd: last.x,
    vEnd: last.v,
    xMin: Math.min(...xs),
    xMax: Math.max(...xs),
    vMaxAbs: Math.max(...s.map((q) => Math.abs(q.v))),
    moved: s.some((q) => q.regime !== 0),
    lifted: rec.lifted,
    tStart,
    tStop,
    method,
    steps,
    energyResidualPct: (Math.abs(last.wF - balance) / scale) * 100,
  }
}

function simulateNumeric(p: Params, method: 'euler' | 'rk4'): Result {
  const rec = new Recorder(p)
  const dt = Math.max(1e-4, p.dt)
  let t = 0, x = 0, v = p.v0
  let s = initialRegime(p)
  let tStart = s !== 0 && p.v0 === 0 ? 0 : NaN
  let tStop = NaN
  rec.push(t, x, v, s)
  let steps = 0
  while (t < p.T - 1e-12 && steps < MAX_STEPS) {
    steps++
    const h = Math.min(dt, p.T - t)
    if (s === 0) {
      if (staticHolds(p, t + h)) {
        t += h
        rec.push(t, x, v, 0)
        continue
      }
      let lo = 0, hi = h
      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2
        if (staticHolds(p, t + mid)) lo = mid
        else hi = mid
      }
      t += hi
      s = sign(forces(p, t).D)
      if (Number.isNaN(tStart)) tStart = t
      rec.push(t, x, v, s)
      continue
    }
    const [xn, vn] = stepMove(p, t, x, v, h, s, method)
    if (vn * s <= 0) {
      let lo = 0, hi = h
      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2
        if (stepMove(p, t, x, v, mid, s, method)[1] * s > 0) lo = mid
        else hi = mid
      }
      x = stepMove(p, t, x, v, hi, s, method)[0]
      v = 0
      t += hi
      if (Number.isNaN(tStop)) tStop = t
      s = staticHolds(p, t) ? 0 : sign(forces(p, t).D)
      rec.push(t, x, v, s)
      continue
    }
    x = xn
    v = vn
    t += h
    rec.push(t, x, v, s)
  }
  return finish(rec, method, steps, tStart, tStop)
}

interface Piece { t0: number; x0: number; v0: number; s: Regime; t1: number }

function pieceState(p: Params, pc: Piece, t: number): [number, number] {
  const tau = t - pc.t0
  if (pc.s === 0) return [pc.x0, 0]
  const c = forces(p, 0)
  const a0 = (c.D - pc.s * muK(p) * c.N) / p.m
  const k = p.b / p.m
  if (k === 0) return [pc.x0 + pc.v0 * tau + 0.5 * a0 * tau * tau, pc.v0 + a0 * tau]
  const vi = a0 / k
  const e = Math.exp(-k * tau)
  return [pc.x0 + vi * tau + ((pc.v0 - vi) * (1 - e)) / k, vi + (pc.v0 - vi) * e]
}

function stopTime(p: Params, s: Regime, v0: number): number {
  const c = forces(p, 0)
  const a0 = (c.D - s * muK(p) * c.N) / p.m
  const k = p.b / p.m
  if (k === 0) return a0 * s < 0 ? -v0 / a0 : Infinity
  const vi = a0 / k
  const r = -vi / (v0 - vi)
  return r > 0 && r < 1 ? -Math.log(r) / k : Infinity
}

function simulateAnalytic(p: Params): Result {
  const pieces: Piece[] = []
  let t0 = 0, x0 = 0, v0 = p.v0
  let s = initialRegime(p)
  let tStart = s !== 0 && p.v0 === 0 ? 0 : NaN
  let tStop = NaN
  for (let i = 0; i < 4 && t0 < p.T; i++) {
    if (s === 0) { pieces.push({ t0, x0, v0: 0, s, t1: p.T }); break }
    const ts = v0 === 0 ? Infinity : stopTime(p, s, v0)
    const t1 = Math.min(p.T, t0 + ts)
    const pc = { t0, x0, v0, s, t1 }
    pieces.push(pc)
    if (t1 >= p.T) break
    x0 = pieceState(p, pc, t1)[0]
    v0 = 0
    t0 = t1
    if (Number.isNaN(tStop)) tStop = t1
    s = staticHolds(p, t1) ? 0 : sign(forces(p, t1).D)
  }
  const rec = new Recorder(p)
  const n = Math.min(20000, Math.max(2, Math.ceil(p.T / Math.max(p.dt, p.T / 20000))))
  const times = new Set<number>()
  for (let i = 0; i <= n; i++) times.add((p.T * i) / n)
  pieces.forEach((pc) => times.add(pc.t1))
  const sorted = [...times].filter((t) => t <= p.T).sort((a, b) => a - b)
  let k = 0
  for (const t of sorted) {
    while (k < pieces.length - 1 && t > pieces[k].t1) k++
    const pc = pieces[k]
    const [x, v] = pieceState(p, pc, t)
    const atBoundary = t === pc.t1 && k < pieces.length - 1
    rec.push(t, x, atBoundary ? 0 : v, atBoundary ? pieces[k + 1].s : pc.s)
  }
  return finish(rec, 'analitico', pieces.length, tStart, tStop)
}

export function simulate(p: Params): Result {
  const q = { ...p, muK: Math.min(p.muK, p.muS) }
  if (q.method === 'analitico' && q.mode === 'constante') return simulateAnalytic(q)
  return simulateNumeric(q, q.method === 'euler' ? 'euler' : 'rk4')
}

export function forceToStart(p: Params): number {
  const den = Math.cos(p.phi * RAD) + p.muS * Math.sin(p.phi * RAD)
  return den > 0 ? (p.m * p.g * (Math.sin(p.theta * RAD) + p.muS * Math.cos(p.theta * RAD))) / den : Infinity
}
export function forceToHold(p: Params): number {
  const need = Math.sin(p.theta * RAD) - p.muS * Math.cos(p.theta * RAD)
  if (need <= 0) return 0
  const den = Math.cos(p.phi * RAD) - p.muS * Math.sin(p.phi * RAD)
  return den > 0 ? (p.m * p.g * need) / den : Infinity
}
export const criticalAngle = (muS: number) => Math.atan(muS) / RAD
export function accelUp(p: Params, F = p.F) {
  const k = Math.min(p.muK, p.muS)
  return (F * (Math.cos(p.phi * RAD) + k * Math.sin(p.phi * RAD)) - p.m * p.g * (Math.sin(p.theta * RAD) + k * Math.cos(p.theta * RAD))) / p.m
}

export function frictionCurve(p: Params, Fmax: number, n = 160) {
  const out: { F: number; estatico: number | null; cinetico: number | null; maximo: number }[] = []
  for (let i = 0; i <= n; i++) {
    const F = (Fmax * i) / n
    const c = forces({ ...p, mode: 'constante', F }, 0)
    const holds = Math.abs(c.D) <= p.muS * c.N + 1e-12
    out.push({ F, estatico: holds ? Math.abs(c.D) : null, cinetico: holds ? null : Math.min(p.muK, p.muS) * c.N, maximo: p.muS * c.N })
  }
  return out
}

export function sampleAt(samples: Sample[], t: number): Sample {
  if (t <= samples[0].t) return samples[0]
  const last = samples[samples.length - 1]
  if (t >= last.t) return last
  let lo = 0, hi = samples.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (samples[mid].t <= t) lo = mid
    else hi = mid
  }
  const a = samples[lo], b = samples[hi]
  const u = (t - a.t) / (b.t - a.t || 1)
  const L = (p: number, q: number) => p + (q - p) * u
  return {
    ...b, t, x: L(a.x, b.x), v: L(a.v, b.v), F: L(a.F, b.F), Fpar: L(a.Fpar, b.Fpar), N: L(a.N, b.N),
    ek: L(a.ek, b.ek), ep: L(a.ep, b.ep), wF: L(a.wF, b.wF), eDiss: L(a.eDiss, b.eDiss),
    regime: a.regime, a: a.a, f: a.f, Fnet: a.Fnet, visc: L(a.visc, b.visc),
  }
}

export function downsample<T>(arr: T[], max = 300): T[] {
  if (arr.length <= max) return arr
  const out: T[] = []
  const stepN = (arr.length - 1) / (max - 1)
  for (let i = 0; i < max; i++) out.push(arr[Math.round(i * stepN)])
  return out
}
