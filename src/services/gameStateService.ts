import type {
  GamePhase,
  GameReadyChange,
  GameStateRequest,
  GameStateSnapshot,
} from '../types/game'
import type { Participant } from '../types/participant'

type CreateGameStateSnapshotInput = {
  meetingId: string
  roomCode: string
  participantCount: number
  participants: Participant[]
  previousRevision?: number
  hostParticipantIdentity?: string
  readyParticipantIdentities?: Iterable<string>
  phase?: GamePhase
  countdownStartedAt?: string
  countdownDurationMs?: number
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
  phase,
  countdownStartedAt,
  countdownDurationMs,
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
    countdownStartedAt,
    countdownDurationMs,
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
