import type { Params } from '../lib/physics'

export interface Material {
  id: string
  name: string
  muS: number
  muK: number
}
export const MATERIALS: Material[] = [
  { id: 'madeira', name: 'Madeira / madeira', muS: 0.5, muK: 0.3 },
  { id: 'borracha', name: 'Borracha / concreto', muS: 1.0, muK: 0.8 },
  { id: 'aco', name: 'Aço / aço', muS: 0.74, muK: 0.57 },
  { id: 'vidro', name: 'Vidro / vidro', muS: 0.94, muK: 0.4 },
  { id: 'gelo', name: 'Gelo / gelo', muS: 0.1, muK: 0.03 },
  { id: 'teflon', name: 'Teflon / teflon', muS: 0.04, muK: 0.04 },
]

export interface WorldPreset {
  id: string
  name: string
  g: number
}
export const WORLDS: WorldPreset[] = [
  { id: 'terra', name: 'Terra', g: 9.81 },
  { id: 'lua', name: 'Lua', g: 1.62 },
  { id: 'marte', name: 'Marte', g: 3.71 },
  { id: 'jupiter', name: 'Júpiter', g: 24.79 },
]

export const DEFAULT_PARAMS: Params = {
  F: 30,
  phi: 0,
  mode: 'constante',
  rate: 5,
  m: 5,
  theta: 0,
  muS: 0.5,
  muK: 0.3,
  g: 9.81,
  v0: 0,
  b: 0,
  T: 5,
  method: 'rk4',
  dt: 0.01,
}

export const OBJECTIVES = [
  'Identificar e representar as forças sobre o bloco (peso, normal, força aplicada e atrito) em um diagrama de corpo livre, decompondo-as nos eixos paralelo e perpendicular à superfície.',
  'Aplicar a 2ª lei de Newton (Fᵣ = m·a) para prever a aceleração a partir da força aplicada, da massa e do atrito.',
  'Diferenciar atrito estático e cinético: explicar por que existe uma força mínima para tirar o bloco do repouso e por que o atrito diminui quando ele começa a deslizar.',
  'Relacionar a inclinação com as componentes do peso (m·g·sen θ e m·g·cos θ), a normal e o ângulo crítico (tg θc = μe), e interpretar v(t) e x(t) como taxas de variação.',
  'Coletar e analisar dados de experimentos repetidos: média, desvio padrão, intervalo de confiança e regressão linear (estimando μc a partir do gráfico a × F).',
]

export const ACTIVITIES = [
  {
    title: 'A força que não move',
    goal: 'Objetivo 3',
    steps: [
      'Superfície horizontal, madeira/madeira, massa 5 kg. Escolha o modo "rampa" com força inicial 0 N e taxa de 10 N/s.',
      'Antes de lançar, calcule μe·m·g. Em que instante o bloco deve começar a se mover?',
      'Lance e observe o gráfico "Atrito × força aplicada": o atrito acompanha a força até um limite e depois cai. Por quê?',
      'Compare o valor do pico com o seu cálculo e com a "Força mínima para mover".',
    ],
  },
  {
    title: 'Newton na prática',
    goal: 'Objetivos 2 e 5',
    steps: [
      'Em Experimentos, faça uma varredura da força de 0 a 80 N, superfície horizontal.',
      'Abaixo da força mínima a aceleração é zero. Acima, os pontos formam uma reta. Qual é a inclinação esperada?',
      'Use o intercepto da regressão para estimar μc e compare com o valor do material.',
    ],
  },
  {
    title: 'Ladeira acima',
    goal: 'Objetivos 1 e 4',
    steps: [
      'Ative o diagrama de corpo livre e as componentes do peso. Incline a rampa para 30°.',
      'Com força 0 N, aumente o ângulo devagar até o bloco escorregar sozinho. Anote o ângulo.',
      'Compare com o ângulo crítico θc = arctg(μe). O resultado depende da massa? Teste.',
    ],
  },
  {
    title: 'Ninguém puxa igual duas vezes',
    goal: 'Objetivo 5',
    steps: [
      'Em Experimentos, rode 200 repetições com incerteza de 5% na força e 10% no atrito.',
      'Leia média, desvio padrão e intervalo de confiança da distância percorrida.',
      'Coloque a força perto da mínima: em quantos lançamentos o bloco nem saiu do lugar?',
    ],
  },
]

export interface Question {
  q: string
  options: string[]
  answer: number
  objective: number
}
export const QUIZ: Question[] = [
  {
    q: 'Um bloco parado numa mesa horizontal recebe uma força horizontal pequena e continua parado. A força de atrito nesse momento é:',
    options: ['Zero', 'Igual em módulo à força aplicada e no sentido oposto', 'Sempre igual a μe·N', 'Maior que a força aplicada'],
    answer: 1,
    objective: 3,
  },
  {
    q: 'Em uma superfície horizontal, sem outras forças verticais além do peso, a força normal sobre o bloco é:',
    options: ['Maior que o peso', 'Igual ao peso em módulo', 'Zero', 'Depende da velocidade do bloco'],
    answer: 1,
    objective: 1,
  },
  {
    q: 'Se a força resultante sobre o bloco dobra e a massa não muda, a aceleração:',
    options: ['Dobra', 'Fica igual', 'Cai pela metade', 'Quadruplica'],
    answer: 0,
    objective: 2,
  },
  {
    q: 'Por que é mais difícil começar a empurrar um móvel pesado do que mantê-lo deslizando?',
    options: ['Porque o coeficiente de atrito estático é maior que o cinético', 'Porque o peso aumenta no início', 'Porque a normal é maior quando está parado', 'Porque a massa diminui com o movimento'],
    answer: 0,
    objective: 3,
  },
  {
    q: 'Num plano inclinado de ângulo θ, a componente do peso paralela à superfície vale:',
    options: ['m·g·cos θ', 'm·g·sen θ', 'm·g·tg θ', 'm·g'],
    answer: 1,
    objective: 1,
  },
  {
    q: 'Ao aumentar a inclinação do plano (sem força aplicada), a força normal sobre o bloco:',
    options: ['Aumenta', 'Diminui', 'Não muda', 'Vira zero a partir de 45°'],
    answer: 1,
    objective: 4,
  },
  {
    q: 'Um bloco parado num plano inclinado começa a escorregar sozinho quando:',
    options: ['tg θ > μe', 'θ > 45°', 'sen θ > μc', 'A massa é muito grande'],
    answer: 0,
    objective: 4,
  },
  {
    q: 'Na regressão linear da aceleração em função da força aplicada (plano horizontal, bloco deslizando), a inclinação da reta representa:',
    options: ['O coeficiente de atrito', 'O inverso da massa (1/m)', 'A gravidade', 'A velocidade do bloco'],
    answer: 1,
    objective: 5,
  },
]

export const REQUIREMENTS = [
  { id: 'RF01', text: 'Alterar força aplicada, ângulo da força, massa, inclinação, μe, μc, velocidade inicial e gravidade', where: 'Simulador › Controles', crit: 'AT 05/06 · EP 01/03' },
  { id: 'RF02', text: 'Animar o bloco sobre superfície horizontal ou inclinada', where: 'Simulador › Palco', crit: 'EP 04 · EP 09' },
  { id: 'RF03', text: 'Exibir o diagrama de corpo livre com peso, componentes, normal, força aplicada, atrito e resultante', where: 'Simulador › Camadas', crit: 'AT 08 · EP 02' },
  { id: 'RF04', text: 'Distinguir atrito estático e cinético, com detecção do instante de partida e de parada', where: 'Simulador', crit: 'AT 08 · EP 02' },
  { id: 'RF05', text: 'Força constante ou crescente no tempo (rampa de força)', where: 'Simulador › Força', crit: 'EP 03' },
  { id: 'RF06', text: 'Resolver pelos métodos analítico (por trechos), Euler e RK4', where: 'Simulador › Método', crit: 'AT 08 · EP 02' },
  { id: 'RF07', text: 'Gráficos sincronizados de forças, posição, velocidade, aceleração, atrito × força e energia', where: 'Simulador › Gráficos', crit: 'EP 04' },
  { id: 'RF08', text: 'Varredura de parâmetros com regressão linear e estimativa de μc', where: 'Experimentos', crit: 'AT 09 · EP 05' },
  { id: 'RF09', text: 'Repetições com incerteza (Monte Carlo), estatística descritiva, IC 95% e teste t', where: 'Experimentos', crit: 'AT 09 · EP 05' },
  { id: 'RF10', text: 'Verificação automática: solução analítica, convergência, trabalho-energia, limiar estático e ângulo crítico', where: 'Verificação', crit: 'AT 10 · EP 06' },
  { id: 'RF11', text: 'Questionário pré/pós-teste com ganho de aprendizagem e teste t pareado', where: 'Aprender', crit: 'EP 07 · EP 08' },
  { id: 'RF12', text: 'Exportar dados em CSV e armazenar em banco SQLite', where: 'Todas', crit: 'EP 04 · EP 10' },
  { id: 'RNF01', text: 'Rodar no navegador, sem instalação, em celular e computador', where: 'Geral', crit: 'AT 11 · EP 10' },
  { id: 'RNF02', text: 'Acessível: teclado, contraste AA, rótulos, redução de movimento', where: 'Geral', crit: 'AT 11' },
  { id: 'RNF03', text: 'Erro relativo < 0,1% (RK4) frente à solução analítica', where: 'Verificação', crit: 'AT 10 · EP 06' },
]
