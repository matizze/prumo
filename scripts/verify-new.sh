#!/usr/bin/env bash
# O portão local do app novo (`pnpm verify:new`), sem navegador e sem GitHub.
#
# Prova de ponta a ponta o que o Prumo entrega: empacota os pacotes, cria um app com `prumo new`
# numa pasta temporária fora do monorepo (com os tarballs) e roda o `pnpm verify` do app (typecheck,
# lint, `prumo check` e testes). A cada comando novo da CLI (`make:schema`, `make:repository`,
# `make:query` e `make:page`), a etapa `cli` ganha as chamadas dele, e o `verify` do app passa a
# cobrir o que foi gerado.
#
# O script não edita arquivo do app: quem muda o app é a CLI. Se o verify do app falha, o achado é
# dos modelos, da CLI ou dos pacotes, não do script. A pasta temporária some no fim, também em caso
# de falha.
#
# Etapas: pack, new, cli, verify e clean (a duração de cada uma sai no fim).
# Pesado (instala dependências e roda tsc, eslint e vitest): rode pela trava de memória da máquina,
# um por vez. Uso: pnpm verify:new
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK=""
APP=""
STEPS=()

# A pasta temporária e o app dentro dela; o trap a apaga quando o script termina, bem ou mal
cleanup() {
  local code=$?
  if [ -n "$WORK" ] && [ -d "$WORK" ]; then
    local started=$SECONDS
    rm -rf "$WORK"
    STEPS+=("clean $((SECONDS - started))s")
  fi
  if [ "${#STEPS[@]}" -gt 0 ]; then
    echo "" >&2
    echo "Etapas: ${STEPS[*]}" >&2
  fi
  if [ "$code" -eq 0 ]; then
    echo "verify:new: verde" >&2
  else
    echo "verify:new: falhou (saída $code)" >&2
  fi
}
trap cleanup EXIT

# Roda uma etapa (nome e função) e anota a duração
step() {
  local name="$1"
  shift
  echo "" >&2
  echo "==> $name" >&2
  local started=$SECONDS
  "$@"
  STEPS+=("$name $((SECONDS - started))s")
}

prumo() {
  (cd "$APP" && pnpm exec prumo "$@")
}

stage_pack() {
  pnpm --dir "$ROOT" run pack:all "$WORK/packs" >&2
}

stage_new() {
  node "$ROOT/packages/cli/dist/bin.js" new portao --dir "$WORK" --packages "$WORK/packs"
}

# Os comandos de geração do app. Cada passo da reescrita da CLI acrescenta aqui as chamadas do seu
# comando, na ordem das camadas:
#   passo 3  make:schema      (schema com campos de todos os tipos: --fields e --entity)
#   passo 4  make:repository  (o mock e o teste de contrato; passo 5: --data-source http e storage)
#   passo 6  make:query
#   passo 7  make:page        (título, lista com --query, parâmetro e detalhe)
# O `new` já gera a tela inicial (home), que o `check` e os testes do verify do app cobrem.
stage_cli() {
  :
}

stage_verify() {
  (cd "$APP" && pnpm verify)
}

# O trap só apaga o que o script criou: a pasta nasce aqui, com o nome do mktemp
WORK="$(mktemp -d "${TMPDIR:-/tmp}/prumo-verify-new.XXXXXX")"
WORK="$(cd "$WORK" && pwd -P)"
APP="$WORK/portao"
export VITEST_MAX_WORKERS="${VITEST_MAX_WORKERS:-2}"

step pack stage_pack
step new stage_new
step cli stage_cli
step verify stage_verify
