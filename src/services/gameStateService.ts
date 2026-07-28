import type { GamePhase, GameStateRequest, GameStateSnapshot } from '../types/game'
import type { Participant } from '../types/participant'

type CreateGameStateSnapshotInput = {
  meetingId: string
  roomCode: string
  participantCount: number
  participants: Participant[]
  previousRevision?: number
  hostParticipantIdentity?: string
}

export function getLobbyGamePhase(
  connectedParticipantCount: number,
  participantCount: number,
): GamePhase {
  return (
    connectedParticipantCount >= participantCount
      ? 'ready'
      : 'waiting'
  )
}

export function createGameStateSnapshot({
  meetingId,
  roomCode,
  participantCount,
  participants,
  previousRevision = 0,
  hostParticipantIdentity,
}: CreateGameStateSnapshotInput): GameStateSnapshot {
  const visibleParticipants = participants.slice(0, participantCount)
  const connectedParticipantCount = visibleParticipants.length
  const hostParticipant =
    visibleParticipants.find((participant) => participant.meetingRole === 'host')

  return {
    type: 'game-state-snapshot',
    meetingId,
    roomCode,
    phase: getLobbyGamePhase(connectedParticipantCount, participantCount),
    revision: previousRevision + 1,
    participantCount,
    connectedParticipantCount,
    hostParticipantIdentity:
      hostParticipantIdentity
      ?? hostParticipant?.liveKitIdentity
      ?? (hostParticipant ? String(hostParticipant.id) : undefined),
    participants: visibleParticipants.map((participant) => ({
      participantId: participant.id,
      participantIdentity:
        participant.liveKitIdentity ?? String(participant.id),
      name: participant.name,
      role: participant.meetingRole,
      isConnected: true,
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
