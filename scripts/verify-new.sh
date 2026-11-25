#!/usr/bin/env bash
# O portão local do app novo (`pnpm verify:new`), sem navegador e sem GitHub.
#
# Prova de ponta a ponta o que o Prumo entrega: empacota os pacotes, cria um app com `prumo new`
# numa pasta temporária fora do monorepo (com os tarballs) e roda o `pnpm verify` do app (typecheck,
# lint, `prumo check` e testes). A cada comando novo da CLI (`make:schema`, `make:usecase` e
# `make:page`), a etapa `cli` ganha as chamadas dele, e o `verify` do app passa a cobrir o que foi gerado.
#
# Depois da CLI, a etapa mcp liga ao servidor do app pelo `.mcp.json` que o `new` criou (o cliente do
# SDK, por stdio) e gera só por ferramentas um domínio (os use cases do CRUD), dois use cases e as telas; o verify do app cobre
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

# Os comandos de geração do app, na ordem das camadas: make:schema, make:usecase (um a um e com --crud)
# e make:page. O `new` já gera a tela inicial (home), que o `check` e os testes do verify do app cobrem.
stage_cli() {
  # make:schema com o campo padrão, com campos de todos os tipos e com --entity
  prumo make:schema clientes
  prumo make:schema livros --fields "titulo:string,autor:string,ano:number,paginas:int,situacao:enum(lido|lendo|desejado),disponivel:boolean,publicadoEm:date,lidoEm?:datetime,apelido?:string"
  prumo make:schema paes --entity pao
  prumo make:schema pedidos
  # um domínio com dígito na entidade (fase-2): o arquivo do schema e o id do teste vêm dos arquivos
  prumo make:schema fases-2 --entity fase-2
  # make:usecase --crud: os cinco use cases de cada entidade, com a coleção de mock que eles dividem,
  # lendo os campos de cada schema (o livros tem todos os tipos); os testes deles rodam no verify do app
  prumo make:usecase clientes --crud
  prumo make:usecase livros --crud
  prumo make:usecase paes --crud --entity pao
  prumo make:usecase pedidos --crud
  prumo make:usecase fases-2 --crud --entity fase-2
  # make:usecase um a um: uma leitura (com a entidade de um schema como Response), uma escrita (com Request e
  # Response em campos) e um local (sem API, no localStorage)
  prumo make:schema stores --fields "name:string,city:string"
  prumo make:usecase stores.get-stores --output "store[]"
  prumo make:usecase auth.sign-in --input "email:string,password:string" --output "token:string"
  prumo make:usecase cart.add-item --local --input "productId:string,quantity:int"
  # make:page: título, parâmetro e as telas de use case (lista, detalhe e formulário). O campo de texto
  # sai do schema: o livros mostra o titulo, e o pedidos (o campo padrão) o name
  prumo make:page sobre
  prumo make:page perfil --path /perfil/:usuario
  prumo make:page clientes --usecase clientes.list-clientes
  prumo make:page cliente --usecase clientes.get-cliente --path /clientes/:id
  prumo make:page livros --usecase livros.list-livros
  prumo make:page livro --usecase livros.get-livro --path /livros/:id
  prumo make:page livro-novo --usecase livros.create-livro
  prumo make:page pedidos --usecase pedidos.list-pedidos
  prumo make:page fase --usecase fases-2.get-fase-2 --path /fases/:id
  # telas em subpastas (com ponto e com barra): a pasta, a rota e as mensagens levam o caminho
  prumo make:page auth.login --usecase auth.sign-in
  prumo make:page auth/register --usecase clientes.list-clientes
  # O prumo list só lê; o JSON tem os schemas, os use cases e as telas que os comandos acima criaram
  prumo list
  prumo list --json | node -e '
    const l = JSON.parse(require("node:fs").readFileSync(0, "utf8"))
    const fail = (m) => { console.error("prumo list --json: " + m); process.exit(1) }
    if ("repositories" in l || "queries" in l) fail("o list ainda traz repositórios ou queries")
    for (const d of ["clientes", "livros", "paes", "pedidos", "fases-2"]) {
      if (!l.schemas.some((s) => s.file.endsWith("/" + (d === "paes" ? "pao" : d === "fases-2" ? "fase-2" : d.slice(0, -1)) + ".ts") && s.fields)) fail("falta o schema " + d)
    }
    const pages = Object.fromEntries(l.pages.map((p) => [p.name, p.variation + ":" + p.route + ":" + p.useCase]))
    const want = { home: "title:/:null", sobre: "title:/sobre:null", clientes: "list:/clientes:clientes.list-clientes", cliente: "detail:/clientes/:id:clientes.get-cliente", livros: "list:/livros:livros.list-livros", livro: "detail:/livros/:id:livros.get-livro", "livro-novo": "form:/livro-novo:livros.create-livro", perfil: "param:/perfil/:usuario:null", pedidos: "list:/pedidos:pedidos.list-pedidos", fase: "detail:/fases/:id:fases-2.get-fase-2", "auth/login": "form:/auth/login:auth.sign-in", "auth/register": "list:/auth/register:clientes.list-clientes" }
    for (const [n, v] of Object.entries(want)) if (pages[n] !== v) fail("tela " + n + ": " + pages[n] + " (esperado " + v + ")")
    const useCase = (d) => l.useCases.find((u) => u.domain + "." + u.name === d) ?? fail("falta o use case " + d)
    const summary = (d) => [useCase(d).key, useCase(d).kind, String(useCase(d).endpoint)].join(" ")
    if (summary("stores.get-stores") !== "getStores read GET /stores/get-stores") fail("use case get-stores: " + summary("stores.get-stores"))
    if (summary("auth.sign-in") !== "signIn write POST /auth/sign-in") fail("use case sign-in: " + summary("auth.sign-in"))
    if (summary("cart.add-item") !== "addItem local null") fail("use case add-item: " + summary("cart.add-item"))
    const crud = { "list-livros": "listLivros read GET /livros", "get-livro": "getLivro read GET /livros/:id", "create-livro": "createLivro write POST /livros", "update-livro": "updateLivro write PATCH /livros/:id", "remove-livro": "removeLivro write DELETE /livros/:id" }
    for (const [n, v] of Object.entries(crud)) if (summary("livros." + n) !== v) fail("use case " + n + ": " + summary("livros." + n))
    const pao = (d) => l.useCases.some((u) => u.domain === "paes" && u.name === d) || fail("falta o use case paes." + d)
    for (const n of ["list-paes", "get-pao", "create-pao", "update-pao", "remove-pao"]) pao(n)
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
