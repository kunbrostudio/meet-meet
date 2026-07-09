export type ChatMessage = {
  id: string
  meetingId: string
  senderId: number | null
  senderName: string
  senderIdentity?: string
  senderRole?: 'host' | 'guest' | 'system'
  roomCode?: string
  language?: string
  message: string
  createdAt: string
  type: 'user' | 'system'
}

export type CreateChatMessageInput = {
  meetingId: string
  senderId: number
  senderName: string
  senderIdentity?: string
  senderRole?: 'host' | 'guest'
  roomCode?: string
  language?: string
  message: string
}

export type CreateSystemMessageInput = {
  meetingId: string
  message: string
}
