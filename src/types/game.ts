export type GamePhase =
  | 'waiting'
  | 'ready'
  | 'countdown'
  | 'game-started'
  | 'role-reveal'
  | 'attack-ready'
  | 'attack-active'
  | 'attack-ended'
  | 'round-ended'
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
  roundNumber?: number
  activePlayerIdentities?: string[]
  turnOrder?: string[]
  currentTurnIndex?: number
  attackerIdentity?: string
  defenderIdentities?: string[]
  roleRevealStartedAt?: string
  roleRevealDurationMs?: number
  attackStartedAt?: string
  attackDurationMs?: number
  attackEndsAt?: string
  attackSequence?: number
  attackContent?: GameAttackContent | null
  hostParticipantIdentity?: string
  participants: GameParticipantStatus[]
  updatedAt: string
}

export type GameAttackContent = {
  contentId: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  size: number
  uploaderParticipantIdentity: string
  roomCode: string
  roundNumber: number
  version: number
  createdAt: string
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

export type GameAttackStartRequest = {
  type: 'attack-start-request'
  meetingId: string
  roomCode: string
  roundNumber: number
  attackSequence?: number
  requestedAt: string
}

export type GameAttackContentSubmitRequest = {
  type: 'attack-content-submit-request'
  meetingId: string
  roomCode: string
  contentId: string
  roundNumber: number
  attackSequence?: number
  requestedAt: string
}
