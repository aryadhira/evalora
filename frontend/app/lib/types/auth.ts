export interface AuthTokens {
  access_token: string
  expires_in: number
}

export interface LoginResponse extends AuthTokens {}

export interface TOTPLoginResponse {
  "2fa_required": boolean
  pending_token: string
}

export type ActionState = {
  error?: string
  errors?: Partial<Record<string, string>>
  data?: unknown
} | null
