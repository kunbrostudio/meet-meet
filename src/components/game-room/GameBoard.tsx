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
  readyStatusText?: string
  isLocalReady?: boolean
  canToggleReady?: boolean
  isHost?: boolean
  canStartGame?: boolean
  onToggleReady?: () => void
  onStartGame?: () => void
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
  readyStatusText,
  isLocalReady = false,
  canToggleReady = false,
  isHost = false,
  canStartGame = false,
  onToggleReady,
  onStartGame,
}: GameBoardProps) {
  const isCountdown = phase === 'countdown'
  const [countdownNow, setCountdownNow] = useState(() => Date.now())
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
