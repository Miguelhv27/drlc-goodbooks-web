# DRLC · Recomendador de libros con Deep Representation Learning

Sitio web del proyecto final (Goodbooks-10k, dos torres en TensorFlow/Keras).
Es el port moderno de la app Streamlit del curso: **conserva el 100% de la rigurosidad
técnica** (mismos números, fórmulas, tablas de capas, diagnósticos y salvedades
metodológicas) y le suma carruseles con portadas de libros, gráficos interactivos y
botones de *Explicación simple* debajo de cada bloque técnico.

Integrantes: Miguel Ángel Hernández Vargas · Juan Sebastián Fajardo Acevedo

## Stack

- **React 19 + TypeScript + Vite** — SPA estática (no necesita backend ni Python en producción).
- **Tailwind CSS 4** — tema "biblioteca" heredado de la app Streamlit (Libre Baskerville +
  Source Serif 4, paleta papel/nogal/bordo/latón).
- **Recharts** — todos los gráficos (EDA, curvas de pérdida, métricas, PCA).
- **KaTeX** — fórmulas de la pérdida softmax con negativos in-batch y la corrección logQ.
- **Portadas**: servidas en el navegador desde Open Library por ISBN-13 (`books.csv` del
  dataset). Si no hay portada, se muestra un lomo tipográfico con el título.

## De dónde salen los datos

`public/data/*.json` son artefactos **hornados**, generados con `tools/gen_data.py`, que
corre el pipeline original (`goodbooks-recommender/pipeline.py`) con la **misma semilla 42**
y los mismos hiperparámetros de `results.json` (dim 64, batch 2048, τ 0.05, logQ, 5 épocas,
15.000 usuarios). El script valida antes de escribir que el NDCG@10 reentrenado coincida
con `results.json` (tolerancia 5e-3) — si no casa, aborta. Por eso cada número del sitio es
el mismo del entregable.

| Archivo | Contenido |
|---|---|
| `summary.json` | config, EDA, métricas (Recall/NDCG/MAP@{5,10,20}), historia de entrenamiento, arquitectura de capas, silhouette/pureza |
| `books.json` | 10.000 libros: título, autores, género proxy, ratings, año, ISBN-13 |
| `pca_<modelo>_<init\|final>.json` | puntos PCA (2D) de las representaciones de libro, muestras de 2.500 por etapa |
| `neighbors.json` | 10 vecinos más cercanos (coseno) para el top-500 del catálogo, inicial y final |
| `demo.json` | 30 usuarios de ejemplo: train, test escondido y top-12 de los 5 modelos (precomputado, mismo pipeline) |
| `popular.json` | top 60 libros por valoraciones (carruseles) |
| `genres.json` | conteos de género proxy |

Para regenerar todo (necesita el repo `goodbooks-recommender` al lado, con `data/` y TensorFlow):

```bash
cd web
python tools/gen_data.py --retrain --demo-users 30
```

Sin `--retrain` reusa `artifacts/` existentes (más rápido, la demo queda con los 5 usuarios originales).

## Desarrollo local

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/ (100% estático)
npm run preview    # sirve dist/ para probar el build
```

## Despliegue en Vercel (gratis)

1. Subí esta carpeta a un repo de GitHub.
2. En Vercel: **Add New → Project → Import** desde ese repo.
3. Framework: *Vite* (autodetectado). Build command `npm run build`, output `dist`.
4. Deploy. Todo está dentro del plan **Hobby gratis**: sitio estático, sin funciones
   server-side, sin base de datos. Los ~2 MB de JSON y las imágenes (que vienen de
   Open Library, no de tu servidor) no consumen nada del límite.

## Estructura

```
web/
├── public/data/        # artefactos horneados (JSON)
├── src/
│   ├── lib/            # tipos, store de datos, paleta/heredada de app.py, textos
│   ├── components/     # BookCover, Carousel, FlowDiagram, TheoryCard, Math, Metric…
│   └── sections/       # Hero, Dataset, Pipeline, Architecture, Curves,
│                       # Results, Representations, Demo, Dificultades
└── tools/
    ├── gen_data.py     # hornea public/data desde el pipeline
    └── smoke.mjs       # verificación de renderizado headless
```

## Notas honestas (igual que en la app Streamlit)

- La demo muestra recomendaciones **precomputadas**, no inferencia en vivo: un sitio
  estático no puede correr TensorFlow en el cliente.
- La lista de libros escondidos en la demo está truncada a los primeros del test, así
  que el conteo de aciertos por usuario **subestima** el Recall real.
- Los valores absolutos de NDCG@k son bajos *por diseño* (catálogo de 10.000 ítems,
  split cronológico, verdades ocultas): lo que se publica es la comparación entre modelos.
- La novena sección del menú, **Dificultades** (`#dificultades`), cubre los problemas
  encontrados durante el proyecto (binarización de ratings ≥ 4, sesgo de los negativos
  in-batch y su corrección logQ, género como proxy ruidoso, primeras corridas con split
  aleatorio que inflaban las métricas, límites del dataset), las limitaciones actuales
  (la tabla principal reporta la corrida canónica de una sola semilla; la varianza
  multi-semilla se está agregando y, cuando los artefactos la expongan, el sitio la
  muestra como `media ± desvío`) y los
  próximos pasos (reentreno con todos los usuarios, init preentrenado item2vec/NCF,
  métricas por categoría, análisis de fairness de popularidad).
- Regla de procedencia de números en la prosa: cada cifra del sitio o sale de un campo
  de `summary.json` (renderizada con formato) o está etiquetada explícitamente como
  *observación anecdótica de corridas intermedias, sin artefacto asociado* (así aparece
  la anécdota de logQ "0,04 → 0,049" en Dificultades).
