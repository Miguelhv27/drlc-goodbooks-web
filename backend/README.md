# backend/ — pipeline de representación (entregable del curso DRLC)

Esta carpeta es el **pipeline completo** que produce y exporta los resultados que consume
la página: `artifacts/results.json`, `embeddings.npz`, `items.csv` y `demo.json`. El sitio
(`../public/data/*.json`) se hornea desde estos artefactos con `../tools/gen_data.py`
(misma semilla, gate de reproducibilidad ±5e-3 sobre NDCG@10), así que cada número de la
página sale de acá.

## Qué hay

| Ruta | Qué es |
|---|---|
| `pipeline.py` | Preparación de Goodbooks-10k, baselines (popularidad, item-kNN, contenido), dos torres (ID / ID+tags) con negativos in-batch + logQ y early stopping sobre NDCG@10 de validación; métricas, análisis de representaciones (PCA, silueta, pureza, puente MRR) y export a `artifacts/` |
| `requirements.txt` | Versiones exactas usadas (Python 3.14.6, TensorFlow 2.22.0rc0 en `results.json → config.tf_version`) |
| `artifacts/` | Resultados exportados ya generados (semilla 42 + `seed_runs` 42/7/2024) — la página se hornea de acá |
| `tests/` | 13 pruebas deterministas del pipeline y del contrato con el sitio |
| `tools/experimentos*.py/json` | Evidencia cruda de las campañas de tuning (early stopping adoptado; dropout/negativos uniformes/τ/dim32/dim128/lr/batch descartados sobre validación) |

## Datos (no commiteados)

`data/` pesa ~88 MB y no va en el repo. Descargue
[Kaggle: zygmunt/goodbooks-10k](https://www.kaggle.com/datasets/zygmunt/goodbooks-10k) y
coloque `ratings.csv`, `books.csv`, `book_tags.csv`, `tags.csv` dentro de `backend/data/`.

## Reproducir de cero

```powershell
cd backend
pip install -r requirements.txt
python pipeline.py --seeds 42,7,2024   # sobreescribe artifacts/ (~1.5 min por semilla)
cd ..
python tools/gen_data.py --retrain     # hornea public/data/ con gate de validación
npm run build                          # y el sitio queda servido desde esos datos
```

Sin `data/` ni TensorFlow, el sitio igual funciona: `public/data/` ya está horneado en el
repo. Las pruebas: `python tests/test_bridge_metric.py`,
`python tests/test_seed_runs_shape.py`, `python tests/test_early_stop_logic.py`
(corren sin dataset); `tests/verificar_split.py` sí requiere `data/`.
