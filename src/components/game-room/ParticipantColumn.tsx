import type { Participant } from '../../types/participant'
import type { GamePlayerState } from '../../types/game'
import { getParticipantGameIdentity } from '../../services/gameStateService'
import { ParticipantGameCard } from './ParticipantGameCard'

type ParticipantColumnProps = {
  side: 'left' | 'right' | 'mobile'
  participants: Participant[]
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

export function ParticipantColumn({
  side,
  participants,
  selectedParticipantId,
  readyParticipantIdentities = [],
  attackerIdentity,
  defenderIdentities = [],
  isAttackActive = false,
  playerStates,
  maxLives = 3,
  fairPlayWarningParticipantIdentity,
  onSelectParticipant,
  onReconnectMedia,
}: ParticipantColumnProps) {
  const readyIdentitySet = new Set(readyParticipantIdentities)
  const defenderIdentitySet = new Set(defenderIdentities)

  return (
    <aside
      className={`participant-column is-${side}`}
      data-count={participants.length}
      aria-label={
        side === 'left'
          ? '왼쪽 참가자 영역'
          : side === 'right'
            ? '오른쪽 참가자 영역'
            : '모바일 참가자 레일'
      }
    >
      {participants.length === 0 ? (
        <div className="participant-waiting-slot">
          <span>WAITING FOR PLAYER...</span>
        </div>
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
              playerState={playerStates?.[participantIdentity]}
              maxLives={maxLives}
              isFairPlayWarning={
                participantIdentity === fairPlayWarningParticipantIdentity
              }
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
