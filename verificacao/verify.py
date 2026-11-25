from __future__ import annotations

import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from physics import Params, analytic_constant, critical_angle, force_to_start, forces, holds, simulate

OUT = Path(__file__).parent / "saida"
OUT.mkdir(exist_ok=True)
NAVY, ORANGE, SAND, RED = "#12284a", "#ee6a28", "#a88f66", "#b3261e"
plt.rcParams.update({"figure.dpi": 140, "axes.spines.top": False, "axes.spines.right": False, "font.size": 10, "axes.grid": True, "grid.alpha": 0.3})

base = Params()
L = ["# Relatório de verificação do simulador Rampa", ""]
L += [f"Bloco: m = {base.m} kg, μe = {base.muS}, μc = {base.muK}, g = {base.g} m/s², F = {base.F} N, T = {base.T} s.", ""]
tests: list[tuple[str, bool]] = []

cases = [("Horizontal, F = 30 N", base), ("Rampa 30°, sobe com v₀ = 8 m/s e volta", base.with_(theta=30, F=0, v0=8)), ("Horizontal com amortecimento b = 2", base.with_(b=2))]
L += ["## 1. Solução analítica × métodos numéricos (Δt = 0,01 s)", "", "| Caso | x analítico (m) | x Euler | erro Euler (%) | x RK4 | erro RK4 (%) |", "|---|---:|---:|---:|---:|---:|"]
ok = True
for name, p in cases:
    xa, _ = analytic_constant(p)
    xe, xr = simulate(p, "euler")["x"], simulate(p, "rk4")["x"]
    ee, er = (xe - xa) / abs(xa) * 100, (xr - xa) / abs(xa) * 100
    ok &= abs(er) < 0.1
    L.append(f"| {name} | {xa:.5f} | {xe:.5f} | {ee:.3f} | {xr:.5f} | {er:.2e} |")
tests.append(("RK4 reproduz a solução analítica com erro < 0,1%", ok))
L.append("")

pc = base.with_(b=2.5, v0=1, F=40, T=2)
xa, _ = analytic_constant(pc)
dts = np.array([0.2, 0.1, 0.05, 0.025, 0.0125])
err = {m: np.array([max(1e-16, abs(simulate(pc, m, dt)["x"] - xa)) for dt in dts]) for m in ("euler", "rk4")}
order = {m: np.polyfit(np.log(dts), np.log(err[m]), 1)[0] for m in err}
L += ["## 2. Ordem de convergência (bloco deslizando com b = 2,5 N·s/m, erro em x(2 s))", "", "| Δt (s) | Erro Euler (m) | Erro RK4 (m) |", "|---:|---:|---:|"]
L += [f"| {dt} | {a:.3e} | {b:.3e} |" for dt, a, b in zip(dts, err["euler"], err["rk4"])]
L += ["", f"Ordem observada: **Euler = {order['euler']:.2f}** (teoria 1), **RK4 = {order['rk4']:.2f}** (teoria 4).", ""]
tests.append(("Ordem de convergência: Euler ≈ 1 e RK4 ≈ 4", abs(order["euler"] - 1) < 0.25 and abs(order["rk4"] - 4) < 0.5))
fig, ax = plt.subplots(figsize=(6, 4))
ax.loglog(dts, err["euler"], "o-", color=NAVY, label=f"Euler (ordem {order['euler']:.2f})")
ax.loglog(dts, err["rk4"], "s-", color=ORANGE, label=f"RK4 (ordem {order['rk4']:.2f})")
ax.set_xlabel("Δt (s)"); ax.set_ylabel("erro de posição (m)"); ax.set_title("Convergência dos métodos numéricos"); ax.legend()
fig.tight_layout(); fig.savefig(OUT / "fig_convergencia.png"); plt.close(fig)

L += ["## 3. Teorema trabalho-energia (RK4): W_F = ΔEc + ΔEp + E_dissipada", "", "| Caso | W_F (J) | ΔEc + ΔEp + E_diss (J) | desvio (%) |", "|---|---:|---:|---:|"]
ok = True
for name, p in cases + [("Força crescente 10 N/s", base.with_(mode="rampa", F=0, rate=10))]:
    r = simulate(p, "rk4", 0.005)
    bal = r["dEc"] + r["dEp"] + r["E_diss"]
    scale = max(abs(r["W_F"]), abs(r["dEc"]), abs(r["E_diss"]), 1e-9)
    dev = abs(r["W_F"] - bal) / scale * 100
    ok &= dev < 0.5
    L.append(f"| {name} | {r['W_F']:.4f} | {bal:.4f} | {dev:.2e} |")
tests.append(("Balanço de energia com desvio < 0,5%", ok))
L.append("")

Fmin = force_to_start(base)
still = simulate(base.with_(F=0.98 * Fmin))
go = simulate(base.with_(F=1.02 * Fmin))
ramp = simulate(base.with_(mode="rampa", F=0, rate=10), "rk4", 0.001)
L += ["## 4. Limiar do atrito estático", "", f"Fmín = m·g·μe = {Fmin:.4f} N. Com 0,98·Fmín moveu? {still['moved']}. Com 1,02·Fmín moveu? {go['moved']}.",
      f"Com força crescendo 10 N/s, a partida simulada ocorreu em t = {ramp['t_start']:.4f} s (teoria Fmín/10 = {Fmin / 10:.4f} s).", ""]
tests.append(("Limiar estático correto (0,98·Fmín parado, 1,02·Fmín desliza)", (not still["moved"]) and go["moved"]))
tests.append(("Instante de partida com força crescente (erro < 0,1%)", abs(ramp["t_start"] - Fmin / 10) / (Fmin / 10) < 1e-3))

Fs = np.linspace(0, 2 * Fmin, 300)
fric, kin = [], []
for F in Fs:
    p = base.with_(F=float(F))
    c = forces(p, 0)
    if holds(p, 0):
        fric.append(abs(c["D"])); kin.append(np.nan)
    else:
        fric.append(np.nan); kin.append(base.muK * c["N"])
fig, ax = plt.subplots(figsize=(6, 3.6))
ax.plot(Fs, fric, color=NAVY, lw=2, label="estático (= força aplicada)")
ax.plot(Fs, kin, color=RED, lw=2, label="cinético (μc·N)")
ax.axhline(base.muS * base.m * base.g, color=SAND, ls="--", label="μe·N")
ax.set_xlabel("força aplicada F (N)"); ax.set_ylabel("atrito (N)"); ax.set_title("Atrito × força aplicada"); ax.legend(fontsize=8)
fig.tight_layout(); fig.savefig(OUT / "fig_atrito_forca.png"); plt.close(fig)

tr = np.array([(r[0], r[1], r[2]) for r in ramp["rows"]])
fig, ax = plt.subplots(figsize=(6, 3.6))
ax.plot(tr[:, 0], tr[:, 2], color=ORANGE, label="v (m/s)")
ax.plot(tr[:, 0], tr[:, 1], color=NAVY, label="x (m)")
ax.axvline(Fmin / 10, color=SAND, ls="--", label="partida teórica")
ax.set_xlabel("t (s)"); ax.set_title("Força crescente: repouso e depois deslizamento"); ax.legend(fontsize=8)
fig.tight_layout(); fig.savefig(OUT / "fig_movimento.png"); plt.close(fig)

thc = critical_angle(base.muS)
angles = np.arange(0, 45.01, 0.25)
disp = [-simulate(base.with_(F=0, theta=float(a), T=2), "rk4", 0.01)["x"] for a in angles]
first = next((a for a, d in zip(angles, disp) if d > 1e-9), math.nan)
L += ["## 5. Ângulo crítico (sem força)", "", f"Teoria arctg(μe) = {thc:.3f}°. Primeiro ângulo da varredura (passo 0,25°) em que o bloco escorrega: {first:.2f}°.", ""]
tests.append(("Ângulo crítico dentro de 0,25° da teoria", abs(first - thc) <= 0.25 + 1e-9))
fig, ax = plt.subplots(figsize=(6, 3.6))
ax.plot(angles, disp, color=ORANGE)
ax.axvline(thc, color=NAVY, ls="--", label=f"θc = {thc:.1f}°")
ax.set_xlabel("inclinação θ (°)"); ax.set_ylabel("deslocamento em 2 s (m, rampa abaixo)"); ax.set_title("Escorrega sozinho acima do ângulo crítico"); ax.legend()
fig.tight_layout(); fig.savefig(OUT / "fig_angulo_critico.png"); plt.close(fig)

L += ["## Testes", "", "| Teste | Resultado |", "|---|---|"]
L += [f"| {n} | {'APROVADO' if ok else 'REPROVADO'} |" for n, ok in tests]
passed = sum(ok for _, ok in tests)
L += ["", f"**{passed}/{len(tests)} testes aprovados.**"]
(OUT / "relatorio_verificacao.md").write_text("\n".join(L), encoding="utf-8")
print("\n".join(L))
