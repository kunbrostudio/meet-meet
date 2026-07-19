import type { ReactNode } from 'react'
import type { Participant } from '../../types/participant'
import { ParticipantColumn } from './ParticipantColumn'

type ParticipantColumns = {
  left: Participant[]
  right: Participant[]
}

type MeetMeetRoomLayoutProps = {
  participants: Participant[]
  board: ReactNode
  selectedParticipantId?: number
  onSelectParticipant?: (participantId: number) => void
  onReconnectMedia?: () => void
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

export function MeetMeetRoomLayout({
  participants,
  board,
  selectedParticipantId,
  onSelectParticipant,
  onReconnectMedia,
}: MeetMeetRoomLayoutProps) {
  const columns = splitParticipantsForGameRoom(participants)

  return (
    <div
      className="meet-meet-room-layout"
      data-participant-count={Math.min(participants.length, 4)}
    >
      <ParticipantColumn
        side="left"
        participants={columns.left}
        selectedParticipantId={selectedParticipantId}
        onSelectParticipant={onSelectParticipant}
        onReconnectMedia={onReconnectMedia}
      />
      <main className="meet-meet-board-shell">
        {board}
      </main>
      <ParticipantColumn
        side="right"
        participants={columns.right}
        selectedParticipantId={selectedParticipantId}
        onSelectParticipant={onSelectParticipant}
        onReconnectMedia={onReconnectMedia}
      />
    </div>
  )
}
