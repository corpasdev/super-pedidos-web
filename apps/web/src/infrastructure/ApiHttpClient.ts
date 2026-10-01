/** Cuerpo de error que devuelve la API (ver interface/http/middlewares.ts → errorHandler). */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    issues?: unknown
  }
}

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string | null,
    message: string,
    readonly issues?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export interface ApiClientOptions {
  baseUrl: string
  /** Devuelve el access_token de Supabase (jwt) o null si no hay sesión. */
  tokenProvider: () => string | null
  /** Modo de prueba: si devuelve algo distinto de undefined, esa es la respuesta y no se llama a la API. */
  mock?: (method: string, path: string, body?: unknown) => Promise<unknown>
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async get<T>(path: string): Promise<T> {
    return this.request("GET", path)
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request("POST", path, body)
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request("PATCH", path, body)
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request("PUT", path, body)
  }

  async delete<T>(path: string): Promise<T> {
    return this.request("DELETE", path)
  }

  async postFile<T>(path: string, file: Blob, fileName: string): Promise<T> {
    const formData = new FormData()
    formData.append("file", file, fileName)
    return this.request("POST", path, formData)
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (this.options.mock) {
      const mocked = await this.options.mock(method, path, body instanceof FormData ? undefined : body)
      if (mocked !== undefined) return mocked as T
    }
    const token = this.options.tokenProvider()
    const headers: Record<string, string> = {}
    if (token !== null) headers["Authorization"] = `Bearer ${token}`
    if (body !== undefined && !(body instanceof FormData)) headers["Content-Type"] = "application/json"

    const response = await fetch(`${this.options.baseUrl}${path}`, {
      method,
      headers,
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    })

    const isJson = response.headers.get("content-type")?.includes("application/json") ?? false
    const payload = isJson ? await (response.json() as Promise<unknown>) : await response.text()

    if (!response.ok) {
      const errorBody = payload as ApiErrorBody | undefined
      throw new ApiError(
        response.status,
        errorBody?.error?.code ?? null,
        errorBody?.error?.message ?? `La petición falló (${response.status}).`,
        errorBody?.error?.issues,
      )
    }
    return payload as T
  }
}