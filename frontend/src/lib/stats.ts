
export const sum = (a: number[]) => a.reduce((s, x) => s + x, 0)
export const mean = (a: number[]) => (a.length ? sum(a) / a.length : NaN)
export function variance(a: number[]) {
  if (a.length < 2) return 0
  const m = mean(a)
  return sum(a.map((x) => (x - m) ** 2)) / (a.length - 1)
}
export const std = (a: number[]) => Math.sqrt(variance(a))
export function quantile(a: number[], q: number) {
  if (!a.length) return NaN
  const s = [...a].sort((x, y) => x - y)
  const pos = (s.length - 1) * q
  const lo = Math.floor(pos), hi = Math.ceil(pos)
  return s[lo] + (s[hi] - s[lo]) * (pos - lo)
}
export const median = (a: number[]) => quantile(a, 0.5)

function logGamma(z: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let x = z, y = z
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (const ci of c) ser += ci / ++y
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}
function betacf(a: number, b: number, x: number) {
  const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1, d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}
function ibeta(x: number, a: number, b: number) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b
}
export function tCdf(t: number, df: number) {
  const x = df / (df + t * t)
  const tail = 0.5 * ibeta(x, df / 2, 0.5)
  return t >= 0 ? 1 - tail : tail
}
export function tInv(p: number, df: number) {
  let lo = -100, hi = 100
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    if (tCdf(mid, df) < p) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function ci95(a: number[]): [number, number] {
  const n = a.length
  if (n < 2) return [NaN, NaN]
  const m = mean(a)
  const half = tInv(0.975, n - 1) * (std(a) / Math.sqrt(n))
  return [m - half, m + half]
}

export interface Describe {
  n: number; mean: number; median: number; std: number; cv: number; min: number; max: number; ci: [number, number]; q1: number; q3: number
}
export function describe(a: number[]): Describe {
  const m = mean(a)
  const s = std(a)
  return {
    n: a.length, mean: m, median: median(a), std: s, cv: m !== 0 ? (s / Math.abs(m)) * 100 : NaN,
    min: Math.min(...a), max: Math.max(...a), ci: ci95(a), q1: quantile(a, 0.25), q3: quantile(a, 0.75),
  }
}

export function welch(a: number[], b: number[]) {
  const va = variance(a) / a.length, vb = variance(b) / b.length
  const t = (mean(a) - mean(b)) / Math.sqrt(va + vb)
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1))
  const p = 2 * (1 - tCdf(Math.abs(t), df))
  const sp = Math.sqrt((variance(a) + variance(b)) / 2)
  const d = sp > 0 ? (mean(a) - mean(b)) / sp : NaN
  return { t, df, p, d }
}

export function pairedT(pre: number[], post: number[]) {
  const diffs = post.map((x, i) => x - pre[i])
  const n = diffs.length
  const sd = std(diffs)
  const t = sd > 0 ? mean(diffs) / (sd / Math.sqrt(n)) : NaN
  const df = n - 1
  const p = Number.isFinite(t) ? 2 * (1 - tCdf(Math.abs(t), df)) : NaN
  return { t, df, p, meanDiff: mean(diffs) }
}

export function linreg(x: number[], y: number[]) {
  const mx = mean(x), my = mean(y)
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my)
    sxx += (x[i] - mx) ** 2
    syy += (y[i] - my) ** 2
  }
  const slope = sxy / sxx
  const intercept = my - slope * mx
  const r2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : 1
  return { slope, intercept, r2 }
}

export function histogram(groups: number[][], bins?: number) {
  const all = groups.flat()
  const n = bins ?? Math.max(5, Math.ceil(Math.log2(Math.max(...groups.map((g) => g.length))) + 1))
  const lo = Math.min(...all), hi = Math.max(...all)
  const w = (hi - lo) / n || 1
  return Array.from({ length: n }, (_, i) => {
    const a = lo + i * w, b = a + w
    const row: Record<string, number> = { center: (a + b) / 2, from: a, to: b }
    groups.forEach((g, gi) => {
      row[`g${gi}`] = g.filter((x) => (i === n - 1 ? x >= a && x <= b : x >= a && x < b)).length
    })
    return row
  })
}

export function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const normal = () => {
    let u = 0
    while (u === 0) u = next()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next())
  }
  return { next, normal }
}
