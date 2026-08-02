import type { Participant } from '../../types/participant'
import { getParticipantGameIdentity } from '../../services/gameStateService'
import { ParticipantGameCard } from './ParticipantGameCard'

type ParticipantColumnProps = {
  side: 'left' | 'right'
  participants: Participant[]
  selectedParticipantId?: number
  readyParticipantIdentities?: string[]
  onSelectParticipant?: (participantId: number) => void
  onReconnectMedia?: () => void
}

export function ParticipantColumn({
  side,
  participants,
  selectedParticipantId,
  readyParticipantIdentities = [],
  onSelectParticipant,
  onReconnectMedia,
}: ParticipantColumnProps) {
  const readyIdentitySet = new Set(readyParticipantIdentities)

  return (
    <aside
      className={`participant-column is-${side}`}
      data-count={participants.length}
      aria-label={side === 'left' ? '왼쪽 참가자 영역' : '오른쪽 참가자 영역'}
    >
      {participants.length === 0 ? (
        <div className="participant-waiting-slot">친구를 기다리는 중</div>
      ) : participants.map((participant) => (
        <ParticipantGameCard
          participant={participant}
          selected={participant.id === selectedParticipantId}
          isReady={readyIdentitySet.has(getParticipantGameIdentity(participant))}
          onSelect={
            onSelectParticipant
              ? () => onSelectParticipant(participant.id)
              : undefined
          }
          onReconnectMedia={onReconnectMedia}
          key={participant.liveKitIdentity ?? participant.id}
        />
      ))}
    </aside>
  )
}
