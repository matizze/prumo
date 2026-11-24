import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import {{page.pascal}}Page from '.'

it('mostra o título e, depois de carregar, a lista do domínio', async () => {
  renderWithProviders(<{{page.pascal}}Page />, { path: '{{route.path}}' })

  expect(screen.getByRole('heading', { name: '{{page.title}}' })).toBeDefined()
  expect(await screen.findByRole('list')).toBeDefined()
})
