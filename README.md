# Rampa — laboratório virtual de forças e atrito

Simulador didático de Física para o Ensino Médio, feito para o **Projeto Integrado: Engenharia em Ação**.
Um bloco é puxado por uma força sobre uma superfície horizontal ou inclinada. Com ele se estudam força aplicada, força resultante, massa,
aceleração, atrito estático, atrito cinético e diagrama de corpo livre, integrando Física do Movimento, Matemática das Variações,
Geometria Analítica, Estatística e Metodologia da Pesquisa.

**Stack:** React + TypeScript (Vite) · FastAPI · SQLite · Python (NumPy, SciPy, Matplotlib, pytest)

---

## Como rodar (3 comandos)

Requisitos: Python 3.10+ e Node.js 18+.

```bash
pip install -r backend/requirements.txt
cd frontend && npm install && npm run build && cd ..
uvicorn backend.app:app --port 8000
```

Abra **http://localhost:8000**. O topo mostra “Servidor conectado”: experimentos e questionários vão para `backend/rampa.db`.
Atalhos: `run.sh` (Linux/macOS) e `run.bat` (Windows).

Para os alunos acessarem pela mesma rede Wi-Fi: `uvicorn backend.app:app --host 0.0.0.0 --port 8000` e abrir `http://IP-DO-COMPUTADOR:8000`.

Modo desenvolvimento: `uvicorn backend.app:app --reload` (terminal 1) e `cd frontend && npm run dev` (terminal 2, porta 5173).

Versão de arquivo único, sem servidor: `cd frontend && SINGLE=1 npx vite build` gera `frontend/dist-single/index.html` (dados ficam no navegador).

---

## O que tem em cada aba

| Aba | Conteúdo | Critérios do PDF |
|---|---|---|
| **Simulador** | Bloco animado na superfície horizontal ou inclinada; diagrama de corpo livre (peso, componentes, normal, força aplicada, atrito, resultante); força constante ou crescente no tempo; atrito estático × cinético com instante de partida e parada; métodos analítico/Euler/RK4; 6 gráficos (forças, atrito × força, posição, velocidade, aceleração, energia); comparar corridas; desafio “descubra a força mínima” | AT 05–08 · EP 01–04, 09 |
| **Experimentos** | Varredura de parâmetro (F, m, θ, μe, μc, φ) com e sem atrito; regressão a × F e a × 1/m com estimativa de μc pelo intercepto; Monte Carlo com incerteza em F, μ e m, estatística descritiva, IC 95%, teste t de Welch, d de Cohen e % de tentativas em que o bloco se moveu; histórico no SQLite; CSV | AT 09 · EP 03–05 |
| **Verificação** | 5 testes automáticos: RK4 × solução analítica, ordem de convergência (Euler ≈ 1, RK4 ≈ 4), teorema trabalho-energia, limiar do atrito estático, ângulo crítico | AT 10 · EP 06 |
| **Aprender** | 5 objetivos de aprendizagem, 4 roteiros de atividade, questionário pré/pós (8 questões ligadas aos objetivos), painel do professor com ganho de Hake e teste t pareado | AT 03 · EP 07–08 |
| **Modelagem** | Modelo físico e hipóteses, EDOs e solução por trechos, decomposição vetorial e rotação de eixos, plano estatístico, requisitos rastreáveis, benchmarking com o PhET, viabilidade/acessibilidade/ética, ODS 4, 9 e 10 | AT 04–12 · EP 10 |

---

## Modelo

Eixo x ao longo da superfície (subindo), y perpendicular:

- `N = m·g·cos θ − F·sen φ` (N ≥ 0) e `D = F·cos φ − m·g·sen θ`
- Parado: se `|D| ≤ μe·N`, o atrito vale `−D` e a aceleração é zero (atrito estático)
- Deslizando: `fₐₜ = −sinal(v)·μc·N` e `m·a = D + fₐₜ − b·v`
- Força mínima para mover: `Fmín = m·g·(sen θ + μe·cos θ)/(cos φ + μe·sen φ)`; ângulo crítico `tg θc = μe`
- Partidas e paradas localizadas por bissecção dentro do passo; solução analítica exata por trechos com força constante

Hipóteses: bloco como partícula (sem tombar), atrito de Coulomb com μ constantes e μc ≤ μe, superfície plana e rígida, g uniforme.

## Estrutura

```
rampa/
├── frontend/src/
│   ├── lib/physics.ts      motor físico (forças, regimes, analítico, Euler, RK4, energia)
│   ├── lib/stats.ts        estatística (IC, Welch, t pareado, regressão, histograma, PRNG)
│   ├── components/Stage.tsx  palco com rampa, bloco e diagrama de corpo livre
│   ├── tabs/               as 5 abas
│   └── data/content.ts     materiais, objetivos, roteiros, questionário, requisitos
├── backend/app.py          FastAPI + SQLite
└── verificacao/
    ├── physics.py          modelo espelhado em Python
    ├── verify.py           relatório e figuras em verificacao/saida/
    ├── test_physics.py     18 testes pytest
    └── analise_questionarios.py
```

## API

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/health` | status |
| GET/POST | `/api/experiments` | listar / salvar experimento |
| GET/POST/DELETE | `/api/quiz` | listar / salvar / apagar respostas |
| GET | `/api/quiz/summary` | médias, ganho de Hake, t pareado |
| GET | `/api/export/{experiments\|quiz}.csv` | exportação |

Documentação interativa em `http://localhost:8000/docs`.

## Verificação em Python

```bash
cd verificacao
pytest -q                         # 18 testes
python verify.py                  # relatório + figuras para o artigo
python analise_questionarios.py   # depois de aplicar o questionário
```
