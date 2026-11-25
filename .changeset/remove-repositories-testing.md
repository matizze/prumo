---
'@matizze/prumo-testing': minor
---

O `renderWithProviders` e o `renderHookWithProviders` deixam o container de repositórios: saem o `createRepositories`, a opção `repositories` e o campo `repositories` do resultado, e o `createTestRepositories`. O parâmetro de tipo dos use cases vem primeiro (`createRenderWithProviders<UseCases, ProviderProps>`), e o `createUseCases` passa a ser obrigatório quando o `UseCases` é declarado (só o `NoContainer` o dispensa). No teste de contrato sai o `repo` (o `@deprecated`): use o `subject`. Para migrar, veja o guia [Migrar para use cases](https://docs.prumo.matizze.com.br/guides/migrate-to-use-cases).
