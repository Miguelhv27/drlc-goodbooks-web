from pathlib import Path
import numpy as np
import pandas as pd

# Ruta a la carpeta data/, relativa a la ubicación de este archivo.
DATA = Path(__file__).resolve().parent.parent / "data"

print("1. Leyendo ratings...", flush=True)
ratings = pd.read_csv(DATA / "ratings.csv")
print(f"   Filas leídas: {len(ratings):,}", flush=True)

print("2. Conservando orden original...", flush=True)
ratings["_order"] = np.arange(len(ratings))
ratings = ratings.drop_duplicates(["user_id", "book_id"])
print(f"   Filas sin duplicados: {len(ratings):,}", flush=True)

print("3. Filtrando valoraciones positivas...", flush=True)
pos = ratings.loc[ratings["rating"] >= 4].copy()

counts = pos.groupby("user_id").size()
valid_users = counts[counts >= 5].index

pos = pos[pos["user_id"].isin(valid_users)].copy()
print(f"   Interacciones positivas: {len(pos):,}", flush=True)
print(f"   Usuarios seleccionados: {pos['user_id'].nunique():,}", flush=True)

print("4. Separando cronológicamente...", flush=True)

# Orden original del archivo como referencia temporal.
pos = pos.sort_values("_order").reset_index(drop=True)

# Posición de cada interacción dentro del historial de cada usuario.
group = pos.groupby("user_id", sort=False)
pos["position"] = group.cumcount()
pos["n"] = group["user_id"].transform("size")

# Número de interacciones que se reservarán para test y validación.
pos["n_test"] = np.ceil(0.20 * pos["n"]).astype(int).clip(lower=1)
pos["n_val"] = np.ceil(0.10 * pos["n"]).astype(int).clip(lower=1)

# Garantizar que cada usuario conserve al menos una interacción
# para entrenamiento, validación y prueba.
small = (pos["n_test"] + pos["n_val"]) >= pos["n"]
pos.loc[small, "n_test"] = 1
pos.loc[small, "n_val"] = 1

pos["n_train"] = pos["n"] - pos["n_test"] - pos["n_val"]

# Clasificación vectorizada: sin bucle ni asignaciones por usuario.
pos["split"] = np.select(
    [
        pos["position"] >= pos["n_train"] + pos["n_val"],
        pos["position"] >= pos["n_train"],
    ],
    ["test", "val"],
    default="train",
)

print("5. Resultado:", flush=True)
print("\nCantidad de interacciones por conjunto:")
print(pos["split"].value_counts().to_string())

print("\nNúmero de usuarios:", pos["user_id"].nunique())

print("\nInteracciones por usuario y conjunto:")
summary = pos.pivot_table(
    index="user_id",
    columns="split",
    values="book_id",
    aggfunc="count",
    fill_value=0,
)

print(summary[["train", "val", "test"]].describe().round(2).to_string())

print("\nUsuarios sin interacciones de entrenamiento:",
      int((summary["train"] == 0).sum()))

print("\nUsuarios sin interacciones de validación:",
      int((summary["val"] == 0).sum()))

print("\nUsuarios sin interacciones de prueba:",
      int((summary["test"] == 0).sum()))

print("\nVerificación terminada.", flush=True)
