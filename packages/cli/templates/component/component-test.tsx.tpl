import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { {{component.pascal}} } from './{{component.kebab}}'

it('mostra o título', () => {
  render(<{{component.pascal}} title="Exemplo" />)

  expect(screen.getByRole('heading', { name: 'Exemplo' })).toBeDefined()
})
