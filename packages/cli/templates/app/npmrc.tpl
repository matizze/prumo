# Os pacotes @matizze/prumo-* vêm do GitHub Packages (privado, por enquanto).
# Para instalar, exporte um token clássico do GitHub com read:packages em NODE_AUTH_TOKEN.
# O token nunca é escrito aqui: o pnpm lê a variável. O valor depois de ":-" só existe para o
# pnpm não ignorar este arquivo inteiro quando a variável falta (ele avisa e descarta tudo);
# sem token de verdade, o GitHub Packages recusa o download (401) em vez de o pnpm cair no npmjs.
@matizze:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN:-sem-token}
