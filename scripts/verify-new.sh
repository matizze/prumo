#!/usr/bin/env bash
# O portão local do app novo (`pnpm verify:new`), sem navegador e sem GitHub.
#
# Prova de ponta a ponta o que o Prumo entrega: empacota os pacotes, cria um app com `prumo new`
# numa pasta temporária fora do monorepo (com os tarballs) e roda o `pnpm verify` do app (typecheck,
# lint, `prumo check` e testes). A cada comando novo da CLI (`make:schema`, `make:usecase`,
# `make:repository`, `make:query` e `make:page`), a etapa `cli` ganha as chamadas dele, e o `verify`
# do app passa a cobrir o que foi gerado.
#
# Depois da CLI, a etapa mcp liga ao servidor do app pelo `.mcp.json` que o `new` criou (o cliente do
# SDK, por stdio) e gera só por ferramentas um domínio, um use case e duas telas; o verify do app cobre
# o que ela gerou.
#
# O script não edita arquivo do app: quem muda o app é a CLI. Se o verify do app falha, o achado é
# dos modelos, da CLI ou dos pacotes, não do script. A pasta temporária some no fim, também em caso
# de falha.
#
# Etapas: pack, new, cli, mcp, verify e clean (a duração de cada uma sai no fim).
# Pesado (instala dependências e roda tsc, eslint e vitest): rode um por vez. Uso: pnpm verify:new
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

# Os comandos de geração do app, na ordem das camadas: make:schema, make:usecase, make:repository
# (mock e as outras fontes), make:query e make:page. O `new` já gera a tela inicial (home), que o `check` e os
# testes do verify do app cobrem.
stage_cli() {
  # make:schema com o campo padrão, com campos de todos os tipos e com --entity
  prumo make:schema clientes
  prumo make:schema livros --fields "titulo:string,autor:string,ano:number,paginas:int,situacao:enum(lido|lendo|desejado),disponivel:boolean,publicadoEm:date,lidoEm?:datetime,apelido?:string"
  prumo make:schema paes --entity pao
  # make:usecase: uma leitura (com a entidade de um schema como Output), uma escrita (com Input e Output
  # em campos) e um local (sem API, no localStorage). Os testes deles rodam contra o mock no verify do app
  prumo make:schema stores --fields "name:string,city:string"
  prumo make:usecase stores.get-stores --output "store[]"
  prumo make:usecase auth.sign-in --input "email:string,password:string" --output "token:string"
  prumo make:usecase cart.add-item --local --input "productId:string,quantity:int"
  # make:usecase --crud: os cinco use cases do livros (todos os tipos de campo), com a coleção de mock
  # que eles dividem; os testes deles rodam no verify do app, e as telas abaixo usam três deles
  prumo make:usecase livros --crud
  # make:repository com o mock, lendo os campos de cada schema (o livros tem todos os tipos)
  prumo make:repository clientes
  prumo make:repository livros
  prumo make:repository paes --entity pao
  # As fontes. O storage e o http entram num repositório que já existe (o contrato do
  # storage roda no verify do app, e o do http fica pulado sem API_TEST_URL); o pedidos já nasce
  # com o http, e o segundo domínio http reaproveita o cliente que o primeiro criou
  prumo make:repository livros --data-source storage
  prumo make:repository clientes --data-source http
  prumo make:schema pedidos
  prumo make:repository pedidos --data-source http
  # make:query, uma por domínio (as queries só usam o contrato, valem para qualquer fonte)
  prumo make:query clientes
  prumo make:query livros
  prumo make:query paes --entity pao
  prumo make:query pedidos
  # make:page, as quatro variações (título, lista com --query, parâmetro e detalhe) e as telas de use
  # case (lista, detalhe e formulário, também em subpasta). O campo de texto sai do schema: o livros
  # mostra o titulo, e o pedidos (o campo padrão) o name
  prumo make:page sobre
  prumo make:page clientes --query clientes
  prumo make:page cliente --query clientes --path /clientes/:id
  prumo make:page livros --usecase livros.list-livros
  prumo make:page livro --usecase livros.get-livro --path /livros/:id
  prumo make:page livro-novo --usecase livros.create-livro
  prumo make:page perfil --path /perfil/:usuario
  prumo make:page pedidos --query pedidos
  # telas em subpastas (com ponto e com barra): a pasta, a rota e as mensagens levam o caminho
  prumo make:page auth.login --usecase auth.sign-in
  prumo make:page auth/register --query clientes
  # um domínio com dígito na entidade (fase-2): o arquivo do schema e o id do teste vêm dos arquivos
  prumo make:schema fases-2 --entity fase-2
  prumo make:repository fases-2 --entity fase-2
  prumo make:query fases-2 --entity fase-2
  prumo make:page fase --query fases-2 --path /fases/:id
  # O prumo list só lê; o JSON tem os domínios, as fontes e as telas que os comandos acima criaram
  prumo list
  prumo list --json | node -e '
    const l = JSON.parse(require("node:fs").readFileSync(0, "utf8"))
    const fail = (m) => { console.error("prumo list --json: " + m); process.exit(1) }
    const repo = (d) => l.repositories.find((r) => r.domain === d) ?? fail("falta o repositório " + d)
    const sources = (d) => repo(d).sources.join(",")
    if (sources("livros") !== "mock,storage") fail("fontes de livros: " + sources("livros"))
    if (sources("clientes") !== "mock,http") fail("fontes de clientes: " + sources("clientes"))
    if (sources("pedidos") !== "mock,http") fail("fontes de pedidos: " + sources("pedidos"))
    if (sources("paes") !== "mock") fail("fontes de paes: " + sources("paes"))
    if (repo("paes").entity !== "Pao") fail("entidade de paes: " + repo("paes").entity)
    for (const d of ["clientes", "livros", "paes", "pedidos", "fases-2"]) {
      if (!l.schemas.some((s) => s.file.endsWith("/" + (d === "paes" ? "pao" : d === "fases-2" ? "fase-2" : d.slice(0, -1)) + ".ts") && s.fields)) fail("falta o schema " + d)
      if (!l.queries.some((q) => q.domain === d)) fail("falta a query " + d)
    }
    const pages = Object.fromEntries(l.pages.map((p) => [p.name, p.variation + ":" + p.route + ":" + p.query + ":" + p.useCase]))
    const want = { home: "title:/:null:null", sobre: "title:/sobre:null:null", clientes: "list:/clientes:clientes:null", cliente: "detail:/clientes/:id:clientes:null", livros: "list:/livros:null:livros.list-livros", livro: "detail:/livros/:id:null:livros.get-livro", "livro-novo": "form:/livro-novo:null:livros.create-livro", perfil: "param:/perfil/:usuario:null:null", pedidos: "list:/pedidos:pedidos:null", fase: "detail:/fases/:id:fases-2:null", "auth/login": "form:/auth/login:null:auth.sign-in", "auth/register": "list:/auth/register:clientes:null" }
    for (const [n, v] of Object.entries(want)) if (pages[n] !== v) fail("tela " + n + ": " + pages[n] + " (esperado " + v + ")")
    const useCase = (d) => l.useCases.find((u) => u.domain + "." + u.name === d) ?? fail("falta o use case " + d)
    const summary = (d) => [useCase(d).key, useCase(d).kind, String(useCase(d).endpoint)].join(" ")
    if (summary("stores.get-stores") !== "getStores read GET /stores/get-stores") fail("use case get-stores: " + summary("stores.get-stores"))
    if (summary("auth.sign-in") !== "signIn write POST /auth/sign-in") fail("use case sign-in: " + summary("auth.sign-in"))
    if (summary("cart.add-item") !== "addItem local null") fail("use case add-item: " + summary("cart.add-item"))
    const crud = { "list-livros": "listLivros read GET /livros", "get-livro": "getLivro read GET /livros/:id", "create-livro": "createLivro write POST /livros", "update-livro": "updateLivro write PATCH /livros/:id", "remove-livro": "removeLivro write DELETE /livros/:id" }
    for (const [n, v] of Object.entries(crud)) if (summary("livros." + n) !== v) fail("use case " + n + ": " + summary("livros." + n))
    if (l.languages.join(",") !== "en,pt-BR") fail("idiomas: " + l.languages)
  '
}

# O cliente roteirizado lê o .mcp.json do app, abre o servidor por ele e gera um domínio e três telas
# só por ferramentas MCP. O SDK vem do monorepo (devDependency da cli), por isso o script mora lá
stage_mcp() {
  node "$ROOT/packages/cli/scripts/drive-mcp.mjs" "$APP"
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
