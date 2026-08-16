import { useEffect, useMemo, useState } from 'react'
import type { GamePhase, GamePlayerState } from '../../types/game'
import type { Participant } from '../../types/participant'
import { getParticipantGameIdentity } from '../../services/gameStateService'
import { ParticipantGameCard } from './ParticipantGameCard'

type PlayerGalleryProps = {
  participants: Participant[]
  maxParticipants?: number
  phase: GamePhase
  roundNumber?: number
  countdownStartedAt?: string
  countdownDurationMs?: number
  attackEndsAt?: string
  selectedParticipantId?: number
  readyParticipantIdentities?: string[]
  attackerIdentity?: string
  defenderIdentities?: string[]
  isAttackActive?: boolean
  playerStates?: Record<string, GamePlayerState>
  maxLives?: number
  fairPlayWarningParticipantIdentity?: string
  fairPlayWarningMessage?: string
  onSelectParticipant?: (participantId: number) => void
  onReconnectMedia?: () => void
  onReturnToGame?: () => void
}

const PHASE_LABELS: Record<GamePhase, string> = {
  waiting: 'WAITING',
  ready: 'READY',
  'auto-start-pending': 'ROOM FULL',
  'fair-play-check': 'FAIR CHECK',
  countdown: 'COUNTDOWN',
  'game-started': 'GAME ACTIVE',
  'role-reveal': 'ROLE REVEAL',
  'attack-ready': 'ATTACK READY',
  'attack-active': 'ATTACK',
  'attack-ended': 'ATTACK ENDED',
  'round-result': 'ROUND RESULT',
  'round-ended': 'ROUND READY',
  'game-over': 'GAME OVER',
  'post-game': 'NEXT GAME',
  'attack-prep': 'ATTACK PREP',
  attacking: 'ATTACK',
  'turn-result': 'TURN RESULT',
  'game-result': 'GAME RESULT',
}

function formatRemainingTime(attackEndsAt: string | undefined, now: number) {
  if (!attackEndsAt) {
    return ''
  }

  const endsAtMs = Date.parse(attackEndsAt)

  if (!Number.isFinite(endsAtMs)) {
    return ''
  }

  const remainingSeconds = Math.max(0, Math.ceil((endsAtMs - now) / 1000))
  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatElapsedCountdown(
  countdownStartedAt: string | undefined,
  countdownDurationMs: number | undefined,
  now: number,
) {
  if (!countdownStartedAt) {
    return ''
  }

  const startedAtMs = Date.parse(countdownStartedAt)

  if (!Number.isFinite(startedAtMs)) {
    return ''
  }

  const durationMs = countdownDurationMs ?? 3000
  const remainingSeconds = Math.max(
    0,
    Math.ceil((startedAtMs + durationMs - now) / 1000),
  )

  return `00:${String(remainingSeconds).padStart(2, '0')}`
}

export function PlayerGallery({
  participants,
  maxParticipants = 4,
  phase,
  roundNumber,
  countdownStartedAt,
  countdownDurationMs,
  attackEndsAt,
  selectedParticipantId,
  readyParticipantIdentities = [],
  attackerIdentity,
  defenderIdentities = [],
  isAttackActive = false,
  playerStates,
  maxLives = 3,
  fairPlayWarningParticipantIdentity,
  fairPlayWarningMessage,
  onSelectParticipant,
  onReconnectMedia,
  onReturnToGame,
}: PlayerGalleryProps) {
  const [now, setNow] = useState(() => Date.now())
  const readyIdentitySet = useMemo(
    () => new Set(readyParticipantIdentities),
    [readyParticipantIdentities],
  )
  const defenderIdentitySet = useMemo(
    () => new Set(defenderIdentities),
    [defenderIdentities],
  )
  const phaseLabel = PHASE_LABELS[phase]
  const remainingTime = phase === 'attack-active'
    ? formatRemainingTime(attackEndsAt, now)
    : phase === 'auto-start-pending' || phase === 'countdown'
      ? formatElapsedCountdown(countdownStartedAt, countdownDurationMs, now)
    : ''
  const statusText = [
    roundNumber ? `ROUND ${String(roundNumber).padStart(2, '0')}` : '',
    phaseLabel,
    remainingTime,
  ].filter(Boolean).join(' · ')

  useEffect(() => {
    if (
      !(
        (phase === 'attack-active' && attackEndsAt)
        || (
          (phase === 'auto-start-pending' || phase === 'countdown')
          && countdownStartedAt
        )
      )
    ) {
      return
    }

    let animationFrameId = 0
    const tick = () => {
      setNow(Date.now())
      animationFrameId = window.requestAnimationFrame(tick)
    }

    tick()

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [attackEndsAt, countdownStartedAt, phase])

  return (
    <section
      className="player-gallery"
      data-count={Math.min(participants.length, maxParticipants)}
      aria-label="Player Gallery"
    >
      <header className="player-gallery-header">
        <div>
          <span>PLAYER GALLERY</span>
          <strong>{participants.length} / {maxParticipants} CONNECTED</strong>
        </div>
        <div className="player-gallery-status">
          <span>{statusText}</span>
          {onReturnToGame && (
            <button type="button" onClick={onReturnToGame}>
              GAME BOARD
            </button>
          )}
        </div>
      </header>
      <div className="player-gallery-grid">
        {participants.slice(0, maxParticipants).map((participant) => {
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
              fairPlayWarningMessage={
                participantIdentity === fairPlayWarningParticipantIdentity
                  ? fairPlayWarningMessage
                  : undefined
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
        })}
      </div>
    </section>
  )
}
