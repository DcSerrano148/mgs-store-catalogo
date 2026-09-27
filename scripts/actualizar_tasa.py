"""
Actualiza datos/tasa.json consultando la API de elTOQUE.

- Lee la tasa anterior de tasa.json
- Consulta la API de elTOQUE (si hay token)
- Determina tendencia (up/down/stable)
- Calcula toque + margen
- Escribe tasa.json

Si no hay token ELTOQUE_TOKEN, mantiene el archivo como esta.
"""
import json
import os
import sys
from datetime import datetime
from pathlib import Path
import urllib.request
import urllib.error

TASA_JSON = Path("datos/tasa.json")

MARGINS = {
    "up": 10,
    "stable": 5,
    "down": 0
}

STABLE_THRESHOLD = 1


def leer_tasa_anterior():
    if not TASA_JSON.exists():
        return None
    try:
        with open(TASA_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, KeyError):
        return None


def consultar_api(token):
    url = "https://tasas.eltoque.com/v1/trmi"
    req = urllib.request.Request(url)
    req.add_header("Authorization", "Bearer " + token)
    req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print("Error HTTP " + str(e.code) + ": " + str(e.reason))
        if e.code == 401:
            print("Token invalido o expirado.")
        elif e.code == 429:
            print("Limite de peticiones excedido.")
        return None
    except Exception as e:
        print("Error de conexion: " + str(e))
        return None


def extraer_tasa_usd(data):
    if not data:
        return None

    if isinstance(data, dict):
        for key in data:
            k = str(key).upper()
            if k == "USD":
                try:
                    return float(data[key])
                except (TypeError, ValueError):
                    pass
        for key in data:
            if isinstance(data[key], dict):
                for k2 in data[key]:
                    if str(k2).upper() == "USD":
                        try:
                            return float(data[key][k2])
                        except (TypeError, ValueError):
                            pass

    if isinstance(data, list) and len(data) > 0:
        last = data[-1]
        if isinstance(last, dict):
            for key in last:
                if str(key).upper() == "USD":
                    try:
                        return float(last[key])
                    except (TypeError, ValueError):
                        pass

    return None


def determinar_tendencia(tasa_nueva, tasa_anterior):
    if tasa_anterior is None:
        return "stable"
    diff = tasa_nueva - tasa_anterior
    if abs(diff) <= STABLE_THRESHOLD:
        return "stable"
    return "up" if diff > 0 else "down"


def guardar(payload):
    TASA_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(TASA_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def main():
    token = os.environ.get("ELTOQUE_TOKEN", "").strip()

    anterior = leer_tasa_anterior()
    tasa_anterior_valor = anterior.get("toque") if anterior else None

    if not token:
        print("No hay ELTOQUE_TOKEN. Manteniendo tasa.json como esta.")
        if anterior:
            print("Tasa actual: " + str(anterior.get("toque")) + " (" + str(anterior.get("trend")) + ")")
        else:
            print("No existe tasa.json. Creando valor inicial por defecto.")
            guardar({
                "toque": 730,
                "trend": "stable",
                "margin": 5,
                "calc": 735,
                "updated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
                "source": "default"
            })
        sys.exit(0)

    print("Consultando API de elTOQUE...")
    data = consultar_api(token)

    if data is None:
        print("No se pudo consultar la API. Manteniendo valor anterior.")
        if anterior:
            print("Tasa actual: " + str(anterior.get("toque")))
        sys.exit(0)

    tasa_nueva = extraer_tasa_usd(data)
    if tasa_nueva is None:
        print("No se encontro la tasa USD en la respuesta.")
        print("Respuesta: " + json.dumps(data, ensure_ascii=False)[:500])
        sys.exit(1)

    print("Tasa elTOQUE nueva: " + str(tasa_nueva))
    print("Tasa elTOQUE anterior: " + str(tasa_anterior_valor))

    trend = determinar_tendencia(tasa_nueva, tasa_anterior_valor)
    print("Tendencia detectada: " + trend)

    margin = MARGINS[trend]
    calc = tasa_nueva + margin
    print("Margen aplicado: +" + str(margin))
    print("Tasa de calculo final: " + str(calc))

    payload = {
        "toque": int(tasa_nueva),
        "trend": trend,
        "margin": margin,
        "calc": int(calc),
        "updated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "source": "elTOQUE API v1/trmi"
    }

    guardar(payload)
    print("Escrito: " + str(TASA_JSON))
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
