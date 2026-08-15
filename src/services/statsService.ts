import { apiUrl } from './apiClient'

type StatsResponse = {
  totalPlayers?: unknown
}

let statsRequestPromise: Promise<number> | null = null

export async function fetchTotalPlayers(): Promise<number> {
  statsRequestPromise ??= fetch(apiUrl('/api/stats'), {
    method: 'GET',
    credentials: 'include',
  })
    .then(async (response) => {
      const details = await response.json().catch(() => ({} as StatsResponse)) as StatsResponse

      if (!response.ok || typeof details.totalPlayers !== 'number') {
        throw new Error('Failed to load lobby stats.')
      }

      return details.totalPlayers
    })
    .catch((error) => {
      statsRequestPromise = null
      throw error
    })

  return statsRequestPromise
}
