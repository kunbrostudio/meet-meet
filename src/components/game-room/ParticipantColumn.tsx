import type { Participant } from '../../types/participant'
import { getParticipantGameIdentity } from '../../services/gameStateService'
import { ParticipantGameCard } from './ParticipantGameCard'

type ParticipantColumnProps = {
  side: 'left' | 'right'
  participants: Participant[]
  selectedParticipantId?: number
  readyParticipantIdentities?: string[]
  attackerIdentity?: string
  defenderIdentities?: string[]
  isAttackActive?: boolean
  onSelectParticipant?: (participantId: number) => void
  onReconnectMedia?: () => void
}

export function ParticipantColumn({
  side,
  participants,
  selectedParticipantId,
  readyParticipantIdentities = [],
  attackerIdentity,
  defenderIdentities = [],
  isAttackActive = false,
  onSelectParticipant,
  onReconnectMedia,
}: ParticipantColumnProps) {
  const readyIdentitySet = new Set(readyParticipantIdentities)
  const defenderIdentitySet = new Set(defenderIdentities)

  return (
    <aside
      className={`participant-column is-${side}`}
      data-count={participants.length}
      aria-label={side === 'left' ? '왼쪽 참가자 영역' : '오른쪽 참가자 영역'}
    >
      {participants.length === 0 ? (
        <div className="participant-waiting-slot">친구를 기다리는 중</div>
      ) : participants.map((participant) => (
        (() => {
          const participantIdentity = getParticipantGameIdentity(participant)
          const gameRole =
            participantIdentity === attackerIdentity
              ? 'attacker'
              : defenderIdentitySet.has(participantIdentity)
                ? 'defender'
                : undefined

          return (
            <ParticipantGameCard
              participant={participant}
              selected={participant.id === selectedParticipantId}
              isReady={readyIdentitySet.has(participantIdentity)}
              gameRole={gameRole}
              isAttackActive={isAttackActive}
              onSelect={
                onSelectParticipant
                  ? () => onSelectParticipant(participant.id)
                  : undefined
              }
              onReconnectMedia={onReconnectMedia}
              key={participant.liveKitIdentity ?? participant.id}
            />
          )
        })()
      ))}
    </aside>
  )
}
