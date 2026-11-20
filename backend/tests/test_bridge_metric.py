"""test_bridge_metric.py - Prueba determinista de la metrica 'puente' (S1).

Cubre `pipeline.bridge_item_metric`, una funcion PURA sobre una matriz de
embeddings + conjuntos de indices (historia train+val, positivos test). Corre
sin TensorFlow y sin el dataset: usa embeddings sinteticos pequenos cuyo MRR y
recall@k se pueden calcular a mano.

Ejecucion:
    python tests/test_bridge_metric.py          # runner plano (sin pytest)
    python -m pytest tests/test_bridge_metric.py
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # goodbooks-recommender/
import pipeline  # noqa: E402


def test_bridge_metric_synthetic_exact():
    """1 usuario, 5 items, sin historial. Rankings sin empates, calculables a mano.

    Embeddings (se L2-normalizan dentro de la funcion):
      e0=[1,0]  e1=[0.9,0.1]  e2=[0.2,0.8]  e3=[-0.3,-0.9]  e4=[-1,0]
    Queries (positivos test) = [0,1,2]; para cada query la verdad de referencia
    son los OTROS dos positivos. Cada ranking pone un positivo relevante en el
    puesto 1, pero solo UNO de los dos relevantes cae en el top-1 -> recall@1=0.5.
    """
    E = np.array([[1, 0], [0.9, 0.1], [0.2, 0.8], [-0.3, -0.9], [-1, 0]], dtype=np.float32)
    seen_sets = [[]]          # sin train/val excluidos
    query_sets = [[0, 1, 2]]  # los tres son 'held-out' para este usuario
    res = pipeline.bridge_item_metric(E, seen_sets, query_sets, ks=(1, 2, 3))

    assert res["mrr"] == 1.0, res              # primer relevante siempre en puesto 1
    assert abs(res["recall@1"] - 0.5) < 1e-9, res   # 1 de 2 relevantes en el top-1
    assert res["recall@2"] == 1.0, res         # ambos relevantes dentro del top-2
    assert res["recall@3"] == 1.0, res


def test_bridge_metric_masks_history():
    """La historia train+val debe EXCLUIRSE como fuente de candidatos.

    e2 (item 2) es historial del usuario y es casi identico a e1 (el query del
    segundo caso). Si NO se enmascarara, e2 encabezaria el ranking y el item
    relevante (e0) caeria al puesto 2 -> MRR baja a 0.75 y recall@1 a 0.5.
    Enmascando el historial (convencion de `evaluate()`), el relevante queda 1ro.
    """
    E = np.array([[1, 0], [0.8, -0.6], [0.72, -0.69], [0, -1]], dtype=np.float32)
    queries = [[0, 1]]
    masked = pipeline.bridge_item_metric(E, [[2]], queries, ks=(1, 2, 3))
    unmasked = pipeline.bridge_item_metric(E, [[]], queries, ks=(1, 2, 3))

    assert masked["mrr"] == 1.0, masked
    assert masked["recall@1"] == 1.0, masked
    # El control demuestra que la diferencia se debe al enmascarado, no al azar.
    assert unmasked["mrr"] < masked["mrr"], (unmasked, masked)
    assert unmasked["recall@1"] < masked["recall@1"], (unmasked, masked)


def test_bridge_metric_skips_users_without_two_positives():
    """Un usuario con <2 positivos test no aporta queries (no hay 'otros' que
    recuperar): la funcion debe devolver el caso vacio sin division por cero."""
    E = np.eye(4, dtype=np.float32)
    res = pipeline.bridge_item_metric(E, [[]], [[0]], ks=(1, 2, 3))
    assert res == {"mrr": 0.0, "recall@1": 0.0, "recall@2": 0.0, "recall@3": 0.0}, res


def test_bridge_metric_bounds_and_perfect_partner():
    """Fronteras de S1: con embeddings aleatorios todo cae en [0,1], y con un
    espacio donde el unico vecino cercano de cada query es su pareja positiva,
    MRR y recall@1 deben ser exactamente 1.0 (caso ideal alcanzable)."""
    rng = np.random.default_rng(0)
    E = rng.normal(size=(50, 8)).astype(np.float32)
    seen_sets = [[int(x) for x in rng.integers(0, 50, 6)] for _ in range(4)]
    query_sets = [[7, 9], [11, 13], [2, 45], [20, 21]]
    res = pipeline.bridge_item_metric(E, seen_sets, query_sets, ks=(5, 10, 20))
    assert 0.0 <= res["mrr"] <= 1.0, res
    for k in (5, 10, 20):
        assert 0.0 <= res[f"recall@{k}"] <= 1.0, res

    # Caso ideal: item 0 y 1 son partners mutuos cercanos; 2 y 3 son lejanos.
    E2 = np.array([[1.0, 0.0], [0.9, 0.44], [0.0, -1.0], [-1.0, 0.0]], dtype=np.float32)
    ideal = pipeline.bridge_item_metric(E2, [[3]], [[0, 1]], ks=(1, 2, 3))
    assert ideal["mrr"] == 1.0, ideal
    assert ideal["recall@1"] == 1.0, ideal


def _run_all():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for t in tests:
        t()
        print(f"OK  {t.__name__}")
    print(f"\n{len(tests)} pruebas de bridge_item_metric superadas.")


if __name__ == "__main__":
    _run_all()
