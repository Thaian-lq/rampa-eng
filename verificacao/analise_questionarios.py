import json
import sqlite3
import sys
from pathlib import Path

from scipy import stats

db = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "backend" / "rampa.db"
con = sqlite3.connect(db)
rows = con.execute("SELECT group_name, student, phase, score, answers FROM quiz ORDER BY id").fetchall()
if not rows:
    sys.exit("Nenhuma resposta no banco ainda.")

ultimo = {}
for g, s, ph, sc, ans in rows:
    ultimo[(g, s, ph)] = (sc, json.loads(ans))
pre = {(g, s): v for (g, s, ph), v in ultimo.items() if ph == "pre"}
pos = {(g, s): v for (g, s, ph), v in ultimo.items() if ph == "pos"}
pares = [(pre[k][0], pos[k][0]) for k in pre if k in pos]

print(f"Respostas: {len(pre)} antes, {len(pos)} depois, {len(pares)} pares")
if pares:
    a = [p for p, _ in pares]; b = [q for _, q in pares]
    mp, mq = sum(a) / len(a), sum(b) / len(b)
    print(f"Média antes: {mp:.1f}%  |  média depois: {mq:.1f}%")
    print(f"Ganho normalizado de Hake: {(mq - mp) / (100 - mp):.2f}")
    if len(pares) >= 2:
        t = stats.ttest_rel(b, a)
        w = stats.wilcoxon(b, a) if len(pares) >= 6 and any(x != y for x, y in pares) else None
        print(f"Teste t pareado: t = {t.statistic:.3f}, p = {t.pvalue:.4f}")
        if w:
            print(f"Wilcoxon (não paramétrico): W = {w.statistic:.1f}, p = {w.pvalue:.4f}")

GABARITO = [1, 1, 0, 0, 1, 1, 0, 1]
print("\nAcertos por questão (% antes → % depois):")
for i, gab in enumerate(GABARITO):
    pa = sum(v[1][i] == gab for v in pre.values()) / max(1, len(pre)) * 100
    pb = sum(v[1][i] == gab for v in pos.values()) / max(1, len(pos)) * 100
    print(f"  Q{i + 1}: {pa:5.1f}% → {pb:5.1f}%")
