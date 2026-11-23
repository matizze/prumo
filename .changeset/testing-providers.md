---
'@matizze/prumo-testing': minor
'@matizze/prumo-cli': minor
---

O `@matizze/prumo-testing` ganha `createRenderHookWithProviders`, que cria o `renderHookWithProviders` do app: o `renderHook` do Testing Library com os mesmos provedores, repositórios, `QueryClient` e rota em memória do `renderWithProviders`, para testar um hook de query ou de mutation sem montar um componente de mentira (devolve também `queryClient`, `repositories`, `history`, `navigate` e `currentPath`). O `createRenderWithProviders` (e o novo `createRenderHookWithProviders`) aceita um segundo parâmetro de tipo com as opções extras de cada teste, passadas na opção `providerProps` e repassadas aos `Providers` do app (a sessão de cada teste, por exemplo), tipadas pelo app. Sem o segundo parâmetro, nada muda para quem já usa. O `src/test/render.tsx` que o `prumo new` gera passa a exportar o `renderHookWithProviders` e traz, comentado, o passo a passo para acrescentar um provedor do app.
