import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ChatMessage } from '../../types/chat'
import type { GameAttackContent, GamePhase } from '../../types/game'
import {
  ATTACK_CONTENT_ACCEPT,
  downloadAttackContentBlob,
  getAttackContentErrorMessage,
} from '../../services/attackContentService'
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
  attackContent?: GameAttackContent | null
  roundNumber?: number
  attackerName?: string
  localGameRole?: 'attacker' | 'defender'
  readyStatusText?: string
  isLocalReady?: boolean
  canToggleReady?: boolean
  isHost?: boolean
  canStartGame?: boolean
  canRequestAttackStart?: boolean
  isUploadingAttackContent?: boolean
  attackContentMessage?: string
  onToggleReady?: () => void
  onStartGame?: () => void
  onUploadAttackContent?: (file: File) => void | Promise<void>
  onRequestAttackStart?: () => void
}

type AttackImageState =
  | { status: 'idle'; url?: undefined; message?: undefined }
  | { status: 'loading'; url?: undefined; message?: undefined }
  | { status: 'ready'; url: string; message?: undefined }
  | { status: 'error'; url?: undefined; message: string }

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
  attackContent,
  roundNumber,
  attackerName,
  localGameRole,
  readyStatusText,
  isLocalReady = false,
  canToggleReady = false,
  isHost = false,
  canStartGame = false,
  canRequestAttackStart = false,
  isUploadingAttackContent = false,
  attackContentMessage,
  onToggleReady,
  onStartGame,
  onUploadAttackContent,
  onRequestAttackStart,
}: GameBoardProps) {
  const isCountdown = phase === 'countdown'
  const isAttackActive = phase === 'attack-active'
  const [countdownNow, setCountdownNow] = useState(() => Date.now())
  const [attackNow, setAttackNow] = useState(() => Date.now())
  const [localPreview, setLocalPreview] = useState<{
    url: string
    name: string
  } | null>(null)
  const [attackImageState, setAttackImageState] =
    useState<AttackImageState>({ status: 'idle' })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const localPreviewUrlRef = useRef<string | null>(null)
  const attackImageUrlRef = useRef<string | null>(null)
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
  const attackContentKey =
    attackContent
      ? `${attackContent.contentId}:${attackContent.version}`
      : ''

  const handleAttackFile = (file: File | undefined) => {
    if (!file || !onUploadAttackContent || isUploadingAttackContent) {
      return
    }

    if (localPreviewUrlRef.current) {
      window.URL.revokeObjectURL(localPreviewUrlRef.current)
    }

    const previewUrl = window.URL.createObjectURL(file)
    localPreviewUrlRef.current = previewUrl
    setLocalPreview({
      url: previewUrl,
      name: file.name,
    })
    void onUploadAttackContent(file)
  }

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

  useEffect(() => {
    let cancelled = false

    const loadAttackContent = async () => {
      if (attackImageUrlRef.current) {
        window.URL.revokeObjectURL(attackImageUrlRef.current)
        attackImageUrlRef.current = null
      }

      if (!attackContent) {
        setAttackImageState({ status: 'idle' })
        return
      }

      setAttackImageState({ status: 'loading' })

      try {
        const blob = await downloadAttackContentBlob(attackContent.contentId)

        if (cancelled) {
          return
        }

        const imageUrl = window.URL.createObjectURL(blob)
        attackImageUrlRef.current = imageUrl
        setAttackImageState({ status: 'ready', url: imageUrl })
      } catch (error) {
        if (cancelled) {
          return
        }

        setAttackImageState({
          status: 'error',
          message: error instanceof Error
            ? error.message
            : getAttackContentErrorMessage('ATTACK_CONTENT_DOWNLOAD_FAILED'),
        })
      }
    }

    void loadAttackContent()

    return () => {
      cancelled = true
    }
  }, [attackContent, attackContentKey])

  useEffect(() => {
    if (phase === 'attack-ready') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      if (localPreviewUrlRef.current) {
        window.URL.revokeObjectURL(localPreviewUrlRef.current)
        localPreviewUrlRef.current = null
      }

      setLocalPreview(null)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [phase])

  useEffect(() => (
    () => {
      if (localPreviewUrlRef.current) {
        window.URL.revokeObjectURL(localPreviewUrlRef.current)
      }

      if (attackImageUrlRef.current) {
        window.URL.revokeObjectURL(attackImageUrlRef.current)
      }
    }
  ), [])

  const renderApprovedAttackImage = () => {
    if (!attackContent) {
      return (
        <div className="game-attack-content-placeholder">
          공격 이미지가 준비되면 여기에 표시됩니다.
        </div>
      )
    }

    if (attackImageState.status === 'ready') {
      return (
        <figure className="game-attack-image-frame">
          <img
            src={attackImageState.url}
            alt="공격 이미지"
            draggable={false}
          />
        </figure>
      )
    }

    return (
      <div className="game-attack-content-placeholder">
        {attackImageState.status === 'error'
          ? attackImageState.message
          : '공격 이미지를 불러오는 중입니다.'}
      </div>
    )
  }

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
                <strong>공격 이미지를 준비하세요.</strong>
                <p>JPEG, PNG, WebP 이미지를 최대 3MB까지 사용할 수 있습니다.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ATTACK_CONTENT_ACCEPT}
                  className="game-attack-file-input"
                  onChange={(event) => {
                    handleAttackFile(event.currentTarget.files?.[0])
                    event.currentTarget.value = ''
                  }}
                />
                <div
                  className="game-attack-upload-zone"
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    handleAttackFile(event.dataTransfer.files[0])
                  }}
                  aria-disabled={isUploadingAttackContent}
                >
                  <span>
                    {isUploadingAttackContent ? '업로드 중...' : '이미지 선택 또는 드롭'}
                  </span>
                </div>
                {localPreview && !attackContent && (
                  <figure className="game-attack-local-preview">
                    <img src={localPreview.url} alt="" draggable={false} />
                    <figcaption>{localPreview.name}</figcaption>
                  </figure>
                )}
                {attackContentMessage && (
                  <p className="game-attack-upload-message">
                    {attackContentMessage}
                  </p>
                )}
                {attackContent && (
                  <p className="game-attack-content-ready">공격 이미지 준비 완료</p>
                )}
                {renderApprovedAttackImage()}
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
                <p>공격자가 이미지를 준비하고 있습니다.</p>
                {renderApprovedAttackImage()}
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
            {renderApprovedAttackImage()}
          </div>
        ) : phase === 'attack-ended' ? (
          <div className="game-attack-ended-panel" aria-live="polite">
            <strong>공격 종료</strong>
            <p>이번 공격이 끝났습니다.</p>
            {renderApprovedAttackImage()}
          </div>
        ) : phase === 'round-ended' ? (
          <div className="game-attack-ended-panel" aria-live="polite">
            <strong>다음 라운드 준비 중</strong>
            <p>
              다음 공격자는 {attackerName ?? '공격자'}님입니다.
            </p>
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
