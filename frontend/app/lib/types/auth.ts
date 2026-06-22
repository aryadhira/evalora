export interface AuthTokens {
  access_token: string
  expires_in: number
}

export interface LoginResponse extends AuthTokens {}

export interface TOTPLoginResponse {
  "2fa_required": boolean
  pending_token: string
}

export interface TOTPStatusResponse {
  totp_enabled: boolean
  backup_codes_remaining: number
}

export interface TOTPSetupResponse {
  secret: string
  otp_url: string
}

export interface TOTPEnableResponse {
  message: string
  backup_codes: string[]
}

export interface TOTPBackupResponse {
  backup_codes: string[]
}

export type ActionState = {
  error?: string
  errors?: Partial<Record<string, string>>
  data?: unknown
} | null
