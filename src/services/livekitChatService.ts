import type { ChatMessage } from '../types/chat'
import type { Transcript } from '../types/transcript'

export const LIVEKIT_CHAT_TOPIC = 'say-merang-chat'
export const LIVEKIT_TRANSCRIPT_TOPIC = 'say-merang-transcript'
export const LIVEKIT_MEETING_CONTROL_TOPIC = 'say-merang-meeting-control'

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
  reason: 'removed_by_host'
  timestamp: string
}

export type LiveKitDataMessage =
  | {
      type: 'chat-message'
      payload: ChatMessage
    }
  | {
      type: 'system-message'
      payload: ChatMessage
    }
  | {
      type: 'transcript-created'
      payload: Transcript
    }
  | {
      type: 'meeting-ended'
      payload: LiveKitMeetingEndedPayload
    }
  | {
      type: 'participant-kicked'
      payload: LiveKitParticipantKickedPayload
    }

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function encodeLiveKitDataMessage(
  message: LiveKitDataMessage,
): Uint8Array {
  return encoder.encode(JSON.stringify(message))
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
        && message.type !== 'meeting-ended'
        && message.type !== 'participant-kicked'
      )
      || (
        message.type === 'meeting-ended'
          ? !isMeetingEndedPayload(message.payload)
          : message.type === 'participant-kicked'
            ? !isParticipantKickedPayload(message.payload)
          : message.type === 'transcript-created'
            ? !isTranscript(message.payload)
            : !isChatMessage(message.payload)
      )
    ) {
      return null
    }

    return message as LiveKitDataMessage
  } catch (error) {
    console.error('[livekit-chat] Failed to decode data message', error)
    return null
  }
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
    && payload.reason === 'removed_by_host'
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
