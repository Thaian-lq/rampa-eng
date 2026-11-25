import math

import pytest

from physics import Params, analytic_constant, critical_angle, force_to_start, simulate

BASE = Params()


@pytest.mark.parametrize("F", [25, 30, 60])
@pytest.mark.parametrize("theta", [0, 10, 20])
def test_rk4_igual_analitico(F, theta):
    p = BASE.with_(F=F, theta=theta)
    xa, va = analytic_constant(p)
    r = simulate(p, "rk4")
    assert r["x"] == pytest.approx(xa, rel=1e-9, abs=1e-9)
    assert r["v"] == pytest.approx(va, rel=1e-9, abs=1e-9)


def test_segunda_lei_horizontal():
    a = (30 - 0.3 * 5 * 9.81) / 5
    assert simulate(BASE)["x"] == pytest.approx(0.5 * a * 25, rel=1e-9)


def test_abaixo_do_limiar_fica_parado():
    r = simulate(BASE.with_(F=0.99 * force_to_start(BASE)))
    assert not r["moved"] and r["x"] == 0


def test_forca_minima_horizontal():
    assert force_to_start(BASE) == pytest.approx(0.5 * 5 * 9.81)


def test_dobrar_forca_resultante_dobra_aceleracao():
    a1 = simulate(BASE.with_(muS=0, muK=0, F=10))["v"] / 5
    a2 = simulate(BASE.with_(muS=0, muK=0, F=20))["v"] / 5
    assert a2 == pytest.approx(2 * a1)


def test_angulo_critico_independe_da_massa():
    for m in (1, 10, 50):
        p = BASE.with_(F=0, m=m)
        assert not simulate(p.with_(theta=critical_angle(0.5) - 0.5))["moved"]
        assert simulate(p.with_(theta=critical_angle(0.5) + 0.5))["moved"]


def test_bloco_sobe_para_e_desce():
    r = simulate(BASE.with_(theta=30, F=0, v0=8), "rk4")
    assert r["v"] < 0 and r["x"] < 0


def test_puxar_para_cima_reduz_normal_e_forca_minima():
    assert force_to_start(BASE.with_(phi=20)) < force_to_start(BASE)


def test_energia_conservada_no_balanco():
    r = simulate(BASE.with_(theta=15, F=50, b=1), "rk4", 0.005)
    assert r["W_F"] == pytest.approx(r["dEc"] + r["dEp"] + r["E_diss"], rel=5e-3)


def test_partida_com_forca_crescente():
    r = simulate(BASE.with_(mode="rampa", F=0, rate=10), "rk4", 0.001)
    assert r["t_start"] == pytest.approx(force_to_start(BASE) / 10, rel=1e-6)
