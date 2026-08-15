import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, MouseEvent, ReactNode, RefObject } from 'react'
import meetingCollaboration from '../assets/landing/meeting-collaboration.jpg'
import { Icon } from '../components/common/Icon'
import {
  FairPlayDetector,
  type FairPlayCheckUiState,
} from '../services/fairPlayDetectorService'
import { parseRoomCodeFromUrl } from '../services/roomService'
import { fetchTotalPlayers } from '../services/statsService'
import type { LocalMediaState, MediaDeviceSelection, MeetingPreferences } from '../types'

type LandingPageProps = {
  localMedia: LocalMediaState
  deviceSelection: MediaDeviceSelection
  initialPreferences: MeetingPreferences
  onLocalMediaChange: (media: LocalMediaState) => void
  onDeviceSelectionChange: (selection: MediaDeviceSelection) => void
  onCreateRoom: (preferences: MeetingPreferences, roomName: string) => string | null | Promise<string | null>
  onJoinRoom: (code: string, preferences: MeetingPreferences) => string | null | Promise<string | null>
}

type MainMediaMode = 'intro' | 'camera'

type DemoPlayer = {
  name: string
  lives: number
  role: string
  accent: 'cyan' | 'magenta' | 'violet' | 'green'
  imageSrc: string
}

type DevicePermissionStatus = 'idle' | 'requesting' | 'ready' | 'blocked' | 'not-found' | 'error'
type CalibrationStatus =
  | 'idle'
  | 'checking'
  | 'passed'
  | 'quick-check-required'
  | 'failed'
type CalibrationMode = 'full' | 'quick'

type GameReadyCalibrationState = {
  status: CalibrationStatus
  mode: CalibrationMode
  cameraPassed: boolean
  facePassed: boolean
  mouthPassed: boolean
  smilePassed: boolean
  message: string
  deviceId?: string
  trackId?: string
  calibratedAt?: string
}

type FloatingTooltipPosition = {
  left: number
  top: number
  arrowLeft: number
}

type GameReadyStatusItem = {
  label: string
  icon: 'camera' | 'users' | 'message' | 'smile'
  passed: boolean
  active: boolean
}

type DemoGame = {
  title: string
  subtitle: string
  players: string
  status: string
  accent: 'cyan' | 'magenta' | 'violet'
}

const demoPlayers: DemoPlayer[] = [
  {
    name: 'MAYA',
    lives: 3,
    role: 'ATTACKER',
    accent: 'magenta',
    imageSrc: '/images/demo-players/maya.png',
  },
  {
    name: 'LIAM',
    lives: 2,
    role: 'DEFENDER',
    accent: 'cyan',
    imageSrc: '/images/demo-players/liam.png',
  },
  {
    name: 'ZOE',
    lives: 3,
    role: 'DEFENDER',
    accent: 'violet',
    imageSrc: '/images/demo-players/zoe.png',
  },
  {
    name: 'NOAH',
    lives: 2,
    role: 'WAITING',
    accent: 'green',
    imageSrc: '/images/demo-players/noah.png',
  },
]

const demoGames: DemoGame[] = [
  {
    title: "DON'T LAUGH!",
    subtitle: '웃으면 탈락!',
    players: '3 / 4',
    status: 'DEMO',
    accent: 'magenta',
  },
  {
    title: 'SHHH!',
    subtitle: '소리 내면 탈락!',
    players: '2 / 4',
    status: 'COMING',
    accent: 'cyan',
  },
  {
    title: 'PHOTO ATTACK',
    subtitle: '이미지 공격 준비 중',
    players: '1 / 4',
    status: 'COMING',
    accent: 'violet',
  },
  {
    title: 'FACE OFF',
    subtitle: '표정으로 버티기',
    players: '0 / 4',
    status: 'COMING',
    accent: 'cyan',
  },
]

const introLore = [
  '밋밋의 로비에 입장하면 평범한 화상방은 잠시 꺼지고, 친구들의 표정과 웃음소리가 게임의 룰이 됩니다.',
  '첫 번째 대표 게임은 웃참 공격전입니다. 공격자는 준비한 이미지와 카메라 액션으로 모두를 웃기고, 방어자는 끝까지 표정을 지키며 버팁니다.',
  '규칙은 단순합니다. 웃으면 Life가 줄고, 끝까지 버틴 사람이 방의 분위기를 차지합니다. 하지만 실제 라운드는 생각보다 훨씬 시끄럽고, 어이없고, 억울합니다.',
  '카메라와 마이크는 게임을 위한 컨트롤러입니다. 버튼보다 표정이 빠르고, 채팅보다 리액션이 먼저 도착합니다.',
  '지금 보이는 플레이어 카드는 실제 접속자가 아니라 아케이드 로비 데모입니다. 친구를 초대하고 방을 만들면 진짜 게임은 화상방 안에서 시작됩니다.',
  '오늘의 방은 기록으로 남지 않아도 괜찮습니다. 대신 누가 먼저 웃었는지, 누가 끝까지 참았는지는 모두가 기억하게 됩니다.',
  '방을 만들고, 코드를 보내고, 카메라를 켜세요. 별거 없는 게임처럼 시작해서 별일 다 생기는 방이 됩니다.',
]

const nicknameStorageKey = 'meet-meet:last-player-name'
const gameReadyCalibrationStorageKey = 'meet-meet:game-ready-calibration'
const createGateTooltipWidth = 300
const createGateTooltipMargin = 14

const initialCalibrationState: GameReadyCalibrationState = {
  status: 'idle',
  mode: 'full',
  cameraPassed: false,
  facePassed: false,
  mouthPassed: false,
  smilePassed: false,
  message: 'Complete the quick check before creating or joining a room.',
}

type StoredGameReadyCalibration = {
  deviceId: string
  fullCalibrationPassed: boolean
  calibratedAt: string
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getCreateGateTooltipPosition(button: HTMLButtonElement): FloatingTooltipPosition {
  const rect = button.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const buttonCenter = rect.left + rect.width / 2
  const maxLeft = Math.max(createGateTooltipMargin, viewportWidth - createGateTooltipWidth - createGateTooltipMargin)
  const left = clampNumber(
    buttonCenter - createGateTooltipWidth / 2,
    createGateTooltipMargin,
    maxLeft,
  )

  return {
    left,
    top: Math.max(createGateTooltipMargin, rect.top - 12),
    arrowLeft: clampNumber(buttonCenter - left, 24, createGateTooltipWidth - 24),
  }
}

function getStoredPlayerName(fallbackName: string) {
  try {
    return localStorage.getItem(nicknameStorageKey) || fallbackName
  } catch {
    return fallbackName
  }
}

function savePlayerName(name: string) {
  try {
    localStorage.setItem(nicknameStorageKey, name)
  } catch {
    // Nickname persistence is a small convenience only.
  }
}

function loadStoredGameReadyCalibration(): StoredGameReadyCalibration | null {
  try {
    const rawCalibration = sessionStorage.getItem(gameReadyCalibrationStorageKey)

    if (!rawCalibration) {
      return null
    }

    const calibration = JSON.parse(rawCalibration) as Partial<StoredGameReadyCalibration>

    if (
      typeof calibration.deviceId !== 'string'
      || !calibration.deviceId
      || calibration.fullCalibrationPassed !== true
      || typeof calibration.calibratedAt !== 'string'
    ) {
      return null
    }

    return {
      deviceId: calibration.deviceId,
      fullCalibrationPassed: true,
      calibratedAt: calibration.calibratedAt,
    }
  } catch {
    return null
  }
}

function saveStoredGameReadyCalibration(deviceId: string) {
  try {
    sessionStorage.setItem(
      gameReadyCalibrationStorageKey,
      JSON.stringify({
        deviceId,
        fullCalibrationPassed: true,
        calibratedAt: new Date().toISOString(),
      } satisfies StoredGameReadyCalibration),
    )
  } catch {
    // Calibration persistence is session-only convenience.
  }
}

function getVideoDeviceId(stream: MediaStream | null) {
  return stream?.getVideoTracks()[0]?.getSettings().deviceId ?? ''
}

function getVideoTrackId(stream: MediaStream | null) {
  return stream?.getVideoTracks()[0]?.id ?? ''
}

function mapCheckStateToCalibration(
  checkState: FairPlayCheckUiState,
  mode: CalibrationMode,
  current: GameReadyCalibrationState,
): GameReadyCalibrationState {
  const facePassed =
    checkState.step === 'mouth-open'
    || checkState.step === 'smile'
    || checkState.step === 'passed'
  const mouthPassed =
    mode === 'quick'
    || checkState.step === 'smile'
    || checkState.step === 'passed'
  const smilePassed =
    mode === 'quick'
    || checkState.step === 'passed'

  return {
    ...current,
    status: checkState.passed ? 'passed' : 'checking',
    cameraPassed: true,
    facePassed,
    mouthPassed,
    smilePassed,
    message: checkState.passed
      ? '게임을 시작할 준비가 되었어요.'
      : checkState.message,
  }
}

function isTrackReady(track: MediaStreamTrack | undefined) {
  return Boolean(track && track.readyState === 'live' && track.enabled)
}

function getGameReadyStepStatus(item: GameReadyStatusItem) {
  if (item.passed) {
    return 'PASS'
  }

  if (item.active) {
    return 'CHECK'
  }

  return 'WAIT'
}

function getGameReadyDisplayCopy(calibration: GameReadyCalibrationState) {
  if (calibration.status === 'passed') {
    return {
      message: "You're ready to play.",
      detail: 'You can now create or join a room.',
    }
  }

  if (calibration.status === 'idle' || calibration.status === 'quick-check-required') {
    return {
      message: 'Complete the quick check before creating or joining a room.',
      detail: 'Use your camera so MEET MEET can confirm your face.',
    }
  }

  if (!calibration.facePassed) {
    return {
      message: 'Keep your face in the camera.',
      detail: 'Center your face in the preview and hold still for a moment.',
    }
  }

  if (!calibration.mouthPassed) {
    return {
      message: 'Open your mouth once.',
      detail: 'This helps the game check that your expression is visible.',
    }
  }

  if (!calibration.smilePassed) {
    return {
      message: 'Give us a smile!',
      detail: 'Hold a clear smile until the check completes.',
    }
  }

  return {
    message: 'Keep looking at the camera.',
    detail: 'The game ready check is almost done.',
  }
}

function hasReadyVideo(stream: MediaStream | null) {
  return isTrackReady(stream?.getVideoTracks()[0])
}

function hasReadyAudio(stream: MediaStream | null) {
  return isTrackReady(stream?.getAudioTracks()[0])
}

function mergeMediaStreams(
  currentStream: MediaStream | null,
  nextStream: MediaStream,
  kind: 'audio' | 'video',
) {
  const preservedTracks = currentStream
    ?.getTracks()
    .filter((track) => track.kind !== kind)
    ?? []
  const nextTracks = kind === 'video'
    ? nextStream.getVideoTracks()
    : nextStream.getAudioTracks()

  currentStream
    ?.getTracks()
    .filter((track) => track.kind === kind)
    .forEach((track) => track.stop())

  nextStream
    .getTracks()
    .filter((track) => track.kind !== kind)
    .forEach((track) => track.stop())

  return new MediaStream([...preservedTracks, ...nextTracks])
}

async function requestDeviceStream(kind: 'audio' | 'video') {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Media devices are not supported in this browser.')
  }

  return navigator.mediaDevices.getUserMedia({
    video: kind === 'video'
      ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        }
      : false,
    audio: kind === 'audio',
  })
}

function getDeviceErrorStatus(error: unknown): DevicePermissionStatus {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'blocked'
    }

    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'not-found'
    }
  }

  return 'error'
}

function getDeviceStatusLabel(status: DevicePermissionStatus) {
  if (status === 'idle') {
    return 'OFF'
  }

  if (status === 'requesting') {
    return 'CHECK'
  }

  if (status === 'not-found') {
    return 'NO DEVICE'
  }

  return status.toUpperCase()
}

function renderLives(lives: number) {
  return Array.from({ length: 3 }, (_, index) => (
    <span key={index}>{index < lives ? '♥' : '♡'}</span>
  ))
}

function formatTotalPlayers(totalPlayers: number | null) {
  return totalPlayers === null ? '------' : totalPlayers.toString().padStart(6, '0')
}

function LandingArcadeHeader({ totalPlayers }: { totalPlayers: number | null }) {
  return (
    <header className="landing-arcade-header">
      <div className="landing-brand-chip" aria-label="MEET MEET">
        <span className="landing-brand-symbol">MM</span>
        <strong>MEET! MEET!</strong>
      </div>

      <div className="landing-online-hud" aria-label="Total players visited">
        <span>TOTAL PLAYERS</span>
        <strong>{formatTotalPlayers(totalPlayers)}</strong>
      </div>

      <div className="landing-profile-hud">
        <button type="button" className="landing-audio-button" aria-label="오디오 설정">
          <Icon name="headphones" size={16} />
        </button>
        <div className="landing-profile-avatar" aria-hidden="true">K</div>
        <span>PLAYER</span>
        <Icon name="chevron-down" size={14} />
      </div>
    </header>
  )
}

function LandingDemoPlayerCard({ player }: { player: DemoPlayer }) {
  return (
    <article className={`landing-demo-card is-${player.accent}`}>
      <div className="landing-demo-card-top">
        <strong>{player.name}</strong>
        <span>{player.role}</span>
      </div>
      <div className="landing-demo-screen">
        <div className="landing-demo-character">
          <img
            src={player.imageSrc}
            alt={`${player.name} demo character`}
            loading="eager"
            onError={(event) => {
              event.currentTarget.hidden = true
            }}
          />
          <b aria-hidden="true">{player.name.slice(0, 1)}</b>
        </div>
      </div>
      <div className="landing-demo-card-bottom">
        <span className="landing-demo-lives">{renderLives(player.lives)}</span>
        <span className="landing-demo-signal">▰▰▱</span>
      </div>
    </article>
  )
}

function LandingIntroPanel({
  mediaMode,
  cameraReady,
  micReady,
  calibration,
  videoRef,
  onShowIntro,
  onShowCamera,
}: {
  mediaMode: MainMediaMode
  cameraReady: boolean
  micReady: boolean
  calibration: GameReadyCalibrationState
  videoRef: RefObject<HTMLVideoElement | null>
  onShowIntro: () => void
  onShowCamera: () => void
}) {
  const isChecking = calibration.status === 'checking'
  const isPassed = calibration.status === 'passed'
  const hasDeviceConnection = cameraReady || micReady
  const showCameraOffPreview = hasDeviceConnection && !cameraReady
  const heroVisualMode =
    showCameraOffPreview ? 'camera-off' : mediaMode
  const gameReadyItems: GameReadyStatusItem[] = [
    {
      label: 'CAMERA',
      icon: 'camera',
      passed: calibration.cameraPassed,
      active: isChecking && !calibration.cameraPassed,
    },
    {
      label: 'FACE',
      icon: 'users',
      passed: calibration.facePassed,
      active: isChecking && calibration.cameraPassed && !calibration.facePassed,
    },
    {
      label: 'MOUTH',
      icon: 'message',
      passed: calibration.mouthPassed,
      active: isChecking && calibration.facePassed && !calibration.mouthPassed,
    },
    {
      label: 'SMILE',
      icon: 'smile',
      passed: calibration.smilePassed,
      active: isChecking && calibration.mouthPassed && !calibration.smilePassed,
    },
  ]
  const { message: readyMessage, detail: readyDetail } = getGameReadyDisplayCopy(calibration)

  return (
    <div className="landing-board-panel landing-intro-panel">
      {!hasDeviceConnection && (
        <div className="landing-title-block">
          <span>RETRO VIDEO PLAYGROUND</span>
          <h1>MEET MEET</h1>
        </div>
      )}

      <figure className={`landing-hero-visual is-${heroVisualMode}`}>
        {mediaMode === 'camera' && cameraReady ? (
          <video
            ref={videoRef}
            className="landing-camera-preview"
            autoPlay
            muted
            playsInline
          />
        ) : showCameraOffPreview ? (
          <div className="landing-camera-off-preview" role="img" aria-label="Camera is off">
            <span aria-hidden="true">
              <Icon name="video-off" size={42} />
            </span>
            <strong>Camera is off</strong>
            <p>Turn on CAMERA before creating or joining a room.</p>
          </div>
        ) : (
          <>
            <img
              src={meetingCollaboration}
              alt="친구들이 함께 게임을 즐기는 데모 장면"
            />
            <div className="landing-video-play-indicator" aria-hidden="true">
              <span />
            </div>
          </>
        )}
        <div className="landing-media-hud" aria-label="Device readiness">
          <span className={cameraReady ? 'is-ready' : ''}>
            CAMERA {cameraReady ? 'READY' : 'OFF'}
          </span>
          <span className={micReady ? 'is-ready' : ''}>
            MIC {micReady ? 'READY' : 'OFF'}
          </span>
          <span className={calibration.status === 'passed' ? 'is-ready' : ''}>
            GAME READY {calibration.status === 'passed' ? '✓' : 'CHECK'}
          </span>
        </div>
        <div className="landing-media-switch">
          {mediaMode === 'camera' ? (
            <button type="button" onClick={onShowIntro}>
              <Icon name="screen" size={12} /> INTRO
            </button>
          ) : cameraReady ? (
            <button type="button" onClick={onShowCamera}>
              <Icon name="video" size={12} /> CAMERA
            </button>
          ) : null}
        </div>
      </figure>

      <div
        className={[
          'landing-intro-copy',
          hasDeviceConnection ? 'has-device-state' : '',
          cameraReady ? 'has-game-ready-check' : '',
        ].filter(Boolean).join(' ')}
      >
        {cameraReady ? (
          <div
            className={[
              'landing-game-ready-check',
              isPassed ? 'is-passed' : '',
            ].filter(Boolean).join(' ')}
            aria-live="polite"
          >
            <div className="landing-game-ready-head">
              <p>GAME READY CHECK</p>
              <strong>{isPassed ? 'GAME READY ✓' : 'CHECKING'}</strong>
            </div>
            <div className="landing-game-ready-steps">
              {gameReadyItems.map((item) => {
                const status = getGameReadyStepStatus(item)

                return (
                  <span
                    className={[
                      'landing-game-ready-step',
                      item.passed ? 'is-passed' : '',
                      item.active ? 'is-active' : '',
                    ].filter(Boolean).join(' ')}
                    key={item.label}
                  >
                    <span className="landing-game-ready-step-label">
                      <Icon name={item.icon} size={18} />
                      <span>{item.label}</span>
                    </span>
                    <strong className="landing-game-ready-step-status">
                      {item.passed && <Icon name="check" size={13} />}
                      {status}
                    </strong>
                  </span>
                )
              })}
            </div>
            <div className="landing-game-ready-message">
              <strong>{readyMessage}</strong>
              <span>{readyDetail}</span>
            </div>
          </div>
        ) : hasDeviceConnection ? (
          <div className="landing-camera-required-panel" aria-live="polite">
            <p>DEVICE READY</p>
            <strong>Audio is connected.</strong>
            <span>Turn on CAMERA to start the Game Ready Check.</span>
          </div>
        ) : (
          <>
            <strong>DON'T JUST CHAT. PLAY.</strong>
            <div
              className="landing-lore-scroll"
              tabIndex={0}
              aria-label="MEET MEET 게임 소개"
            >
              <div className="landing-lore-track">
                {introLore.concat(introLore.slice(0, 3)).map((line, index) => (
                  <p key={`${line}-${index}`}>{line}</p>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function LandingGamesPanel() {
  return (
    <div className="landing-board-panel landing-games-panel">
      <div className="landing-games-heading">
        <span>PUBLIC GAME ROOMS</span>
        <p>Demo list only. 실제 공개 방 매칭은 아직 연결되지 않았습니다.</p>
      </div>

      <div className="landing-games-list" role="list">
        {demoGames.map((game) => (
          <article className="landing-game-row" role="listitem" key={game.title}>
            <div className={`landing-game-thumb is-${game.accent}`} aria-hidden="true">
              <span>{game.title.slice(0, 2)}</span>
            </div>
            <div className="landing-game-info">
              <strong>{game.title}</strong>
              <span>{game.subtitle}</span>
            </div>
            <div className="landing-game-count">{game.players}</div>
            <div className="landing-game-status">{game.status}</div>
            <button type="button" disabled>
              JOIN
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}

function LandingGameBoard({
  activeTab,
  onTabChange,
  children,
}: {
  activeTab: 'intro' | 'games'
  onTabChange: (tab: 'intro' | 'games') => void
  children: ReactNode
}) {
  return (
    <section className="landing-main-board" aria-label="MEET MEET arcade board">
      <div className="landing-board-tabs" role="tablist" aria-label="Lobby sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'intro'}
          className={activeTab === 'intro' ? 'is-active' : ''}
          onClick={() => onTabChange('intro')}
        >
          Intro
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'games'}
          className={activeTab === 'games' ? 'is-active' : ''}
          onClick={() => onTabChange('games')}
        >
          Games
        </button>
      </div>
      {activeTab === 'intro' ? children : <LandingGamesPanel />}
    </section>
  )
}

function LandingControlBar({
  cameraReady,
  micReady,
  activeCoachmark,
  onCamera,
  onAudio,
  onOpenJoin,
  onOpenCreate,
  isCameraGateActive,
  cameraGateFeedbackToken,
  cameraGateMessage,
  cameraGateDetail,
  cameraGateTooltipPosition,
}: {
  cameraReady: boolean
  micReady: boolean
  activeCoachmark: 'camera' | 'audio' | null
  onCamera: () => void | Promise<void>
  onAudio: () => void | Promise<void>
  onOpenJoin: (event: MouseEvent<HTMLButtonElement>) => void
  onOpenCreate: (event: MouseEvent<HTMLButtonElement>) => void
  isCameraGateActive: boolean
  cameraGateFeedbackToken: number
  cameraGateMessage: string
  cameraGateDetail: string
  cameraGateTooltipPosition: FloatingTooltipPosition | null
}) {
  const tooltipStyle = cameraGateTooltipPosition
    ? ({
        left: `${cameraGateTooltipPosition.left}px`,
        top: `${cameraGateTooltipPosition.top}px`,
        '--tooltip-arrow-left': `${cameraGateTooltipPosition.arrowLeft}px`,
      } as CSSProperties)
    : undefined

  return (
    <>
      <nav className="landing-control-bar" aria-label="Lobby controls">
        <button
          key={`camera-${cameraGateFeedbackToken}`}
          type="button"
          className={`${cameraReady ? 'is-ready' : ''} ${activeCoachmark === 'camera' ? 'is-coached' : ''} ${isCameraGateActive ? 'is-gated' : ''}`}
          onClick={onCamera}
        >
          <Icon name="video" size={16} />
          <span>CAMERA</span>
        </button>
        <button
          key={`audio-${cameraGateFeedbackToken}`}
          type="button"
          className={`${micReady ? 'is-ready' : ''} ${activeCoachmark === 'audio' ? 'is-coached' : ''} ${isCameraGateActive ? 'is-gated-secondary' : ''}`}
          onClick={onAudio}
        >
          <Icon name="mic" size={16} />
          <span>AUDIO</span>
        </button>
        <button type="button" onClick={onOpenJoin}>
          <Icon name="link" size={16} />
          <span>JOIN CODE</span>
        </button>
        <button type="button" className="is-create" onClick={onOpenCreate}>
          <span aria-hidden="true">+</span>
          <strong>CREATE ROOM</strong>
        </button>
        {activeCoachmark && (
          <div className={`landing-device-coachmark is-${activeCoachmark}`} role="status">
            {activeCoachmark === 'camera' ? '카메라를 연결하세요' : '마이크를 연결하세요'}
          </div>
        )}
      </nav>
      {cameraGateMessage && tooltipStyle && (
        <div
          key={`gate-message-${cameraGateFeedbackToken}`}
          className="landing-camera-gate-notice"
          role="status"
          style={tooltipStyle}
        >
          <strong>{cameraGateMessage}</strong>
          {cameraGateDetail && <span>{cameraGateDetail}</span>}
        </div>
      )}
    </>
  )
}

export function LandingPage({
  localMedia,
  deviceSelection,
  initialPreferences,
  onLocalMediaChange,
  onDeviceSelectionChange,
  onCreateRoom,
  onJoinRoom,
}: LandingPageProps) {
  const [activeTab, setActiveTab] = useState<'intro' | 'games'>('intro')
  const [code, setCode] = useState(() => parseRoomCodeFromUrl() ?? '')
  const [codeError, setCodeError] = useState('')
  const [isJoinOpen, setIsJoinOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [totalPlayers, setTotalPlayers] = useState<number | null>(null)
  const [mediaMode, setMediaMode] = useState<MainMediaMode>('intro')
  const [playerName, setPlayerName] = useState(() => (
    getStoredPlayerName(initialPreferences.displayName)
  ))
  const [roomName, setRoomName] = useState('MEET MEET Room')
  const [participantCount, setParticipantCount] = useState(
    Math.min(4, Math.max(2, initialPreferences.participantCount ?? 2)),
  )
  const [lifeCount, setLifeCount] = useState<1 | 3 | 5>(
    initialPreferences.initialLives ?? 3,
  )
  const [attackTimeSeconds, setAttackTimeSeconds] = useState<15 | 30>(30)
  const [cameraStatus, setCameraStatus] = useState<DevicePermissionStatus>('idle')
  const [micStatus, setMicStatus] = useState<DevicePermissionStatus>('idle')
  const [manualCameraOff, setManualCameraOff] = useState(false)
  const [manualMicOff, setManualMicOff] = useState(false)
  const [mediaError, setMediaError] = useState('')
  const [createRoomError, setCreateRoomError] = useState('')
  const [isSubmittingRoom, setIsSubmittingRoom] = useState(false)
  const [cameraGateMessage, setCameraGateMessage] = useState('')
  const [cameraGateDetail, setCameraGateDetail] = useState('')
  const [cameraGateRequiresAudio, setCameraGateRequiresAudio] = useState(false)
  const [cameraGateFeedbackToken, setCameraGateFeedbackToken] = useState(0)
  const [cameraGateTooltipPosition, setCameraGateTooltipPosition] =
    useState<FloatingTooltipPosition | null>(null)
  const [calibration, setCalibration] =
    useState<GameReadyCalibrationState>(initialCalibrationState)
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const calibrationDetectorRef = useRef<FairPlayDetector | null>(null)
  const calibrationSessionKeyRef = useRef('')
  const cameraRestoreAttemptedRef = useRef(false)
  const cameraSessionRestoreInProgressRef = useRef(false)
  const cameraReady = hasReadyVideo(localMedia.stream)
  const micReady = hasReadyAudio(localMedia.stream)
  const isGameReady = cameraReady && calibration.status === 'passed'
  const isDeviceGateSatisfied =
    isGameReady && (!cameraGateRequiresAudio || micReady)
  const visibleCameraGateMessage = isDeviceGateSatisfied ? '' : cameraGateMessage
  const isCameraGateActive = Boolean(visibleCameraGateMessage)
  const activeCoachmark = !cameraReady
    ? (manualCameraOff ? null : 'camera')
    : !micReady
      ? (manualMicOff ? null : 'audio')
      : null

  useEffect(() => {
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = localMedia.stream
      if (localMedia.stream) {
        void cameraVideoRef.current.play().catch(() => undefined)
      }
    }
  }, [activeTab, localMedia.stream, mediaMode])

  useEffect(() => {
    if (cameraRestoreAttemptedRef.current || !cameraReady) {
      return
    }

    cameraRestoreAttemptedRef.current = true
    const deviceId = getVideoDeviceId(localMedia.stream)
    const trackId = getVideoTrackId(localMedia.stream)
    const storedCalibration = loadStoredGameReadyCalibration()
    cameraSessionRestoreInProgressRef.current =
      storedCalibration?.deviceId === deviceId
    const timer = window.setTimeout(() => {
      setMediaMode('camera')

      if (storedCalibration?.deviceId !== deviceId) {
        cameraSessionRestoreInProgressRef.current = false
        return
      }

      setCalibration({
        status: 'passed',
        mode: 'full',
        cameraPassed: true,
        facePassed: true,
        mouthPassed: true,
        smilePassed: true,
        message: '게임을 시작할 준비가 되었어요.',
        deviceId,
        trackId,
        calibratedAt: storedCalibration.calibratedAt,
      })

      if (import.meta.env.DEV) {
        console.info('[camera-session] restored', {
          device: deviceId,
          calibrationStatus: 'passed',
        })
      }
      cameraSessionRestoreInProgressRef.current = false
    }, 0)

    return () => window.clearTimeout(timer)
  }, [cameraReady, localMedia.stream])

  useEffect(() => {
    if (!cameraReady) {
      calibrationDetectorRef.current?.stop()
      calibrationSessionKeyRef.current = ''
      const timer = window.setTimeout(() => {
        setCalibration((current) => ({
          ...initialCalibrationState,
          status: current.status === 'passed' ? 'quick-check-required' : 'idle',
          message: '카메라를 다시 연결하면 GAME READY CHECK를 확인합니다.',
        }))
      }, 0)
      return () => window.clearTimeout(timer)
    }

    if (mediaMode !== 'camera') {
      return
    }

    const video = cameraVideoRef.current
    const videoTrack = localMedia.stream?.getVideoTracks()[0]
    const deviceId = getVideoDeviceId(localMedia.stream)
    const trackId = getVideoTrackId(localMedia.stream)

    if (!video || !videoTrack || videoTrack.readyState !== 'live') {
      if (import.meta.env.DEV) {
        console.info('[calibration-not-started]', {
          reason: !video ? 'no-video-element' : 'track-not-live',
          device: deviceId,
        })
      }
      return
    }

    const storedCalibration = loadStoredGameReadyCalibration()
    const mode: CalibrationMode =
      storedCalibration?.deviceId === deviceId
        ? 'quick'
        : 'full'
    const sessionKey = [deviceId || 'unknown-device', trackId, mode].join(':')

    if (
      cameraSessionRestoreInProgressRef.current
      && calibration.status === 'idle'
      && storedCalibration?.deviceId === deviceId
    ) {
      return
    }

    if (
      calibration.status === 'passed'
      && calibration.deviceId === deviceId
      && calibration.trackId === trackId
    ) {
      return
    }

    if (
      calibration.status === 'checking'
      && calibrationSessionKeyRef.current === sessionKey
    ) {
      return
    }

    let cancelled = false

    const startCalibration = () => {
      if (cancelled || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return
      }

      void calibrationDetectorRef.current?.close()
      calibrationDetectorRef.current = new FairPlayDetector(video, {
        onCheckState: (checkState) => {
          setCalibration((current) => (
            mapCheckStateToCalibration(checkState, mode, current)
          ))
          if (import.meta.env.DEV) {
            const stagePayload =
              checkState.step === 'passed'
                ? { status: 'passed' }
                : { step: checkState.step }
            console.info('[calibration-stage]', stagePayload)
          }
        },
        onCheckResult: (result) => {
          if (!result.passed) {
            setCalibration((current) => ({
              ...current,
              status: 'failed',
              message: 'GAME READY CHECK를 다시 진행해 주세요.',
            }))
            return
          }

          if (mode === 'full' && deviceId) {
            saveStoredGameReadyCalibration(deviceId)
          }

          const calibratedAt = new Date().toISOString()
          setCalibration((current) => ({
            ...current,
            status: 'passed',
            cameraPassed: true,
            facePassed: true,
            mouthPassed: true,
            smilePassed: true,
            message: '게임을 시작할 준비가 되었어요.',
            calibratedAt,
          }))
          if (import.meta.env.DEV) {
            console.info('[calibration]', {
              status: 'passed',
              mode,
              device: deviceId,
              calibratedAt,
            })
          }
        },
      })
      calibrationSessionKeyRef.current = sessionKey
      setCalibration({
        status: 'checking',
        mode,
        cameraPassed: true,
        facePassed: false,
        mouthPassed: mode === 'quick',
        smilePassed: mode === 'quick',
        message: mode === 'quick'
          ? '카메라 정면을 잠깐 봐주세요.'
          : '게임을 시작하기 전에 카메라와 표정을 빠르게 확인할게요.',
        deviceId,
        trackId,
      })

      if (import.meta.env.DEV) {
        console.info('[calibration]', { mode, device: deviceId })
        console.info('[calibration-stage]', { camera: 'pass' })
      }

      void calibrationDetectorRef.current.startFaceCheck({ mode }).catch((error) => {
        console.warn('[calibration] Failed to start game ready check', error)
        setCalibration((current) => ({
          ...current,
          status: 'failed',
          message: 'GAME READY CHECK를 시작하지 못했습니다.',
        }))
      })
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      startCalibration()
    } else {
      video.addEventListener('loadeddata', startCalibration, { once: true })
      video.addEventListener('canplay', startCalibration, { once: true })
    }

    return () => {
      cancelled = true
      video.removeEventListener('loadeddata', startCalibration)
      video.removeEventListener('canplay', startCalibration)
    }
  }, [
    calibration.deviceId,
    calibration.status,
    calibration.trackId,
    cameraReady,
    localMedia.stream,
    mediaMode,
  ])

  useEffect(() => {
    if (!cameraGateMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setCameraGateMessage('')
      setCameraGateDetail('')
      setCameraGateRequiresAudio(false)
      setCameraGateTooltipPosition(null)
    }, 3000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [cameraGateMessage, cameraGateFeedbackToken])

  useEffect(() => {
    let isActive = true

    fetchTotalPlayers()
      .then((nextTotalPlayers) => {
        if (isActive) {
          setTotalPlayers(nextTotalPlayers)
        }
      })
      .catch((error) => {
        console.warn('[landing] Failed to load total player count', error)
      })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!isCreateOpen && !isJoinOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isCreateOpen, isJoinOpen])

  useEffect(() => () => {
    void calibrationDetectorRef.current?.close()
  }, [])

  const stopCamera = () => {
    const currentStream = localMedia.stream
    currentStream?.getVideoTracks().forEach((track) => track.stop())
    cameraSessionRestoreInProgressRef.current = false
    const audioTracks = currentStream?.getAudioTracks() ?? []
    const nextStream = audioTracks.length > 0 ? new MediaStream(audioTracks) : null

    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null
    }

    onLocalMediaChange({
      stream: nextStream,
      cameraEnabled: false,
      microphoneEnabled: micReady,
    })
    setCameraStatus('idle')
    setCameraGateMessage('')
    setCameraGateTooltipPosition(null)
    setManualCameraOff(true)
    setMediaMode('intro')
    if (import.meta.env.DEV) {
      console.info('[camera-session] user-stop')
    }
  }

  const startCamera = async () => {
    setCameraStatus('requesting')
    setMediaError('')

    try {
      const nextStream = await requestDeviceStream('video')
      const mergedStream = mergeMediaStreams(localMedia.stream, nextStream, 'video')
      const videoDeviceId = mergedStream.getVideoTracks()[0]?.getSettings().deviceId ?? ''
      onDeviceSelectionChange({
        ...deviceSelection,
        videoDeviceId,
      })
      onLocalMediaChange({
        stream: mergedStream,
        cameraEnabled: true,
        microphoneEnabled: localMedia.microphoneEnabled,
      })
      setCameraStatus('ready')
      setCameraGateMessage('')
      setCameraGateTooltipPosition(null)
      setManualCameraOff(false)
      setMediaMode('camera')
      if (import.meta.env.DEV) {
        console.info('[camera-session] created')
      }
      return true
    } catch (error) {
      const nextStatus = getDeviceErrorStatus(error)
      setCameraStatus(nextStatus)
      setMediaError(
        nextStatus === 'blocked'
          ? '카메라 권한이 필요합니다. 브라우저 권한 설정을 확인해 주세요.'
          : nextStatus === 'not-found'
            ? '사용 가능한 카메라를 찾지 못했습니다.'
            : '카메라를 연결하지 못했습니다.',
      )
      return false
    }
  }

  const toggleCamera = async () => {
    if (cameraReady) {
      stopCamera()
      return
    }

    await startCamera()
  }

  const connectAudio = async () => {
    if (micReady) {
      const currentStream = localMedia.stream
      currentStream?.getAudioTracks().forEach((track) => track.stop())
      const videoTracks = currentStream?.getVideoTracks() ?? []
      const nextStream = videoTracks.length > 0 ? new MediaStream(videoTracks) : null

      onLocalMediaChange({
        stream: nextStream,
        cameraEnabled: cameraReady,
        microphoneEnabled: false,
      })
      setMicStatus('idle')
      setManualMicOff(true)
      return
    }

    setMicStatus('requesting')
    setMediaError('')

    try {
      const nextStream = await requestDeviceStream('audio')
      const mergedStream = mergeMediaStreams(localMedia.stream, nextStream, 'audio')
      const audioDeviceId = mergedStream.getAudioTracks()[0]?.getSettings().deviceId ?? ''
      onDeviceSelectionChange({
        ...deviceSelection,
        audioDeviceId,
      })
      onLocalMediaChange({
        stream: mergedStream,
        cameraEnabled: cameraReady,
        microphoneEnabled: true,
      })
      setMicStatus('ready')
      setManualMicOff(false)
    } catch (error) {
      const nextStatus = getDeviceErrorStatus(error)
      setMicStatus(nextStatus)
      setMediaError(
        nextStatus === 'blocked'
          ? '마이크 권한이 필요합니다. 브라우저 권한 설정을 확인해 주세요.'
          : nextStatus === 'not-found'
            ? '사용 가능한 마이크를 찾지 못했습니다.'
            : '마이크를 연결하지 못했습니다.',
      )
    }
  }

  const openCreateRoom = (event: MouseEvent<HTMLButtonElement>) => {
    setCreateRoomError('')
    setCodeError('')

    if (import.meta.env.DEV) {
      console.info('[room-create] clicked')
      console.info('[room-create] local validation', {
        cameraReady,
        micReady,
        calibrationStatus: calibration.status,
        canOpenCreateModal: isGameReady,
      })
    }

    if (isGameReady) {
      setCameraGateMessage('')
      setCameraGateDetail('')
      setCameraGateRequiresAudio(false)
      setCameraGateTooltipPosition(null)
      setIsCreateOpen(true)
      return
    }

    setCameraGateTooltipPosition(getCreateGateTooltipPosition(event.currentTarget))
    setCameraGateMessage(
      cameraReady
        ? 'GAME READY CHECK를 먼저 완료해주세요.'
        : '왼쪽 CAMERA 버튼을 눌러 카메라를 연결하세요.',
    )
    setCameraGateDetail(
      cameraReady
        ? '완료 후 방 만들기가 가능해요.'
        : '연결 후 방 만들기가 가능해요.',
    )
    setCameraGateRequiresAudio(false)
    setCameraGateFeedbackToken((currentToken) => currentToken + 1)
  }

  const openJoinCode = (event: MouseEvent<HTMLButtonElement>) => {
    setCodeError('')

    if (isGameReady && micReady) {
      setCameraGateMessage('')
      setCameraGateDetail('')
      setCameraGateRequiresAudio(false)
      setCameraGateTooltipPosition(null)
      setIsJoinOpen(true)
      return
    }

    setCameraGateTooltipPosition(getCreateGateTooltipPosition(event.currentTarget))
    setCameraGateMessage(
      !cameraReady
        ? '카메라와 오디오를 먼저 연결해 주세요.'
        : calibration.status !== 'passed'
          ? 'GAME READY CHECK를 먼저 완료해주세요.'
          : '오디오를 먼저 연결해 주세요.',
    )
    setCameraGateDetail('완료 후 코드 입장이 가능해요.')
    setCameraGateRequiresAudio(true)
    setCameraGateFeedbackToken((currentToken) => currentToken + 1)
  }

  const createPreferences = (nextParticipantCount = participantCount): MeetingPreferences => ({
    displayName: playerName.trim() || initialPreferences.displayName || 'Ken Choi',
    sourceLanguage: 'ko',
    targetLanguage: 'ko',
    participantCount: nextParticipantCount,
    initialLives: lifeCount,
    autoStartCaption: false,
  })

  const ensureReadyToEnter = () => {
    if (!cameraReady) {
      return '게임방에 참여하려면 카메라를 연결해 주세요.'
    }

    if (calibration.status !== 'passed') {
      return '게임방에 참여하려면 GAME READY CHECK를 완료해 주세요.'
    }

    if (!micReady) {
      return '게임방에 참여하려면 오디오를 연결해 주세요.'
    }

    return null
  }

  const ensureReadyToCreateRoom = () => {
    if (!cameraReady) {
      return '카메라 연결이 필요합니다.'
    }

    if (calibration.status !== 'passed') {
      return 'GAME READY CHECK를 먼저 완료해주세요.'
    }

    return null
  }

  const submitCreateRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const readinessError = ensureReadyToCreateRoom()

    if (readinessError) {
      setCreateRoomError(readinessError)
      return
    }

    setIsSubmittingRoom(true)
    setCodeError('')
    setCreateRoomError('')

    try {
      const nextPreferences = createPreferences()

      if (import.meta.env.DEV) {
        console.info('[room-create] request started', {
          participantName: nextPreferences.displayName,
          cameraReady,
          micReady,
          calibrationStatus: calibration.status,
        })
      }

      savePlayerName(nextPreferences.displayName)
      const error = await onCreateRoom(nextPreferences, roomName.trim() || 'MEET MEET Room')
      if (error) {
        setCreateRoomError(error)
        return
      }
      setIsCreateOpen(false)
    } finally {
      setIsSubmittingRoom(false)
    }
  }

  const joinMeeting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!code.trim()) {
      setCodeError('방 코드를 입력해주세요.')
      return
    }

    const readinessError = ensureReadyToEnter()

    if (readinessError) {
      setCodeError(readinessError)
      setCameraGateMessage(readinessError)
      setCameraGateDetail('연결 후 코드 입장이 가능해요.')
      setCameraGateRequiresAudio(true)
      setCameraGateTooltipPosition(null)
      return
    }

    setCameraGateMessage('')
    setCameraGateDetail('')
    setCameraGateRequiresAudio(false)
    setCameraGateTooltipPosition(null)
    setIsSubmittingRoom(true)

    try {
      const nextPreferences = createPreferences()
      savePlayerName(nextPreferences.displayName)
      const error = await onJoinRoom(code, nextPreferences)
      setCodeError(error ?? '')
    } finally {
      setIsSubmittingRoom(false)
    }
  }

  return (
    <section className="landing-arcade">
      <div className="landing-space-layer" aria-hidden="true" />
      <div className="landing-grid-layer" aria-hidden="true" />

      <div className="landing-shell">
        <LandingArcadeHeader totalPlayers={totalPlayers} />

        <div className="landing-scroll-region">
          <div className="landing-stage">
            <aside className="landing-demo-column" aria-label="Demo players left">
              {demoPlayers.slice(0, 2).map((player) => (
                <LandingDemoPlayerCard player={player} key={player.name} />
              ))}
            </aside>

            <LandingGameBoard activeTab={activeTab} onTabChange={setActiveTab}>
              <LandingIntroPanel
                mediaMode={mediaMode}
                cameraReady={cameraReady}
                micReady={micReady}
                calibration={calibration}
                videoRef={cameraVideoRef}
                onShowIntro={() => setMediaMode('intro')}
                onShowCamera={() => setMediaMode('camera')}
              />
            </LandingGameBoard>

            <aside className="landing-demo-column" aria-label="Demo players right">
              {demoPlayers.slice(2).map((player) => (
                <LandingDemoPlayerCard player={player} key={player.name} />
              ))}
            </aside>
          </div>

          <div className="landing-mobile-carousel" aria-label="Demo player carousel">
            {demoPlayers.map((player) => (
              <LandingDemoPlayerCard player={player} key={player.name} />
            ))}
          </div>
          <div className="landing-carousel-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <LandingControlBar
          cameraReady={cameraReady}
          micReady={micReady}
          activeCoachmark={activeCoachmark}
          onCamera={toggleCamera}
          onAudio={connectAudio}
          onOpenJoin={openJoinCode}
          onOpenCreate={openCreateRoom}
          isCameraGateActive={isCameraGateActive}
          cameraGateFeedbackToken={cameraGateFeedbackToken}
          cameraGateMessage={visibleCameraGateMessage}
          cameraGateDetail={cameraGateDetail}
          cameraGateTooltipPosition={cameraGateTooltipPosition}
        />
      </div>

      {isCreateOpen && (
        <div className="landing-join-backdrop" role="presentation">
          <div className="landing-join-panel landing-room-modal" role="dialog" aria-modal="true" aria-labelledby="landing-create-title">
            <div className="landing-join-content landing-create-content">
              <div className="landing-modal-header">
                <span>CREATE ROOM</span>
                <div className="landing-join-title-row">
                  <h2 id="landing-create-title">CREATE ROOM</h2>
                  <button
                    className="landing-join-close"
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    aria-label="닫기"
                  >
                    ×
                  </button>
                </div>
              </div>
              <form className="landing-create-form" onSubmit={submitCreateRoom}>
                <div className="landing-modal-scroll-body">
                  <label htmlFor="landing-room-name">Room name</label>
                  <input
                    id="landing-room-name"
                    value={roomName}
                    onChange={(event) => setRoomName(event.target.value)}
                    placeholder="MEET MEET Room"
                  />
                  <label htmlFor="landing-create-player-name">Player name</label>
                  <input
                    id="landing-create-player-name"
                    value={playerName}
                    onChange={(event) => setPlayerName(event.target.value)}
                    placeholder="PLAYER"
                  />
                  <label htmlFor="landing-game-select">Game</label>
                  <select id="landing-game-select" value="laugh" disabled>
                    <option value="laugh">DON'T LAUGH!</option>
                  </select>
                  <div className="landing-modal-option-group" aria-label="Players">
                    <span>PLAYERS</span>
                    {[2, 3, 4].map((count) => (
                      <button
                        type="button"
                        className={participantCount === count ? 'is-selected' : ''}
                        onClick={() => setParticipantCount(count)}
                        key={count}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                  <div className="landing-modal-option-group" aria-label="Life">
                    <span>LIFE</span>
                    {[1, 3, 5].map((count) => (
                      <button
                        type="button"
                        className={lifeCount === count ? 'is-selected' : ''}
                        onClick={() => setLifeCount(count as 1 | 3 | 5)}
                        key={count}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                  <div className="landing-modal-option-group" aria-label="Attack time">
                    <span>ATTACK TIME</span>
                    {[15, 30].map((seconds) => (
                      <button
                        type="button"
                        className={attackTimeSeconds === seconds ? 'is-selected' : ''}
                        onClick={() => setAttackTimeSeconds(seconds as 15 | 30)}
                        key={seconds}
                      >
                        {seconds}s
                      </button>
                    ))}
                  </div>
                  <div className="landing-device-readiness">
                    <span className={cameraReady ? 'is-ready' : ''}>CAMERA {cameraReady ? 'READY' : getDeviceStatusLabel(cameraStatus)}</span>
                    <span className={micReady ? 'is-ready' : ''}>MIC {micReady ? 'READY' : getDeviceStatusLabel(micStatus)}</span>
                    <span className={calibration.status === 'passed' ? 'is-ready' : ''}>GAME READY {calibration.status === 'passed' ? '✓' : 'CHECK'}</span>
                  </div>
                </div>
                <div className="landing-modal-footer">
                  {createRoomError && <p role="alert">{createRoomError}</p>}
                  <button type="submit" disabled={isSubmittingRoom}>
                    {isSubmittingRoom ? '생성 중...' : 'CREATE ROOM'} <Icon name="arrow-right" size={15} />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isJoinOpen && (
        <div className="landing-join-backdrop" role="presentation">
          <div className="landing-join-panel" role="dialog" aria-modal="true" aria-labelledby="landing-join-title">
            <div className="landing-join-content">
              <span>ENTER ROOM CODE</span>
              <div className="landing-join-title-row">
                <h2 id="landing-join-title">JOIN CODE</h2>
                <button
                  className="landing-join-close"
                  type="button"
                  onClick={() => setIsJoinOpen(false)}
                  aria-label="코드 입장 닫기"
                >
                  ×
                </button>
              </div>
              <form onSubmit={joinMeeting}>
                <label htmlFor="landing-room-code">Room code</label>
                <input
                  id="landing-room-code"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.toUpperCase())
                    setCodeError('')
                  }}
                  placeholder="MMT-XXXXXX"
                  aria-invalid={Boolean(codeError)}
                  autoFocus
                />
                <label htmlFor="landing-join-player-name">Player name</label>
                <input
                  id="landing-join-player-name"
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  placeholder="PLAYER"
                />
                <div className="landing-device-readiness">
                  <span className={cameraReady ? 'is-ready' : ''}>CAMERA {cameraReady ? 'READY' : getDeviceStatusLabel(cameraStatus)}</span>
                  <span className={micReady ? 'is-ready' : ''}>MIC {micReady ? 'READY' : getDeviceStatusLabel(micStatus)}</span>
                  <span className={calibration.status === 'passed' ? 'is-ready' : ''}>GAME READY {calibration.status === 'passed' ? '✓' : 'CHECK'}</span>
                </div>
                {codeError && <p role="alert">{codeError}</p>}
                {mediaError && !codeError && <p role="alert">{mediaError}</p>}
                <button type="submit" disabled={isSubmittingRoom}>
                  {isSubmittingRoom ? '입장 중...' : 'JOIN ROOM'} <Icon name="arrow-right" size={15} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
