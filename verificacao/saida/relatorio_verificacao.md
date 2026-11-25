# Relatório de verificação do simulador Rampa

Bloco: m = 5.0 kg, μe = 0.5, μc = 0.3, g = 9.81 m/s², F = 30.0 N, T = 5.0 s.

## 1. Solução analítica × métodos numéricos (Δt = 0,01 s)

| Caso | x analítico (m) | x Euler | erro Euler (%) | x RK4 | erro RK4 (%) |
|---|---:|---:|---:|---:|---:|
| Horizontal, F = 30 N | 38.21250 | 38.13608 | -0.200 | 38.21250 | 6.32e-13 |
| Rampa 30°, sobe com v₀ = 8 m/s e volta | -13.87269 | -13.78653 | 0.621 | -13.87269 | -4.72e-12 |
| Horizontal com amortecimento b = 2 | 21.69200 | 21.68165 | -0.048 | 21.69200 | 5.11e-11 |

## 2. Ordem de convergência (bloco deslizando com b = 2,5 N·s/m, erro em x(2 s))

| Δt (s) | Erro Euler (m) | Erro RK4 (m) |
|---:|---:|---:|
| 0.2 | 3.500e-01 | 6.074e-06 |
| 0.1 | 1.712e-01 | 3.641e-07 |
| 0.05 | 8.471e-02 | 2.229e-08 |
| 0.025 | 4.213e-02 | 1.379e-09 |
| 0.0125 | 2.101e-02 | 8.571e-11 |

Ordem observada: **Euler = 1.01** (teoria 1), **RK4 = 4.03** (teoria 4).

## 3. Teorema trabalho-energia (RK4): W_F = ΔEc + ΔEp + E_dissipada

| Caso | W_F (J) | ΔEc + ΔEp + E_diss (J) | desvio (%) |
|---|---:|---:|---:|
| Horizontal, F = 30 N | 1146.3750 | 1146.3750 | 2.18e-12 |
| Rampa 30°, sobe com v₀ = 8 m/s e volta | 0.0000 | -0.0000 | 1.09e-12 |
| Horizontal com amortecimento b = 2 | 650.7598 | 650.7599 | 1.64e-05 |
| Força crescente 10 N/s | 504.7084 | 504.7077 | 1.42e-04 |

## 4. Limiar do atrito estático

Fmín = m·g·μe = 24.5250 N. Com 0,98·Fmín moveu? False. Com 1,02·Fmín moveu? True.
Com força crescendo 10 N/s, a partida simulada ocorreu em t = 2.4525 s (teoria Fmín/10 = 2.4525 s).

## 5. Ângulo crítico (sem força)

Teoria arctg(μe) = 26.565°. Primeiro ângulo da varredura (passo 0,25°) em que o bloco escorrega: 26.75°.

## Testes

| Teste | Resultado |
|---|---|
| RK4 reproduz a solução analítica com erro < 0,1% | APROVADO |
| Ordem de convergência: Euler ≈ 1 e RK4 ≈ 4 | APROVADO |
| Balanço de energia com desvio < 0,5% | APROVADO |
| Limiar estático correto (0,98·Fmín parado, 1,02·Fmín desliza) | APROVADO |
| Instante de partida com força crescente (erro < 0,1%) | APROVADO |
| Ângulo crítico dentro de 0,25° da teoria | APROVADO |

**6/6 testes aprovados.**