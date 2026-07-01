const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined

export const API_BASE_URL = rawApiBaseUrl?.replace(/\/$/, '') ?? ''

console.debug('[api] API_BASE_URL', API_BASE_URL || '(relative /api)')

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}
