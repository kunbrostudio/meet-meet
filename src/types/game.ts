export type GamePhase =
  | 'waiting'
  | 'ready'
  | 'countdown'
  | 'attack-prep'
  | 'attacking'
  | 'judging'
  | 'turn-result'
  | 'game-result'

export type GameParticipantStatus = {
  participantId: number
  participantIdentity?: string
  name: string
  role: 'host' | 'participant'
  isConnected: boolean
}

export type GameStateSnapshot = {
  type: 'game-state-snapshot'
  meetingId: string
  roomCode: string
  phase: GamePhase
  revision: number
  participantCount: number
  connectedParticipantCount: number
  hostParticipantIdentity?: string
  participants: GameParticipantStatus[]
  updatedAt: string
}

export type GameStateRequest = {
  type: 'game-state-request'
  meetingId: string
  roomCode: string
  requesterParticipantIdentity?: string
  requestedAt: string
}
