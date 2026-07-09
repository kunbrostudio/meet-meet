import type {
  MeetingHistoryItem,
  MeetingMeta,
} from '../types/meeting'
import type { Transcript } from '../types/transcript'
import { clearChatMessages } from './chatService'
import { clearTranslations } from './translationRecordService'
import { STORAGE_KEYS } from '../constants/storageKeys'

function readJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : null
  } catch (error) {
    console.error('[transcript-storage] Failed to read localStorage', {
      key,
      error,
    })
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error('[transcript-storage] Failed to write localStorage', {
      key,
      error,
    })
  }
}

export function saveMeetingTranscripts(
  meetingId: string,
  transcripts: Transcript[],
): void {
  writeJson(STORAGE_KEYS.meetingTranscripts(meetingId), transcripts)
}

export function loadMeetingTranscripts(meetingId: string): Transcript[] {
  const transcripts = readJson<Transcript[]>(
    STORAGE_KEYS.meetingTranscripts(meetingId),
  )
  return Array.isArray(transcripts)
    ? transcripts.map((transcript) => ({
        ...transcript,
        meetingId,
      }))
    : []
}

export function clearMeetingTranscripts(meetingId: string): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.meetingTranscripts(meetingId))
  } catch (error) {
    console.error('[transcript-storage] Failed to clear transcripts', {
      meetingId,
      error,
    })
  }
}

export function saveMeetingMeta(meeting: MeetingMeta): void {
  writeJson(STORAGE_KEYS.meetingMeta(meeting.meetingId), meeting)
}

export function loadMeetingMeta(meetingId: string): MeetingMeta | null {
  return readJson<MeetingMeta>(STORAGE_KEYS.meetingMeta(meetingId))
}

export function clearMeetingMeta(meetingId: string): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.meetingMeta(meetingId))
  } catch (error) {
    console.error('[transcript-storage] Failed to clear meeting meta', {
      meetingId,
      error,
    })
  }
}

export function saveMeetingHistoryItem(
  meetingMeta: MeetingHistoryItem,
): void {
  const history = loadMeetingHistory()
  const nextHistory = [
    meetingMeta,
    ...history.filter((item) => item.meetingId !== meetingMeta.meetingId),
  ].sort(
    (a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt),
  )

  writeJson(STORAGE_KEYS.meetingHistory, nextHistory)
}

export function loadMeetingHistory(): MeetingHistoryItem[] {
  const history = readJson<MeetingHistoryItem[]>(STORAGE_KEYS.meetingHistory)
  return Array.isArray(history) ? history : []
}

export function deleteMeetingHistoryItem(meetingId: string): void {
  const nextHistory = loadMeetingHistory().filter(
    (item) => item.meetingId !== meetingId,
  )
  writeJson(STORAGE_KEYS.meetingHistory, nextHistory)
}

export function clearAllMeetingHistory(): void {
  const history = loadMeetingHistory()

  history.forEach((item) => {
    clearMeetingTranscripts(item.meetingId)
    clearChatMessages(item.meetingId)
    clearTranslations(item.meetingId)
    clearMeetingMeta(item.meetingId)
    localStorage.removeItem(STORAGE_KEYS.meetingSession(item.meetingId))
  })

  writeJson(STORAGE_KEYS.meetingHistory, [])
}

export function saveActiveMeetingId(meetingId: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.activeMeeting, meetingId)
  } catch (error) {
    console.error('[transcript-storage] Failed to save active meeting', error)
  }
}

export function loadActiveMeetingId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.activeMeeting)
  } catch (error) {
    console.error('[transcript-storage] Failed to load active meeting', error)
    return null
  }
}

export function clearActiveMeetingId(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.activeMeeting)
  } catch (error) {
    console.error('[transcript-storage] Failed to clear active meeting', error)
  }
}
