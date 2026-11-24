# syntax=docker/dockerfile:1
# Site da documentação do Prumo (docs.prumo.matizze.com.br): o Docusaurus gera o HTML da pasta docs/,
# e o nginx o serve. A imagem é gerada pelo GitHub Actions (.github/workflows/docs.yml) e enviada para
# o ghcr.io/matizze/prumo-docs; a stack fica no Portainer (prumo-docs).
#
# Build, da raiz do repositório: docker build -f website/Dockerfile -t prumo-docs .
# O contexto é a raiz, e o website/Dockerfile.dockerignore deixa entrar só docs/ e website/.

FROM node:24-alpine AS build
WORKDIR /repo
RUN npm install --global pnpm@10.34.9
# As dependências primeiro, para o cache da camada sobreviver a uma mudança só de texto
COPY website/package.json website/pnpm-lock.yaml website/
RUN pnpm --dir website install --frozen-lockfile --ignore-workspace
COPY docs docs
COPY website website
RUN pnpm --dir website build

FROM nginx:1.28-alpine
LABEL org.opencontainers.image.source="https://github.com/matizze/prumo"
LABEL org.opencontainers.image.description="Prumo: site da documentação"
COPY website/docker/nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /repo/website/build /usr/share/nginx/html
EXPOSE 80
