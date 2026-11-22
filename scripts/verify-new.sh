#!/usr/bin/env bash
# O portão local do app novo (`pnpm verify:new`), sem navegador e sem GitHub.
#
# Prova de ponta a ponta o que o Prumo entrega: empacota os pacotes, cria um app com `prumo new`
# numa pasta temporária fora do monorepo, gera nele um domínio, uma tela com --domain e um componente
# pela CLI, gera outro domínio e outra tela só por ferramentas MCP (um cliente de verdade, por stdio,
# contra o prumo-mcp do app) e roda o `pnpm verify` do app (typecheck, lint, check e testes).
#
# O script não edita arquivo do app: quem muda o app é a CLI e o servidor MCP. Se o verify do app
# falha, o achado é dos modelos, da CLI ou dos pacotes, não do script. A pasta temporária some no fim,
# também em caso de falha.
#
# Etapas: pack, new, cli, mcp, verify e clean (a duração de cada uma sai no fim).
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

stage_cli() {
  prumo make:domain clientes
  prumo make:page clientes --domain clientes
  prumo make:component resumo --page clientes
}

stage_mcp() {
  node "$ROOT/packages/mcp/scripts/drive-mcp.mjs" "$APP"
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
step mcp stage_mcp
step verify stage_verify
