import { fireEvent, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import {{page.pascal}}Page from '.'

it('envia o formulário contra o mock e mostra o aviso de sucesso', async () => {
  renderWithProviders(<{{page.pascal}}Page />, { path: '{{route.path}}' })

{{form.test}}  fireEvent.submit(screen.getByRole('form', { name: '{{page.title}}' }))

  expect(await screen.findByRole('status')).toBeDefined()
  expect(screen.queryByRole('alert')).toBeNull()
})
