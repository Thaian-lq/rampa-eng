import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GraduationCap, ClipboardCheck, Users } from 'lucide-react'
import { ACTIVITIES, OBJECTIVES, QUIZ } from '../data/content'
import { mean, pairedT, std } from '../lib/stats'
import { Card, CsvButtons, Metric, Tip } from '../components/ui'
import { fmt, fmtP, store, type QuizRecord } from '../lib/util'

export function LearnTab({ online }: { online: boolean }) {
  const [records, setRecords] = useState<QuizRecord[]>([])
  const refresh = () => store.listQuiz().then(setRecords).catch(() => setRecords([]))
  useEffect(() => { refresh() }, [online])

  return (
    <>
      <div className="section-head">
        <div>
          <h2>Aprender e avaliar</h2>
          <p className="muted">Objetivos de aprendizagem, roteiros de atividade para a aula e o questionário pré/pós-teste que mede se o simulador ajudou.</p>
        </div>
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><GraduationCap size={18} /> Objetivos de aprendizagem</span>}>
          <p className="muted" style={{ marginBottom: 10 }}>Ao final, o estudante do Ensino Médio deverá ser capaz de:</p>
          <ol className="steps" style={{ marginTop: 0 }}>
            {OBJECTIVES.map((o, i) => <li key={i}><b>O{i + 1}.</b> {o}</li>)}
          </ol>
        </Card>
        <Card title="Roteiros de atividade">
          <div className="grid" style={{ gap: 14 }}>
            {ACTIVITIES.map((a) => (
              <details key={a.title} className="more" open={a.title === ACTIVITIES[0].title}>
                <summary>{a.title} <span className="muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 13 }}>{a.goal}</span></summary>
                <ol className="steps">{a.steps.map((s) => <li key={s}>{s}</li>)}</ol>
              </details>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid g2" style={{ marginTop: 16, alignItems: 'start' }}>
        <Quiz onSaved={refresh} online={online} />
        <TeacherPanel records={records} onClear={async () => { await store.clearQuiz(); refresh() }} online={online} />
      </div>
    </>
  )
}

function Quiz({ onSaved, online }: { onSaved: () => void; online: boolean }) {
  const [student, setStudent] = useState('')
  const [group, setGroup] = useState('')
  const [phase, setPhase] = useState<'pre' | 'pos'>('pre')
  const [answers, setAnswers] = useState<number[]>(Array(QUIZ.length).fill(-1))
  const [done, setDone] = useState<number | null>(null)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!student.trim()) return setError('Informe o código do estudante (não use o nome completo).')
    if (answers.some((a) => a < 0)) return setError('Responda todas as questões.')
    const score = (answers.filter((a, i) => a === QUIZ[i].answer).length / QUIZ.length) * 100
    try {
      await store.saveQuiz({ student: student.trim().toUpperCase(), group_name: group.trim().toUpperCase() || 'GERAL', phase, score, answers })
      setDone(score)
      setError('')
      onSaved()
    } catch {
      setError('Não foi possível salvar. Tente novamente.')
    }
  }
  const restart = () => { setAnswers(Array(QUIZ.length).fill(-1)); setDone(null) }

  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><ClipboardCheck size={18} /> Questionário pré/pós-teste</span>}>
      <form onSubmit={submit}>
        <div className="form-row">
          <label className="field">Código do estudante<input value={student} onChange={(e) => setStudent(e.target.value)} placeholder="ex.: A07" autoComplete="off" /></label>
          <label className="field">Turma<input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="ex.: 1A" autoComplete="off" /></label>
          <label className="field">Momento
            <select value={phase} onChange={(e) => setPhase(e.target.value as 'pre' | 'pos')}>
              <option value="pre">Antes do simulador</option>
              <option value="pos">Depois do simulador</option>
            </select>
          </label>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Use um código anônimo, sem nome. As respostas ficam {online ? 'no banco SQLite do servidor' : 'neste navegador'}.</p>
        {QUIZ.map((q, qi) => (
          <fieldset key={qi} className="quiz-q" style={{ border: 0, margin: 0, padding: '14px 0' }}>
            <legend style={{ fontWeight: 600, marginBottom: 8, padding: 0 }}>{qi + 1}. {q.q}</legend>
            <div className="opts">
              {q.options.map((o, oi) => {
                const cls = done !== null ? (oi === q.answer ? ' correct' : answers[qi] === oi ? ' wrong' : '') : ''
                return (
                  <label key={oi} className={`opt${cls}`}>
                    <input type="radio" name={`q${qi}`} checked={answers[qi] === oi} disabled={done !== null}
                      onChange={() => setAnswers(answers.map((a, i) => (i === qi ? oi : a)))} />
                    <span>{o}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        ))}
        {error && <p className="note warn" role="alert" style={{ marginBottom: 10 }}>{error}</p>}
        {done === null ? (
          <button className="btn primary" type="submit">Enviar respostas</button>
        ) : (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="finding">Nota: <em>{fmt(done, 0)}%</em></span>
            <button className="btn" type="button" onClick={restart}>Nova resposta</button>
          </div>
        )}
      </form>
    </Card>
  )
}

function TeacherPanel({ records, onClear, online }: { records: QuizRecord[]; onClear: () => void; online: boolean }) {
  const [confirm, setConfirm] = useState(false)
  const a = useMemo(() => {
    const pre = records.filter((r) => r.phase === 'pre')
    const pos = records.filter((r) => r.phase === 'pos')
    const key = (r: QuizRecord) => `${r.group_name}|${r.student}`
    const lastBy = (arr: QuizRecord[]) => { const m = new Map<string, QuizRecord>(); arr.forEach((r) => m.set(key(r), r)); return m }
    const mPre = lastBy(pre), mPos = lastBy(pos)
    const pairs = [...mPre.keys()].filter((k) => mPos.has(k)).map((k) => ({ k, pre: mPre.get(k)!.score, pos: mPos.get(k)!.score }))
    const preM = mean(pre.map((r) => r.score)), posM = mean(pos.map((r) => r.score))
    const pairedPre = pairs.map((p) => p.pre), pairedPos = pairs.map((p) => p.pos)
    const hake = pairs.length ? (mean(pairedPos) - mean(pairedPre)) / (100 - mean(pairedPre)) : NaN
    const test = pairs.length >= 2 ? pairedT(pairedPre, pairedPos) : null
    const perQ = QUIZ.map((q, i) => ({
      q: `Q${i + 1}`,
      pre: pre.length ? (pre.filter((r) => r.answers[i] === q.answer).length / pre.length) * 100 : 0,
      pos: pos.length ? (pos.filter((r) => r.answers[i] === q.answer).length / pos.length) * 100 : 0,
    }))
    return { pre, pos, pairs, preM, posM, preSd: std(pre.map((r) => r.score)), posSd: std(pos.map((r) => r.score)), hake, test, perQ }
  }, [records])

  return (
    <Card
      title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Users size={18} /> Painel do professor</span>}
      actions={records.length > 0 && <CsvButtons name="questionarios.csv" rows={() => records.map((r) => ({ data: r.created_at, estudante: r.student, turma: r.group_name, momento: r.phase, nota: r.score, ...Object.fromEntries(r.answers.map((x, i) => [`Q${i + 1}`, x === QUIZ[i].answer ? 1 : 0])) }))} />}
    >
      {records.length === 0 ? (
        <p className="muted">
          Ainda não há respostas. Aplique o questionário “antes” no início da aula, use o simulador com os roteiros e aplique o “depois” no final. Os resultados
          aparecem aqui com média, ganho de aprendizagem e teste t pareado.
        </p>
      ) : (
        <>
          <div className="results" style={{ marginTop: 0 }}>
            <Metric label="Média antes" value={fmt(a.preM, 1)} unit="%" note={`n = ${a.pre.length} · DP ${fmt(a.preSd, 1)}`} />
            <Metric label="Média depois" value={fmt(a.posM, 1)} unit="%" note={`n = ${a.pos.length} · DP ${fmt(a.posSd, 1)}`} />
            <Metric lead label="Ganho normalizado (Hake)" value={fmt(a.hake, 2)} note={!Number.isFinite(a.hake) ? 'precisa de pares antes/depois' : a.hake >= 0.7 ? 'ganho alto' : a.hake >= 0.3 ? 'ganho médio' : 'ganho baixo'} />
            <Metric label="Teste t pareado" value={a.test ? `p ${a.test.p < 0.001 ? '< 0,001' : '= ' + fmtP(a.test.p)}` : '—'} note={a.test ? `t = ${fmt(a.test.t, 2)}, gl = ${a.test.df}, ${a.pairs.length} pares` : 'mínimo de 2 pares'} />
          </div>
          <div className="chart-title" style={{ marginTop: 16 }}>
            <h3>Acertos por questão</h3>
            <span>
              <span className="legend-dot" style={{ background: 'var(--series-3)', marginRight: 5, verticalAlign: 'middle' }} />antes
              <span className="legend-dot" style={{ background: 'var(--series-2)', margin: '0 5px 0 10px', verticalAlign: 'middle' }} />depois (%)
            </span>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.perQ} margin={{ top: 6, right: 10, bottom: 4, left: -16 }}>
                <CartesianGrid strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="q" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip content={<Tip xLabel="questão" digits={0} />} isAnimationActive={false} />
                <Bar dataKey="pre" name="antes" fill="var(--series-3)" isAnimationActive={false} radius={[4, 4, 0, 0]} />
                <Bar dataKey="pos" name="depois" fill="var(--series-2)" isAnimationActive={false} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="note" style={{ marginTop: 10 }}>
            Ganho de Hake: g = (pós − pré) / (100 − pré), calculado sobre os estudantes com as duas respostas. Cada questão está ligada a um objetivo
            (O1–O5), o que mostra quais objetivos o simulador atingiu.
          </p>
          <div style={{ marginTop: 12 }}>
            {confirm ? (
              <div className="btn-row">
                <button className="btn sm" style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }} onClick={() => { onClear(); setConfirm(false) }}>Confirmar: apagar {records.length} respostas</button>
                <button className="btn sm" onClick={() => setConfirm(false)}>Cancelar</button>
              </div>
            ) : (
              <button className="btn sm" onClick={() => setConfirm(true)}>Apagar respostas {online ? 'do banco' : 'deste navegador'}</button>
            )}
          </div>
        </>
      )}
    </Card>
  )
}
