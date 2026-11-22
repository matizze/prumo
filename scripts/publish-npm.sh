#!/usr/bin/env bash
# Publica no npm público as versões dos pacotes do Prumo que ainda não estão lá.
#
# Roda no workflow de publicação (.github/workflows/release.yml), a cada push na `main`. Primeiro
# pergunta ao npm, sem instalar nada, quais versões faltam: se nenhuma falta (o caso comum), termina
# em segundos. Se falta alguma, instala as dependências, compila e empacota os cinco pacotes
# (scripts/pack-packages.sh, que troca o `workspace:*` pela versão) e publica só os tarballs que
# faltam, com o `npm publish`.
#
# No GitHub Actions, o npm se autentica pelo Trusted Publishing (OIDC): nenhum token fica guardado no
# repositório. Cada pacote precisa ter, no npmjs, o Trusted Publisher apontando para matizze/prumo e
# para o arquivo release.yml.
#
# Uso: scripts/publish-npm.sh [--dry-run]
#   --dry-run  faz tudo, menos publicar (o `npm publish --dry-run` só mostra o que sairia).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGISTRY="https://registry.npmjs.org"
# A versão mínima do npm com Trusted Publishing; abaixo dela, o script instala esta versão fixa
NPM_MIN="11.5.1"
NPM_PINNED="11.11.0"
# A mesma ordem do pack-packages.sh: o cli depende do rules, e o mcp depende do cli
PACKAGES=(rules core testing cli mcp)

DRY_RUN=""
case "${1:-}" in
  "") ;;
  --dry-run) DRY_RUN="--dry-run" ;;
  *)
    echo "uso: scripts/publish-npm.sh [--dry-run]" >&2
    exit 2
    ;;
esac

field() {
  node -p "require('$ROOT/packages/$1/package.json').$2"
}

# 1. Quais versões faltam no npm (consulta anônima, sem instalar nada)
pending=()
for name in "${PACKAGES[@]}"; do
  pkg="$(field "$name" name)"
  version="$(field "$name" version)"
  code="$(curl -s -o /dev/null -w '%{http_code}' "$REGISTRY/$pkg/$version")"
  case "$code" in
    200) echo "$pkg@$version: já está no npm" ;;
    404)
      echo "$pkg@$version: a publicar"
      pending+=("$name")
      ;;
    *)
      echo "erro: o npm respondeu HTTP $code para $pkg@$version" >&2
      exit 1
      ;;
  esac
done

if [ "${#pending[@]}" -eq 0 ]; then
  echo "Nada a publicar."
  exit 0
fi

# 2. Instala, compila e empacota os cinco (o pack-packages.sh compila cada um antes do pack)
cd "$ROOT"
pnpm install --frozen-lockfile
PACKS="$(mktemp -d)"
trap 'rm -rf "$PACKS"' EXIT
scripts/pack-packages.sh "$PACKS" >/dev/null

# 3. Garante um npm com Trusted Publishing
current="$(npm --version)"
if [ "$(printf '%s\n%s\n' "$NPM_MIN" "$current" | sort -V | head -1)" != "$NPM_MIN" ]; then
  echo "npm $current é anterior a $NPM_MIN; instalando o npm $NPM_PINNED"
  npm install -g "npm@$NPM_PINNED"
fi

# 4. Publica só o que falta, na ordem das dependências
for name in "${pending[@]}"; do
  pkg="$(field "$name" name)"
  version="$(field "$name" version)"
  tarball="$PACKS/matizze-prumo-$name-$version.tgz"
  if [ ! -f "$tarball" ]; then
    echo "erro: o tarball $tarball não foi gerado" >&2
    exit 1
  fi
  echo "==> publicando $pkg@$version"
  set +e
  output="$(npm publish "$tarball" --access public --registry "$REGISTRY" $DRY_RUN 2>&1)"
  status=$?
  set -e
  echo "$output"
  if [ "$status" -ne 0 ]; then
    # Logo depois de uma publicação, o CDN do npm pode ainda dizer 404 para a versão nova: se o npm
    # recusa por ela já existir, não é falha
    if echo "$output" | grep -q "cannot publish over the previously published versions"; then
      echo "$pkg@$version já estava publicado; seguindo"
    else
      exit "$status"
    fi
  fi
done
