import type { ChatMessage } from '../types/chat'
import type {
  GameAttackContent,
  GameAttackContentSubmitRequest,
  GameAttackStartRequest,
  GameFairPlayCheckStatus,
  GameFairPlayEventRequest,
  GamePlayerState,
  GameReadyChange,
  GameRoundResult,
  GameStateRequest,
  GameStateSnapshot,
} from '../types/game'
import type {
  LanguageCode,
  SpeechRecognitionLanguage,
  SupportedLanguage,
  Transcript,
} from '../types/transcript'
import type { TranslationRecord } from '../types/translation'

export const LIVEKIT_CHAT_TOPIC = 'meet-meet-chat'
export const LIVEKIT_TRANSCRIPT_TOPIC = 'meet-meet-transcript'
export const LIVEKIT_TRANSLATION_TOPIC = 'meet-meet-translation'
export const LIVEKIT_MEETING_CONTROL_TOPIC = 'meet-meet-room-control'
export const LIVEKIT_GAME_STATE_TOPIC = 'meet-meet-game-state'

export type LiveKitChatSenderRole = 'host' | 'guest' | 'system'

export type LiveKitChatMessagePayload = {
  type: 'chat-message' | 'system-message'
  messageId: string
  roomCode: string
  meetingId: string
  senderId: string
  senderName: string
  senderRole: LiveKitChatSenderRole
  text: string
  language: string
  createdAt: string
}

export type LiveKitTranscriptPayload = {
  type: 'transcript'
  transcriptId: string
  roomCode: string
  meetingId: string
  speakerId: string
  speakerName: string
  speakerRole: 'host' | 'guest'
  text: string
  language: SpeechRecognitionLanguage
  isFinal: boolean
  createdAt: string
}

export type LiveKitMeetingEndedPayload = {
  meetingId: string
  roomName: string
  endedByParticipantIdentity: string
  endedByName: string
  endedAt: string
}

export type LiveKitParticipantKickedPayload = {
  meetingId: string
  roomName: string
  targetParticipantIdentity: string
  removedByParticipantIdentity: string
  removedByName: string
  reason: 'removed_by_host' | 'eliminated'
  timestamp: string
}

export type LiveKitHostChangedPayload = {
  meetingId: string
  roomName: string
  previousHostParticipantIdentity: string
  newHostParticipantIdentity: string
  newHostName: string
  newHostControlToken?: string
  changedAt: string
  reason: 'host_eliminated' | 'host_left'
}

export type LiveKitDataMessage =
  | {
      type: 'chat-message'
      payload: LiveKitChatMessagePayload
    }
  | {
      type: 'system-message'
      payload: LiveKitChatMessagePayload
    }
  | {
      type: 'transcript-created'
      payload: LiveKitTranscriptPayload
    }
  | {
      type: 'translation'
      payload: TranslationRecord
    }
  | {
      type: 'meeting-ended'
      payload: LiveKitMeetingEndedPayload
    }
  | {
      type: 'participant-kicked'
      payload: LiveKitParticipantKickedPayload
    }
  | {
      type: 'host-changed'
      payload: LiveKitHostChangedPayload
    }
  | {
      type: 'game-state-snapshot'
      payload: GameStateSnapshot
    }
  | {
      type: 'game-state-request'
      payload: GameStateRequest
    }
  | {
      type: 'game-ready-change'
      payload: GameReadyChange
    }
  | {
      type: 'attack-start-request'
      payload: GameAttackStartRequest
    }
  | {
      type: 'attack-content-submit-request'
      payload: GameAttackContentSubmitRequest
    }
  | {
      type: 'fair-play-event-request'
      payload: GameFairPlayEventRequest
    }
  | {
      type: 'fair-play-check-status'
      payload: GameFairPlayCheckStatus
    }

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function encodeLiveKitDataMessage(
  message: LiveKitDataMessage,
): Uint8Array {
  return encoder.encode(JSON.stringify(message))
}

export function chatMessageToLiveKitPayload(
  message: ChatMessage,
  options: {
    roomCode: string
    senderIdentity?: string
    senderRole?: LiveKitChatSenderRole
    language?: string
  },
): LiveKitChatMessagePayload {
  return {
    type: message.type === 'system' ? 'system-message' : 'chat-message',
    messageId: message.id,
    roomCode: options.roomCode,
    meetingId: message.meetingId,
    senderId:
      options.senderIdentity
      ?? message.senderIdentity
      ?? String(message.senderId ?? 'system'),
    senderName: message.senderName,
    senderRole:
      message.type === 'system'
        ? 'system'
        : options.senderRole ?? message.senderRole ?? 'guest',
    text: message.message,
    language: options.language ?? message.language ?? 'ko',
    createdAt: message.createdAt,
  }
}

export function liveKitPayloadToChatMessage(
  payload: LiveKitChatMessagePayload,
  fallbackSenderId: number | null = null,
): ChatMessage {
  return {
    id: payload.messageId,
    meetingId: payload.meetingId,
    senderId: fallbackSenderId,
    senderName: payload.senderName,
    senderIdentity: payload.senderId,
    senderRole: payload.senderRole,
    roomCode: payload.roomCode,
    language: payload.language,
    message: payload.text,
    createdAt: payload.createdAt,
    type: payload.type === 'system-message' ? 'system' : 'user',
  }
}

export function transcriptToLiveKitPayload(
  transcript: Transcript,
  options: {
    roomCode: string
    speakerIdentity?: string
    speakerRole?: 'host' | 'guest'
    language?: SpeechRecognitionLanguage
  },
): LiveKitTranscriptPayload {
  return {
    type: 'transcript',
    transcriptId: transcript.transcriptId ?? String(transcript.id),
    roomCode: options.roomCode,
    meetingId: transcript.meetingId,
    speakerId:
      options.speakerIdentity
      ?? transcript.speakerIdentity
      ?? String(transcript.speakerId ?? transcript.participantId),
    speakerName: transcript.speakerName,
    speakerRole: options.speakerRole ?? transcript.speakerRole ?? 'guest',
    text: transcript.sourceText,
    language:
      options.language
      ?? transcript.recognitionLanguage
      ?? toRecognitionLanguage(transcript.sourceLanguage),
    isFinal: transcript.isFinal ?? true,
    createdAt: transcript.createdAt,
  }
}

export function liveKitPayloadToTranscript(
  payload: LiveKitTranscriptPayload,
  options: {
    participantId?: number
    speakerNumericId?: number
    targetLanguage: LanguageCode
  },
): Transcript {
  const sourceLanguage = fromRecognitionLanguage(payload.language)
  const translatedTextByLanguage = {
    ko: payload.text,
    en: payload.text,
    ja: payload.text,
    zh: payload.text,
  } satisfies Record<SupportedLanguage, string>

  return {
    id: getStableNumericTranscriptId(payload.transcriptId),
    transcriptId: payload.transcriptId,
    meetingId: payload.meetingId,
    roomCode: payload.roomCode,
    participantId:
      options.participantId
      ?? options.speakerNumericId
      ?? getStableNumericTranscriptId(payload.speakerId),
    speakerId:
      options.speakerNumericId
      ?? options.participantId
      ?? getStableNumericTranscriptId(payload.speakerId),
    speakerIdentity: payload.speakerId,
    speakerRole: payload.speakerRole,
    time: new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(payload.createdAt)),
    createdAt: payload.createdAt,
    speakerName: payload.speakerName,
    sourceLanguage,
    recognitionLanguage: payload.language,
    sourceText: payload.text,
    targetLanguage: options.targetLanguage,
    translatedText: payload.text,
    translationSource: 'same-language',
    translatedTextByLanguage,
    isFinal: payload.isFinal,
  }
}

export function decodeLiveKitDataMessage(
  payload: Uint8Array,
): LiveKitDataMessage | null {
  try {
    const message = JSON.parse(decoder.decode(payload)) as unknown

    if (
      typeof message !== 'object'
      || message === null
      || !('type' in message)
      || !('payload' in message)
      || (
        message.type !== 'chat-message'
        && message.type !== 'system-message'
        && message.type !== 'transcript-created'
        && message.type !== 'translation'
        && message.type !== 'meeting-ended'
        && message.type !== 'participant-kicked'
        && message.type !== 'host-changed'
        && message.type !== 'game-state-snapshot'
        && message.type !== 'game-state-request'
        && message.type !== 'game-ready-change'
        && message.type !== 'attack-start-request'
        && message.type !== 'attack-content-submit-request'
        && message.type !== 'fair-play-event-request'
        && message.type !== 'fair-play-check-status'
      )
      || (
        message.type === 'meeting-ended'
          ? !isMeetingEndedPayload(message.payload)
          : message.type === 'participant-kicked'
            ? !isParticipantKickedPayload(message.payload)
          : message.type === 'host-changed'
            ? !isHostChangedPayload(message.payload)
          : message.type === 'game-state-snapshot'
            ? !isGameStateSnapshot(message.payload)
          : message.type === 'game-state-request'
            ? !isGameStateRequest(message.payload)
          : message.type === 'game-ready-change'
            ? !isGameReadyChange(message.payload)
          : message.type === 'attack-start-request'
            ? !isGameAttackStartRequest(message.payload)
          : message.type === 'attack-content-submit-request'
            ? !isGameAttackContentSubmitRequest(message.payload)
          : message.type === 'fair-play-event-request'
            ? !isGameFairPlayEventRequest(message.payload)
          : message.type === 'fair-play-check-status'
            ? !isGameFairPlayCheckStatus(message.payload)
          : message.type === 'transcript-created'
            ? !isLiveKitTranscriptPayload(message.payload)
              && !isTranscript(message.payload)
          : message.type === 'translation'
            ? !isTranslationRecord(message.payload)
            : !isLiveKitChatMessagePayload(message.payload)
              && !isChatMessage(message.payload)
      )
    ) {
      return null
    }

    if (
      (message.type === 'chat-message' || message.type === 'system-message')
      && isChatMessage(message.payload)
    ) {
      return {
        type: message.type,
        payload: chatMessageToLiveKitPayload(message.payload, {
          roomCode: message.payload.roomCode ?? '',
          senderIdentity:
            message.payload.senderIdentity
            ?? String(message.payload.senderId ?? 'system'),
          senderRole:
            message.payload.type === 'system'
              ? 'system'
              : message.payload.senderRole ?? 'guest',
          language: message.payload.language ?? 'ko',
        }),
      }
    }

    if (
      message.type === 'transcript-created'
      && isTranscript(message.payload)
    ) {
      return {
        type: 'transcript-created',
        payload: transcriptToLiveKitPayload(message.payload, {
          roomCode: message.payload.roomCode ?? '',
          speakerIdentity:
            message.payload.speakerIdentity
            ?? String(message.payload.speakerId ?? message.payload.participantId),
          speakerRole: message.payload.speakerRole ?? 'guest',
          language:
            message.payload.recognitionLanguage
            ?? toRecognitionLanguage(message.payload.sourceLanguage),
        }),
      }
    }

    return message as LiveKitDataMessage
  } catch (error) {
    console.warn('[livekit-chat] Failed to decode data message', error)
    return null
  }
}

function isLiveKitTranscriptPayload(
  value: unknown,
): value is LiveKitTranscriptPayload {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const payload = value as Partial<LiveKitTranscriptPayload>
  return (
    payload.type === 'transcript'
    && typeof payload.transcriptId === 'string'
    && typeof payload.roomCode === 'string'
    && typeof payload.meetingId === 'string'
    && typeof payload.speakerId === 'string'
    && typeof payload.speakerName === 'string'
    && (payload.speakerRole === 'host' || payload.speakerRole === 'guest')
    && typeof payload.text === 'string'
    && (payload.language === 'ko-KR' || payload.language === 'en-US')
    && typeof payload.isFinal === 'boolean'
    && typeof payload.createdAt === 'string'
  )
}

function isTranslationRecord(value: unknown): value is TranslationRecord {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const translation = value as Partial<TranslationRecord>
  return (
    translation.type === 'translation'
    && typeof translation.translationId === 'string'
    && typeof translation.roomCode === 'string'
    && (translation.sourceType === 'chat' || translation.sourceType === 'transcript')
    && typeof translation.sourceId === 'string'
    && typeof translation.sourceText === 'string'
    && typeof translation.translatedText === 'string'
    && typeof translation.sourceLanguage === 'string'
    && typeof translation.targetLanguage === 'string'
    && (
      translation.status === undefined
      || translation.status === 'pending'
      || translation.status === 'success'
      || translation.status === 'failed'
      || translation.status === 'skipped'
    )
    && typeof translation.createdAt === 'string'
  )
}

function toRecognitionLanguage(
  language: LanguageCode,
): SpeechRecognitionLanguage {
  return language === 'en' ? 'en-US' : 'ko-KR'
}

function fromRecognitionLanguage(
  language: SpeechRecognitionLanguage,
): LanguageCode {
  return language === 'en-US' ? 'en' : 'ko'
}

function getStableNumericTranscriptId(value: string): number {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash) || 1
}

function isLiveKitChatMessagePayload(
  value: unknown,
): value is LiveKitChatMessagePayload {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const payload = value as Partial<LiveKitChatMessagePayload>
  return (
    (payload.type === 'chat-message' || payload.type === 'system-message')
    && typeof payload.messageId === 'string'
    && typeof payload.roomCode === 'string'
    && typeof payload.meetingId === 'string'
    && typeof payload.senderId === 'string'
    && typeof payload.senderName === 'string'
    && (
      payload.senderRole === 'host'
      || payload.senderRole === 'guest'
      || payload.senderRole === 'system'
    )
    && typeof payload.text === 'string'
    && typeof payload.language === 'string'
    && typeof payload.createdAt === 'string'
  )
}

function isParticipantKickedPayload(
  value: unknown,
): value is LiveKitParticipantKickedPayload {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const payload = value as Partial<LiveKitParticipantKickedPayload>
  return (
    typeof payload.meetingId === 'string'
    && typeof payload.roomName === 'string'
    && typeof payload.targetParticipantIdentity === 'string'
    && typeof payload.removedByParticipantIdentity === 'string'
    && typeof payload.removedByName === 'string'
    && (
      payload.reason === 'removed_by_host'
      || payload.reason === 'eliminated'
    )
    && typeof payload.timestamp === 'string'
  )
}

function isMeetingEndedPayload(
  value: unknown,
): value is LiveKitMeetingEndedPayload {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const payload = value as Partial<LiveKitMeetingEndedPayload>
  return (
    typeof payload.meetingId === 'string'
    && typeof payload.roomName === 'string'
    && typeof payload.endedByParticipantIdentity === 'string'
    && typeof payload.endedByName === 'string'
    && typeof payload.endedAt === 'string'
  )
}

function isHostChangedPayload(
  value: unknown,
): value is LiveKitHostChangedPayload {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const payload = value as Partial<LiveKitHostChangedPayload>
  return (
    typeof payload.meetingId === 'string'
    && typeof payload.roomName === 'string'
    && typeof payload.previousHostParticipantIdentity === 'string'
    && typeof payload.newHostParticipantIdentity === 'string'
    && typeof payload.newHostName === 'string'
    && (
      payload.newHostControlToken === undefined
      || typeof payload.newHostControlToken === 'string'
    )
    && typeof payload.changedAt === 'string'
    && (
      payload.reason === 'host_eliminated'
      || payload.reason === 'host_left'
    )
  )
}

function isGameStateSnapshot(value: unknown): value is GameStateSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const snapshot = value as Partial<GameStateSnapshot>
  return (
    snapshot.type === 'game-state-snapshot'
    && typeof snapshot.meetingId === 'string'
    && typeof snapshot.roomCode === 'string'
    && isGamePhase(snapshot.phase)
    && typeof snapshot.revision === 'number'
    && Number.isFinite(snapshot.revision)
    && typeof snapshot.participantCount === 'number'
    && Number.isFinite(snapshot.participantCount)
    && typeof snapshot.connectedParticipantCount === 'number'
    && Number.isFinite(snapshot.connectedParticipantCount)
    && typeof snapshot.readyParticipantCount === 'number'
    && Number.isFinite(snapshot.readyParticipantCount)
    && (
      snapshot.initialLives === undefined
      || snapshot.initialLives === 1
      || snapshot.initialLives === 3
      || snapshot.initialLives === 5
    )
    && (
      snapshot.autoStartAt === undefined
      || typeof snapshot.autoStartAt === 'string'
    )
    && (
      snapshot.gameOverAt === undefined
      || typeof snapshot.gameOverAt === 'string'
    )
    && (
      snapshot.postGameAt === undefined
      || typeof snapshot.postGameAt === 'string'
    )
    && (
      snapshot.countdownStartedAt === undefined
      || typeof snapshot.countdownStartedAt === 'string'
    )
    && (
      snapshot.countdownDurationMs === undefined
      || (
        typeof snapshot.countdownDurationMs === 'number'
        && Number.isFinite(snapshot.countdownDurationMs)
      )
    )
    && (
      snapshot.roundNumber === undefined
      || (
        typeof snapshot.roundNumber === 'number'
        && Number.isFinite(snapshot.roundNumber)
      )
    )
    && (
      snapshot.activePlayerIdentities === undefined
      || (
        Array.isArray(snapshot.activePlayerIdentities)
        && snapshot.activePlayerIdentities.every(
          (participantIdentity) => typeof participantIdentity === 'string',
        )
      )
    )
    && (
      snapshot.turnOrder === undefined
      || (
        Array.isArray(snapshot.turnOrder)
        && snapshot.turnOrder.every(
          (participantIdentity) => typeof participantIdentity === 'string',
        )
      )
    )
    && (
      snapshot.currentTurnIndex === undefined
      || (
        typeof snapshot.currentTurnIndex === 'number'
        && Number.isFinite(snapshot.currentTurnIndex)
      )
    )
    && (
      snapshot.attackerIdentity === undefined
      || typeof snapshot.attackerIdentity === 'string'
    )
    && (
      snapshot.defenderIdentities === undefined
      || (
        Array.isArray(snapshot.defenderIdentities)
        && snapshot.defenderIdentities.every(
          (participantIdentity) => typeof participantIdentity === 'string',
        )
      )
    )
    && (
      snapshot.roleRevealStartedAt === undefined
      || typeof snapshot.roleRevealStartedAt === 'string'
    )
    && (
      snapshot.roleRevealDurationMs === undefined
      || (
        typeof snapshot.roleRevealDurationMs === 'number'
        && Number.isFinite(snapshot.roleRevealDurationMs)
      )
    )
    && (
      snapshot.attackStartedAt === undefined
      || typeof snapshot.attackStartedAt === 'string'
    )
    && (
      snapshot.attackDurationMs === undefined
      || (
        typeof snapshot.attackDurationMs === 'number'
        && Number.isFinite(snapshot.attackDurationMs)
      )
    )
    && (
      snapshot.attackEndsAt === undefined
      || typeof snapshot.attackEndsAt === 'string'
    )
    && (
      snapshot.attackEndReason === undefined
      || snapshot.attackEndReason === 'all-defenders-hit'
      || snapshot.attackEndReason === 'timeout'
    )
    && (
      snapshot.attackSequence === undefined
      || (
        typeof snapshot.attackSequence === 'number'
        && Number.isFinite(snapshot.attackSequence)
      )
    )
    && (
      snapshot.hostParticipantIdentity === undefined
      || typeof snapshot.hostParticipantIdentity === 'string'
    )
    && (
      snapshot.attackContent === undefined
      || snapshot.attackContent === null
      || isGameAttackContent(snapshot.attackContent)
    )
    && (
      snapshot.playerStates === undefined
      || isGamePlayerStates(snapshot.playerStates)
    )
    && (
      snapshot.roundResult === undefined
      || snapshot.roundResult === null
      || isGameRoundResult(snapshot.roundResult)
    )
    && (
      snapshot.fairPlay === undefined
      || (
        typeof snapshot.fairPlay === 'object'
        && snapshot.fairPlay !== null
      )
    )
    && (
      snapshot.penalizedParticipantIdentitiesForCurrentAttack === undefined
      || (
        Array.isArray(snapshot.penalizedParticipantIdentitiesForCurrentAttack)
        && snapshot.penalizedParticipantIdentitiesForCurrentAttack.every(
          (participantIdentity) => typeof participantIdentity === 'string',
        )
      )
    )
    && Array.isArray(snapshot.participants)
    && snapshot.participants.every((participant) => (
      typeof participant === 'object'
      && participant !== null
      && typeof participant.participantId === 'number'
      && (
        participant.participantIdentity === undefined
        || typeof participant.participantIdentity === 'string'
      )
      && typeof participant.name === 'string'
      && (
        participant.role === 'host'
        || participant.role === 'participant'
      )
      && typeof participant.isConnected === 'boolean'
      && typeof participant.isReady === 'boolean'
    ))
    && typeof snapshot.updatedAt === 'string'
  )
}

function isGamePlayerStates(
  value: unknown,
): value is Record<string, GamePlayerState> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  return Object.entries(value).every(([participantIdentity, playerState]) => (
    typeof participantIdentity === 'string'
    && typeof playerState === 'object'
    && playerState !== null
    && typeof (playerState as Partial<GamePlayerState>).lives === 'number'
    && Number.isFinite((playerState as Partial<GamePlayerState>).lives)
    && typeof (playerState as Partial<GamePlayerState>).eliminated === 'boolean'
  ))
}

function isGameRoundResult(value: unknown): value is GameRoundResult {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const result = value as Partial<GameRoundResult>
  return (
    typeof result.roundNumber === 'number'
    && Number.isFinite(result.roundNumber)
    && (
      result.attackSequence === undefined
      || (
        typeof result.attackSequence === 'number'
        && Number.isFinite(result.attackSequence)
      )
    )
    && (
      result.attackerIdentity === undefined
      || typeof result.attackerIdentity === 'string'
    )
    && Array.isArray(result.laughedParticipantIdentities)
    && result.laughedParticipantIdentities.every(
      (participantIdentity) => typeof participantIdentity === 'string',
    )
    && Array.isArray(result.lifeChanges)
    && result.lifeChanges.every((change) => (
      typeof change === 'object'
      && change !== null
      && typeof change.participantIdentity === 'string'
      && typeof change.previousLives === 'number'
      && Number.isFinite(change.previousLives)
      && typeof change.currentLives === 'number'
      && Number.isFinite(change.currentLives)
      && typeof change.eliminated === 'boolean'
    ))
  )
}

function isGameAttackContent(value: unknown): value is GameAttackContent {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const attackContent = value as Partial<GameAttackContent>
  return (
    typeof attackContent.contentId === 'string'
    && (
      attackContent.mimeType === 'image/jpeg'
      || attackContent.mimeType === 'image/png'
      || attackContent.mimeType === 'image/webp'
    )
    && typeof attackContent.size === 'number'
    && Number.isFinite(attackContent.size)
    && typeof attackContent.uploaderParticipantIdentity === 'string'
    && typeof attackContent.roomCode === 'string'
    && typeof attackContent.roundNumber === 'number'
    && Number.isFinite(attackContent.roundNumber)
    && typeof attackContent.version === 'number'
    && Number.isFinite(attackContent.version)
    && typeof attackContent.createdAt === 'string'
  )
}

function isGameStateRequest(value: unknown): value is GameStateRequest {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const request = value as Partial<GameStateRequest>
  return (
    request.type === 'game-state-request'
    && typeof request.meetingId === 'string'
    && typeof request.roomCode === 'string'
    && (
      request.requesterParticipantIdentity === undefined
      || typeof request.requesterParticipantIdentity === 'string'
    )
    && typeof request.requestedAt === 'string'
  )
}

function isGameReadyChange(value: unknown): value is GameReadyChange {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const readyChange = value as Partial<GameReadyChange>
  return (
    readyChange.type === 'game-ready-change'
    && typeof readyChange.meetingId === 'string'
    && typeof readyChange.roomCode === 'string'
    && typeof readyChange.participantIdentity === 'string'
    && typeof readyChange.isReady === 'boolean'
    && typeof readyChange.changedAt === 'string'
  )
}

function isGameAttackStartRequest(
  value: unknown,
): value is GameAttackStartRequest {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const request = value as Partial<GameAttackStartRequest>
  return (
    request.type === 'attack-start-request'
    && typeof request.meetingId === 'string'
    && typeof request.roomCode === 'string'
    && typeof request.roundNumber === 'number'
    && Number.isFinite(request.roundNumber)
    && (
      request.attackSequence === undefined
      || (
        typeof request.attackSequence === 'number'
        && Number.isFinite(request.attackSequence)
      )
    )
    && typeof request.requestedAt === 'string'
  )
}

function isGameAttackContentSubmitRequest(
  value: unknown,
): value is GameAttackContentSubmitRequest {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const request = value as Partial<GameAttackContentSubmitRequest>
  return (
    request.type === 'attack-content-submit-request'
    && typeof request.meetingId === 'string'
    && typeof request.roomCode === 'string'
    && typeof request.contentId === 'string'
    && typeof request.roundNumber === 'number'
    && Number.isFinite(request.roundNumber)
    && (
      request.attackSequence === undefined
      || (
        typeof request.attackSequence === 'number'
        && Number.isFinite(request.attackSequence)
      )
    )
    && typeof request.requestedAt === 'string'
  )
}

function isGamePhase(value: unknown): value is GameStateSnapshot['phase'] {
  return (
    value === 'waiting'
    || value === 'ready'
    || value === 'auto-start-pending'
    || value === 'fair-play-check'
    || value === 'countdown'
    || value === 'game-started'
    || value === 'role-reveal'
    || value === 'attack-ready'
    || value === 'attack-active'
    || value === 'attack-ended'
    || value === 'round-result'
    || value === 'round-ended'
    || value === 'game-over'
    || value === 'post-game'
    || value === 'attack-prep'
    || value === 'attacking'
    || value === 'turn-result'
    || value === 'game-result'
  )
}

function isGameFairPlayEventRequest(
  value: unknown,
): value is GameFairPlayEventRequest {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const request = value as Partial<GameFairPlayEventRequest>
  return (
    request.type === 'fair-play-event-request'
    && typeof request.meetingId === 'string'
    && typeof request.roomCode === 'string'
    && typeof request.eventId === 'string'
    && (
      request.reason === 'visible-laugh'
      || request.reason === 'multimodal-laugh'
      || request.reason === 'audio-laugh'
      || request.reason === 'occluded-audio-laugh'
      || request.reason === 'hidden-audio-laugh'
      || request.reason === 'mouth-occlusion-timeout'
      || request.reason === 'face-not-visible-timeout'
      || request.reason === 'visibility-face-lost'
      || request.reason === 'visibility-camera-off'
    )
    && typeof request.roundNumber === 'number'
    && Number.isFinite(request.roundNumber)
    && (
      request.attackSequence === undefined
      || (
        typeof request.attackSequence === 'number'
        && Number.isFinite(request.attackSequence)
      )
    )
    && typeof request.detectorVersion === 'string'
    && typeof request.detectedAt === 'string'
  )
}

function isGameFairPlayCheckStatus(
  value: unknown,
): value is GameFairPlayCheckStatus {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const status = value as Partial<GameFairPlayCheckStatus>
  return (
    status.type === 'fair-play-check-status'
    && typeof status.meetingId === 'string'
    && typeof status.roomCode === 'string'
    && typeof status.participantIdentity === 'string'
    && (
      status.participantName === undefined
      || typeof status.participantName === 'string'
    )
    && typeof status.cameraReady === 'boolean'
    && typeof status.faceReady === 'boolean'
    && typeof status.mouthReady === 'boolean'
    && typeof status.smileReady === 'boolean'
    && typeof status.passed === 'boolean'
    && typeof status.failed === 'boolean'
    && (
      status.step === 'camera'
      || status.step === 'face'
      || status.step === 'mouth'
      || status.step === 'smile'
      || status.step === 'passed'
    )
    && typeof status.message === 'string'
    && (
      status.checkVersion === undefined
      || (
        typeof status.checkVersion === 'number'
        && Number.isFinite(status.checkVersion)
      )
    )
    && (
      status.calibrationVersion === undefined
      || (
        typeof status.calibrationVersion === 'number'
        && Number.isFinite(status.calibrationVersion)
      )
    )
    && typeof status.updatedAt === 'string'
  )
}

function isTranscript(value: unknown): value is Transcript {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const transcript = value as Partial<Transcript>
  return (
    typeof transcript.id === 'number'
    && typeof transcript.meetingId === 'string'
    && typeof transcript.participantId === 'number'
    && typeof transcript.speakerId === 'number'
    && typeof transcript.time === 'string'
    && typeof transcript.createdAt === 'string'
    && typeof transcript.speakerName === 'string'
    && typeof transcript.sourceLanguage === 'string'
    && typeof transcript.sourceText === 'string'
    && typeof transcript.targetLanguage === 'string'
    && typeof transcript.translatedText === 'string'
    && typeof transcript.translationSource === 'string'
    && typeof transcript.translatedTextByLanguage === 'object'
    && transcript.translatedTextByLanguage !== null
  )
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const message = value as Partial<ChatMessage>
  return (
    typeof message.id === 'string'
    && typeof message.meetingId === 'string'
    && (typeof message.senderId === 'number' || message.senderId === null)
    && typeof message.senderName === 'string'
    && typeof message.message === 'string'
    && typeof message.createdAt === 'string'
    && (message.type === 'user' || message.type === 'system')
  )
}
