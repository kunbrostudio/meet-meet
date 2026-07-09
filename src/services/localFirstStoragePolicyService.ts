import { STORAGE_KEYS } from '../constants/storageKeys'
import type { MeetingHistoryItem, MeetingSessionRecord } from '../types/meeting'

export const MEETING_RECORD_TTL_DAYS = 3
export const MAX_MEETING_RECORD_BYTES = 20 * 1024 * 1024
export const MAX_TOTAL_RECORD_BYTES = 50 * 1024 * 1024
export const MAX_MEETING_RECORD_COUNT = 10

const DAY_MS = 24 * 60 * 60 * 1000

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

function writeHistory(history: MeetingHistoryItem[]): void {
  localStorage.setItem(STORAGE_KEYS.meetingHistory, JSON.stringify(history))
}

function getUtf8Size(value: unknown): number {
  return new Blob([JSON.stringify(value)]).size
}

export function createRecordExpiresAt(endedAt: string): string {
  return new Date(Date.parse(endedAt) + MEETING_RECORD_TTL_DAYS * DAY_MS)
    .toISOString()
}

export function getRecordSizeBytes(record: unknown): number {
  return getUtf8Size(record)
}

export function isMeetingSessionExpired(
  session: Pick<MeetingSessionRecord, 'expiresAt'> | null | undefined,
): boolean {
  return Boolean(session?.expiresAt && Date.parse(session.expiresAt) <= Date.now())
}

export function getExpiryLabel(expiresAt?: string): string {
  if (!expiresAt) {
    return '만료일 미정'
  }

  const remainingMs = Date.parse(expiresAt) - Date.now()
  if (remainingMs <= 0) {
    return '만료됨'
  }

  const remainingDays = Math.max(1, Math.ceil(remainingMs / DAY_MS))
  return `${remainingDays}일 후 만료`
}

export function canStoreMeetingSession(session: MeetingSessionRecord): boolean {
  return getRecordSizeBytes(session) <= MAX_MEETING_RECORD_BYTES
}

export function cleanupExpiredAndOversizedRecords(): void {
  const history = readJson<MeetingHistoryItem[]>(
    STORAGE_KEYS.meetingHistory,
    [],
  )
  const sessions = history
    .map((item) => ({
      item,
      session: readJson<MeetingSessionRecord | null>(
        STORAGE_KEYS.meetingSession(item.meetingId),
        null,
      ),
    }))
    .filter(({ session }) => session !== null)

  const validSessions = sessions.filter(({ session }) => (
    !isMeetingSessionExpired(session)
  ))

  const expiredMeetingIds = new Set(
    sessions
      .filter(({ session }) => isMeetingSessionExpired(session))
      .map(({ item }) => item.meetingId),
  )

  for (const meetingId of expiredMeetingIds) {
    localStorage.removeItem(STORAGE_KEYS.meetingSession(meetingId))
    localStorage.removeItem(STORAGE_KEYS.meetingTranscripts(meetingId))
    localStorage.removeItem(STORAGE_KEYS.meetingChat(meetingId))
    localStorage.removeItem(STORAGE_KEYS.meetingTranslations(meetingId))
    localStorage.removeItem(STORAGE_KEYS.meetingMeta(meetingId))
  }

  let nextSessions = validSessions
    .sort((a, b) => (
      Date.parse(b.item.endedAt) - Date.parse(a.item.endedAt)
    ))

  if (nextSessions.length > MAX_MEETING_RECORD_COUNT) {
    const removed = nextSessions.slice(MAX_MEETING_RECORD_COUNT)
    nextSessions = nextSessions.slice(0, MAX_MEETING_RECORD_COUNT)
    for (const { item } of removed) {
      localStorage.removeItem(STORAGE_KEYS.meetingSession(item.meetingId))
      localStorage.removeItem(STORAGE_KEYS.meetingTranscripts(item.meetingId))
      localStorage.removeItem(STORAGE_KEYS.meetingChat(item.meetingId))
      localStorage.removeItem(STORAGE_KEYS.meetingTranslations(item.meetingId))
      localStorage.removeItem(STORAGE_KEYS.meetingMeta(item.meetingId))
    }
  }

  let totalBytes = nextSessions.reduce((sum, { session }) => (
    sum + getRecordSizeBytes(session)
  ), 0)

  while (totalBytes > MAX_TOTAL_RECORD_BYTES && nextSessions.length > 0) {
    const removed = nextSessions.pop()
    if (!removed) {
      break
    }
    localStorage.removeItem(STORAGE_KEYS.meetingSession(removed.item.meetingId))
    localStorage.removeItem(STORAGE_KEYS.meetingTranscripts(removed.item.meetingId))
    localStorage.removeItem(STORAGE_KEYS.meetingChat(removed.item.meetingId))
    localStorage.removeItem(STORAGE_KEYS.meetingTranslations(removed.item.meetingId))
    localStorage.removeItem(STORAGE_KEYS.meetingMeta(removed.item.meetingId))
    totalBytes = nextSessions.reduce((sum, { session }) => (
      sum + getRecordSizeBytes(session)
    ), 0)
  }

  writeHistory(nextSessions.map(({ item }) => item))
}
