export type ChatMessage = {
  id: string
  meetingId: string
  senderId: number | null
  senderName: string
  message: string
  createdAt: string
  type: 'user' | 'system'
}

export type CreateChatMessageInput = {
  meetingId: string
  senderId: number
  senderName: string
  message: string
}

export type CreateSystemMessageInput = {
  meetingId: string
  message: string
}
