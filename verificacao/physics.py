from __future__ import annotations

import math
from dataclasses import dataclass, replace


@dataclass(frozen=True)
class Params:
    F: float = 30.0
    phi: float = 0.0
    mode: str = "constante"
    rate: float = 5.0
    m: float = 5.0
    theta: float = 0.0
    muS: float = 0.5
    muK: float = 0.3
    g: float = 9.81
    v0: float = 0.0
    b: float = 0.0
    T: float = 5.0

    def with_(self, **kw) -> "Params":
        return replace(self, **kw)


def sign(x: float) -> int:
    return 1 if x > 0 else -1 if x < 0 else 0


def applied(p: Params, t: float) -> float:
    return max(0.0, p.F + p.rate * t) if p.mode == "rampa" else p.F


def forces(p: Params, t: float):
    F = applied(p, t)
    fpar = F * math.cos(math.radians(p.phi))
    fperp = F * math.sin(math.radians(p.phi))
    ppar = -p.m * p.g * math.sin(math.radians(p.theta))
    pperp = p.m * p.g * math.cos(math.radians(p.theta))
    N = max(0.0, pperp - fperp)
    return {"F": F, "Fpar": fpar, "N": N, "D": fpar + ppar}


def mu_k(p: Params) -> float:
    return min(p.muK, p.muS)


def holds(p: Params, t: float) -> bool:
    c = forces(p, t)
    return abs(c["D"]) <= p.muS * c["N"] + 1e-12


def accel(p: Params, t: float, v: float, s: int) -> float:
    if s == 0:
        return 0.0
    c = forces(p, t)
    return (c["D"] - s * mu_k(p) * c["N"] - p.b * v) / p.m


def step(p, t, x, v, h, s, method):
    if method == "euler":
        return x + h * v, v + h * accel(p, t, v, s)
    a1 = accel(p, t, v, s)
    v2 = v + h / 2 * a1
    a2 = accel(p, t + h / 2, v2, s)
    v3 = v + h / 2 * a2
    a3 = accel(p, t + h / 2, v3, s)
    v4 = v + h * a3
    a4 = accel(p, t + h, v4, s)
    return x + h / 6 * (v + 2 * v2 + 2 * v3 + v4), v + h / 6 * (a1 + 2 * a2 + 2 * a3 + a4)


def friction(p: Params, t: float, s: int) -> float:
    c = forces(p, t)
    return -c["D"] if s == 0 else -s * mu_k(p) * c["N"]


def simulate(p: Params, method: str = "rk4", dt: float = 0.01) -> dict:
    t, x, v = 0.0, 0.0, p.v0
    s = sign(p.v0) if p.v0 != 0 else (0 if holds(p, 0) else sign(forces(p, 0)["D"]))
    t_start = 0.0 if (s != 0 and p.v0 == 0) else math.nan
    rows = [(t, x, v, s)]
    while t < p.T - 1e-12:
        h = min(dt, p.T - t)
        if s == 0:
            if holds(p, t + h):
                t += h
                rows.append((t, x, v, 0))
                continue
            lo, hi = 0.0, h
            for _ in range(50):
                mid = (lo + hi) / 2
                lo, hi = (mid, hi) if holds(p, t + mid) else (lo, mid)
            t += hi
            s = sign(forces(p, t)["D"])
            if math.isnan(t_start):
                t_start = t
            rows.append((t, x, v, s))
            continue
        xn, vn = step(p, t, x, v, h, s, method)
        if vn * s <= 0:
            lo, hi = 0.0, h
            for _ in range(50):
                mid = (lo + hi) / 2
                lo, hi = (mid, hi) if step(p, t, x, v, mid, s, method)[1] * s > 0 else (lo, mid)
            x = step(p, t, x, v, hi, s, method)[0]
            v, t = 0.0, t + hi
            s = 0 if holds(p, t) else sign(forces(p, t)["D"])
            rows.append((t, x, v, s))
            continue
        x, v, t = xn, vn, t + h
        rows.append((t, x, v, s))

    wF = eD = 0.0
    sth = math.sin(math.radians(p.theta))
    for (t0, x0, v0_, s0), (t1, x1, v1, s1) in zip(rows, rows[1:]):
        hh = t1 - t0
        wF += 0.5 * hh * (forces(p, t0)["Fpar"] * v0_ + forces(p, t1)["Fpar"] * v1)
        d0 = -(friction(p, t0, s0) * v0_) + p.b * v0_ * v0_
        d1 = -(friction(p, t1, s1) * v1) + p.b * v1 * v1
        eD += 0.5 * hh * (d0 + d1)
    tN, xN, vN, _ = rows[-1]
    dEc = 0.5 * p.m * (vN * vN - p.v0 * p.v0)
    dEp = p.m * p.g * xN * sth
    return {"x": xN, "v": vN, "moved": any(r[3] != 0 for r in rows), "t_start": t_start, "rows": rows, "W_F": wF, "dEc": dEc, "dEp": dEp, "E_diss": eD}


def analytic_constant(p: Params) -> tuple[float, float]:
    t0, x0, v0 = 0.0, 0.0, p.v0
    s = sign(v0) if v0 != 0 else (0 if holds(p, 0) else sign(forces(p, 0)["D"]))
    c = forces(p, 0)
    k = p.b / p.m
    for _ in range(4):
        if s == 0:
            return x0, 0.0
        a0 = (c["D"] - s * mu_k(p) * c["N"]) / p.m
        if k == 0:
            ts = -v0 / a0 if (v0 != 0 and a0 * s < 0) else math.inf
        else:
            vi = a0 / k
            r = -vi / (v0 - vi) if v0 != vi else -1
            ts = -math.log(r) / k if (v0 != 0 and 0 < r < 1) else math.inf

        def state(tau):
            if k == 0:
                return x0 + v0 * tau + 0.5 * a0 * tau * tau, v0 + a0 * tau
            vi_ = a0 / k
            e = math.exp(-k * tau)
            return x0 + vi_ * tau + (v0 - vi_) * (1 - e) / k, vi_ + (v0 - vi_) * e

        if t0 + ts >= p.T:
            return state(p.T - t0)
        x0 = state(ts)[0]
        v0, t0 = 0.0, t0 + ts
        s = 0 if holds(p, t0) else sign(c["D"])
    return x0, v0


def force_to_start(p: Params) -> float:
    ph, th = math.radians(p.phi), math.radians(p.theta)
    return p.m * p.g * (math.sin(th) + p.muS * math.cos(th)) / (math.cos(ph) + p.muS * math.sin(ph))


def critical_angle(muS: float) -> float:
    return math.degrees(math.atan(muS))
