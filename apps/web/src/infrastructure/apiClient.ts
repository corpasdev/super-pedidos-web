import { ApiClient } from "./ApiHttpClient"
import { environment } from "./environment"
import { getAuthToken } from "./authTokenStore"
import { isMockMode, mockRequest } from "./mockApi"

/** Cliente HTTP único de la web hacia la API (sección 4.1). */
export const apiClient = new ApiClient({
  baseUrl: environment.apiBaseUrl,
  tokenProvider: getAuthToken,
  ...(isMockMode ? { mock: mockRequest } : {}),
})