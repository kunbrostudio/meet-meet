import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ChatMessage } from '../../types/chat'
import type { GamePhase } from '../../types/game'
import { GameBoardHeader } from './GameBoardHeader'
import { GameChatPanel } from './GameChatPanel'

type GameBoardProps = {
  phase?: GamePhase
  statusText?: string
  chatMessages: ChatMessage[]
  localParticipantId?: number
  onSendChatMessage: (message: string) => void | Promise<void>
  canSendChatMessage?: boolean
  chatSendMessage?: string
  screenShareSlot?: ReactNode
  countdownStartedAt?: string
  countdownDurationMs?: number
  attackEndsAt?: string
  attackDurationMs?: number
  roundNumber?: number
  attackerName?: string
  localGameRole?: 'attacker' | 'defender'
  readyStatusText?: string
  isLocalReady?: boolean
  canToggleReady?: boolean
  isHost?: boolean
  canStartGame?: boolean
  canRequestAttackStart?: boolean
  onToggleReady?: () => void
  onStartGame?: () => void
  onRequestAttackStart?: () => void
}

export function GameBoard({
  phase = 'waiting',
  statusText,
  chatMessages,
  localParticipantId,
  onSendChatMessage,
  canSendChatMessage,
  chatSendMessage,
  screenShareSlot,
  countdownStartedAt,
  countdownDurationMs = 3000,
  attackEndsAt,
  attackDurationMs = 30000,
  roundNumber,
  attackerName,
  localGameRole,
  readyStatusText,
  isLocalReady = false,
  canToggleReady = false,
  isHost = false,
  canStartGame = false,
  canRequestAttackStart = false,
  onToggleReady,
  onStartGame,
  onRequestAttackStart,
}: GameBoardProps) {
  const isCountdown = phase === 'countdown'
  const isAttackActive = phase === 'attack-active'
  const [countdownNow, setCountdownNow] = useState(() => Date.now())
  const [attackNow, setAttackNow] = useState(() => Date.now())
  const countdownStartedAtMs = useMemo(
    () => (
      countdownStartedAt
        ? Date.parse(countdownStartedAt)
        : Number.NaN
    ),
    [countdownStartedAt],
  )
  const countdownElapsedMs =
    Number.isFinite(countdownStartedAtMs)
      ? Math.max(0, countdownNow - countdownStartedAtMs)
      : 0
  const countdownStep = Math.min(
    3,
    Math.floor(countdownElapsedMs / 1000),
  )
  const countdownLabel =
    countdownElapsedMs >= countdownDurationMs
      ? 'GAME START!'
      : String(Math.max(1, 3 - countdownStep))
  const attackEndsAtMs = useMemo(
    () => (
      attackEndsAt
        ? Date.parse(attackEndsAt)
        : Number.NaN
    ),
    [attackEndsAt],
  )
  const attackRemainingMs =
    Number.isFinite(attackEndsAtMs)
      ? Math.max(0, attackEndsAtMs - attackNow)
      : attackDurationMs
  const attackRemainingSeconds = Math.ceil(attackRemainingMs / 1000)
  const attackDurationSeconds = Math.ceil(attackDurationMs / 1000)
  const attackTimeLabel =
    `00:${String(Math.min(attackDurationSeconds, attackRemainingSeconds)).padStart(2, '0')}`
  const attackProgress =
    attackDurationMs > 0
      ? Math.max(0, Math.min(1, attackRemainingMs / attackDurationMs))
      : 0

  useEffect(() => {
    if (!isCountdown || !countdownStartedAt) {
      return
    }

    let animationFrameId = 0
    const tick = () => {
      setCountdownNow(Date.now())
      animationFrameId = window.requestAnimationFrame(tick)
    }

    tick()

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [countdownStartedAt, isCountdown])

  useEffect(() => {
    if (!isAttackActive || !attackEndsAt) {
      return
    }

    let animationFrameId = 0
    const tick = () => {
      setAttackNow(Date.now())
      animationFrameId = window.requestAnimationFrame(tick)
    }

    tick()

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [attackEndsAt, isAttackActive])

  return (
    <section className="game-board" aria-label="GAME BOARD">
      <GameBoardHeader phase={phase} statusText={statusText} />
      <div className="game-board-ready-panel">
        {isCountdown ? (
          <div className="game-countdown-panel" aria-live="polite">
            <span key={countdownLabel}>{countdownLabel}</span>
          </div>
        ) : phase === 'game-started' ? (
          <div className="game-started-panel" aria-live="polite">
            <strong>게임 준비 완료</strong>
            <p>다음 단계에서 첫 공격자를 정합니다.</p>
          </div>
        ) : phase === 'role-reveal' ? (
          <div className="game-role-reveal-panel" aria-live="polite">
            <p>이번 공격자는</p>
            <strong>{attackerName ?? '공격자'}</strong>
            {localGameRole === 'attacker' ? (
              <span>당신이 공격자입니다. 친구들을 웃길 준비를 하세요.</span>
            ) : (
              <span>웃음을 참으세요. 공격자가 준비하고 있습니다.</span>
            )}
          </div>
        ) : phase === 'attack-ready' ? (
          <div className="game-attack-ready-panel" aria-live="polite">
            {localGameRole === 'attacker' ? (
              <>
                <strong>공격할 준비가 되었나요?</strong>
                <p>준비가 끝나면 공격을 시작하세요.</p>
                <button
                  type="button"
                  className="game-attack-start-button"
                  onClick={onRequestAttackStart}
                  disabled={!canRequestAttackStart}
                >
                  공격 시작
                </button>
              </>
            ) : (
              <>
                <strong>공격자가 콘텐츠를 준비하고 있습니다.</strong>
                <p>잠시 기다려 주세요.</p>
              </>
            )}
          </div>
        ) : phase === 'attack-active' ? (
          <div className="game-attack-active-panel" aria-live="polite">
            <div className="game-attack-meta">
              <span>ROUND {roundNumber ?? 1}</span>
              <span>공격 중</span>
            </div>
            <strong>공격 시간</strong>
            <span className="game-attack-timer">{attackTimeLabel}</span>
            <div
              className="game-attack-progress"
              aria-hidden="true"
            >
              <i style={{ transform: `scaleX(${attackProgress})` }} />
            </div>
            <p>{attackerName ?? '공격자'}님의 턴입니다.</p>
            {localGameRole === 'attacker' ? (
              <span>친구들을 웃겨 보세요! 공격 진행 중</span>
            ) : (
              <span>웃음을 참으세요! 공격을 버티는 중</span>
            )}
            <div className="game-attack-content-placeholder">
              공격 콘텐츠가 여기에 표시됩니다.
            </div>
          </div>
        ) : phase === 'attack-ended' ? (
          <div className="game-attack-ended-panel" aria-live="polite">
            <strong>공격이 종료되었습니다.</strong>
            <p>다음 단계에서 결과를 판정합니다.</p>
          </div>
        ) : (
          <>
            <div className="game-ready-count" aria-live="polite">
              {readyStatusText}
            </div>
            <div className="game-ready-actions">
              <button
                type="button"
                className={[
                  'game-ready-button',
                  isLocalReady ? 'is-ready' : '',
                ].filter(Boolean).join(' ')}
                onClick={onToggleReady}
                disabled={!canToggleReady}
              >
                {isLocalReady ? '준비 완료' : '준비하기'}
              </button>
              {isHost && (
                <button
                  type="button"
                  className="game-start-button"
                  onClick={onStartGame}
                  disabled={!canStartGame}
                >
                  GAME START
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {screenShareSlot && (
        <div className="game-board-screen-share">
          {screenShareSlot}
        </div>
      )}
      <GameChatPanel
        messages={chatMessages}
        localParticipantId={localParticipantId}
        onSendMessage={onSendChatMessage}
        canSendMessage={canSendChatMessage}
        sendMessage={chatSendMessage}
      />
    </section>
  )
}
