---
'@matizze/prumo-testing': minor
---

O `createRenderWithProviders` e o `createRenderHookWithProviders` aceitam o container de use cases (`createUseCases`, a opção `useCases` por teste e o campo `useCases` no resultado), com o novo `createTestUseCases`, e o container de repositórios sai (veja o changeset `remove-repositories-testing`). O contexto do contrato ganha `subject`. O `defineContractSuite` e o `runContractSuite` ganham a documentação e o exemplo com use cases (o mesmo contrato contra o mock e contra a API real).
