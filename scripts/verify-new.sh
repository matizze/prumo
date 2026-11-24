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
#   passo 4  make:repository  (o mock e o teste de contrato)
#   passo 5  make:repository --data-source (storage e http, no repositório que existe e no que nasce com a fonte)
#   passo 6  make:query
#   passo 7  make:page        (título, lista com --query, parâmetro e detalhe)
# O `new` já gera a tela inicial (home), que o `check` e os testes do verify do app cobrem.
stage_cli() {
  # passo 3: make:schema com o campo padrão, com campos de todos os tipos e com --entity
  prumo make:schema clientes
  prumo make:schema livros --fields "titulo:string,autor:string,ano:number,paginas:int,situacao:enum(lido|lendo|desejado),disponivel:boolean,publicadoEm:date,lidoEm?:datetime,apelido?:string"
  prumo make:schema paes --entity pao
  # passo 4: make:repository com o mock, lendo os campos de cada schema (o livros tem todos os tipos)
  prumo make:repository clientes
  prumo make:repository livros
  prumo make:repository paes --entity pao
  # passo 5: as fontes. O storage e o http entram num repositório que já existe (o contrato do
  # storage roda no verify do app, e o do http fica pulado sem API_TEST_URL); o pedidos já nasce
  # com o http, e o segundo domínio http reaproveita o cliente que o primeiro criou
  prumo make:repository livros --data-source storage
  prumo make:repository clientes --data-source http
  prumo make:schema pedidos
  prumo make:repository pedidos --data-source http
  # passo 6: make:query, uma por domínio (as queries só usam o contrato, valem para qualquer fonte)
  prumo make:query clientes
  prumo make:query livros
  prumo make:query paes --entity pao
  prumo make:query pedidos
  # passo 7: make:page, as quatro variações (título, lista com --query, parâmetro e detalhe). O
  # campo de texto sai do schema: o livros mostra o titulo, e o pedidos (o campo padrão) o name
  prumo make:page sobre
  prumo make:page clientes --query clientes
  prumo make:page cliente --query clientes --path /clientes/:id
  prumo make:page livros --query livros
  prumo make:page livro --query livros --path /livros/:id
  prumo make:page perfil --path /perfil/:usuario
  prumo make:page pedidos --query pedidos
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
