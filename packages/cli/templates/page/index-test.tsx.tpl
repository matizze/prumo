import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import {{page.pascal}}Page from '.'

it('mostra o título da tela', () => {
  renderWithProviders(<{{page.pascal}}Page />, { path: '/{{page.kebab}}' })

  expect(screen.getByRole('heading', { name: '{{page.title}}' })).toBeDefined()
})
