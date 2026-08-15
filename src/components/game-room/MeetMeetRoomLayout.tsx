import type { ReactNode } from 'react'
import type { GamePlayerState } from '../../types/game'
import type { Participant } from '../../types/participant'
import { ParticipantColumn } from './ParticipantColumn'
import { splitParticipantsForGameRoom } from './participantLayout'

type MeetMeetRoomLayoutProps = {
  participants: Participant[]
  board: ReactNode
  selectedParticipantId?: number
  readyParticipantIdentities?: string[]
  attackerIdentity?: string
  defenderIdentities?: string[]
  isAttackActive?: boolean
  playerStates?: Record<string, GamePlayerState>
  maxLives?: number
  fairPlayWarningParticipantIdentity?: string
  onSelectParticipant?: (participantId: number) => void
  onReconnectMedia?: () => void
}

export function MeetMeetRoomLayout({
  participants,
  board,
  selectedParticipantId,
  readyParticipantIdentities,
  attackerIdentity,
  defenderIdentities,
  isAttackActive,
  playerStates,
  maxLives = 3,
  fairPlayWarningParticipantIdentity,
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
        readyParticipantIdentities={readyParticipantIdentities}
        attackerIdentity={attackerIdentity}
        defenderIdentities={defenderIdentities}
        isAttackActive={isAttackActive}
        playerStates={playerStates}
        maxLives={maxLives}
        fairPlayWarningParticipantIdentity={fairPlayWarningParticipantIdentity}
        onSelectParticipant={onSelectParticipant}
        onReconnectMedia={onReconnectMedia}
      />
      <main className="meet-meet-board-shell">
        {board}
      </main>
      <div className="mobile-player-rail">
        <ParticipantColumn
          side="mobile"
          participants={participants.slice(0, 4)}
          selectedParticipantId={selectedParticipantId}
          readyParticipantIdentities={readyParticipantIdentities}
          attackerIdentity={attackerIdentity}
          defenderIdentities={defenderIdentities}
          isAttackActive={isAttackActive}
          playerStates={playerStates}
          maxLives={maxLives}
          fairPlayWarningParticipantIdentity={fairPlayWarningParticipantIdentity}
          onSelectParticipant={onSelectParticipant}
          onReconnectMedia={onReconnectMedia}
        />
      </div>
      <ParticipantColumn
        side="right"
        participants={columns.right}
        selectedParticipantId={selectedParticipantId}
        readyParticipantIdentities={readyParticipantIdentities}
        attackerIdentity={attackerIdentity}
        defenderIdentities={defenderIdentities}
        isAttackActive={isAttackActive}
        playerStates={playerStates}
        maxLives={maxLives}
        fairPlayWarningParticipantIdentity={fairPlayWarningParticipantIdentity}
        onSelectParticipant={onSelectParticipant}
        onReconnectMedia={onReconnectMedia}
      />
    </div>
  )
}
