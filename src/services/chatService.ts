import type {
  ChatMessage,
  CreateChatMessageInput,
  CreateSystemMessageInput,
} from '../types/chat'
import { STORAGE_KEYS } from '../constants/storageKeys'

function createMessageId(): string {
  return crypto.randomUUID?.()
    ?? `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function saveChatMessages(
  meetingId: string,
  messages: ChatMessage[],
): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.meetingChat(meetingId),
      JSON.stringify(messages),
    )
  } catch (error) {
    console.error('[chat-service] Failed to save chat messages', error)
  }
}

export function loadChatMessages(meetingId: string): ChatMessage[] {
  try {
    const value = localStorage.getItem(STORAGE_KEYS.meetingChat(meetingId))
    const messages = value ? JSON.parse(value) as ChatMessage[] : []
    return Array.isArray(messages) ? messages : []
  } catch (error) {
    console.error('[chat-service] Failed to load chat messages', error)
    return []
  }
}

export function clearChatMessages(meetingId: string): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.meetingChat(meetingId))
  } catch (error) {
    console.error('[chat-service] Failed to clear chat messages', error)
  }
}

export function createChatMessage({
  meetingId,
  senderId,
  senderName,
  senderIdentity,
  senderRole,
  roomCode,
  language,
  message,
}: CreateChatMessageInput): ChatMessage {
  return {
    id: createMessageId(),
    meetingId,
    senderId,
    senderName,
    senderIdentity,
    senderRole,
    roomCode,
    language,
    message: message.trim(),
    createdAt: new Date().toISOString(),
    type: 'user',
  }
}

export function createSystemMessage({
  meetingId,
  message,
}: CreateSystemMessageInput): ChatMessage {
  return {
    id: createMessageId(),
    meetingId,
    senderId: null,
    senderName: 'MEET MEET',
    message: message.trim(),
    createdAt: new Date().toISOString(),
    type: 'system',
  }
}
