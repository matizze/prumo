#!/usr/bin/env bash
# Compila e empacota os quatro pacotes publicáveis do Prumo (core, rules, testing e cli) com o
# `pnpm pack`, deixando os tarballs numa pasta. Nada é publicado: os tarballs servem para provar a
# instalação fora do monorepo (`prumo new --packages <pasta>` e o portão do produto novo).
#
# Uso: scripts/pack-packages.sh [pasta]
#
# A pasta é o argumento, ou a variável PRUMO_PACKS_DIR, ou `.packs` na raiz do monorepo (que o git
# ignora). Se já existe, é esvaziada antes: a pasta tem só os tarballs desta execução, um por pacote,
# com o `workspace:*` já trocado pela versão e o `exports` já apontando para o `dist/`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# A ordem é a de publicação: o cli depende do rules
PACKAGES=(rules core testing cli)

if [ "$#" -gt 1 ]; then
  echo "uso: scripts/pack-packages.sh [pasta]" >&2
  exit 2
fi

OUT="${1:-${PRUMO_PACKS_DIR:-$ROOT/.packs}}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

# Esvazia só o que o script cria, nunca uma pasta com outras coisas: apaga os .tgz e nada mais
find "$OUT" -maxdepth 1 -type f -name 'matizze-prumo-*.tgz' -delete

for name in "${PACKAGES[@]}"; do
  dir="$ROOT/packages/$name"
  echo "==> @matizze/prumo-$name: build" >&2
  (cd "$dir" && pnpm run build >&2)
  echo "==> @matizze/prumo-$name: pack" >&2
  (cd "$dir" && pnpm pack --pack-destination "$OUT" >&2)
done

echo "Tarballs em $OUT:" >&2
ls -1 "$OUT"/matizze-prumo-*.tgz
