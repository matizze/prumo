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
- **`prumo check`** e **`prumo list`** só leem arquivos, sem rede.
- **`prumo mcp`** abre um servidor MCP por stdio, que só conversa com o programa que o abriu (o agente de IA): não abre porta de rede nem faz requisição. Cada ferramenta roda o comando de mesmo nome, em processo, e escreve no projeto pelas mesmas regras da CLI (valida tudo antes e nunca sobrescreve arquivo), e só nele: a pasta é a de onde o servidor abriu (ou a `--root`), e nenhuma ferramenta recebe outra. Os nomes e caminhos que as ferramentas aceitam são validados e ficam sob a raiz do projeto, e antes de gravar a CLI confere o caminho real de cada arquivo, com os links simbólicos resolvidos: se ele sai do projeto (o próprio `src`, uma pasta dentro dele ou um arquivo como o `App.tsx` sendo link para fora), ou passa por um link quebrado, o comando sai com 2, diz qual é o link e não escreve nada (o `--dry-run` confere o mesmo). Link dentro do projeto que aponta para dentro dele continua valendo. O que a conferência não vê: um link físico (hard link) de um arquivo do projeto para um de fora, que só existe se alguém o criou na máquina (o git não o carrega). Ele não cria app (o `new` não é ferramenta), não roda comandos do sistema nem instala dependências. Quem aprova o servidor é a pessoa, no cliente do agente, ao confiar no `.mcp.json` do projeto: um `.mcp.json` de origem desconhecida abre o programa que ele disser, então confie nele como confiaria num script do projeto.

Os pacotes são publicados pelo workflow do repositório com o Trusted Publishing do npm, sem token guardado.
