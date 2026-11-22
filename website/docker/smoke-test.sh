#!/usr/bin/env bash
# Confere a imagem do site antes de publicar: o healthcheck, a página inicial, páginas internas, um
# arquivo de assets e o 404. Uso: website/docker/smoke-test.sh <imagem>
set -euo pipefail

image="$1"
name="prumo-docs-smoke-$$"
port="${SMOKE_PORT:-18081}"
base="http://127.0.0.1:$port"

cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$name" -p "127.0.0.1:$port:80" "$image" >/dev/null
for _ in $(seq 1 30); do
  curl -fsS "$base/healthz" >/dev/null 2>&1 && break
  sleep 1
done

expect() {
  local want="$1" path="$2" got
  got="$(curl -s -o /dev/null -w '%{http_code}' "$base$path")"
  if [ "$got" != "$want" ]; then
    echo "esperava $want e veio $got: $path" >&2
    docker logs "$name" >&2
    exit 1
  fi
  echo "ok: $want $path"
}

expect 200 /healthz
expect 200 /
expect 200 /getting-started
expect 200 /concepts/architecture
expect 200 /guides/test
expect 200 /reference/cli
expect 200 /sitemap.xml
expect 404 /nao-existe

# O conteúdo é o da documentação, e um asset do bundle responde
curl -fsS "$base/" | grep -q 'Documentação do Prumo' || { echo "a página inicial não tem o título" >&2; exit 1; }
asset="$(curl -fsS "$base/" | grep -o '/assets/js/[^"]*\.js' | head -1)"
expect 200 "$asset"
echo "imagem ok"
