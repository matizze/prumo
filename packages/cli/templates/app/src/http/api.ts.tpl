import { createHttp } from '@matizze/prumo-core/http'
import { withErrors } from './errors'

/**
 * O cliente da API, usado pelos use cases (com VITE_DATA_SOURCE=http). O endereço vem da
 * VITE_API_URL (padrão: /api, o mesmo domínio do app; vazia vale como ausente). Os erros saem como
 * `UIError`, pelo `withErrors`.
 */
export const api = withErrors(
  createHttp({
    baseUrl: import.meta.env.VITE_API_URL || '/api',
    // O token da sessão: quando o app tiver login, descomente e ligue à sessão do app.
    // auth: {
    //   getToken: () => appSession.getAccessToken(),
    //   refresh: (usedToken) => appSession.refresh(usedToken),
    // },
  }),
)
