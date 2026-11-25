import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, SkipForward, Target as TargetIcon, Bookmark, Trash2 } from 'lucide-react'
import { accelUp, criticalAngle, downsample, forceToHold, forceToStart, frictionCurve, sampleAt, simulate, type Params, type Result } from '../lib/physics'
import { Stage, type Layers } from '../components/Stage'
import { LineBox } from '../components/Charts'
import { Card, CsvButtons, Metric, Seg, Slider, Toggle } from '../components/ui'
import { MATERIALS, WORLDS } from '../data/content'
import { fmt } from '../lib/util'

const SAVED_COLORS = ['var(--series-4)', 'var(--series-3)', 'var(--navy-500)']

interface SavedRun { id: number; label: string; color: string; samples: Result['samples'] }

interface Props {
  params: Params
  setParams: (p: Params) => void
  result: Result
  active: boolean
}

export function SimTab({ params, setParams, result, active }: Props) {
  const set = (patch: Partial<Params>) => setParams({ ...params, ...patch })
  const timeRef = useRef(0)
  const [tView, setTView] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [layers, setLayers] = useState<Layers>({
    weight: true, components: false, normal: true, applied: true, friction: true, resultant: true, velocity: false, fbd: true, marks: true,
  })
  const [saved, setSaved] = useState<SavedRun[]>([])
  const [challenge, setChallenge] = useState(false)
  const [score, setScore] = useState({ tries: 0, hits: 0 })
  const [outcome, setOutcome] = useState<{ title: string; note: string } | null>(null)
  const playingRef = useRef(playing)
  playingRef.current = playing
  const resultRef = useRef(result)
  resultRef.current = result
  const speedRef = useRef(speed)
  speedRef.current = speed

  useEffect(() => {
    timeRef.current = 0
    setTView(0)
    setOutcome(null)
  }, [result])

  const Fmin = forceToStart(params)
  const onLandRef = useRef(() => {})
  onLandRef.current = () => {
    if (!challenge) return
    const r = resultRef.current
    const ok = r.moved && params.F <= Fmin * 1.05
    setScore((s) => ({ tries: s.tries + 1, hits: s.hits + (ok ? 1 : 0) }))
    if (!r.moved) setOutcome({ title: 'Não saiu do lugar', note: 'O atrito estático segurou. Aumente um pouco a força.' })
    else if (ok) setOutcome({ title: 'Na medida!', note: `Força mínima: ${fmt(Fmin, 1)} N. Clique em Novo bloco.` })
    else setOutcome({ title: 'Moveu, mas sobrou força', note: `Dava com ${fmt(Fmin, 1)} N. Tente chegar mais perto do limite.` })
  }

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastUi = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dtReal = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!playingRef.current) return
      const T = resultRef.current.samples[resultRef.current.samples.length - 1].t
      let t = timeRef.current + dtReal * speedRef.current
      if (t >= T) {
        t = T
        timeRef.current = t
        setTView(t)
        setPlaying(false)
        onLandRef.current()
        return
      }
      timeRef.current = t
      if (now - lastUi > 90) { lastUi = now; setTView(t) }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const T = result.samples[result.samples.length - 1].t
  const play = () => {
    if (timeRef.current >= T - 1e-9) { timeRef.current = 0; setTView(0); setOutcome(null) }
    setPlaying(true)
  }
  const reset = () => { timeRef.current = 0; setTView(0); setPlaying(false); setOutcome(null) }
  const toEnd = () => { timeRef.current = T; setTView(T); setPlaying(false) }

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') return
      if (e.code === 'Space') { e.preventDefault(); if (playingRef.current) setPlaying(false); else play() }
      if (e.key === 'r' || e.key === 'R') reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const newBlock = () => {
    const mat = MATERIALS[Math.floor(Math.random() * 4)]
    setParams({
      ...params, m: Math.round((2 + Math.random() * 18) * 10) / 10, theta: Math.round(Math.random() * 25), muS: mat.muS, muK: mat.muK,
      F: 0, phi: 0, mode: 'constante', v0: 0, b: 0, g: 9.81,
    })
    reset()
  }

  const now = sampleAt(result.samples, tView)
  const ended = tView >= T - 1e-9
  const muK = Math.min(params.muK, params.muS)
  const thetaC = criticalAngle(params.muS)
  const hold = forceToHold(params)
  const Fuse = params.mode === 'rampa' ? now.F : params.F
  const aTheory = accelUp(params, Fuse)

  const chartData = useMemo(() => {
    const ds = downsample(result.samples, 260)
    return ds.map((s) => {
      const row: Record<string, number> = {
        t: +s.t.toFixed(4), x: s.x, v: s.v, a: s.a, Fpar: s.Fpar, Ppar: s.Ppar, f: s.f, Fnet: s.Fnet, ek: s.ek, ep: s.ep, wF: s.wF, eDiss: s.eDiss,
      }
      saved.forEach((r, i) => { if (s.t <= r.samples[r.samples.length - 1].t + 1e-9) row[`s${i}`] = sampleAt(r.samples, s.t).x })
      return row
    })
  }, [result, saved])

  const fricData = useMemo(() => {
    const Fmax = Math.max(10, Math.min(Number.isFinite(Fmin) ? Fmin * 2 : 100, 400), params.mode === 'rampa' ? params.F + params.rate * params.T : params.F * 1.3)
    const curve: Record<string, number | null>[] = frictionCurve(params, Fmax).map((r) => ({ ...r, sim: null }))
    if (params.mode === 'rampa') {
      downsample(result.samples, 160).forEach((s) => curve.push({ F: s.F, estatico: null, cinetico: null, maximo: null, sim: Math.abs(s.f) }))
      curve.sort((a, b) => (a.F as number) - (b.F as number))
    }
    return curve
  }, [params, result, Fmin])

  const matId = MATERIALS.find((m) => m.muS === params.muS && m.muK === params.muK)?.id ?? 'custom'
  const worldId = WORLDS.find((w) => w.g === params.g)?.id ?? 'custom'
  const L = (k: keyof Layers) => (v: boolean) => setLayers({ ...layers, [k]: v })

  const state = now.regime === 0 ? 'Em repouso' : now.regime > 0 ? 'Deslizando ↑' : 'Deslizando ↓'
  const situ = !result.moved ? 'Parado o tempo todo' : result.samples[result.samples.length - 1].regime === 0 ? 'Moveu e parou' : result.vEnd > 0 ? 'Desliza para a frente' : 'Desliza para trás'

  const saveRun = () => {
    if (saved.length >= 3) return
    const label = `${fmt(params.F, 0)} N · ${fmt(params.m, 1)} kg · ${fmt(params.theta, 0)}° · μc ${fmt(muK, 2)}`
    setSaved([...saved, { id: Date.now(), label, color: SAVED_COLORS[saved.length], samples: downsample(result.samples, 600) }])
  }

  const analyticErr = (() => {
    if (params.mode !== 'constante' || params.method === 'analitico') return null
    const ref = simulate({ ...params, method: 'analitico' })
    return ref.xEnd !== 0 ? ((result.xEnd - ref.xEnd) / Math.abs(ref.xEnd)) * 100 : result.xEnd === 0 ? 0 : NaN
  })()

  return (
    <>
      <div className="section-head">
        <div>
          <h2>Puxe, observe, compare</h2>
          <p className="muted">Ajuste a força, o bloco e a superfície à direita e veja as forças, o movimento e os gráficos responderem. Espaço = soltar/pausar · R = reiniciar.</p>
        </div>
      </div>

      <div className="sim">
        <div className="sim-main">
          <section className="card stage-card">
            <div className="stage-chips">
              <span className={`chip-s${now.regime !== 0 ? ' hot' : ''}`}>{state}</span>
              <span className="chip-s">{now.regime === 0 ? 'Atrito estático' : 'Atrito cinético'}</span>
              {result.lifted && <span className="chip-s hot">N = 0: o bloco perde contato</span>}
              {challenge && <span className="chip-s">Acertos {score.hits}/{score.tries}</span>}
            </div>
            <div className="stage">
              <Stage params={params} result={result} layers={layers} timeRef={timeRef} />
              {outcome && (
                <div className="toast-hit" role="status">{outcome.title}<small>{outcome.note}</small></div>
              )}
            </div>
            <div className="transport">
              {playing ? (
                <button className="btn primary" onClick={() => setPlaying(false)}><Pause size={18} /> Pausar</button>
              ) : (
                <button className="btn primary" onClick={play}><Play size={18} /> {ended ? 'Soltar de novo' : 'Soltar'}</button>
              )}
              <button className="btn icon" onClick={reset} aria-label="Reiniciar" title="Reiniciar (R)"><RotateCcw size={18} /></button>
              <button className="btn icon" onClick={toEnd} aria-label="Ir ao fim" title="Ir ao fim"><SkipForward size={18} /></button>
              <div className="timeline">
                <input
                  type="range" aria-label="Linha do tempo" min={0} max={T} step={T / 500} value={tView}
                  style={{ ['--pct' as string]: `${(tView / T) * 100}%` }}
                  onChange={(e) => { const t = parseFloat(e.target.value); timeRef.current = t; setTView(t); setPlaying(false) }}
                />
              </div>
              <div className="seg" role="group" aria-label="Velocidade da animação">
                {[0.25, 0.5, 1, 2].map((s) => (
                  <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{String(s).replace('.', ',')}×</button>
                ))}
              </div>
            </div>
            <div className="readouts">
              <div className="readout"><span>tempo</span><b>{fmt(now.t)} s</b></div>
              <div className="readout"><span>posição x</span><b>{fmt(now.x)} m</b></div>
              <div className="readout"><span>velocidade</span><b>{fmt(now.v)} m/s</b></div>
              <div className="readout hl"><span>aceleração</span><b>{fmt(now.a)} m/s²</b></div>
              <div className="readout"><span>força aplicada</span><b>{fmt(now.F, 1)} N</b></div>
              <div className="readout"><span>normal</span><b>{fmt(now.N, 1)} N</b></div>
              <div className="readout"><span>atrito</span><b>{fmt(Math.abs(now.f), 1)} N</b></div>
              <div className="readout hl"><span>resultante</span><b>{fmt(now.Fnet, 1)} N</b></div>
            </div>
          </section>

          <div className="results">
            <Metric lead label="Situação" value={situ} note={Number.isFinite(result.tStart) && result.tStart > 0 ? `começou a deslizar em t = ${fmt(result.tStart)} s` : Number.isFinite(result.tStop) ? `parou em t = ${fmt(result.tStop)} s` : `em ${fmt(params.T, 1)} s de simulação`} />
            <Metric label="Força mínima para mover" value={challenge && !ended ? '?' : Number.isFinite(Fmin) ? fmt(Fmin, 1) : '∞'} unit="N" note={hold > 0 ? `para segurar parado: ${fmt(hold, 1)} N` : `atrito estático máx.: ${fmt(params.muS * Math.max(0, params.m * params.g * Math.cos((params.theta * Math.PI) / 180)), 1)} N`} />
            <Metric label="Aceleração deslizando" value={fmt(aTheory, 2)} unit="m/s²" note={aTheory < 0 ? `com F = ${fmt(Fuse, 1)} N não acelera para a frente` : `teoria com F = ${fmt(Fuse, 1)} N${params.b > 0 ? ', sem amortecimento' : ''}`} />
            <Metric label="Deslocamento" value={challenge && !ended ? '?' : fmt(result.xEnd, 2)} unit="m" note={`velocidade final ${fmt(result.vEnd, 2)} m/s`} />
            <Metric label="Ângulo crítico θc" value={fmt(thetaC, 1)} unit="°" note={params.theta > thetaC ? 'acima: escorrega sozinho' : 'abaixo: fica parado sem força'} />
            <Metric label="Erro vs. analítico" value={analyticErr === null ? '—' : Math.abs(analyticErr) < 1e-6 ? '≈ 0' : fmt(analyticErr, 4)} unit={analyticErr === null ? '' : '%'} note={analyticErr === null ? (params.method === 'analitico' ? 'é a própria solução analítica' : 'rampa de força: sem solução fechada') : `${result.steps} passos de ${fmt(params.dt, 3)} s`} />
          </div>
        </div>

        <aside className="panel">
          <Card title="Força aplicada">
            <div className="ctl-group">
              <Seg label="Tipo de força" value={params.mode}
                options={[{ value: 'constante', label: 'Constante' }, { value: 'rampa', label: 'Cresce com o tempo' }]}
                onChange={(m) => set({ mode: m, method: m === 'rampa' && params.method === 'analitico' ? 'rk4' : params.method })} />
              <Slider label={params.mode === 'rampa' ? 'Força inicial F₀' : 'Força F'} value={params.F} min={0} max={200} step={0.5} decimals={1} unit="N" onChange={(v) => set({ F: v })} />
              {params.mode === 'rampa' && <Slider label="Taxa de aumento" value={params.rate} min={0.5} max={50} step={0.5} decimals={1} unit="N/s" onChange={(v) => set({ rate: v })} />}
              <Slider label="Ângulo da força φ" value={params.phi} min={-30} max={60} step={1} decimals={0} unit="°" onChange={(v) => set({ phi: v })} />
            </div>
          </Card>

          <Card title="Bloco e superfície">
            <div className="ctl-group">
              <Slider label="Massa m" value={params.m} min={0.5} max={50} step={0.5} decimals={1} unit="kg" onChange={(v) => set({ m: v })} />
              <Slider label="Inclinação θ" value={params.theta} min={0} max={60} step={0.5} decimals={1} unit="°" onChange={(v) => set({ theta: v })} />
              <Seg label="Materiais" value={matId} options={MATERIALS.map((m) => ({ value: m.id, label: m.name }))}
                onChange={(id) => { const m = MATERIALS.find((x) => x.id === id)!; set({ muS: m.muS, muK: m.muK }) }} />
              <Slider label="Atrito estático μe" value={params.muS} min={0} max={1.2} step={0.01} decimals={2} onChange={(v) => set({ muS: v, muK: Math.min(params.muK, v) })} />
              <Slider label="Atrito cinético μc" value={muK} min={0} max={1.2} step={0.01} decimals={2} onChange={(v) => set({ muK: Math.min(v, params.muS) })} />
              {params.muK > params.muS && <p className="note warn">μc não pode ser maior que μe.</p>}
              <details className="more">
                <summary>Mais opções</summary>
                <div className="ctl-group" style={{ marginTop: 10 }}>
                  <Seg label="Onde" value={worldId} options={WORLDS.map((w) => ({ value: w.id, label: w.name }))} onChange={(id) => set({ g: WORLDS.find((w) => w.id === id)!.g })} />
                  <Slider label="Velocidade inicial v₀" value={params.v0} min={-15} max={15} step={0.5} decimals={1} unit="m/s" onChange={(v) => set({ v0: v })} />
                  <Slider label="Amortecimento viscoso b" value={params.b} min={0} max={10} step={0.1} decimals={1} unit="N·s/m" onChange={(v) => set({ b: v })} />
                  <Slider label="Duração" value={params.T} min={1} max={20} step={0.5} decimals={1} unit="s" onChange={(v) => set({ T: v })} />
                </div>
              </details>
            </div>
          </Card>

          <Card title="Método numérico">
            <div className="ctl-group">
              <Seg value={params.method}
                options={[
                  { value: 'analitico', label: 'Analítico', disabled: params.mode === 'rampa', title: 'Só com força constante' },
                  { value: 'euler', label: 'Euler' },
                  { value: 'rk4', label: 'RK4' },
                ]}
                onChange={(m) => set({ method: m })} />
              <Seg label="Passo de tempo Δt" value={String(params.dt)}
                options={['0.001', '0.005', '0.01', '0.05', '0.1'].map((d) => ({ value: d, label: `${d.replace('.', ',')} s` }))}
                onChange={(d) => set({ dt: parseFloat(d) })} />
              {params.method === 'euler' && <p className="note">Euler erra a posição proporcionalmente a Δt. Aumente o passo e veja o “Erro vs. analítico”.</p>}
            </div>
          </Card>

          <Card title="Camadas">
            <div className="ctl-group" style={{ gap: 2 }}>
              <Toggle label="Diagrama de corpo livre" checked={layers.fbd} onChange={L('fbd')} />
              <Toggle label="Peso P" checked={layers.weight} onChange={L('weight')} color="var(--stage-ink)" />
              <Toggle label="Componentes do peso" checked={layers.components} onChange={L('components')} color="var(--stage-ink)" dashed />
              <Toggle label="Normal N" checked={layers.normal} onChange={L('normal')} color="var(--navy-500)" />
              <Toggle label="Força aplicada F" checked={layers.applied} onChange={L('applied')} color="var(--orange)" />
              <Toggle label="Atrito fₐₜ" checked={layers.friction} onChange={L('friction')} color="var(--bad)" />
              <Toggle label="Resultante Fᵣ" checked={layers.resultant} onChange={L('resultant')} color="var(--accent-ink)" />
              <Toggle label="Velocidade v" checked={layers.velocity} onChange={L('velocity')} color="var(--series-4)" />
              <Toggle label="Marcas de tempo" checked={layers.marks} onChange={L('marks')} />
            </div>
          </Card>

          <Card title="Comparar e desafiar">
            <div className="ctl-group">
              <div className="btn-row">
                <button className="btn sm" onClick={saveRun} disabled={saved.length >= 3}><Bookmark size={16} /> Salvar corrida</button>
                <button className="btn sm" onClick={() => setSaved([])} disabled={!saved.length}><Trash2 size={16} /> Limpar</button>
              </div>
              <div className="btn-row">
                <span className="ctl-label" style={{ alignSelf: 'center' }}>Corrida atual:</span>
                <CsvButtons name="bloco.csv" rows={() => result.samples.map((s) => ({ t: s.t, x: s.x, v: s.v, a: s.a, F: s.F, N: s.N, atrito: s.f, resultante: s.Fnet, regime: s.regime === 0 ? 'repouso' : 'deslizando', Ec: s.ek, Ep: s.ep, W_F: s.wF, E_dissipada: s.eDiss }))} />
              </div>
              {saved.length > 0 && (
                <ul className="clean" style={{ listStyle: 'none', padding: 0, gap: 4, fontSize: 13 }}>
                  {saved.map((s) => (
                    <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="legend-dot" style={{ background: s.color }} /> {s.label}
                    </li>
                  ))}
                </ul>
              )}
              <Toggle
                label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><TargetIcon size={16} /> Desafio: descubra a força mínima</span>}
                checked={challenge}
                onChange={(v) => { setChallenge(v); setScore({ tries: 0, hits: 0 }); if (v) newBlock(); else setOutcome(null) }}
              />
              {challenge && (
                <>
                  <p className="note">Ajuste só a força para tirar o bloco do lugar com no máximo 5% a mais que o necessário. Use μe, a massa e a inclinação.</p>
                  <button className="btn sm dark" onClick={newBlock}>Novo bloco</button>
                </>
              )}
            </div>
          </Card>
        </aside>

        <div className="grid g2 sim-charts">
          <Card>
            <LineBox title="Forças ao longo da superfície × tempo" unit="N" xKey="t" xLabel="t (s)" data={chartData} cursor={tView}
              series={[
                { key: 'Fpar', name: 'F·cos φ', color: 'var(--series-2)' },
                { key: 'f', name: 'atrito', color: 'var(--bad)' },
                ...(params.theta > 0 ? [{ key: 'Ppar', name: 'P∥', color: 'var(--series-3)', dash: true }] : []),
                { key: 'Fnet', name: 'resultante', color: 'var(--series-1)', width: 2.8 },
              ]} />
          </Card>
          <Card>
            <LineBox title="Atrito × força aplicada" unit="N" xKey="F" xLabel="F (N)" data={fricData as Record<string, number>[]} cursor={params.mode === 'constante' ? params.F : now.F}
              series={[
                { key: 'estatico', name: 'estático', color: 'var(--series-1)' },
                { key: 'cinetico', name: 'cinético', color: 'var(--bad)' },
                { key: 'maximo', name: 'μe·N', color: 'var(--series-3)', dash: true, width: 1.5 },
                ...(params.mode === 'rampa' ? [{ key: 'sim', name: 'simulado', color: 'var(--series-2)', width: 1.5 }] : []),
              ]} />
          </Card>
          <Card>
            <LineBox title="Posição × tempo" unit="m" xKey="t" xLabel="t (s)" data={chartData} cursor={tView}
              series={[{ key: 'x', name: 'atual', color: 'var(--series-2)' }, ...saved.map((s, i) => ({ key: `s${i}`, name: `corrida ${i + 1}`, color: s.color, dash: true }))]} />
          </Card>
          <Card>
            <LineBox title="Velocidade × tempo" unit="m/s" xKey="t" xLabel="t (s)" data={chartData} cursor={tView}
              series={[{ key: 'v', name: 'v', color: 'var(--series-1)' }]} />
          </Card>
          <Card>
            <LineBox title="Aceleração × tempo" unit="m/s²" xKey="t" xLabel="t (s)" data={chartData} cursor={tView}
              series={[{ key: 'a', name: 'a', color: 'var(--series-2)' }]} />
          </Card>
          <Card>
            <LineBox title="Energia × tempo" unit="J" xKey="t" xLabel="t (s)" data={chartData} cursor={tView} digits={2}
              series={[
                { key: 'wF', name: 'trabalho de F', color: 'var(--series-2)' },
                { key: 'ek', name: 'cinética', color: 'var(--series-1)' },
                ...(params.theta > 0 ? [{ key: 'ep', name: 'potencial', color: 'var(--series-4)' }] : []),
                { key: 'eDiss', name: 'dissipada', color: 'var(--bad)', dash: true },
              ]} />
          </Card>
        </div>
      </div>
    </>
  )
}

export function useSimulation(params: Params) {
  return useMemo(() => simulate(params), [params])
}
