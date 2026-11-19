/** Texto riguroso heredado de DIFICULTADES y AJUSTES en app.py (verbatim). */

export interface Item {
  t: string;
  x: string;
}

export const DIFICULTADES: Item[] = [
  {
    t: "No hay timestamps en ratings.csv",
    x: "Goodbooks-10k no incluye fechas en `ratings.csv`, pero su documentación indica que las valoraciones están **ordenadas por tiempo** (github.com/zygmuntz/goodbooks-10k). Usamos el orden de filas de cada usuario como proxy de tiempo y hacemos un **split temporal por usuario**: las interacciones más antiguas van a train, luego validación y las más recientes a test. Es un supuesto que queremos validar. Además excluimos de las recomendaciones lo que el usuario ya vio en train/val.",
  },
  {
    t: "No existe columna de género",
    x: "El dataset trae tags, no géneros. Creamos un género 'proxy' tomando el tag de género más frecuente de cada libro (fantasy, romance, mystery…). Los libros sin tag de género quedan como 'otro' y no se usan en silhouette.",
  },
  {
    t: "Escala: ~6M calificaciones",
    x: "Para iterar rápido trabajamos con un subconjunto aleatorio de usuarios (ver configuración en 'Pipeline'). El pipeline acepta `--max_users 0` para correr con todo.",
  },
  {
    t: "Long tail y sesgo a populares",
    x: "Pocos libros concentran muchas interacciones: el baseline de popularidad es difícil de superar y la evaluación puede favorecer a modelos que recomiendan lo popular.",
  },
];

export const AJUSTES: Item[] = [
  {
    t: "Split aleatorio → split cronológico",
    x: "El plan original usaba un split aleatorio por usuario. Según la documentación del dataset, las valoraciones de `ratings.csv` están ordenadas por tiempo, así que ahora el split es **cronológico** (train = más antiguas, val/test = más recientes). Esto evalúa de forma más realista la capacidad de predecir lo que el usuario leerá *después* de su historial.",
  },
  {
    t: "Corrección logQ en los negativos in-batch",
    x: "Los negativos in-batch se muestrean con la distribución de popularidad, lo que sobrepenaliza los libros populares. Restamos log Q(j) de los logits durante el entrenamiento (Yi et al., 2019): con esto el NDCG@10 de las dos torres pasó de ~0.024 a ~0.049.",
  },
  {
    t: "TFRS → dos torres manuales en Keras",
    x: "Implementamos la tarea de retrieval (softmax con negativos in-batch) directamente en TensorFlow/Keras: es la misma idea de TFRS pero evita problemas de compatibilidad de versiones.",
  },
  {
    t: "Tags de género fuera de las features de contenido",
    x: "Para que el género sirva como referencia lo más independiente posible al analizar representaciones, quitamos los tags de género de las features de contenido y del modelo con metadatos. Otros tags pueden seguir correlacionados con el género.",
  },
  {
    t: "Evaluación sobre muestra de usuarios",
    x: "Evaluamos sobre una muestra aleatoria de usuarios con items en test, para que sea rápido y reproducible (semilla fija).",
  },
  {
    t: "Retroalimentación del profesor",
    x: "Se agregaron: reporte completo de métricas, resumen de arquitectura de las torres y curvas de entrenamiento con interpretación.",
  },
];

export const CHECKLIST: { requisito: string; donde: string; href: string }[] = [
  { requisito: "Dataset preparado", donde: "Dataset", href: "#dataset" },
  { requisito: "Pipeline inicial funcionando", donde: "Pipeline", href: "#pipeline" },
  { requisito: "Resultados preliminares", donde: "Resultados + Representaciones", href: "#resultados" },
  { requisito: "Dificultades encontradas", donde: "Dificultades y ajustes", href: "#dificultades" },
  { requisito: "Ajustes al plan original", donde: "Dificultades y ajustes", href: "#dificultades" },
  { requisito: "Resumen de arquitectura de las torres", donde: "Arquitectura", href: "#arquitectura" },
  { requisito: "Curvas de entrenamiento interpretadas", donde: "Curvas", href: "#curvas" },
];
