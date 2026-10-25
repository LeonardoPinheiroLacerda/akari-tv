export type ApiErrorCode = 'NETWORK_ERROR' | 'UNKNOWN_ERROR' | (string & {})

export interface ApiErrorInit {
  status: number
  code: ApiErrorCode
  message: string
  details?: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly details?: unknown

  constructor({ status, code, message, details }: ApiErrorInit) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}
