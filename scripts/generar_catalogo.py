import pandas as pd, json, re
from pathlib import Path
from datetime import datetime

CATALOGO_XLSX = Path("datos/Catalogo_MG_Store_Maestro_Definitivo.xlsx")
PRECIOS_CSV   = Path("datos/precios.csv")
PRECIOS_XLSX  = Path("datos/precios.xlsx")
OUT           = Path("datos/catalogo.json")
OUT.parent.mkdir(parents=True, exist_ok=True)


# ---------- Utilidades ----------
def norm(s):
    s = "" if s is None else str(s).lower()
    return re.sub(r"[^a-z0-9 ]", "", s.translate(str.maketrans("áéíóúñ", "aeioun"))).strip()


def clean(v):
    if v is None: return ""
    try:
        if pd.isna(v): return ""
    except (TypeError, ValueError):
        pass
    return re.sub(r"\s+", " ", str(v)).strip()


def category(name):
    n = norm(name)
    rules = [
        ("Servicios técnicos",     ["reparacion", "reparaciones"]),
        ("Frenos",                 ["freno", "pastilla", "forro", "pinza", "bomba", "pulmon", "manguera", "manija"]),
        ("Iluminación",            ["faro", "farol", "intermitente", "neblinero", "led", "bombillo"]),
        ("Ruedas y llantas",       ["goma", "llanta", "rueda", "rin", "valvula"]),
        ("Químicos y sprays",      ["spray", "pintura", "limpiador", "abrillantador", "grasa", "barniz", "aflojalo"]),
        ("Sistema eléctrico",      ["alarma", "conmutador", "voltimetro", "pito", "musica", "twitter", "gps", "breker",
                                     "flasher", "regleta", "caja de luces", "toma de carga", "cargador"]),
        ("Motor y transmisión",    ["bujia", "chucho", "kit de junta", "kit de rodamiento", "reten", "filtro", "6301"]),
        ("Carrocería y controles", ["espejo", "manubrio", "puño", "puno", "slaider", "slider", "estribo", "letra", "capas"]),
        ("Accesorios y tornillería",["brida", "tornillo", "candado", "liga", "embellecedor", "quita ruido", "tapa de valvula", "paquete"]),
    ]
    for cat, keys in rules:
        if any(k in n for k in keys): return cat
    return "Accesorios y tornillería"


# ---------- 1) Cargar tabla de precios ----------
def cargar_precios():
    if PRECIOS_XLSX.exists():
        df = pd.read_excel(PRECIOS_XLSX)
        fuente = PRECIOS_XLSX
    elif PRECIOS_CSV.exists():
        df = pd.read_csv(PRECIOS_CSV, encoding="utf-8")
        fuente = PRECIOS_CSV
    else:
        print(f"⚠️  No encontré {PRECIOS_CSV} ni {PRECIOS_XLSX}. Los precios quedarán en null.")
        return {}, None

    df.columns = [str(c).strip().lower() for c in df.columns]
    mapa = {}
    for _, r in df.iterrows():
        code = clean(r.get("codigo"))
        if not code: continue
        minor = pd.to_numeric(r.get("precio_minorista_usd"), errors="coerce")
        mayor = pd.to_numeric(r.get("precio_mayorista_usd"), errors="coerce")
        mapa[code] = {
            "retail":    float(minor) if pd.notna(minor) else None,
            "wholesale": float(mayor) if pd.notna(mayor) else None,
        }
    print(f"✅ {len(mapa)} precios cargados desde {fuente.name}")
    return mapa, fuente


# ---------- 2) Cargar catálogo ----------
if not CATALOGO_XLSX.exists():
    raise SystemExit(f"❌ No encuentro {CATALOGO_XLSX}")

df = pd.read_excel(CATALOGO_XLSX, sheet_name="Catálogo")
df.columns = [str(c).strip() for c in df.columns]

# ---------- 3) JOIN ----------
precios, _ = cargar_precios()

items, issues, seen = [], [], set()
for i, r in df.iterrows():
    name = clean(r.get("Producto"))
    if not name or name.lower() == "nan":
        continue

    code = clean(r.get("Código"))
    if not code:
        issues.append(f"Fila {i+2}: sin código. Se omite.")
        continue
    if code in seen:
        issues.append(f"Duplicado: {code} — se omite la segunda fila.")
        continue
    seen.add(code)

    unidades = pd.to_numeric(r.get("Unidades"), errors="coerce")
    disp     = clean(r.get("Disponibilidad")).lower() == "disponible"
    cat      = clean(r.get("Categoría")) or category(name)

    p = precios.get(code, {"retail": None, "wholesale": None})

    items.append({
        "code":       code,
        "name":       name,
        "cat":        cat,
        "stock":      int(unidades) if pd.notna(unidades) else 0,
        "disponible": disp,
        "retail":     p["retail"],
        "wholesale":  p["wholesale"],
        "photo":      f"fotos/{code}.jpg",
    })

    if p["retail"]    is None: issues.append(f"Sin precio minorista: {code}")
    if p["wholesale"] is None: issues.append(f"Sin precio mayorista: {code}")
    if not disp and not items[-1]["stock"]: issues.append(f"Agotado: {code}")

# ---------- 4) Guardar ----------
payload = {
    "version":      datetime.now().strftime("%Y%m%d-%H%M"),
    "generated_at": datetime.now().isoformat(timespec="seconds"),
    "total":        len(items),
    "items":        items,
}
OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

# ---------- 5) Reporte QA ----------
print(f"\n✅ Catálogo generado: {len(items)} productos → {OUT}")
print(f"   Sin precio minorista: {sum(1 for i in items if i['retail']    is None)}")
print(f"   Sin precio mayorista: {sum(1 for i in items if i['wholesale'] is None)}")
print(f"   Disponibles:          {sum(1 for i in items if i['disponible'])}")
print(f"   Agotados:             {sum(1 for i in items if not i['disponible'])}")

if issues:
    print(f"\n⚠️  {len(issues)} observaciones:")
    for x in issues[:25]:
        print(f"   - {x}")
    print(f"   ... (total {len(issues)})")
