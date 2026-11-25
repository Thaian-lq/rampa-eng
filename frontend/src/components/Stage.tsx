import { useEffect, useRef } from 'react'
import { sampleAt, type Params, type Result, type Sample } from '../lib/physics'

export interface Layers {
  weight: boolean
  components: boolean
  normal: boolean
  applied: boolean
  friction: boolean
  resultant: boolean
  velocity: boolean
  fbd: boolean
  marks: boolean
}

interface Props {
  params: Params
  result: Result
  layers: Layers
  timeRef: React.MutableRefObject<number>
}

const VARS = ['--stage-sky-top', '--stage-sky-bot', '--stage-grid', '--stage-ink', '--orange', '--muted', '--surface', '--navy-500', '--accent-ink', '--bad', '--series-4', '--sand-200', '--sand-300', '--navy-800'] as const
type Palette = Record<(typeof VARS)[number], string>

function readPalette(probe: HTMLElement): Palette {
  const out = {} as Palette
  for (const v of VARS) {
    probe.style.color = `var(${v})`
    out[v] = getComputedStyle(probe).color
  }
  return out
}

function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 5, 10]) if (m * p >= raw) return m * p
  return 10 * p
}
const fmtN = (v: number, d = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: d })

export function Stage(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const probeRef = useRef<HTMLSpanElement>(null)
  const propsRef = useRef(props)
  const versionRef = useRef(0)
  propsRef.current = props
  versionRef.current++

  useEffect(() => {
    const canvas = canvasRef.current!
    const probe = probeRef.current!
    const ctx = canvas.getContext('2d')!
    let pal = readPalette(probe)
    let raf = 0
    let lastKey = ''
    let frame = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = canvas.clientWidth
      const H = canvas.clientHeight
      if (!W || !H) return
      if (++frame % 60 === 0) pal = readPalette(probe)
      const P = propsRef.current
      const t = P.timeRef.current
      const key = `${W}x${H}|${t}|${versionRef.current}`
      if (key === lastKey) return
      lastKey = key
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr)
        canvas.height = Math.round(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      render(ctx, W, H, P, t, pal)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <>
      <canvas ref={canvasRef} role="img" aria-label="Animação do bloco sobre a superfície com as forças do diagrama de corpo livre" />
      <span ref={probeRef} style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }} />
    </>
  )
}

type V2 = [number, number]

function render(ctx: CanvasRenderingContext2D, W: number, H: number, P: Props, t: number, c: Palette) {
  const { params: p, result, layers } = P
  const narrow = W < 520
  const th = (p.theta * Math.PI) / 180
  const cs = Math.cos(th), sn = Math.sin(th)

  let uA = Math.min(0, result.xMin)
  let uB = Math.max(0, result.xMax)
  if (uB - uA < 6) { const extra = 6 - (uB - uA); uA -= extra * 0.3; uB += extra * 0.7 }
  const pad = (uB - uA) * 0.14
  uA -= pad * 1.8
  uB += pad
  const xL = uA * cs, xR = uB * cs, yB = uA * sn, yT = uB * sn

  const baseB = narrow ? 44 : 52
  const padB = baseB + Math.max(0, H * 0.3 - baseB) * Math.max(0, 1 - p.theta / 15)
  const padL = 20, padR = 20, padT = narrow ? (layers.fbd ? 196 : 110) : 140
  const availW = W - padL - padR, availH = H - padT - padB
  const sc = Math.min(availW / Math.max(xR - xL, 1e-6), availH / Math.max(yT - yB, 1e-6))
  const ox = padL + (availW - (xR - xL) * sc) / 2
  const oy = H - padB
  const X = (wx: number) => ox + (wx - xL) * sc
  const Y = (wy: number) => oy - (wy - yB) * sc
  const S = (u: number): V2 => [X(u * cs), Y(u * sn)]
  const ePar: V2 = [cs, -sn]
  const ePerp: V2 = [-sn, -cs]
  const loc = (a: number, b: number): V2 => [a * ePar[0] + b * ePerp[0], a * ePar[1] + b * ePerp[1]]

  const sky = ctx.createLinearGradient(0, 0, 0, oy)
  sky.addColorStop(0, c['--stage-sky-top'])
  sky.addColorStop(1, c['--stage-sky-bot'])
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = c['--sand-300']
  ctx.fillRect(0, oy, W, H - oy)
  ctx.strokeStyle = c['--stage-ink']
  ctx.globalAlpha = 0.5
  ctx.beginPath(); ctx.moveTo(0, oy + 0.5); ctx.lineTo(W, oy + 0.5); ctx.stroke()
  ctx.globalAlpha = 1

  const A = S(uA), B = S(uB)
  if (p.theta > 0.2) {
    ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(B[0], A[1]); ctx.closePath()
    ctx.fillStyle = c['--sand-200']
    ctx.fill()
    ctx.save()
    ctx.clip()
    ctx.strokeStyle = c['--stage-grid']
    ctx.lineWidth = 1
    for (let k = -H; k < W + H; k += 14) { ctx.beginPath(); ctx.moveTo(k, oy); ctx.lineTo(k + H, oy - H); ctx.stroke() }
    ctx.restore()
    ctx.strokeStyle = c['--stage-ink']
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(B[0], A[1]); ctx.stroke()
    ctx.strokeStyle = c['--orange']
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(A[0], A[1], 48, -th, 0); ctx.stroke()
    label(ctx, `θ = ${fmtN(p.theta)}°`, A[0] + 54, A[1] - 14, c, 'left')
  } else {
    ctx.strokeStyle = c['--stage-ink']
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke()
  }

  const stepM = niceStep((narrow ? 60 : 80) / sc)
  ctx.font = `500 ${narrow ? 10 : 11}px 'JetBrains Mono', monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const inward: V2 = [sn, cs]
  for (let u = Math.ceil(uA / stepM) * stepM; u <= uB; u += stepM) {
    const q = S(u)
    ctx.strokeStyle = c['--stage-ink']
    ctx.globalAlpha = 0.6
    ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + inward[0] * 6, q[1] + inward[1] * 6); ctx.stroke()
    ctx.globalAlpha = 0.85
    ctx.fillStyle = c['--stage-ink']
    ctx.fillText(fmtN(Math.abs(u) < 1e-9 ? 0 : u, 2), q[0] + inward[0] * 18, q[1] + inward[1] * 18)
  }
  ctx.globalAlpha = 1
  const z = S(0)
  ctx.strokeStyle = c['--stage-ink']
  ctx.lineWidth = 1.5
  const flagTop: V2 = [z[0] + ePerp[0] * 34, z[1] + ePerp[1] * 34]
  ctx.beginPath(); ctx.moveTo(z[0], z[1]); ctx.lineTo(flagTop[0], flagTop[1]); ctx.stroke()
  ctx.fillStyle = c['--navy-500']
  ctx.beginPath(); ctx.moveTo(flagTop[0], flagTop[1]); ctx.lineTo(flagTop[0] + ePar[0] * 14 - ePerp[0] * 5, flagTop[1] + ePar[1] * 14 - ePerp[1] * 5); ctx.lineTo(flagTop[0] - ePerp[0] * 10, flagTop[1] - ePerp[1] * 10); ctx.closePath(); ctx.fill()

  const bw = Math.max(36, Math.min(76, 30 + 11 * Math.cbrt(p.m)))
  const bh = bw * 0.7
  const drawBlock = (u: number, ghost: boolean) => {
    const base = S(u)
    ctx.save()
    ctx.translate(base[0], base[1])
    ctx.rotate(-th)
    if (ghost) {
      ctx.strokeStyle = c['--navy-800']
      ctx.globalAlpha = 0.28
      ctx.lineWidth = 1.5
      roundRect(ctx, -bw / 2, -bh, bw, bh, 6)
      ctx.stroke()
    } else {
      ctx.fillStyle = 'rgba(12,29,56,0.18)'
      roundRect(ctx, -bw / 2 + 3, -bh + 4, bw, bh, 6)
      ctx.fill()
      const g = ctx.createLinearGradient(0, -bh, 0, 0)
      g.addColorStop(0, '#1c3a66')
      g.addColorStop(1, '#0c1d38')
      ctx.fillStyle = g
      roundRect(ctx, -bw / 2, -bh, bw, bh, 6)
      ctx.fill()
      ctx.fillStyle = c['--orange']
      ctx.fillRect(-bw / 2 + 6, -bh + 5, bw - 12, 4)
      ctx.fillStyle = '#f3ead9'
      ctx.font = `700 ${bw > 50 ? 13 : 11}px Sora, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${fmtN(p.m, 1)} kg`, 0, -bh / 2 + 2)
    }
    ctx.restore()
  }
  if (layers.marks) {
    for (let k = 1; k < 8; k++) {
      const tk = (p.T * k) / 8
      if (tk >= t) break
      const s = sampleAt(result.samples, tk)
      drawBlock(s.x, true)
      const q = S(s.x)
      ctx.fillStyle = c['--orange']
      ctx.globalAlpha = 0.6
      ctx.beginPath(); ctx.arc(q[0], q[1], 3, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
    }
  }
  const now = sampleAt(result.samples, t)
  drawBlock(now.x, false)

  const fRef = Math.max(p.m * p.g, ...result.samples.map((s) => Math.max(s.F, s.N, Math.abs(s.f))), 1)
  const k = (narrow ? 70 : 95) / fRef
  const base = S(now.x)
  const C: V2 = [base[0] + ePerp[0] * (bh / 2), base[1] + ePerp[1] * (bh / 2)]
  const vecs = forceVectors(p, now)
  const draw = (from: V2, v: V2, color: string, w: number, dashed: boolean, text: string, kk = k, shift = 0) => {
    const to: V2 = [from[0] + v[0] * kk, from[1] + v[1] * kk]
    arrow(ctx, from[0], from[1], to[0], to[1], color, w, dashed)
    const dx = to[0] - from[0], dy = to[1] - from[1]
    if (!text || Math.hypot(dx, dy) < 8) return
    if (Math.abs(dx) > Math.abs(dy)) label(ctx, text, to[0] + (dx > 0 ? 8 : -8), to[1] + shift, c, dx > 0 ? 'left' : 'right')
    else label(ctx, text, to[0] + shift, to[1] + (dy > 0 ? 14 : -14), c, 'center')
  }
  if (layers.components) {
    draw(C, loc(now.Ppar, 0), c['--stage-ink'], 1.6, true, 'P∥', k, -14)
    draw(C, loc(0, -vecs.Pperp), c['--stage-ink'], 1.6, true, 'P⊥', k, 18)
  }
  if (layers.weight) draw(C, [0, p.m * p.g], c['--stage-ink'], 3, false, `P = ${fmtN(p.m * p.g)} N`)
  if (layers.normal) draw(base, loc(0, now.N), c['--navy-500'], 3, false, `N = ${fmtN(now.N)} N`)
  if (layers.applied && now.F > 0) {
    draw(C, loc(vecs.Fpar, vecs.Fperp), c['--orange'], 3.5, false, `F = ${fmtN(now.F)} N`)
    if (Math.abs(p.phi) > 0.5) {
      ctx.strokeStyle = c['--orange']
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(C[0], C[1], 30, -th - (p.phi * Math.PI) / 180, -th, p.phi < 0)
      ctx.stroke()
    }
  }
  if (layers.friction && Math.abs(now.f) > 1e-6) draw(base, loc(now.f, 0), c['--bad'], 3, false, `fₐₜ = ${fmtN(Math.abs(now.f))} N`, k, 16)
  if (layers.resultant) {
    if (Math.abs(now.Fnet) > 1e-6) {
      const off: V2 = [C[0] + ePerp[0] * (bh / 2 + 40), C[1] + ePerp[1] * (bh / 2 + 40)]
      draw(off, loc(now.Fnet, 0), c['--accent-ink'], 4, false, `Fᵣ = ${fmtN(now.Fnet)} N`)
    } else {
      const off: V2 = [C[0] + ePerp[0] * (bh / 2 + 40), C[1] + ePerp[1] * (bh / 2 + 40)]
      label(ctx, 'Fᵣ = 0', off[0], off[1], c, 'center', true)
    }
  }
  if (layers.velocity && Math.abs(now.v) > 1e-3) {
    const vk = (narrow ? 50 : 70) / Math.max(result.vMaxAbs, 0.5)
    const off: V2 = [C[0] - ePerp[0] * 0 + ePerp[0] * (bh / 2 + 70), C[1] + ePerp[1] * (bh / 2 + 70)]
    draw(off, loc(now.v, 0), c['--series-4'], 2.5, false, `v = ${fmtN(now.v, 2)} m/s`, vk)
  }

  if (layers.fbd) {
    const size = narrow ? 112 : 156
    const bx = 12, by = 48
    ctx.fillStyle = c['--surface']
    ctx.globalAlpha = 0.94
    roundRect(ctx, bx, by, size, size + 18, 12)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = c['--stage-grid']
    ctx.lineWidth = 1
    roundRect(ctx, bx, by, size, size + 18, 12)
    ctx.stroke()
    ctx.fillStyle = c['--muted']
    ctx.font = `600 ${narrow ? 9.5 : 11}px Sora, system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('Corpo livre', bx + 10, by + 8)
    const O: V2 = [bx + size / 2, by + 18 + size / 2]
    const r = size * 0.36
    ctx.save()
    ctx.setLineDash([3, 4])
    ctx.strokeStyle = c['--muted']
    ctx.globalAlpha = 0.6
    ctx.beginPath(); ctx.moveTo(O[0] - ePar[0] * r * 1.1, O[1] - ePar[1] * r * 1.1); ctx.lineTo(O[0] + ePar[0] * r * 1.1, O[1] + ePar[1] * r * 1.1); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(O[0] - ePerp[0] * r * 1.1, O[1] - ePerp[1] * r * 1.1); ctx.lineTo(O[0] + ePerp[0] * r * 1.1, O[1] + ePerp[1] * r * 1.1); ctx.stroke()
    ctx.restore()
    const kk = r / fRef
    const mini = (v: V2, color: string, txt: string) => {
      const to: V2 = [O[0] + v[0] * kk, O[1] + v[1] * kk]
      if (Math.hypot(v[0] * kk, v[1] * kk) < 3) return
      arrow(ctx, O[0], O[1], to[0], to[1], color, 2.2, false)
      const len = Math.hypot(to[0] - O[0], to[1] - O[1]) || 1
      ctx.fillStyle = color
      ctx.font = `700 ${narrow ? 10 : 11}px Sora, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(txt, to[0] + ((to[0] - O[0]) / len) * 9, to[1] + ((to[1] - O[1]) / len) * 9)
    }
    mini([0, p.m * p.g], c['--stage-ink'], 'P')
    mini(loc(0, now.N), c['--navy-500'], 'N')
    if (now.F > 0) mini(loc(vecs.Fpar, vecs.Fperp), c['--orange'], 'F')
    if (Math.abs(now.f) > 1e-6) mini(loc(now.f, 0), c['--bad'], 'fₐₜ')
    ctx.fillStyle = c['--stage-ink']
    ctx.beginPath(); ctx.arc(O[0], O[1], 4, 0, Math.PI * 2); ctx.fill()
  }

  ctx.font = `600 13px 'JetBrains Mono', monospace`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillStyle = c['--stage-ink']
  ctx.fillText(`t = ${now.t.toFixed(2).replace('.', ',')} s`, W - 12, narrow ? 48 : 14)
}

function forceVectors(p: Params, s: Sample) {
  const ph = (p.phi * Math.PI) / 180
  return { Fpar: s.F * Math.cos(ph), Fperp: s.F * Math.sin(ph), Pperp: p.m * p.g * Math.cos((p.theta * Math.PI) / 180) }
}

function arrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, w: number, dashed: boolean) {
  const len = Math.hypot(x2 - x1, y2 - y1)
  if (len < 3) return
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len
  const head = Math.min(11, len * 0.45)
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = w
  ctx.lineCap = 'round'
  if (dashed) { ctx.setLineDash([4, 4]); ctx.globalAlpha = 0.75 }
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - ux * head * 0.6, y2 - uy * head * 0.6); ctx.stroke()
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - ux * head - uy * head * 0.5, y2 - uy * head + ux * head * 0.5)
  ctx.lineTo(x2 - ux * head + uy * head * 0.5, y2 - uy * head - ux * head * 0.5)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, c: Palette, align: CanvasTextAlign, strong = false) {
  ctx.font = `${strong ? 700 : 600} 12px Sora, system-ui, sans-serif`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  const w = ctx.measureText(text).width
  const cw = ctx.canvas.clientWidth
  let x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
  const x0c = Math.min(Math.max(x0, 8), cw - w - 8)
  x += x0c - x0
  x0 = x0c
  ctx.fillStyle = c['--surface']
  ctx.globalAlpha = 0.88
  roundRect(ctx, x0 - 5, y - 9, w + 10, 18, 6)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = strong ? c['--accent-ink'] : c['--stage-ink']
  ctx.fillText(text, x, y + 0.5)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
