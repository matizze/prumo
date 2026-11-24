# Segurança

## Versões cobertas

O Prumo está em versão `0.x`. As correções de segurança saem na versão mais recente de cada pacote `@matizze/prumo-*` no npm; atualize para ela.

## Como relatar uma vulnerabilidade

**Não abra uma issue pública.** Use o relato privado do GitHub: na aba **Security** do repositório, clique em **Report a vulnerability**. Só o time do Prumo vê o relato.

Inclua, se puder:

- o pacote e a versão afetados;
- o que um atacante consegue fazer e em que condições;
- os passos para reproduzir, ou uma prova de conceito;
- uma sugestão de correção, se tiver.

Respondemos confirmando o recebimento, combinamos o prazo da correção conforme a gravidade e avisamos quando a versão corrigida for publicada. Pedimos que o problema não seja divulgado antes disso.

## O que o Prumo faz na sua máquina

Para avaliar o risco, vale saber o que cada peça executa:

- **`prumo new`** cria arquivos numa pasta nova e roda `git init` e `pnpm install` nela.
- **`prumo make:*`** cria e edita arquivos dentro da pasta do projeto (`--root`), e só depois de validar tudo.
- **`prumo check`** só lê arquivos, sem rede.

Os pacotes são publicados pelo workflow do repositório com o Trusted Publishing do npm, sem token guardado.
