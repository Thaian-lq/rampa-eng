import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ScatterChart, Scatter, Line, ComposedChart } from 'recharts'
import { FlaskConical, Shuffle, Save } from 'lucide-react'
import { forceToStart, simulate, type Params } from '../lib/physics'
import { describe, histogram, linreg, rng, welch } from '../lib/stats'
import { LineBox, axisFmt } from '../components/Charts'
import { Card, CsvButtons, Metric, Tip } from '../components/ui'
import { fmt, fmtP, store, type ExperimentRecord } from '../lib/util'

type VarKey = 'F' | 'm' | 'theta' | 'muK' | 'muS' | 'phi'
const VARS: { key: VarKey; label: string; unit: string; from: number; to: number }[] = [
  { key: 'F', label: 'Força aplicada F', unit: 'N', from: 0, to: 80 },
  { key: 'm', label: 'Massa m', unit: 'kg', from: 1, to: 20 },
  { key: 'theta', label: 'Inclinação θ', unit: '°', from: 0, to: 45 },
  { key: 'muK', label: 'Atrito cinético μc', unit: '', from: 0, to: 0.5 },
  { key: 'muS', label: 'Atrito estático μe', unit: '', from: 0.2, to: 1 },
  { key: 'phi', label: 'Ângulo da força φ', unit: '°', from: 0, to: 60 },
]
const RAD = Math.PI / 180
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

interface SweepRow { value: number; a_com: number; a_sem: number; d_com: number; d_sem: number; f_com: number; moved: number }

const run = (p: Params) => {
  const r = simulate({ ...p, mode: 'constante', method: 'rk4', dt: 0.005 })
  return { a: (r.vEnd - p.v0) / p.T, d: r.xEnd, f: Math.abs(r.samples[r.samples.length - 1].f), moved: r.moved }
}

export function ExpTab({ params, online }: { params: Params; online: boolean }) {
  const [history, setHistory] = useState<ExperimentRecord[]>([])
  const refresh = () => store.listExperiments().then(setHistory).catch(() => setHistory([]))
  useEffect(() => { refresh() }, [online])

  return (
    <>
      <div className="section-head">
        <div>
          <h2>Experimentos virtuais</h2>
          <p className="muted">
            Partem do bloco configurado no Simulador, com força constante{params.mode === 'rampa' ? ` (no modo “cresce com o tempo”, usa-se a força inicial, ${fmt(params.F, 1)} N)` : ''}. A varredura muda uma variável por vez; as repetições simulam a incerteza de
            experimentos reais e geram dados para a análise estatística.
          </p>
        </div>
      </div>
      <Sweep params={params} onSaved={refresh} />
      <div style={{ height: 16 }} />
      <MonteCarlo params={params} onSaved={refresh} />
      <div style={{ height: 16 }} />
      <Card title={`Experimentos salvos ${online ? '(banco SQLite)' : '(neste navegador)'}`}>
        {history.length === 0 ? (
          <p className="muted">Nenhum experimento salvo ainda. Use “Salvar no banco” depois de rodar uma varredura ou repetição.</p>
        ) : (
          <div className="scroll">
            <table>
              <thead><tr><th>Quando</th><th>Tipo</th><th>Descrição</th><th>Resumo</th></tr></thead>
              <tbody>
                {history.slice(0, 30).map((h) => (
                  <tr key={h.id}>
                    <td className="num">{h.created_at ? new Date(h.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}</td>
                    <td>{h.kind}</td>
                    <td>{h.label}</td>
                    <td style={{ fontSize: 13 }}>{Object.entries(h.summary).map(([k, v]) => `${k}: ${typeof v === 'number' ? fmt(v, 3) : String(v)}`).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

function Sweep({ params, onSaved }: { params: Params; onSaved: () => void }) {
  const [vk, setVk] = useState<VarKey>('F')
  const def = VARS.find((v) => v.key === vk)!
  const [from, setFrom] = useState(def.from)
  const [to, setTo] = useState(def.to)
  const [n, setN] = useState(41)
  const [rows, setRows] = useState<SweepRow[] | null>(null)
  const [saved, setSaved] = useState(false)

  const go = () => {
    const out: SweepRow[] = []
    const steps = Math.max(2, Math.min(200, Math.round(n)))
    for (let i = 0; i < steps; i++) {
      const value = from + ((to - from) * i) / (steps - 1)
      const p: Params = { ...params, [vk]: value }
      if (vk === 'muS') p.muK = Math.min(p.muK, value)
      if (vk === 'muK') p.muS = Math.max(p.muS, value)
      const A = run(p)
      const B = run({ ...p, muS: 0, muK: 0 })
      out.push({ value, a_com: A.a, a_sem: B.a, d_com: A.d, d_sem: B.d, f_com: A.f, moved: A.moved ? 1 : 0 })
    }
    setRows(out)
    setSaved(false)
  }
  useEffect(go, []) 

  const analysis = useMemo(() => {
    if (!rows) return null
    const firstMove = rows.find((r) => r.moved)
    let reg: { x: number[]; y: number[]; xLabel: string; slopeTh?: number; interTh?: number; muEst?: number } | null = null
    const mv = rows.filter((r) => r.moved && r.a_com > 1e-9)
    const k = Math.min(params.muK, params.muS)
    const c = Math.cos(params.phi * RAD), s = Math.sin(params.phi * RAD), st = Math.sin(params.theta * RAD), ct = Math.cos(params.theta * RAD)
    if (vk === 'F' && mv.length >= 2) {
      reg = { x: mv.map((r) => r.value), y: mv.map((r) => r.a_com), xLabel: 'F (N)', slopeTh: (c + k * s) / params.m, interTh: -params.g * (st + k * ct) }
    } else if (vk === 'm' && mv.length >= 2) {
      reg = { x: mv.map((r) => 1 / r.value), y: mv.map((r) => r.a_com), xLabel: '1/m (1/kg)', slopeTh: params.F * (c + k * s), interTh: -params.g * (st + k * ct) }
    } else if (mv.length >= 2) {
      reg = { x: mv.map((r) => r.value), y: mv.map((r) => r.a_com), xLabel: def.label }
    }
    const fit = reg ? linreg(reg.x, reg.y) : null
    if (reg && fit && (vk === 'F' || vk === 'm') && Math.abs(params.phi) < 1e-9 && ct > 0) reg.muEst = (-fit.intercept / params.g - st) / ct
    return { firstMove, reg, fit }
  }, [rows, vk, params, def.label])

  const changeVar = (key: VarKey) => { const d = VARS.find((v) => v.key === key)!; setVk(key); setFrom(d.from); setTo(d.to) }

  const save = async () => {
    if (!rows || !analysis) return
    const summary: Record<string, unknown> = { 'pontos que se moveram': rows.filter((r) => r.moved).length }
    if (analysis.firstMove) summary[`primeiro ${def.label} com movimento`] = analysis.firstMove.value
    if (analysis.fit) { summary['inclinação'] = analysis.fit.slope; summary['R²'] = analysis.fit.r2 }
    if (analysis.reg?.muEst !== undefined) summary['μc estimado'] = analysis.reg.muEst
    await store.saveExperiment({
      kind: 'varredura',
      label: `${def.label} de ${fmt(from, 2)} a ${fmt(to, 2)} ${def.unit} (m ${fmt(params.m, 1)} kg, θ ${fmt(params.theta, 1)}°, μe ${fmt(params.muS, 2)}, μc ${fmt(params.muK, 2)})`,
      params: { ...params, variable: vk, from, to, steps: rows.length },
      summary,
    })
    setSaved(true)
    onSaved()
  }

  const scatter = analysis?.reg && analysis.fit ? analysis.reg.x.map((x, i) => ({ x, y: analysis.reg!.y[i], fit: analysis.fit!.intercept + analysis.fit!.slope * x })).sort((a, b) => a.x - b.x) : null
  const Fmin = forceToStart(params)

  return (
    <Card
      title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><FlaskConical size={18} /> Varredura de parâmetro</span>}
      actions={rows && (
        <>
          <CsvButtons name={`varredura_${vk}.csv`} rows={() => rows.map((r) => ({ [vk]: r.value, a_com_atrito: r.a_com, a_sem_atrito: r.a_sem, d_com_atrito: r.d_com, d_sem_atrito: r.d_sem, atrito_final: r.f_com, moveu: r.moved }))} />
          <button className="btn sm dark" onClick={save} disabled={saved}><Save size={15} /> {saved ? 'Salvo' : 'Salvar no banco'}</button>
        </>
      )}
    >
      <div className="form-row" style={{ marginBottom: 14 }}>
        <label className="field">Variável
          <select value={vk} onChange={(e) => changeVar(e.target.value as VarKey)}>
            {VARS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
        </label>
        <label className="field">De ({def.unit || '—'})<input type="number" value={from} step="any" onChange={(e) => setFrom(parseFloat(e.target.value))} /></label>
        <label className="field">Até ({def.unit || '—'})<input type="number" value={to} step="any" onChange={(e) => setTo(parseFloat(e.target.value))} /></label>
        <label className="field">Pontos<input type="number" value={n} min={2} max={200} onChange={(e) => setN(parseFloat(e.target.value))} /></label>
        <button className="btn primary" onClick={go}>Rodar varredura</button>
      </div>

      {rows && analysis && (
        <>
          <p className="finding" style={{ marginBottom: 14 }}>
            {vk === 'F' ? (
              analysis.firstMove ? <>O bloco começa a se mover a partir de <em>{fmt(analysis.firstMove.value, 1)} N</em> (teoria: {fmt(Fmin, 1)} N, com pontos a cada {fmt((to - from) / Math.max(1, Math.round(n) - 1), 1)} N); abaixo disso, o atrito estático anula a força.</> : <>Nenhuma força do intervalo tirou o bloco do repouso (é preciso {fmt(Fmin, 1)} N).</>
            ) : vk === 'theta' && params.F === 0 ? (
              analysis.firstMove ? <>Sem força, o bloco escorrega sozinho a partir de <em>{fmt(analysis.firstMove.value, 1)}°</em> (teoria: arctg μe = {fmt(Math.atan(params.muS) / RAD, 1)}°).</> : <>O bloco não escorrega em nenhum ângulo do intervalo.</>
            ) : (
              <>Com atrito, a aceleração média vai de <em>{fmt(Math.min(...rows.map((r) => r.a_com)), 2)}</em> a <em>{fmt(Math.max(...rows.map((r) => r.a_com)), 2)} m/s²</em>; sem atrito, de {fmt(Math.min(...rows.map((r) => r.a_sem)), 2)} a {fmt(Math.max(...rows.map((r) => r.a_sem)), 2)} m/s².</>
            )}
          </p>
          <div className="grid g2">
            <LineBox title={`Aceleração média × ${lower(def.label)}`} unit="m/s²" xKey="value" xLabel={def.label} data={rows as unknown as Record<string, number>[]}
              series={[{ key: 'a_sem', name: 'sem atrito', color: 'var(--series-1)', dash: true }, { key: 'a_com', name: 'com atrito', color: 'var(--series-2)' }]} />
            <LineBox title={`Deslocamento em ${fmt(params.T, 1)} s × ${lower(def.label)}`} unit="m" xKey="value" xLabel={def.label} data={rows as unknown as Record<string, number>[]}
              series={[{ key: 'd_sem', name: 'sem atrito', color: 'var(--series-1)', dash: true }, { key: 'd_com', name: 'com atrito', color: 'var(--series-2)' }]} />
          </div>
          {analysis.reg && analysis.fit && scatter ? (
            <div className="grid g2" style={{ marginTop: 16, alignItems: 'start' }}>
              <div>
                <div className="chart-title"><h3>Regressão linear: a × {analysis.reg.xLabel}</h3><span>só pontos com movimento</span></div>
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={scatter} margin={{ top: 6, right: 10, bottom: 4, left: -8 }}>
                      <CartesianGrid strokeDasharray="3 4" vertical={false} />
                      <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tickFormatter={axisFmt} tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={axisFmt} tick={{ fontSize: 11 }} width={50} />
                      <Tooltip content={<Tip xLabel={analysis.reg.xLabel} digits={3} />} isAnimationActive={false} />
                      <Scatter dataKey="y" name="simulado" fill="var(--series-2)" isAnimationActive={false} />
                      <Line dataKey="fit" name="ajuste" stroke="var(--series-1)" dot={false} strokeWidth={2} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="grid" style={{ gap: 10 }}>
                <div className="results" style={{ marginTop: 0 }}>
                  <Metric label="Inclinação (ajuste)" value={fmt(analysis.fit.slope, 4)} note={analysis.reg.slopeTh !== undefined ? `teoria ${fmt(analysis.reg.slopeTh, 4)}` : undefined} />
                  <Metric label="Intercepto" value={fmt(analysis.fit.intercept, 3)} note={analysis.reg.interTh !== undefined ? `teoria ${fmt(analysis.reg.interTh, 3)}` : undefined} />
                  <Metric label="R²" value={fmt(analysis.fit.r2, 5)} />
                  {analysis.reg.muEst !== undefined && <Metric lead label="μc estimado pelo intercepto" value={fmt(analysis.reg.muEst, 3)} note={`valor usado: ${fmt(Math.min(params.muK, params.muS), 3)}`} />}
                </div>
                <p className="note">
                  {vk === 'F' && 'Deslizando, a = F·(cos φ + μc·sen φ)/m − g·(sen θ + μc·cos θ): reta em F com inclinação 1/m (φ = 0). O intercepto revela o atrito cinético.'}
                  {vk === 'm' && 'Com F fixa, a = F/m − g·(sen θ + μc·cos θ): reta em 1/m com inclinação F (φ = 0).'}
                  {vk !== 'F' && vk !== 'm' && 'Ajuste linear exploratório. R² abaixo de 1 indica que a relação não é linear nessa variável.'}
                  {params.b > 0 && ' Com amortecimento b > 0 a aceleração não é constante e a reta deixa de ser exata.'}
                </p>
              </div>
            </div>
          ) : (
            <p className="note" style={{ marginTop: 12 }}>A regressão aparece quando pelo menos dois pontos da varredura têm o bloco em movimento.</p>
          )}
        </>
      )}
    </Card>
  )
}

function MonteCarlo({ params, onSaved }: { params: Params; onSaved: () => void }) {
  const [N, setN] = useState(200)
  const [sF, setSF] = useState(5)
  const [sMu, setSMu] = useState(10)
  const [sM, setSM] = useState(2)
  const [seed, setSeed] = useState(42)
  const [data, setData] = useState<{ F: number; muK: number; m: number; dA: number; dB: number; moved: boolean }[] | null>(null)
  const [saved, setSaved] = useState(false)

  const go = () => {
    const r = rng(seed)
    const out = []
    const count = Math.max(10, Math.min(3000, Math.round(N)))
    for (let i = 0; i < count; i++) {
      const F = Math.max(0, params.F * (1 + (sF / 100) * r.normal()))
      const fac = Math.max(0, 1 + (sMu / 100) * r.normal())
      const m = Math.max(0.1, params.m * (1 + (sM / 100) * r.normal()))
      const muS = params.muS * fac, muK = Math.min(params.muK, params.muS) * fac
      const p = { ...params, F, m, muS, muK, dt: 0.01 }
      const B = run(p)
      const A = run({ ...p, muS: 0, muK: 0 })
      out.push({ F, muK, m, dA: A.d, dB: B.d, moved: B.moved })
    }
    setData(out)
    setSaved(false)
  }
  useEffect(go, [])

  const stats = useMemo(() => {
    if (!data) return null
    const A = data.map((d) => d.dA), B = data.map((d) => d.dB)
    const movedPct = (data.filter((d) => d.moved).length / data.length) * 100
    return { a: describe(A), b: describe(B), test: welch(A, B), hist: histogram([A, B], 24), movedPct }
  }, [data])

  const save = async () => {
    if (!stats) return
    await store.saveExperiment({
      kind: 'monte-carlo',
      label: `${data!.length} puxadas, σF ${sF}%, σμ ${sMu}%, σm ${sM}% (F ${fmt(params.F, 1)} N, m ${fmt(params.m, 1)} kg, θ ${fmt(params.theta, 1)}°)`,
      params: { ...params, N: data!.length, sigma_F_pct: sF, sigma_mu_pct: sMu, sigma_m_pct: sM, seed },
      summary: { 'média sem atrito (m)': stats.a.mean, 'média com atrito (m)': stats.b.mean, 'DP com atrito': stats.b.std, '% que se moveu': stats.movedPct, p: stats.test.p },
    })
    setSaved(true)
    onSaved()
  }

  const rowsStat = stats
    ? ([
        ['n', stats.a.n, stats.b.n, 0],
        ['Média (m)', stats.a.mean, stats.b.mean, 2],
        ['Mediana (m)', stats.a.median, stats.b.median, 2],
        ['Desvio padrão (m)', stats.a.std, stats.b.std, 3],
        ['Coef. de variação (%)', stats.a.cv, stats.b.cv, 2],
        ['Mínimo (m)', stats.a.min, stats.b.min, 2],
        ['1º quartil (m)', stats.a.q1, stats.b.q1, 2],
        ['3º quartil (m)', stats.a.q3, stats.b.q3, 2],
        ['Máximo (m)', stats.a.max, stats.b.max, 2],
      ] as [string, number, number, number][])
    : []

  return (
    <Card
      title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Shuffle size={18} /> Repetições com incerteza (Monte Carlo)</span>}
      actions={data && (
        <>
          <CsvButtons name="repeticoes.csv" rows={() => data.map((d, i) => ({ repeticao: i + 1, F: d.F, muC: d.muK, massa: d.m, d_sem_atrito: d.dA, d_com_atrito: d.dB, moveu: d.moved ? 1 : 0 }))} />
          <button className="btn sm dark" onClick={save} disabled={saved}><Save size={15} /> {saved ? 'Salvo' : 'Salvar no banco'}</button>
        </>
      )}
    >
      <div className="form-row" style={{ marginBottom: 14 }}>
        <label className="field">Repetições<input type="number" value={N} min={10} max={3000} onChange={(e) => setN(parseFloat(e.target.value))} /></label>
        <label className="field">Incerteza na força (%)<input type="number" value={sF} step="0.5" min={0} onChange={(e) => setSF(parseFloat(e.target.value))} /></label>
        <label className="field">Incerteza no atrito (%)<input type="number" value={sMu} step="0.5" min={0} onChange={(e) => setSMu(parseFloat(e.target.value))} /></label>
        <label className="field">Incerteza na massa (%)<input type="number" value={sM} step="0.5" min={0} onChange={(e) => setSM(parseFloat(e.target.value))} /></label>
        <label className="field">Semente<input type="number" value={seed} onChange={(e) => setSeed(parseFloat(e.target.value))} /></label>
        <button className="btn primary" onClick={go}>Rodar repetições</button>
      </div>

      {stats && (
        <>
          {stats.a.max === 0 && stats.b.max === 0 ? (
            <p className="note warn" style={{ marginBottom: 14 }}>Com estes parâmetros o bloco não se move em nenhuma tentativa (força {fmt(params.F, 1)} N). Aumente a força ou a inclinação no Simulador.</p>
          ) : (
          <p className="finding" style={{ marginBottom: 14 }}>
            Com atrito, o deslocamento médio em {fmt(params.T, 1)} s cai de <em>{fmt(stats.a.mean, 1)} m</em> para <em>{fmt(stats.b.mean, 1)} m</em>, e o bloco saiu do lugar em{' '}
            <em>{fmt(stats.movedPct, 0)}%</em> das tentativas.
          </p>
          )}
          <div className="grid g2" style={{ alignItems: 'start' }}>
            <div>
              <div className="chart-title">
                <h3>Distribuição do deslocamento</h3>
                <span>
                  <span className="legend-dot" style={{ background: 'var(--series-1)', marginRight: 5, verticalAlign: 'middle' }} />sem atrito
                  <span className="legend-dot" style={{ background: 'var(--series-2)', margin: '0 5px 0 10px', verticalAlign: 'middle' }} />com atrito
                </span>
              </div>
              <div className="chart tall">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.hist} barGap={0} barCategoryGap={1} margin={{ top: 6, right: 10, bottom: 4, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="center" tickFormatter={(v: number) => v.toFixed(0)} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip content={<Tip xLabel="deslocamento (m)" digits={0} />} isAnimationActive={false} />
                    <Bar dataKey="g0" name="sem atrito" fill="var(--series-1)" isAnimationActive={false} />
                    <Bar dataKey="g1" name="com atrito" fill="var(--series-2)" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="scroll">
              <table>
                <thead><tr><th>Deslocamento</th><th className="r">Sem atrito</th><th className="r">Com atrito</th></tr></thead>
                <tbody>
                  {rowsStat.map(([k, a, b, d]) => (
                    <tr key={k}><td>{k}</td><td className="r num">{fmt(a, d)}</td><td className="r num">{fmt(b, d)}</td></tr>
                  ))}
                  <tr><td>IC 95% da média (m)</td><td className="r num">{fmt(stats.a.ci[0], 2)} – {fmt(stats.a.ci[1], 2)}</td><td className="r num">{fmt(stats.b.ci[0], 2)} – {fmt(stats.b.ci[1], 2)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="results">
            <Metric label="Saiu do lugar" value={fmt(stats.movedPct, 1)} unit="%" note="proporção das tentativas com atrito" />
            <Metric label="t de Welch" value={fmt(stats.test.t, 2)} note={`gl = ${fmt(stats.test.df, 1)}`} />
            <Metric label="Valor-p (bicaudal)" value={fmtP(stats.test.p)} note={stats.test.p < 0.05 ? 'rejeita H₀ (médias iguais) a 5%' : 'não rejeita H₀ a 5%'} />
            <Metric label="Tamanho do efeito (d de Cohen)" value={fmt(Math.abs(stats.test.d), 2)} note={Math.abs(stats.test.d) >= 0.8 ? 'efeito grande' : Math.abs(stats.test.d) >= 0.5 ? 'efeito médio' : 'efeito pequeno'} />
          </div>
          <details className="more" style={{ marginTop: 12 }}>
            <summary>Dispersão: μc sorteado × deslocamento com atrito</summary>
            <div className="chart" style={{ marginTop: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 6, right: 10, bottom: 4, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 4" />
                  <XAxis dataKey="muK" type="number" name="μc" domain={['dataMin', 'dataMax']} tickFormatter={axisFmt} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="dB" type="number" name="d" tickFormatter={axisFmt} tick={{ fontSize: 11 }} width={50} />
                  <Scatter data={data!.slice(0, 800)} fill="var(--series-2)" fillOpacity={0.55} isAnimationActive={false} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </details>
        </>
      )}
    </Card>
  )
}
