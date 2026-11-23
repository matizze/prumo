import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { i18n } from '@/i18n'

// O jsdom diz en-US: fixa o idioma padrão do app para os testes não dependerem do navegador.
await i18n.changeLanguage('pt-BR')

afterEach(cleanup)
