#!/usr/bin/env bash
# Copia os dados públicos do tm-clubes para o site.
# Uso local:   scripts/sincronizar_dados.sh ../tm-clubes
# Sem argumento, baixa a versão publicada no GitHub.
set -euo pipefail
DESTINO="$(cd "$(dirname "$0")/.." && pwd)/site/dados"
mkdir -p "$DESTINO"
ARQUIVOS=(ranking_clubes.json atletas_por_clube.json modelo_vitoria.json)

if [[ $# -ge 1 ]]; then
  for a in "${ARQUIVOS[@]}"; do cp "$1/dados/publico/$a" "$DESTINO/$a"; done
else
  BASE="${TM_CLUBES_RAW:-https://raw.githubusercontent.com/Matheusbruno7/tm-clubes/${TM_CLUBES_BRANCH:-main}/dados/publico}"
  for a in "${ARQUIVOS[@]}"; do curl -fsSL "$BASE/$a" -o "$DESTINO/$a"; done
fi
echo "dados sincronizados em $DESTINO"
