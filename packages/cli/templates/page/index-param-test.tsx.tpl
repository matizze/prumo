import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { Route } from 'wouter'
import { renderWithProviders } from '@/test/render'
import {{page.pascal}}Page from '.'

// O parâmetro de rota só existe dentro da <Route>: a tela é renderizada na rota real, com um valor de exemplo.
it('mostra o título e o parâmetro da rota', () => {
  renderWithProviders(
    <Route path="{{route.path}}">
      <{{page.pascal}}Page />
    </Route>,
    { path: '{{route.example}}' },
  )

  expect(screen.getByRole('heading', { name: '{{page.title}}' })).toBeDefined()
  expect(screen.getByText('{{param.example}}')).toBeDefined()
})
