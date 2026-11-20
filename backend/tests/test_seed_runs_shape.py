"""test_seed_runs_shape.py - Regresion de forma y consistencia del multi-seed (S2/S5).

Lee los artefactos CANONICOS commiteados (no reentrena) y verifica:
  1. config: seeds y tf_version presentes y correctos.
  2. seed_runs: 3 corridas, metricas completas por modelo.
  3. mean±desvío (poblacional) de NDCG@10 igual a los valores publicados (4 dec).
  4. web/public/data/summary.json trae los mismos seed_runs redondeados a 6 dec
     (contrato del bake de gen_data.py; si el generator vive al lado, salta con aviso).

Ejecucion:
    python tests/test_seed_runs_shape.py
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "artifacts" / "results.json"
# web/ vive en el proyecto hermano DRLC_Proyecto_final/web; en el repo de entrega
# (web/backend/) el summary esta un nivel arriba: public/data/summary.json
SUMMARY_CANDIDATES = [
    ROOT / ".." / "public" / "data" / "summary.json",
    ROOT.parent / "DRLC_Proyecto_final" / "web" / "public" / "data" / "summary.json",
    ROOT.parent / "web" / "public" / "data" / "summary.json",
]

TOWERS = ["dos_torres_id", "dos_torres_meta"]
EXPECTED_MEANSTD_NDCG10 = {  # valores publicados en el sitio (4 dec, artefactos T6 con early stopping)
    "dos_torres_id": (0.0465, 0.0017),
    "dos_torres_meta": (0.0504, 0.002),
}
KEYS = ["recall@5", "recall@10", "recall@20", "ndcg@5", "ndcg@10", "ndcg@20", "map@10"]


def _load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def test_config_seeds_and_tf_version():
    d = _load(RESULTS)
    assert d["config"].get("seeds") == [42, 7, 2024], d["config"].get("seeds")
    tfv = str(d["config"].get("tf_version") or "")
    assert tfv, "tf_version missing en results.json"
    assert str(d["config"].get("seed")) == "42"  # la corrida canonica sigue siendo seed 42


def test_seed_runs_shape():
    d = _load(RESULTS)
    runs = d.get("seed_runs")
    assert isinstance(runs, list) and len(runs) == 3, len(runs if runs else [])
    assert [r["seed"] for r in runs] == [42, 7, 2024]
    for r in runs:
        for model in TOWERS:
            m = r["metrics"][model]
            for k in KEYS:
                assert k in m and 0.0 <= m[k] <= 1.0, (r["seed"], model, k, m.get(k))


def test_seed_runs_mean_std_matches_published():
    d = _load(RESULTS)
    for model, (mean_exp, std_exp) in EXPECTED_MEANSTD_NDCG10.items():
        vals = [r["metrics"][model]["ndcg@10"] for r in d["seed_runs"]]
        mean = sum(vals) / len(vals)
        std = math.sqrt(sum((v - mean) ** 2 for v in vals) / len(vals))  # poblacional
        assert round(mean, 4) == mean_exp, (model, round(mean, 4), mean_exp)
        assert round(std, 4) == std_exp, (model, round(std, 4), std_exp)


def test_summary_bake_consistency():
    summary_path = next((p for p in SUMMARY_CANDIDATES if p.exists()), None)
    if summary_path is None:
        print("SKIP: summary.json no encontrado (web/ no esta al lado); contrato de bake no verificado aqui.")
        return
    s = _load(summary_path)
    d = _load(RESULTS)
    assert "seed_runs" in s and "bridge" in s and "user_repr" in s, sorted(s.keys())
    assert [r["seed"] for r in s["seed_runs"]] == [r["seed"] for r in d["seed_runs"]]
    for rs_web, rs_art in zip(s["seed_runs"], d["seed_runs"]):
        for model in TOWERS:
            for k in ("ndcg@10", "recall@10"):
                # el bake redondea a 6 decimales: tolerancia = epsilon de rounding
                assert abs(rs_web["metrics"][model][k] - rs_art["metrics"][model][k]) <= 5e-7 + 1e-12, (model, k)
    for model in TOWERS:
        for stage in ("init", "final"):
            assert abs(s["bridge"][model][stage]["mrr"]
                       - d["repr"][model][f"bridge_{stage}"]["mrr"]) <= 5e-7 + 1e-12, (model, stage)


def _run_all():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for t in tests:
        t()
        print(f"OK  {t.__name__}")
    print(f"\n{len(tests)} pruebas de seed_runs/summary superadas.")


if __name__ == "__main__":
    _run_all()
