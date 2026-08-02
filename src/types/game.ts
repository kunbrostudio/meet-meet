export type GamePhase =
  | 'waiting'
  | 'ready'
  | 'countdown'
  | 'game-started'
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
  isReady: boolean
}

export type GameStateSnapshot = {
  type: 'game-state-snapshot'
  meetingId: string
  roomCode: string
  phase: GamePhase
  revision: number
  participantCount: number
  connectedParticipantCount: number
  readyParticipantCount: number
  countdownStartedAt?: string
  countdownDurationMs?: number
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

export type GameReadyChange = {
  type: 'game-ready-change'
  meetingId: string
  roomCode: string
  participantIdentity: string
  isReady: boolean
  changedAt: string
}
