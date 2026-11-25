import { REQUIREMENTS } from '../data/content'
import { Card } from '../components/ui'

const ODS = [
  { n: 4, color: '#C5192D', title: 'Educação de qualidade', text: 'Metas 4.1 e 4.4: recurso gratuito que melhora a aprendizagem de Dinâmica e desenvolve competências em ciência e tecnologia.' },
  { n: 9, color: '#FD6925', title: 'Indústria, inovação e infraestrutura', text: 'Atrito e planos inclinados estão em rampas, esteiras, freios e pneus: o simulador promove o pensamento de engenharia.' },
  { n: 10, color: '#DD1367', title: 'Redução das desigualdades', text: 'Laboratório virtual sem custo para escolas sem dinamômetros e trilhos; roda em celular e não exige instalação.' },
]

const BENCH = [
  ['Força aplicada, massa e atrito ajustáveis', 'Sim', 'Mantido'],
  ['Diagrama de forças sobre o objeto', 'Sim', 'Melhorado: corpo livre com componentes e resultante'],
  ['Atrito estático × cinético', 'Sim', 'Melhorado: μe e μc separados e gráfico atrito × força'],
  ['Plano inclinado com força em ângulo', '—', 'Criado'],
  ['Força crescente no tempo (rampa)', '—', 'Criado'],
  ['Analítico × Euler × RK4 e convergência', '—', 'Criado'],
  ['Varredura, regressão e estimativa de μc', '—', 'Criado'],
  ['Monte Carlo, IC 95% e teste t', '—', 'Criado'],
  ['Pré/pós-teste, banco de dados e CSV', '—', 'Criado'],
]

export function ModelTab() {
  return (
    <>
      <div className="section-head">
        <div>
          <h2>Modelagem e documentação</h2>
          <p className="muted">Base teórica de cada disciplina, requisitos rastreáveis e o enquadramento do projeto: o mesmo conteúdo que vai para o artigo ou relatório.</p>
        </div>
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card title="Física do Movimento — modelo físico" className="prose">
          <p>Bloco de massa m sobre uma superfície de inclinação θ, puxado por uma força F que faz ângulo φ com a superfície. Eixo x ao longo da superfície (subindo), eixo y perpendicular.</p>
          <div className="eq">{'Peso:     P∥ = −m·g·sen θ      P⊥ = −m·g·cos θ\nForça:    F∥ = F·cos φ         F⊥ = F·sen φ\nNormal:   N = m·g·cos θ − F·sen φ   (N ≥ 0)\nSem atrito, a força paralela é  D = F·cos φ − m·g·sen θ'}</div>
          <div className="eq">{'Parado:      |D| ≤ μe·N  ⇒  fₐₜ = −D,  a = 0   (atrito estático)\nDeslizando:  fₐₜ = −sinal(v)·μc·N               (atrito cinético)\n2ª lei:      m·a = D + fₐₜ − b·v'}</div>
          <p><b>Hipóteses e simplificações:</b></p>
          <ul>
            <li>Bloco rígido tratado como partícula (sem tombar nem girar); força aplicada no centro de massa.</li>
            <li>Atrito de Coulomb com μe e μc constantes e μc ≤ μe; independe da área e da velocidade.</li>
            <li>Superfície plana e rígida; g uniforme.</li>
            <li>Amortecimento viscoso b·v opcional, representando ar ou lubrificante.</li>
          </ul>
          <div className="eq">{'Energia:  W_F = ΔEc + ΔEp + E_dissipada\nEc = ½·m·v²    Ep = m·g·x·sen θ    E_diss = ∫(μc·N·|v| + b·v²) dt'}</div>
        </Card>

        <Card title="Matemática das Variações — equações e métodos" className="prose">
          <p>A posição e a velocidade obedecem a um sistema de equações diferenciais (taxas de variação):</p>
          <div className="eq">{'dx/dt = v\ndv/dt = a(t, v) = [D(t) − s·μc·N(t) − b·v] / m      s = sinal(v)'}</div>
          <p><b>Solução analítica (força constante):</b></p>
          <div className="eq">{'b = 0:  v(t) = v₀ + a·t          x(t) = x₀ + v₀·t + a·t²/2\nb > 0:  k = b/m,  v∞ = a₀/k\n        v(t) = v∞ + (v₀ − v∞)·e^(−k·t)\n        x(t) = x₀ + v∞·t + (v₀ − v∞)·(1 − e^(−k·t))/k'}</div>
          <p>Cada trecho termina quando v = 0; aí se testa de novo o atrito estático. Com força crescente (F = F₀ + r·t) o instante de partida é t = (Fmín − F₀)/r.</p>
          <div className="eq">{'Euler:  sₙ₊₁ = sₙ + Δt·f(tₙ, sₙ)                     erro global ~ Δt\nRK4:    k₁…k₄ avaliados em tₙ, tₙ + Δt/2, tₙ + Δt\n        sₙ₊₁ = sₙ + Δt·(k₁ + 2k₂ + 2k₃ + k₄)/6       erro global ~ Δt⁴'}</div>
          <p>Partidas e paradas são localizadas por bissecção dentro do passo, para não “atravessar” o zero da velocidade.</p>
        </Card>

        <Card title="Geometria Analítica — vetores e decomposição" className="prose">
          <p>As forças são vetores no plano. Trocar os eixos horizontal/vertical pelos eixos da rampa é uma rotação de ângulo θ:</p>
          <div className="eq">{'[x′]   [ cos θ   sen θ] [x]\n[y′] = [−sen θ   cos θ] [y]\n\nP = (0, −m·g)  ⇒  P′ = (−m·g·sen θ, −m·g·cos θ)'}</div>
          <div className="eq">{'Força mínima para mover (subindo):\nFmín = m·g·(sen θ + μe·cos θ) / (cos φ + μe·sen φ)\n\nÂngulo crítico (F = 0):  tg θc = μe\nResultante:  |Fᵣ| = |D + fₐₜ|   na direção da superfície'}</div>
          <p>O diagrama de corpo livre mostra a soma vetorial: com o bloco parado, os vetores formam um polígono fechado (resultante nula).</p>
        </Card>

        <Card title="Estatística — planejamento e análise" className="prose">
          <ul>
            <li><b>Variáveis manipuladas:</b> F, φ, m, θ, μe, μc, v₀, b, g, método, Δt.</li>
            <li><b>Variáveis observadas:</b> aceleração, deslocamento, velocidade final, atrito, instante de partida/parada, energia dissipada.</li>
            <li><b>Varredura:</b> uma variável por vez; regressão linear de a × F (inclinação 1/m) e a × 1/m; o intercepto estima μc.</li>
            <li><b>Repetições (Monte Carlo):</b> incerteza gaussiana em F, μ e m (semente fixa, reprodutível); média, mediana, desvio padrão, CV, quartis e IC 95% (t de Student); proporção de tentativas em que o bloco se moveu.</li>
            <li><b>Comparação:</b> teste t de Welch (com × sem atrito) e d de Cohen.</li>
            <li><b>Verificação:</b> erro relativo frente à solução analítica; ordem de convergência por regressão log-log; balanço de energia.</li>
            <li><b>Avaliação com usuários:</b> pré/pós-teste, ganho normalizado de Hake e teste t pareado.</li>
          </ul>
        </Card>
      </div>

      <div style={{ height: 16 }} />
      <Card title="Requisitos rastreáveis">
        <div className="scroll">
          <table className="stack">
            <thead><tr><th>ID</th><th>Requisito</th><th>Onde está</th><th>Critério do PDF</th></tr></thead>
            <tbody>
              {REQUIREMENTS.map((r) => (
                <tr key={r.id}><td className="num">{r.id}</td><td>{r.text}</td><td>{r.where}</td><td className="num" style={{ fontSize: 12.5 }}>{r.crit}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid g2" style={{ marginTop: 16, alignItems: 'start' }}>
        <Card title="Benchmarking e diferencial" className="prose">
          <p>Referência principal: o simulador <i>Forças e Movimento: Noções Básicas</i> do PhET (Universidade do Colorado), gratuito e usado em sala. Confira a versão atual antes de citar.</p>
          <div className="scroll">
            <table>
              <thead><tr><th>Recurso</th><th>PhET</th><th>No Rampa</th></tr></thead>
              <tbody>{BENCH.map(([a, b, c]) => <tr key={a}><td>{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>
        <Card title="Viabilidade, acessibilidade, ética e riscos" className="prose">
          <ul>
            <li><b>Tecnologia:</b> React + TypeScript (física no navegador), FastAPI + SQLite (dados), Python/Matplotlib (verificação). Tudo gratuito e de código aberto.</li>
            <li><b>Custo:</b> zero de licença; roda nos computadores e celulares da escola; hospedagem estática gratuita ou servidor local.</li>
            <li><b>Acessibilidade:</b> navegação por teclado, rótulos para leitores de tela, contraste adequado, alvos de toque de 44 px, respeito à preferência de reduzir movimento.</li>
            <li><b>Ética e LGPD:</b> o questionário usa apenas código anônimo; nenhum dado pessoal é coletado; o professor pode apagar as respostas.</li>
            <li><b>Riscos:</b> o modelo de Coulomb simplifica o atrito real (μ varia com velocidade, umidade e desgaste), o que é explicado ao aluno; Euler com Δt grande gera erro visível, usado como recurso didático.</li>
            <li><b>Continuidade:</b> o motor físico separado da interface permite novos cenários, como polias ou dois blocos.</li>
          </ul>
        </Card>
      </div>

      <div style={{ height: 16 }} />
      <Card title="Contribuição aos ODS da ONU">
        <div className="grid g3">
          {ODS.map((o) => (
            <div key={o.n} className="ods">
              <div className="ods-n" style={{ background: o.color }}>{o.n}</div>
              <div><b>{o.title}</b><p className="muted" style={{ fontSize: 14, marginTop: 2 }}>{o.text}</p></div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
