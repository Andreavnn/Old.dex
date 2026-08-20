export type AppErrorContext = Record<string, string | number | boolean | undefined>

export class AppError extends Error {
  readonly code: string
  readonly context: AppErrorContext
  readonly cause?: unknown

  constructor(code: string, message: string, context: AppErrorContext = {}, cause?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.context = context
    this.cause = cause
  }
}

export type AppDiagnostic = {
  at: string
  code: string
  message: string
  context: AppErrorContext
}

const diagnostics: AppDiagnostic[] = []
const MAX_DIAGNOSTICS = 100

export function reportAppError(error: unknown, code = 'UNKNOWN', context: AppErrorContext = {}) {
  const appError = error instanceof AppError
    ? error
    : new AppError(code, error instanceof Error ? error.message : String(error || 'Unknown error'), context, error)
  diagnostics.unshift({ at: new Date().toISOString(), code: appError.code, message: appError.message, context: { ...appError.context, ...context } })
  diagnostics.splice(MAX_DIAGNOSTICS)
  return appError
}

export function recentDiagnostics() {
  return diagnostics.map((row) => ({ ...row, context: { ...row.context } }))
}
