import { AppError, reportAppError } from './appErrors'

export type FetchOptions = RequestInit & {
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
  source?: string
  /** Return non-2xx responses to callers that need to inspect an API error body. */
  allowHttpError?: boolean
}

const DEFAULT_TIMEOUT_MS = 12_000
const DEFAULT_RETRY_DELAY_MS = 250

function retryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

function abortReason(signal?: AbortSignal | null) {
  return signal?.reason instanceof Error ? signal.reason : new DOMException('Request aborted', 'AbortError')
}

function delay(ms: number, signal?: AbortSignal | null) {
  if (ms <= 0) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal))
      return
    }
    const timer = globalThis.setTimeout(resolve, ms)
    const abort = () => {
      globalThis.clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      reject(abortReason(signal))
    }
    signal?.addEventListener('abort', abort, { once: true })
  })
}

/**
 * Shared network boundary for Old.dex. GET/HEAD requests retry once by default;
 * mutating requests do not retry unless a caller explicitly opts in.
 */
export async function fetchWithTimeout(input: RequestInfo | URL, options: FetchOptions = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    source = String(input),
    allowHttpError = false,
    signal,
    ...request
  } = options
  const method = String(request.method || 'GET').toUpperCase()
  const retryCount = Math.max(0, Math.floor(retries ?? (method === 'GET' || method === 'HEAD' ? 1 : 0)))
  let lastError: unknown

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    if (signal?.aborted) throw reportAppError(abortReason(signal), 'HTTP_ABORTED', { source, attempt })

    const controller = new AbortController()
    let timedOut = false
    const timer = globalThis.setTimeout(() => {
      timedOut = true
      controller.abort(new DOMException('Request timed out', 'TimeoutError'))
    }, timeoutMs)
    const abort = () => controller.abort(abortReason(signal))
    signal?.addEventListener('abort', abort, { once: true })

    try {
      const response = await fetch(input, { ...request, signal: controller.signal })
      if (!response.ok && !allowHttpError) {
        const statusError = new AppError('HTTP_STATUS', `Request failed (${response.status})`, { source, status: response.status, attempt })
        if (attempt < retryCount && retryableStatus(response.status)) {
          lastError = statusError
        } else {
          throw statusError
        }
      } else {
        return response
      }
    } catch (error) {
      if (signal?.aborted) throw reportAppError(abortReason(signal), 'HTTP_ABORTED', { source, attempt })
      if (timedOut) {
        lastError = new AppError('HTTP_TIMEOUT', `Request timed out after ${timeoutMs} ms.`, { source, timeoutMs, attempt }, error)
      } else {
        lastError = error
      }
      const status = lastError instanceof AppError && lastError.code === 'HTTP_STATUS' ? Number(lastError.context.status) : 0
      const shouldRetry = attempt < retryCount && (!status || retryableStatus(status))
      if (!shouldRetry) break
    } finally {
      globalThis.clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }

    try {
      await delay(retryDelayMs * (attempt + 1), signal)
    } catch (error) {
      throw reportAppError(error, 'HTTP_ABORTED', { source, attempt })
    }
  }

  if (lastError instanceof AppError) throw reportAppError(lastError)
  throw reportAppError(lastError, 'HTTP_REQUEST_FAILED', { source })
}
