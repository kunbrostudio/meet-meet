import { STORAGE_KEYS } from '../constants/storageKeys'
import type {
  MeetingHistoryItem,
  MeetingMeta,
  MeetingSessionRecord,
} from '../types/meeting'
import type { ChatMessage } from '../types/chat'
import type { Transcript } from '../types/transcript'
import type { TranslationRecord } from '../types/translation'
import {
  canStoreMeetingSession,
  createRecordExpiresAt,
} from './localFirstStoragePolicyService'
import {
  loadMeetingMeta,
  saveMeetingHistoryItem,
  saveMeetingMeta,
  saveMeetingTranscripts,
} from './transcriptStorageService'
import {
  saveChatMessages,
} from './chatService'
import {
  dedupeTranslations,
  loadTranslations,
  saveTranslations,
} from './translationRecordService'

type MeetingSessionInput = Partial<MeetingSessionRecord> & {
  meetingId: string
}

function readJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : null
  } catch (error) {
    console.error('[meeting-session] Failed to read localStorage', {
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
    console.error('[meeting-session] Failed to write localStorage', {
      key,
      error,
    })
  }
}

function sortByCreatedAt<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  )
}

export function dedupeChatMessages(messages: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>()

  for (const message of messages) {
    map.set(message.id, message)
  }

  return sortByCreatedAt([...map.values()])
}

export function dedupeTranscripts(transcripts: Transcript[]): Transcript[] {
  const map = new Map<string, Transcript>()

  for (const transcript of transcripts) {
    map.set(transcript.transcriptId ?? String(transcript.id), transcript)
  }

  return sortByCreatedAt([...map.values()])
}

export function mergeTranslations(
  previous: TranslationRecord[] = [],
  next: TranslationRecord[] = [],
): TranslationRecord[] {
  return dedupeTranslations([...previous, ...next])
}

export function extractSystemMessages(
  messages: ChatMessage[],
): ChatMessage[] {
  return dedupeChatMessages(
    messages.filter((message) => message.type === 'system'),
  )
}

export function loadMeetingSession(
  meetingId: string,
): MeetingSessionRecord | null {
  const session = readJson<MeetingSessionRecord>(
    STORAGE_KEYS.meetingSession(meetingId),
  )

  if (!session || session.meetingId !== meetingId) {
    return null
  }

  return normalizeMeetingSession(session)
}

export function saveMeetingSession(
  input: MeetingSessionInput,
): MeetingSessionRecord {
  const previous = loadMeetingSession(input.meetingId)
  const now = new Date().toISOString()
  const chatMessages = dedupeChatMessages(
    input.chatMessages ?? previous?.chatMessages ?? [],
  )
  const transcripts = dedupeTranscripts(
    input.transcripts ?? previous?.transcripts ?? [],
  )
  const translations = mergeTranslations(
    previous?.translations ?? loadTranslations(input.meetingId),
    input.translations,
  )
  const systemMessages = dedupeChatMessages([
    ...(input.systemMessages ?? previous?.systemMessages ?? []),
    ...extractSystemMessages(chatMessages),
  ])

  const session: MeetingSessionRecord = normalizeMeetingSession({
    meetingId: input.meetingId,
    roomCode: input.roomCode ?? previous?.roomCode ?? 'MER-LOCAL',
    roomName: input.roomName ?? previous?.roomName ?? 'Say, Merang Meeting',
    title:
      input.title
      ?? input.roomName
      ?? previous?.title
      ?? previous?.roomName
      ?? 'Say, Merang Meeting',
    createdAt: input.createdAt ?? previous?.createdAt ?? now,
    startedAt: input.startedAt ?? previous?.startedAt ?? input.createdAt ?? now,
    endedAt: input.endedAt ?? previous?.endedAt,
    endedBy: input.endedBy ?? previous?.endedBy,
    participants: input.participants ?? previous?.participants ?? [],
    chatMessages,
    transcripts,
    translations,
    systemMessages,
    recordingEnabled: input.recordingEnabled ?? previous?.recordingEnabled ?? true,
    expiresAt:
      input.expiresAt
      ?? previous?.expiresAt
      ?? (
        input.endedAt
          ? createRecordExpiresAt(input.endedAt)
          : undefined
      ),
    summaryStatus: input.summaryStatus ?? previous?.summaryStatus,
  })

  if (!canStoreMeetingSession(session)) {
    console.warn('[meeting-session] Meeting record is too large to save.')
    return session
  }

  writeJson(STORAGE_KEYS.meetingSession(input.meetingId), session)
  saveMeetingTranscripts(input.meetingId, session.transcripts)
  saveChatMessages(input.meetingId, session.chatMessages)
  saveTranslations(input.meetingId, session.translations)

  return session
}

export function updateMeetingSession(
  meetingId: string,
  updates: Omit<MeetingSessionInput, 'meetingId'>,
): MeetingSessionRecord {
  return saveMeetingSession({
    meetingId,
    ...updates,
  })
}

export function clearMeetingSession(meetingId: string): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.meetingSession(meetingId))
  } catch (error) {
    console.error('[meeting-session] Failed to clear meeting session', {
      meetingId,
      error,
    })
  }
}

export function saveEndedMeetingSessionToHistory(
  session: MeetingSessionRecord,
  meta?: MeetingMeta | null,
): void {
  const loadedMeta = meta ?? loadMeetingMeta(session.meetingId)
  const participantCount =
    session.participants.length
    || loadedMeta?.participantCount
    || 1
  const endedAt = session.endedAt ?? new Date().toISOString()
  const expiresAt = session.expiresAt ?? createRecordExpiresAt(endedAt)
  const usedLanguages = [...new Set(
    session.transcripts.flatMap((transcript) => [
      transcript.sourceLanguage,
      transcript.targetLanguage,
    ]),
  )]

  saveMeetingMeta({
    meetingId: session.meetingId,
    roomCode: session.roomCode,
    roomName: session.roomName,
    meetingRole: loadedMeta?.meetingRole,
    participantCount,
    createdAt: session.createdAt,
    updatedAt: endedAt,
    preferences: loadedMeta?.preferences ?? {
      displayName: session.participants[0]?.name ?? '',
      sourceLanguage: session.participants[0]?.language ?? 'ko',
      targetLanguage: session.transcripts[0]?.targetLanguage ?? 'en',
      participantCount,
      autoStartCaption: true,
    },
  })

  const historyItem: MeetingHistoryItem = {
    meetingId: session.meetingId,
    roomCode: session.roomCode,
    title: session.title,
    createdAt: session.createdAt,
    endedAt,
    expiresAt,
    participantCount,
    transcriptCount: session.transcripts.length,
    usedLanguages,
  }

  if (session.recordingEnabled !== false) {
    saveMeetingHistoryItem(historyItem)
  }
}

function normalizeMeetingSession(
  session: MeetingSessionRecord,
): MeetingSessionRecord {
  const chatMessages = dedupeChatMessages(session.chatMessages ?? [])
  const transcripts = dedupeTranscripts(session.transcripts ?? [])
  const translations = mergeTranslations(
    session.translations ?? [],
    loadTranslations(session.meetingId),
  )

  return {
    ...session,
    participants: session.participants ?? [],
    chatMessages,
    transcripts,
    translations,
    systemMessages: dedupeChatMessages([
      ...(session.systemMessages ?? []),
      ...extractSystemMessages(chatMessages),
    ]),
    recordingEnabled: session.recordingEnabled ?? true,
  }
}
