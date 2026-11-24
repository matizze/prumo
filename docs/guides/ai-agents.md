# Agentes de IA

O Prumo foi feito para ser usado tanto por pessoas quanto por agentes de IA. Todo app criado pelo `prumo new` já vem com um `AGENTS.md`, o guia do projeto para agentes: as camadas, as regras, os comandos e o que fazer antes de dar uma tarefa por pronta.

Com ele, o agente gera telas e domínios pelos mesmos comandos que uma pessoa usa, no terminal, e passa pela mesma verificação (`pnpm verify`).

## O `AGENTS.md`

O `AGENTS.md` gerado é curto de propósito: as camadas, as quatro regras de convivência (telas isoladas, view sem dados, dado pelo repositório, texto nos dois idiomas), a tabela de comandos e as regras do projeto. Ele é do seu time: acrescente as convenções do produto (o design system, a API, o que exige aprovação).

Vários agentes leem o `AGENTS.md` da raiz do projeto por conta própria. O Claude Code lê o `CLAUDE.md`: crie um com a linha abaixo para que ele importe o `AGENTS.md` (é o que o próprio repositório do Prumo faz):

```markdown
@AGENTS.md
```

Um pedido como este já basta:

> Crie um domínio de pedidos com os campos número, valor e status, e uma tela que lista os pedidos com o valor formatado em reais. Rode o `pnpm verify` no fim.

O agente lê o `AGENTS.md`, gera as camadas pelos comandos `prumo make:*`, ajusta o schema, as fixtures, o contrato, o model, a view e os textos, e confere com o `pnpm verify`.
