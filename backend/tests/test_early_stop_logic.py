"""test_early_stop_logic.py - Prueba pura de la decision de early stopping (S10/T6).

Cubre `pipeline.early_stop_decision`, la funcion PURA portada del closure
`train_tt()` de tools/experimentos.py (T5: early stopping sobre val NDCG@10 fue
el unico knob que mejoro validacion). Corre sin TensorFlow y sin el dataset:
usa historias sinteticas de NDCG@10, incluida la corrida real 'es' seed 42.

Semantica verificada (identica a experimentos.py):
  - mejora ESTRICTA (`>`) mueve el mejor epoch; empates dejan el epoch mas antiguo;
  - `should_stop` cuando pasan `patience` epochs sin nueva mejora;
  - historial vacio = (False, -1).

Ejecucion:
    python tests/test_early_stop_logic.py          # runner plano (sin pytest)
    python -m pytest tests/test_early_stop_logic.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # goodbooks-recommender/
import pipeline  # noqa: E402


def test_real_es_history_peak_at_epoch_4_stops_at_epoch_6():
    """Historia real del run 'es' (tower id, seed 42) de tools/experimentos.py:
    pico 0.0482 en epoca 4 (idx 3); epocas 5 y 6 no mejoran -> patience 2 se
    agota exactamente en la epoca 6."""
    h = [0.0376, 0.044, 0.0472, 0.0482, 0.0478, 0.0481]
    assert pipeline.early_stop_decision(h[:4], 2) == (False, 3)  # recien alcanza el pico
    assert pipeline.early_stop_decision(h[:5], 2) == (False, 3)  # espera = 1 < patience
    assert pipeline.early_stop_decision(h, 2) == (True, 3)       # espera = 2 -> stop, mejor epoca 4


def test_monotone_increasing_never_stops():
    """Si cada epoca supera a la anterior, la mejor siempre es la ultima:
    jamas se debe detener (hasta el tope de epocas)."""
    h = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10]
    for n in range(1, len(h) + 1):
        stop, bidx = pipeline.early_stop_decision(h[:n], 2)
        assert stop is False and bidx == n - 1, (n, stop, bidx)


def test_ties_keep_earliest_best_epoch_deterministically():
    """Mejora estricta: un empate no desplaza el mejor epoch (queda el mas
    antiguo), y cada empate suma espera. Con patience 2, tras dos empates se
    detiene senalando la epoca 1 (idx 0), no la ultima."""
    assert pipeline.early_stop_decision([0.5, 0.5], 2) == (False, 0)   # espera = 1
    assert pipeline.early_stop_decision([0.5, 0.5, 0.5], 2) == (True, 0)  # espera = 2
    # un empate en el pico, luego una marca igual de alta: el idx no se mueve
    assert pipeline.early_stop_decision([0.4, 0.5, 0.5], 3) == (False, 1)


def test_empty_history_is_noop():
    assert pipeline.early_stop_decision([], 2) == (False, -1)


def test_patience_one_stops_after_single_non_improvement():
    assert pipeline.early_stop_decision([0.9], 1) == (False, 0)
    assert pipeline.early_stop_decision([0.9, 0.1], 1) == (True, 0)
    # recuperacion por encima del pico reinicia la espera
    assert pipeline.early_stop_decision([0.9, 0.1, 0.95], 1) == (False, 2)


def _run_all():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for t in tests:
        t()
        print(f"OK  {t.__name__}")
    print(f"\n{len(tests)} pruebas de early_stop_decision superadas.")


if __name__ == "__main__":
    _run_all()
