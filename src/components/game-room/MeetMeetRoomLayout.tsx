import type { ReactNode } from 'react'
import type { Participant } from '../../types/participant'
import { ParticipantColumn } from './ParticipantColumn'
import { splitParticipantsForGameRoom } from './participantLayout'

type MeetMeetRoomLayoutProps = {
  participants: Participant[]
  board: ReactNode
  selectedParticipantId?: number
  onSelectParticipant?: (participantId: number) => void
  onReconnectMedia?: () => void
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
