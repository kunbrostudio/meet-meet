import type { MeetingSession } from '../types/meeting'

let activeSession: MeetingSession | null = null

export async function connectToRoom(
  roomId: string,
  participantName: string,
): Promise<MeetingSession> {
  activeSession = {
    roomId,
    roomName: `${participantName}'s meeting`,
    participantCount: 1,
    startedAt: new Date().toISOString(),
  }

  return activeSession
}

export async function disconnectFromRoom(): Promise<void> {
  activeSession = null
}

export function getActiveSession(): MeetingSession | null {
  return activeSession
}
