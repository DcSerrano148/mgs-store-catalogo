"""
Genera datos/catalogo.json a partir de:
  - datos/catalogo.csv   (productos, categoria, stock, disponibilidad)
  - datos/precios.csv    (precios minorista / mayorista)
"""
import json
from datetime import datetime
from pathlib import Path
import pandas as pd

DATOS = Path("datos")
CATALOGO_CSV = DATOS / "catalogo.csv"
PRECIOS_CSV = DATOS / "precios.csv"
OUT = DATOS / "catalogo.json"


def limpiar(v):
    if v is None:
        return ""
    if isinstance(v, float) and pd.isna(v):
        return ""
    return str(v).strip()


def leer_csv(path):
    if not path.exists():
        return None
    df = pd.read_csv(path, encoding="utf-8")
    df.columns = [str(c).strip().lower() for c in df.columns]
    return df


def cargar_precios():
    df = leer_csv(PRECIOS_CSV)
    if df is None:
        print("Aviso: no existe", PRECIOS_CSV)
        return {}
    mapa = {}
    for _, r in df.iterrows():
        code = limpiar(r.get("codigo"))
        if not code:
            continue
        minor = pd.to_numeric(r.get("precio_minorista_usd"), errors="coerce")
        mayor = pd.to_numeric(r.get("precio_mayorista_usd"), errors="coerce")
        mapa[code] = {
            "retail": float(minor) if pd.notna(minor) else None,
            "wholesale": float(mayor) if pd.notna(mayor) else None,
        }
    print("Precios cargados:", len(mapa))
    return mapa


def main():
    if not CATALOGO_CSV.exists():
        raise SystemExit("No existe " + str(CATALOGO_CSV))

    cat = leer_csv(CATALOGO_CSV)
    precios = cargar_precios()

    items = []
    seen = set()
    for i, r in cat.iterrows():
        name = limpiar(r.get("producto"))
        if not name or name.lower() == "nan":
            continue

        code = limpiar(r.get("codigo"))
        if not code or code in seen:
            print("Fila " + str(i + 2) + ": codigo vacio o duplicado ->", code)
            continue
        seen.add(code)

        unidades = pd.to_numeric(r.get("unidades"), errors="coerce")
        p = precios.get(code, {"retail": None, "wholesale": None})

        items.append({
            "code": code,
            "name": name,
            "cat": limpiar(r.get("categoria")) or "Sin categoría",
            "seccion": limpiar(r.get("seccion")),
            "stock": int(unidades) if pd.notna(unidades) else 0,
            "disponible": limpiar(r.get("disponibilidad")).lower() == "disponible",
            "retail": p["retail"],
            "wholesale": p["wholesale"],
            "photo": limpiar(r.get("foto")) or ("fotos/" + code + ".jpg"),
        })

    payload = {
        "version": datetime.now().strftime("%Y%m%d-%H%M"),
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "total": len(items),
        "items": items,
    }

    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    sin_min = sum(1 for x in items if x["retail"] is None)
    sin_may = sum(1 for x in items if x["wholesale"] is None)
    disp = sum(1 for x in items if x["disponible"])

    print("Generado:", OUT)
    print("Total:", len(items))
    print("Sin precio minorista:", sin_min)
    print("Sin precio mayorista:", sin_may)
    print("Disponibles:", disp)


if __name__ == "__main__":
    main()