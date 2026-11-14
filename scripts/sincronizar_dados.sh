#!/usr/bin/env bash
# Copia para o site os dados do tm-clubes e o motor de previsão do tm-ranking.
# Uso local:   scripts/sincronizar_dados.sh ../tm-clubes ../tm-ranking
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DESTINO="$RAIZ/site/dados"
mkdir -p "$DESTINO"
CLUBES="${1:-}"
RANKING="${2:-}"
ARQUIVOS=(ranking_clubes.json atletas_por_clube.json modelo_vitoria.json)

if [[ -n "$CLUBES" ]]; then
  for a in "${ARQUIVOS[@]}"; do cp "$CLUBES/dados/publico/$a" "$DESTINO/$a"; done
else
  BASE="${TM_CLUBES_RAW:-https://raw.githubusercontent.com/Matheusbruno7/tm-clubes/${TM_CLUBES_BRANCH:-main}/dados/publico}"
  for a in "${ARQUIVOS[@]}"; do curl -fsSL "$BASE/$a" -o "$DESTINO/$a"; done
fi
if [[ -n "$RANKING" ]]; then
  cp "$RANKING/src/previsao.js" "$RAIZ/site/js/previsao.js"
fi
echo "dados sincronizados em $DESTINO"
