import { createUseCasesContext } from '@matizze/prumo-core/use-cases'
import { createAppUseCases, type UseCases } from '@/use-cases'

export const { UseCasesProvider, useUseCases } = createUseCasesContext<UseCases>(createAppUseCases)
