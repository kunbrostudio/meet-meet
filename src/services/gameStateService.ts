import type {
  GameAttackContent,
  GameAttackContentSubmitRequest,
  GameAttackStartRequest,
  GameFairPlayState,
  GamePhase,
  GamePlayerState,
  GameReadyChange,
  GameRoundResult,
  GameStateRequest,
  GameStateSnapshot,
} from '../types/game'
import type { Participant } from '../types/participant'

export const DEFAULT_PLAYER_LIVES = 3

type CreateGameStateSnapshotInput = {
  meetingId: string
  roomCode: string
  participantCount: number
  participants: Participant[]
  previousRevision?: number
  hostParticipantIdentity?: string
  readyParticipantIdentities?: Iterable<string>
  initialLives?: 1 | 3 | 5
  autoStartAt?: string
  gameOverAt?: string
  postGameAt?: string
  phase?: GamePhase
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
  attackEndReason?: GameStateSnapshot['attackEndReason']
  attackSequence?: number
  attackContent?: GameAttackContent | null
  playerStates?: Record<string, GamePlayerState>
  roundResult?: GameRoundResult | null
  fairPlay?: GameFairPlayState
  penalizedParticipantIdentitiesForCurrentAttack?: string[]
}

export function getLobbyGamePhase(
  connectedParticipantCount: number,
  _participantCount: number,
  readyParticipantCount = 0,
): GamePhase {
  return (
    connectedParticipantCount >= 2
      && readyParticipantCount === connectedParticipantCount
      ? 'ready'
      : 'waiting'
  )
}

export function getParticipantGameIdentity(participant: Participant): string {
  return participant.liveKitIdentity ?? String(participant.id)
}

export function filterReadyParticipantIdentities(
  participants: Participant[],
  readyParticipantIdentities: Iterable<string>,
): string[] {
  const connectedParticipantIdentities = new Set(
    participants.map(getParticipantGameIdentity),
  )

  return Array.from(readyParticipantIdentities).filter(
    (participantIdentity) => connectedParticipantIdentities.has(participantIdentity),
  )
}

export function createGameStateSnapshot({
  meetingId,
  roomCode,
  participantCount,
  participants,
  previousRevision = 0,
  hostParticipantIdentity,
  readyParticipantIdentities = [],
  initialLives,
  autoStartAt,
  gameOverAt,
  postGameAt,
  phase,
  countdownStartedAt,
  countdownDurationMs,
  roundNumber,
  activePlayerIdentities,
  turnOrder,
  currentTurnIndex,
  attackerIdentity,
  defenderIdentities,
  roleRevealStartedAt,
  roleRevealDurationMs,
  attackStartedAt,
  attackDurationMs,
  attackEndsAt,
  attackEndReason,
  attackSequence,
  attackContent,
  playerStates,
  roundResult,
  fairPlay,
  penalizedParticipantIdentitiesForCurrentAttack,
}: CreateGameStateSnapshotInput): GameStateSnapshot {
  const visibleParticipants = participants.slice(0, participantCount)
  const connectedParticipantCount = visibleParticipants.length
  const readyIdentitySet = new Set(
    filterReadyParticipantIdentities(visibleParticipants, readyParticipantIdentities),
  )
  const readyParticipantCount = visibleParticipants.filter(
    (participant) => readyIdentitySet.has(getParticipantGameIdentity(participant)),
  ).length
  const hostParticipant =
    visibleParticipants.find((participant) => participant.meetingRole === 'host')

  return {
    type: 'game-state-snapshot',
    meetingId,
    roomCode,
    phase: phase ?? getLobbyGamePhase(
      connectedParticipantCount,
      participantCount,
      readyParticipantCount,
    ),
    revision: previousRevision + 1,
    participantCount,
    connectedParticipantCount,
    readyParticipantCount,
    initialLives,
    autoStartAt,
    gameOverAt,
    postGameAt,
    countdownStartedAt,
    countdownDurationMs,
    roundNumber,
    activePlayerIdentities,
    turnOrder,
    currentTurnIndex,
    attackerIdentity,
    defenderIdentities,
    roleRevealStartedAt,
    roleRevealDurationMs,
    attackStartedAt,
    attackDurationMs,
    attackEndsAt,
    attackEndReason,
    attackSequence,
    attackContent: attackContent ?? null,
    playerStates,
    roundResult: roundResult ?? null,
    fairPlay,
    penalizedParticipantIdentitiesForCurrentAttack,
    hostParticipantIdentity:
      hostParticipantIdentity
      ?? hostParticipant?.liveKitIdentity
      ?? (hostParticipant ? String(hostParticipant.id) : undefined),
    participants: visibleParticipants.map((participant) => ({
      participantId: participant.id,
      participantIdentity: getParticipantGameIdentity(participant),
      name: participant.name,
      role: participant.meetingRole,
      isConnected: true,
      isReady: readyIdentitySet.has(getParticipantGameIdentity(participant)),
    })),
    updatedAt: new Date().toISOString(),
  }
}

export function getActivePlayerIdentities(input: {
  participants: Participant[]
  participantCount: number
  readyParticipantIdentities: Iterable<string>
}): string[] {
  const visibleParticipants = input.participants.slice(0, input.participantCount)
  const visibleIdentitySet = new Set(
    visibleParticipants.map(getParticipantGameIdentity),
  )
  const readyIdentities = Array.from(new Set(input.readyParticipantIdentities))
    .filter((identity) => visibleIdentitySet.has(identity))

  if (readyIdentities.length >= 2) {
    return readyIdentities.slice(0, 4)
  }

  return Array.from(visibleIdentitySet).slice(0, 4)
}

export function createTurnOrder(playerIdentities: string[]): string[] {
  const turnOrder = [...new Set(playerIdentities)]

  for (let index = turnOrder.length - 1; index > 0; index -= 1) {
    const randomValues = new Uint32Array(1)
    crypto.getRandomValues(randomValues)
    const swapIndex = randomValues[0] % (index + 1)
    const currentIdentity = turnOrder[index]
    turnOrder[index] = turnOrder[swapIndex]
    turnOrder[swapIndex] = currentIdentity
  }

  return turnOrder
}

export function getDefenderIdentities(
  activePlayerIdentities: string[],
  attackerIdentity: string | undefined,
): string[] {
  if (!attackerIdentity) {
    return []
  }

  return activePlayerIdentities.filter(
    (participantIdentity) => participantIdentity !== attackerIdentity,
  )
}

export function getGameStateSnapshotKey(snapshot: GameStateSnapshot): string {
  return JSON.stringify({
    phase: snapshot.phase,
    autoStartAt: snapshot.autoStartAt,
    gameOverAt: snapshot.gameOverAt,
    postGameAt: snapshot.postGameAt,
    countdownStartedAt: snapshot.countdownStartedAt,
    countdownDurationMs: snapshot.countdownDurationMs,
    roundNumber: snapshot.roundNumber,
    activePlayerIdentities: snapshot.activePlayerIdentities,
    turnOrder: snapshot.turnOrder,
    currentTurnIndex: snapshot.currentTurnIndex,
    attackerIdentity: snapshot.attackerIdentity,
    defenderIdentities: snapshot.defenderIdentities,
    roleRevealStartedAt: snapshot.roleRevealStartedAt,
    roleRevealDurationMs: snapshot.roleRevealDurationMs,
    attackStartedAt: snapshot.attackStartedAt,
    attackDurationMs: snapshot.attackDurationMs,
    attackEndsAt: snapshot.attackEndsAt,
    attackEndReason: snapshot.attackEndReason,
    attackSequence: snapshot.attackSequence,
    attackContent: snapshot.attackContent,
    playerStates: snapshot.playerStates,
    roundResult: snapshot.roundResult,
    fairPlay: snapshot.fairPlay,
    penalizedParticipantIdentitiesForCurrentAttack:
      snapshot.penalizedParticipantIdentitiesForCurrentAttack,
    initialLives: snapshot.initialLives,
    participantCount: snapshot.participantCount,
    connectedParticipantCount: snapshot.connectedParticipantCount,
    readyParticipantCount: snapshot.readyParticipantCount,
    participants: snapshot.participants.map((participant) => [
      participant.participantIdentity,
      participant.name,
      participant.role,
      participant.isConnected,
      participant.isReady,
    ]),
  })
}

export function createGameAttackContentSubmitRequest(input: {
  meetingId: string
  roomCode: string
  contentId: string
  roundNumber: number
  attackSequence?: number
}): GameAttackContentSubmitRequest {
  return {
    type: 'attack-content-submit-request',
    meetingId: input.meetingId,
    roomCode: input.roomCode,
    contentId: input.contentId,
    roundNumber: input.roundNumber,
    attackSequence: input.attackSequence,
    requestedAt: new Date().toISOString(),
  }
}

export function createGameAttackStartRequest(input: {
  meetingId: string
  roomCode: string
  roundNumber: number
  attackSequence?: number
}): GameAttackStartRequest {
  return {
    type: 'attack-start-request',
    meetingId: input.meetingId,
    roomCode: input.roomCode,
    roundNumber: input.roundNumber,
    attackSequence: input.attackSequence,
    requestedAt: new Date().toISOString(),
  }
}

export function createGameStateRequest(input: {
  meetingId: string
  roomCode: string
  requesterParticipantIdentity?: string
}): GameStateRequest {
  return {
    type: 'game-state-request',
    meetingId: input.meetingId,
    roomCode: input.roomCode,
    requesterParticipantIdentity: input.requesterParticipantIdentity,
    requestedAt: new Date().toISOString(),
  }
}

export function createGameReadyChange(input: {
  meetingId: string
  roomCode: string
  participantIdentity: string
  isReady: boolean
}): GameReadyChange {
  return {
    type: 'game-ready-change',
    meetingId: input.meetingId,
    roomCode: input.roomCode,
    participantIdentity: input.participantIdentity,
    isReady: input.isReady,
    changedAt: new Date().toISOString(),
  }
}

export function shouldAcceptGameStateSnapshot(
  current: GameStateSnapshot,
  incoming: GameStateSnapshot,
): boolean {
  return (
    incoming.meetingId === current.meetingId
    && incoming.roomCode === current.roomCode
    && incoming.revision >= current.revision
  )
}
