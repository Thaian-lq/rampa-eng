import { useEffect, useState } from 'react'
import { Activity, FlaskConical, ShieldCheck, GraduationCap, BookOpen } from 'lucide-react'
import { SimTab, useSimulation } from './tabs/SimTab'
import { ExpTab } from './tabs/ExpTab'
import { VerifyTab } from './tabs/VerifyTab'
import { LearnTab } from './tabs/LearnTab'
import { ModelTab } from './tabs/ModelTab'
import { DEFAULT_PARAMS } from './data/content'
import { detectServer } from './lib/util'
import type { Params } from './lib/physics'

const TABS = [
  { id: 'simulador', label: 'Simulador', icon: Activity },
  { id: 'experimentos', label: 'Experimentos', icon: FlaskConical },
  { id: 'verificacao', label: 'Verificação', icon: ShieldCheck },
  { id: 'aprender', label: 'Aprender', icon: GraduationCap },
  { id: 'modelo', label: 'Modelagem', icon: BookOpen },
] as const
type TabId = (typeof TABS)[number]['id']

const fromHash = (): TabId => {
  const h = window.location.hash.replace('#', '')
  return (TABS.find((t) => t.id === h)?.id ?? 'simulador') as TabId
}

function loadParams(): Params {
  try {
    const raw = localStorage.getItem('rampa.params')
    if (raw) return { ...DEFAULT_PARAMS, ...JSON.parse(raw) }
  } catch {
  }
  return DEFAULT_PARAMS
}

export default function App() {
  const [tab, setTab] = useState<TabId>(fromHash)
  const [params, setParams] = useState<Params>(loadParams)
  const [online, setOnline] = useState(false)
  const result = useSimulation(params)

  useEffect(() => {
    detectServer().then(setOnline)
    const onHash = () => setTab(fromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    try { localStorage.setItem('rampa.params', JSON.stringify(params)) } catch { }
  }, [params])

  const go = (id: TabId) => {
    setTab(id)
    try { history.replaceState(null, '', `#${id}`) } catch { window.location.hash = id }
    window.scrollTo({ top: 0 })
  }

  return (
    <>
      <header className="top">
        <div className="top-in">
          <a className="brand" href="#simulador" onClick={(e) => { e.preventDefault(); go('simulador') }}>
            <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="9" fill="#f3ead9" />
              <path d="M4 26 L28 26 L28 10 Z" fill="#e9dbc1" stroke="#12284a" strokeWidth="1.6" strokeLinejoin="round" />
              <rect x="13" y="12.5" width="8" height="6" rx="1.2" fill="#12284a" transform="rotate(-33.7 17 15.5)" />
              <path d="M19 12 L26 7.5" stroke="#ee6a28" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            <div>
              <strong>Rampa</strong>
              <span>Laboratório virtual de forças e atrito</span>
            </div>
          </a>
          <nav className="tabs" role="tablist" aria-label="Seções">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} role="tab" className="tab" aria-selected={tab === id} onClick={() => go(id)}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </nav>
          <span className="status" title={online ? 'Dados salvos no banco SQLite do servidor' : 'Dados salvos apenas neste navegador'}>
            <span className={`dot${online ? ' on' : ''}`} /> {online ? 'Servidor conectado' : 'Modo navegador'}
          </span>
        </div>
      </header>

      <main>
        <div hidden={tab !== 'simulador'}>
          <SimTab params={params} setParams={setParams} result={result} active={tab === 'simulador'} />
        </div>
        {tab === 'experimentos' && <ExpTab params={params} online={online} />}
        {tab === 'verificacao' && <VerifyTab params={params} />}
        {tab === 'aprender' && <LearnTab online={online} />}
        {tab === 'modelo' && <ModelTab />}
      </main>

      <footer>
        Projeto Integrado · Engenharia em Ação — simulador didático de bloco puxado por força, com atrito, para o Ensino Médio. Física do Movimento, Matemática das
        Variações, Geometria Analítica, Estatística e Metodologia da Pesquisa.
      </footer>
    </>
  )
}
