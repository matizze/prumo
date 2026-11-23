import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { Route } from 'wouter'
import { renderWithProviders } from '@/test/render'
import {{page.pascal}}Page from '.'

// O parâmetro de rota só existe dentro da <Route>: a tela é renderizada na rota real, com o id de um
// registro do mock (veja os dados de exemplo em src/repositories). Se o parâmetro não chegar, o registro não carrega.
it('mostra o título e, depois de carregar, o registro da rota', async () => {
  renderWithProviders(
    <Route path="{{route.path}}">
      <{{page.pascal}}Page />
    </Route>,
    { path: '{{route.example}}' },
  )

  expect(screen.getByRole('heading', { name: '{{page.title}}' })).toBeDefined()
  expect(await screen.findByText('Exemplo 1')).toBeDefined()
})
