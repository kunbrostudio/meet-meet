import type { Participant } from '../../types/participant'

type ParticipantColumns = {
  left: Participant[]
  right: Participant[]
}

export function splitParticipantsForGameRoom(
  participants: Participant[],
): ParticipantColumns {
  const visibleParticipants = participants.slice(0, 4)

  if (visibleParticipants.length <= 1) {
    return {
      left: visibleParticipants,
      right: [],
    }
  }

  const leftCount = visibleParticipants.length <= 3 ? 1 : 2

  return {
    left: visibleParticipants.slice(0, leftCount),
    right: visibleParticipants.slice(leftCount),
  }
}
