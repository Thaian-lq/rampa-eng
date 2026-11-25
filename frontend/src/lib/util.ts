export const fmt = (x: number, d = 2) => {
  if (!Number.isFinite(x)) return '—'
  const v = Number(x.toFixed(d)) === 0 ? 0 : x
  return v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
}
export const fmtSci = (x: number) => (Number.isFinite(x) ? (x === 0 ? '0' : x.toExponential(2).replace('.', ',')) : '—')
export const fmtP = (p: number) => (!Number.isFinite(p) ? '—' : p < 0.001 ? '< 0,001' : fmt(p, 3))

export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = typeof v === 'number' ? (Number.isFinite(v) ? String(+v.toPrecision(10)) : '') : String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

export async function downloadCSV(name: string, rows: Record<string, unknown>[]) {
  const csv = '\ufeff' + toCSV(rows)

  const host = window as unknown as { claude?: { use: (n: string) => Promise<{ save: (r: { filename: string; data: string }) => Promise<unknown> } | null> } }
  if (host.claude?.use) {
    try {
      const d = await host.claude.use('downloads')
      if (d) {
        await d.save({ filename: name, data: csv }).catch(() => undefined)
        return
      }
    } catch {

    }
  }
  try {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  } catch {

  }
}

export async function copyCSV(rows: Record<string, unknown>[]) {
  try {
    await navigator.clipboard.writeText(toCSV(rows))
    return true
  } catch {
    return false
  }
}

export interface ExperimentRecord {
  id?: number
  created_at?: string
  kind: 'varredura' | 'monte-carlo'
  label: string
  params: Record<string, unknown>
  summary: Record<string, unknown>
}
export interface QuizRecord {
  id?: number
  created_at?: string
  student: string
  group_name: string
  phase: 'pre' | 'pos'
  score: number
  answers: number[]
}

let serverOnline: boolean | null = null

export async function detectServer(): Promise<boolean> {
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 1500)
    const r = await fetch('/api/health', { signal: ctl.signal })
    clearTimeout(timer)
    const j = r.ok ? await r.json() : null
    serverOnline = j?.status === 'ok'
  } catch {
    serverOnline = false
  }
  return serverOnline
}

const memory: Record<string, unknown[]> = {}
function localGet<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T[]
  } catch {
  }
  return (memory[key] as T[]) ?? []
}
function localSet<T>(key: string, value: T[]) {
  memory[key] = value
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {

  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json() as Promise<T>
}

const K_EXP = 'rampa.experiments'
const K_QUIZ = 'rampa.quiz'

export const store = {
  async listExperiments(): Promise<ExperimentRecord[]> {
    if (serverOnline) return api('/api/experiments')
    return localGet<ExperimentRecord>(K_EXP).slice().reverse()
  },
  async saveExperiment(e: ExperimentRecord): Promise<void> {
    if (serverOnline) {
      await api('/api/experiments', { method: 'POST', body: JSON.stringify(e) })
      return
    }
    const all = localGet<ExperimentRecord>(K_EXP)
    all.push({ ...e, id: Date.now(), created_at: new Date().toISOString() })
    localSet(K_EXP, all.slice(-100))
  },
  async listQuiz(): Promise<QuizRecord[]> {
    if (serverOnline) return api('/api/quiz')
    return localGet<QuizRecord>(K_QUIZ)
  },
  async saveQuiz(q: QuizRecord): Promise<void> {
    if (serverOnline) {
      await api('/api/quiz', { method: 'POST', body: JSON.stringify(q) })
      return
    }
    const all = localGet<QuizRecord>(K_QUIZ)
    all.push({ ...q, id: Date.now(), created_at: new Date().toISOString() })
    localSet(K_QUIZ, all)
  },
  async clearQuiz(): Promise<void> {
    if (serverOnline) {
      await api('/api/quiz', { method: 'DELETE' })
      return
    }
    localSet(K_QUIZ, [])
  },
}
