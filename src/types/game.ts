export type GamePhase =
  | 'waiting'
  | 'ready'
  | 'auto-start-pending'
  | 'fair-play-check'
  | 'countdown'
  | 'game-started'
  | 'role-reveal'
  | 'attack-ready'
  | 'attack-active'
  | 'attack-ended'
  | 'round-result'
  | 'round-ended'
  | 'game-over'
  | 'post-game'
  | 'attack-prep'
  | 'attacking'
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
  initialLives?: 1 | 3 | 5
  autoStartAt?: string
  gameOverAt?: string
  postGameAt?: string
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
  attackEndReason?: 'all-defenders-hit' | 'timeout'
  attackSequence?: number
  attackContent?: GameAttackContent | null
  playerStates?: Record<string, GamePlayerState>
  roundResult?: GameRoundResult | null
  fairPlay?: GameFairPlayState
  penalizedParticipantIdentitiesForCurrentAttack?: string[]
  hostParticipantIdentity?: string
  participants: GameParticipantStatus[]
  updatedAt: string
}

export type GamePlayerState = {
  lives: number
  eliminated: boolean
}

export type GameRoundLifeChange = {
  participantIdentity: string
  previousLives: number
  currentLives: number
  eliminated: boolean
}

export type GameRoundResult = {
  roundNumber: number
  attackSequence?: number
  attackerIdentity?: string
  laughedParticipantIdentities: string[]
  lifeChanges: GameRoundLifeChange[]
}

export type GameFairPlayCheckStep =
  | 'camera'
  | 'face'
  | 'mouth'
  | 'smile'
  | 'passed'

export type GameFairPlayCheckParticipantStatus = {
  participantIdentity: string
  participantName?: string
  cameraReady: boolean
  faceReady: boolean
  mouthReady: boolean
  smileReady: boolean
  passed: boolean
  failed: boolean
  step: GameFairPlayCheckStep
  message: string
  checkVersion?: number
  calibrationVersion?: number
  updatedAt: string
}

export type GameFairPlayCheckState = {
  startedAt: string
  activePlayerIdentities: string[]
  participants: Record<string, GameFairPlayCheckParticipantStatus>
  passedAt?: string
}

export type GameFairPlayState = {
  lastEvent?: GameFairPlayEventRecord
  check?: GameFairPlayCheckState
}

export type GameFairPlayEventReason =
  | 'visible-laugh'
  | 'multimodal-laugh'
  | 'audio-laugh'
  | 'occluded-audio-laugh'
  | 'hidden-audio-laugh'
  | 'mouth-occlusion-timeout'
  | 'face-not-visible-timeout'
  | 'visibility-face-lost'
  | 'visibility-camera-off'

export type GameFairPlayEventRecord = {
  eventId: string
  participantIdentity: string
  reason: GameFairPlayEventReason
  roundNumber: number
  attackSequence?: number
  previousLives: number
  currentLives: number
  eliminated: boolean
  detectedAt: string
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

export type GameTimelineEvent =
  | {
      id: string
      type: 'attack'
      attackId: string
      participantIdentity?: string
      displayName: string
      media: GameAttackContent
      timestamp: string
    }
  | {
      id: string
      type: 'attack-result'
      attackId: string
      title: string
      message: string
      defenderResults?: Array<{
        participantIdentity: string
        displayName: string
        hit: boolean
        eliminated: boolean
      }>
      timestamp: string
    }
  | {
      id: string
      type: 'elimination'
      participantIdentity: string
      displayName: string
      timestamp: string
    }
  | {
      id: string
      type: 'game-result'
      title: string
      message: string
      winnerParticipantIdentity?: string
      winnerName?: string
      eliminatedParticipants?: Array<{
        participantIdentity: string
        displayName: string
      }>
      timestamp: string
    }
  | {
      id: string
      type: 'system'
      message: string
      timestamp: string
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

export type GameFairPlayEventRequest = {
  type: 'fair-play-event-request'
  meetingId: string
  roomCode: string
  eventId: string
  reason: GameFairPlayEventReason
  roundNumber: number
  attackSequence?: number
  detectorVersion: string
  scoreSummary?: {
    smileScore?: number
    cheekScore?: number
    audioLaughScore?: number
    audioTopCategoryName?: string
    audioTopCategoryScore?: number
  }
  detectedAt: string
}

export type GameFairPlayCheckStatus = {
  type: 'fair-play-check-status'
  meetingId: string
  roomCode: string
  participantIdentity: string
  participantName?: string
  cameraReady: boolean
  faceReady: boolean
  mouthReady: boolean
  smileReady: boolean
  passed: boolean
  failed: boolean
  step: GameFairPlayCheckStep
  message: string
  checkVersion?: number
  calibrationVersion?: number
  updatedAt: string
}
