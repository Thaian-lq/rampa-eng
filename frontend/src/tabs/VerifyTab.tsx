import { useMemo } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { criticalAngle, forceToStart, simulate, type Params } from '../lib/physics'
import { linreg } from '../lib/stats'
import { LineBox } from '../components/Charts'
import { Card, CsvButtons, Metric } from '../components/ui'
import { fmt, fmtSci } from '../lib/util'

const relErr = (a: number, b: number) => (Math.abs(b) > 1e-9 ? ((a - b) / Math.abs(b)) * 100 : Math.abs(a - b) < 1e-9 ? 0 : NaN)
const Badge = ({ ok }: { ok: boolean }) =>
  ok ? <span className="badge ok"><CheckCircle2 size={13} /> aprovado</span> : <span className="badge no"><XCircle size={13} /> reprovado</span>

export function VerifyTab({ params }: { params: Params }) {
  const v = useMemo(() => {
    const Fmin0 = forceToStart({ ...params, mode: 'constante' })
    const user: Params = { ...params, mode: 'constante' }
    const adjusted = !simulate({ ...user, method: 'analitico' }).moved && Number.isFinite(Fmin0)
    const base: Params = adjusted ? { ...user, F: Math.round(1.5 * Fmin0 * 10) / 10 } : user
    const an = simulate({ ...base, method: 'analitico' })
    const eu = simulate({ ...base, method: 'euler' })
    const rk = simulate({ ...base, method: 'rk4' })
    const lastOf = (r: typeof an) => r.samples[r.samples.length - 1]
    const rows = [
      { q: 'Posição final x(T) (m)', th: an.xEnd, eu: eu.xEnd, rk: rk.xEnd },
      { q: 'Velocidade final v(T) (m/s)', th: an.vEnd, eu: eu.vEnd, rk: rk.vEnd },
      { q: 'Energia dissipada (J)', th: lastOf(an).eDiss, eu: lastOf(eu).eDiss, rk: lastOf(rk).eDiss },
      { q: 'Trabalho da força aplicada (J)', th: lastOf(an).wF, eu: lastOf(eu).wF, rk: lastOf(rk).wF },
    ]

    const Fmin = forceToStart(params)
    const pc: Params = { ...base, v0: 1, b: Math.max(params.b, 0.5 * params.m), F: Math.min(400, Math.max(params.F, 1.5 * (Number.isFinite(Fmin) ? Fmin : 50) + 1)), T: 2 }
    const ref = simulate({ ...pc, method: 'analitico' }).xEnd
    const dts = [0.2, 0.1, 0.05, 0.025, 0.0125]
    const conv = dts.map((dt) => ({
      dt,
      euler: Math.max(1e-16, Math.abs(simulate({ ...pc, method: 'euler', dt }).xEnd - ref)),
      rk4: Math.max(1e-16, Math.abs(simulate({ ...pc, method: 'rk4', dt }).xEnd - ref)),
    }))
    const order = (k: 'euler' | 'rk4') => linreg(conv.map((c) => Math.log(c.dt)), conv.map((c) => Math.log(c[k]))).slope

    const e0 = (r: typeof an) => r.samples[0]
    const n = Math.min(eu.samples.length, rk.samples.length, 300)
    const scale = Math.max(Math.abs(lastOf(rk).wF), ...rk.samples.map((s) => s.ek), Math.abs(lastOf(rk).eDiss), 1e-9)
    const energy = Array.from({ length: n }, (_, i) => {
      const je = Math.round((i * (eu.samples.length - 1)) / (n - 1))
      const jr = Math.round((i * (rk.samples.length - 1)) / (n - 1))
      const res = (r: typeof an, j: number) => {
        const s = r.samples[j]
        return ((s.wF - (s.ek - e0(r).ek + s.ep - e0(r).ep + s.eDiss)) / scale) * 100
      }
      return { t: rk.samples[jr].t, euler: res(eu, je), rk4: res(rk, jr) }
    })

    const still = simulate({ ...base, v0: 0, F: 0.98 * Fmin, method: 'rk4' })
    const go = simulate({ ...base, v0: 0, F: 1.02 * Fmin, method: 'rk4' })
    const lastStill = lastOf(still)
    const staticOk = Number.isFinite(Fmin) && !still.moved && go.moved

    const thc = criticalAngle(params.muS)
    const below = simulate({ ...base, F: 0, v0: 0, theta: Math.max(0, thc - 1), method: 'rk4' })
    const above = simulate({ ...base, F: 0, v0: 0, theta: Math.min(89, thc + 1), method: 'rk4' })

    return { adjusted, Fver: base.F, rows, conv, oEu: order('euler'), oRk: order('rk4'), energy, eRk: rk.energyResidualPct, eEu: eu.energyResidualPct, Fmin, staticOk, lastStill, thc, belowMoved: below.moved, aboveMoved: above.moved, pc }
  }, [params])

  const tests = [
    { name: 'RK4 reproduz a solução analítica (erro < 0,1%)', ok: v.rows.every((r) => { const e = relErr(r.rk, r.th); return Number.isFinite(e) && Math.abs(e) < 0.1 }) },
    { name: 'Ordem de convergência: Euler ≈ 1 e RK4 ≈ 4', ok: Math.abs(v.oEu - 1) < 0.25 && Math.abs(v.oRk - 4) < 0.5 },
    { name: 'Teorema trabalho-energia: W_F = ΔEc + ΔEp + E_dissipada (RK4, desvio < 0,5%)', ok: v.eRk < 0.5 },
    { name: 'Limiar estático: 0,98·Fmín fica parado e 1,02·Fmín desliza', ok: v.staticOk },
    { name: 'Ângulo crítico: sem força, fica parado em θc − 1° e escorrega em θc + 1°', ok: !v.belowMoved && v.aboveMoved },
  ]
  const passed = tests.filter((t) => t.ok).length

  return (
    <>
      <div className="section-head">
        <div>
          <h2>Verificação do simulador</h2>
          <p className="muted">
            Testes automáticos recalculados para o bloco atual: solução analítica da 2ª lei de Newton, ordem de convergência dos métodos numéricos, balanço de
            energia, limiar do atrito estático e ângulo crítico.
          </p>
        </div>
      </div>

      <div className="results" style={{ marginTop: 0, marginBottom: 16 }}>
        <Metric lead label="Testes aprovados" value={`${passed}/${tests.length}`} note="recalculado a cada mudança" />
        <Metric label="Ordem observada — Euler" value={fmt(v.oEu, 2)} note="teoria: 1" />
        <Metric label="Ordem observada — RK4" value={fmt(v.oRk, 2)} note="teoria: 4" />
        <Metric label="Força mínima para mover" value={Number.isFinite(v.Fmin) ? fmt(v.Fmin, 2) : '∞'} unit="N" note={`ângulo crítico ${fmt(v.thc, 2)}°`} />
      </div>

      <Card title="Checklist de verificação">
        <div className="scroll">
          <table>
            <tbody>
              {tests.map((t) => (<tr key={t.name}><td>{t.name}</td><td className="r"><Badge ok={t.ok} /></td></tr>))}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ height: 16 }} />
      <Card title={v.adjusted ? `Analítico × numérico (F = ${fmt(v.Fver, 1)} N, pois o bloco atual não se move)` : 'Analítico × numérico (força constante, Δt do simulador)'} actions={<CsvButtons name="verificacao.csv" rows={() => v.rows.map((r) => ({ grandeza: r.q, analitico: r.th, euler: r.eu, rk4: r.rk, erro_euler_pct: relErr(r.eu, r.th), erro_rk4_pct: relErr(r.rk, r.th) }))} />}>
        <div className="scroll">
          <table>
            <thead><tr><th>Grandeza</th><th className="r">Analítico</th><th className="r">Euler</th><th className="r">Erro Euler</th><th className="r">RK4</th><th className="r">Erro RK4</th></tr></thead>
            <tbody>
              {v.rows.map((r) => (
                <tr key={r.q}>
                  <td>{r.q}</td>
                  <td className="r num">{fmt(r.th, 4)}</td>
                  <td className="r num">{fmt(r.eu, 4)}</td>
                  <td className="r num">{fmt(relErr(r.eu, r.th), 3)}%</td>
                  <td className="r num">{fmt(r.rk, 4)}</td>
                  <td className="r num">{fmtSci(relErr(r.rk, r.th))}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: 10 }}>
          Com força constante e sem amortecimento, a aceleração é constante em cada trecho: x = x₀ + v₀t + at²/2. O RK4 reproduz isso exatamente; Euler erra a
          posição em proporção a Δt. As partidas e paradas são localizadas por bissecção dentro do passo.
        </p>
      </Card>

      <div className="grid g2" style={{ marginTop: 16 }}>
        <Card>
          <LineBox title="Convergência (escala log)" unit="erro em m" xKey="dt" xLabel="Δt (s)" data={v.conv} logX logY digits={12}
            series={[{ key: 'euler', name: `Euler (ordem ${fmt(v.oEu, 2)})`, color: 'var(--series-1)' }, { key: 'rk4', name: `RK4 (ordem ${fmt(v.oRk, 2)})`, color: 'var(--series-2)' }]} />
          <p className="note" style={{ marginTop: 8 }}>
            Bloco deslizando com amortecimento b = {fmt(v.pc.b, 1)} N·s/m (solução exata exponencial), F = {fmt(v.pc.F, 1)} N, erro em x(2 s). A inclinação no
            gráfico log-log é a ordem do método.
          </p>
        </Card>
        <Card>
          <LineBox title="Balanço trabalho-energia" unit="% do maior termo" xKey="t" xLabel="t (s)" data={v.energy} digits={6}
            series={[{ key: 'euler', name: `Euler (final ${fmt(v.eEu, 3)}%)`, color: 'var(--series-1)' }, { key: 'rk4', name: `RK4 (final ${fmtSci(v.eRk)}%)`, color: 'var(--series-2)' }]} />
          <p className="note" style={{ marginTop: 8 }}>W_F − (ΔEc + ΔEp + E_dissipada) deveria ser zero: o trabalho da força vira energia cinética, potencial e calor no atrito.</p>
        </Card>
      </div>

      <div style={{ height: 16 }} />
      <Card title="Comparação com a teoria e a literatura">
        <ul className="clean">
          <li>
            <b>Leis de Amontons-Coulomb:</b> o atrito não depende da área de contato e é proporcional à normal. Deslizando, |f| = μc·N; parado, o atrito vale exatamente
            o necessário para equilibrar, até μe·N. Com 0,98·Fmín, o atrito simulado foi <span className="num">{fmt(Math.abs(v.lastStill.f), 2)} N</span>, igual à força
            que tenta mover o bloco.
          </li>
          <li>
            <b>Força mínima:</b> F·(cos φ + μe·sen φ) = m·g·(sen θ + μe·cos θ) ⇒ <span className="num">Fmín = {Number.isFinite(v.Fmin) ? fmt(v.Fmin, 2) : '∞'} N</span>. Puxar
            levemente para cima (φ &gt; 0) reduz a normal e pode diminuir a força necessária.
          </li>
          <li>
            <b>Ângulo crítico:</b> tg θc = μe ⇒ <span className="num">θc = {fmt(v.thc, 2)}°</span>, independente da massa. É o método clássico de laboratório para medir μe:
            inclinar a rampa devagar até o bloco escorregar.
          </li>
          <li>
            <b>Dados experimentais:</b> o grupo pode medir o ângulo crítico com um livro e uma régua (ou o transferidor do celular) e comparar com o simulador, ou puxar um
            bloco com um dinamômetro e registrar o pico do atrito estático.
          </li>
        </ul>
      </Card>
    </>
  )
}
