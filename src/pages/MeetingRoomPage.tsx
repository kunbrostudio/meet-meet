import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../components/common/Icon'
import { Logo } from '../components/common/Logo'
import { ENABLE_MOCK_DATA } from '../constants/mockData'
import { TRANSLATION_MODE_CONFIG } from '../constants/translationMode'
import {
  AUDIO_LAUGH_TRIGGER_THRESHOLD,
  AUDIO_LAUGH_VERY_HIGH_THRESHOLD,
} from '../constants/fairPlayAudio'
import { GameBoard } from '../components/game-room/GameBoard'
import { MeetMeetRoomLayout } from '../components/game-room/MeetMeetRoomLayout'
import { PlayerGallery } from '../components/game-room/PlayerGallery'
import { ScreenShareCard } from '../components/meeting/ScreenShareCard'
import { ControlBar } from '../components/meeting/ControlBar'
import { EndMeetingModal } from '../components/meeting/EndMeetingModal'
import { MeetingSettingsPanel } from '../components/meeting/MeetingSettingsPanel'
import { RemoveParticipantModal } from '../components/meeting/RemoveParticipantModal'
import type { Participant } from '../types/participant'
import type {
  GameAttackContent,
  GameFairPlayCheckParticipantStatus,
  GameFairPlayCheckState,
  GameFairPlayCheckStatus,
  GameFairPlayEventRequest,
  GamePhase,
  GamePlayerState,
  GameStateSnapshot,
  GameTimelineEvent,
} from '../types/game'
import type {
  LanguageCode,
  SpeechRecognitionLanguage,
  SupportedLanguage,
  Transcript,
} from '../types/transcript'
import type {
  LocalMediaState,
  MediaDeviceSelection,
} from '../types/meeting'
import type {
  TranslationRecord,
  TranslationSourceType,
} from '../types/translation'
import {
  getSpeechRecognitionStatus,
  isSpeechRecognitionSupported,
  startSpeechRecognition,
  stopSpeechRecognition,
} from '../services/speechService'
import { getPendingTranslationText, mockTranscripts } from '../fixtures/mockTranscripts'
import {
  loadMeetingTranscripts,
  saveMeetingTranscripts,
} from '../services/transcriptStorageService'
import {
  dedupeChatMessages,
  dedupeTranscripts,
  loadMeetingSession,
  saveEndedMeetingSessionToHistory,
  saveMeetingSession,
} from '../services/meetingSessionStorageService'
import { copyToClipboard } from '../services/roomService'
import {
  getAudioInputDevices,
  getAudioOutputDevices,
  getVideoInputDevices,
  requestMediaStream,
  toggleTrack,
} from '../services/deviceService'
import {
  createMockRemoteParticipants,
  getParticipantInitials,
  updateParticipantMediaState,
} from '../services/participantService'
import type { MeetingPreferences } from '../types/meeting'
import {
  createChatMessage,
  createSystemMessage,
  loadChatMessages,
  saveChatMessages,
} from '../services/chatService'
import {
  createGameAttackContentSubmitRequest,
  createGameAttackStartRequest,
  createGameReadyChange,
  createGameStateRequest,
  createGameStateSnapshot,
  createTurnOrder,
  DEFAULT_PLAYER_LIVES,
  filterReadyParticipantIdentities,
  getActivePlayerIdentities,
  getDefenderIdentities,
  getGameStateSnapshotKey,
  getParticipantGameIdentity,
  shouldAcceptGameStateSnapshot,
} from '../services/gameStateService'
import {
  fetchAttackContentMetadata,
  getAttackContentErrorMessage,
  uploadAttackContent,
} from '../services/attackContentService'
import {
  FairPlayDetector,
  type FairPlayCheckUiState,
  type FairPlayDebugState,
  type FairPlayWarningState,
} from '../services/fairPlayDetectorService'
import {
  AudioLaughDetector,
  type AudioLaughDebugState,
  type AudioLaughEvent,
} from '../services/audioLaughDetectorService'
import {
  createManualTranslation,
  dedupeTranslations,
  findTranslation,
  getTranslationCacheKey,
  loadTranslations,
  saveTranslations,
  shouldAutoTranslateText,
} from '../services/translationRecordService'
import {
  isScreenShareSupported,
  startScreenShare,
  stopScreenShare,
} from '../services/screenShareService'
import type { CaptionSize } from '../types'
import {
  loadCaptionPreferences,
  saveCaptionPreferences,
} from '../services/captionPreferencesService'
import {
  endFreeBetaRoom,
  leaveFreeBetaRoom,
  removeLiveKitParticipant,
  requestLiveKitToken,
  type LiveKitConnectionDetails,
  type LiveKitDataController,
  type LiveKitMediaController,
  type LiveKitScreenShare,
} from '../services/livekitConnectionService'
import {
  chatMessageToLiveKitPayload,
  liveKitPayloadToChatMessage,
  liveKitPayloadToTranscript,
  transcriptToLiveKitPayload,
  type LiveKitDataMessage,
} from '../services/livekitChatService'

const LiveKitTestRoom = lazy(
  () => import('../components/livekit/LiveKitTestRoom').then(
    (module) => ({ default: module.LiveKitTestRoom }),
  ),
)

const GAME_COUNTDOWN_DURATION_MS = 3000
const GAME_ROLE_REVEAL_DURATION_MS = 2600
const GAME_ATTACK_DURATION_MS = 30_000
const GAME_ATTACK_END_REVIEW_DURATION_MS = 2400
const GAME_TURN_HANDOFF_DURATION_MS = 1700
const GAME_AUTO_READY_DELAY_MS = 15_000
const GAME_AUTO_START_DELAY_MS = 10_000
const FAIR_PLAY_DEBUG_ENABLED = import.meta.env.VITE_FAIR_PLAY_DEBUG === 'true'

function logFairPlayCheckDebug(
  message: string,
  details?: Record<string, unknown>,
) {
  if (!import.meta.env.DEV) {
    return
  }

  console.debug(`[fair-play] ${message}`, details ?? {})
}

function logGameDamageDebug(
  message: string,
  details?: Record<string, unknown>,
) {
  if (!import.meta.env.DEV) {
    return
  }

  console.debug(`[game-damage] ${message}`, details ?? {})
}

function logMatchStartDebug(
  message: string,
  details?: Record<string, unknown>,
) {
  if (!import.meta.env.DEV) {
    return
  }

  console.info(`[match-start] ${message}`, details ?? {})
}

function logAutoStartDebug(
  message: string,
  details?: Record<string, unknown>,
) {
  if (!import.meta.env.DEV) {
    return
  }

  console.info(`[auto-start] ${message}`, details ?? {})
}

function logHostTransferDebug(
  message: string,
  details?: Record<string, unknown>,
) {
  if (!import.meta.env.DEV) {
    return
  }

  console.info(`[host-transfer] ${message}`, details ?? {})
}

function logPostGameDebug(
  message: string,
  details?: Record<string, unknown>,
) {
  if (!import.meta.env.DEV) {
    return
  }

  console.info(`[post-game] ${message}`, details ?? {})
}

function logGameResultDebug(
  message: string,
  details?: Record<string, unknown>,
) {
  if (!import.meta.env.DEV) {
    return
  }

  console.info(`[game-result] ${message}`, details ?? {})
}

function logNextMatchDebug(
  message: string,
  details?: Record<string, unknown>,
) {
  if (!import.meta.env.DEV) {
    return
  }

  console.info(`[next-match] ${message}`, details ?? {})
}

function logLocalParticipantDebug(details: Record<string, unknown>) {
  if (!import.meta.env.DEV) {
    return
  }

  console.info('[local-participant]', details)
}

function logRoomAuthorityDebug(details: Record<string, unknown>) {
  if (!import.meta.env.DEV) {
    return
  }

  console.info('[room-authority]', details)
}

function shouldAcceptServerRoomSnapshot(
  current: GameStateSnapshot,
  incoming: GameStateSnapshot,
): boolean {
  return (
    incoming.meetingId === current.meetingId
    && incoming.roomCode === current.roomCode
    && (
      incoming.revision >= current.revision
      || incoming.phase === 'game-over'
      || incoming.phase === 'post-game'
    )
  )
}

function getSnapshotParticipantIdentities(snapshot: GameStateSnapshot): string[] {
  return snapshot.participants
    .map((participant) => participant.participantIdentity)
    .filter((participantIdentity): participantIdentity is string => (
      typeof participantIdentity === 'string'
    ))
}

function scopePostGameSnapshotToRoster(
  snapshot: GameStateSnapshot,
  previousSnapshot: GameStateSnapshot,
): GameStateSnapshot {
  if (snapshot.phase !== 'post-game') {
    return snapshot
  }

  const rosterIdentities = getSnapshotParticipantIdentities(snapshot)

  if (rosterIdentities.length === 0) {
    return snapshot
  }

  const participantNamesByIdentity = Object.fromEntries(
    snapshot.participants
      .filter((participant) => participant.participantIdentity)
      .map((participant) => [
        participant.participantIdentity as string,
        participant.name,
      ]),
  )

  return {
    ...snapshot,
    activePlayerIdentities: snapshot.activePlayerIdentities
      ?.filter((participantIdentity) => (
        rosterIdentities.includes(participantIdentity)
      )),
    fairPlay: {
      ...snapshot.fairPlay,
      check: createFairPlayCheckState({
        activePlayerIdentities: rosterIdentities,
        participantNamesByIdentity,
        previous:
          snapshot.fairPlay?.check
          ?? previousSnapshot.fairPlay?.check,
      }),
    },
  }
}

function logRejoinDebug(
  message: string,
  details?: Record<string, unknown>,
) {
  if (!import.meta.env.DEV) {
    return
  }

  console.info(`[rejoin] ${message}`, details ?? {})
}

function createInitialPlayerStates(
  playerIdentities: string[],
  initialLives: 1 | 3 | 5 = DEFAULT_PLAYER_LIVES,
): Record<string, GamePlayerState> {
  return Object.fromEntries(
    playerIdentities.map((participantIdentity) => [
      participantIdentity,
      {
        lives: initialLives,
        eliminated: false,
      },
    ]),
  )
}

function getAlivePlayerIdentities(input: {
  activePlayerIdentities?: string[]
  playerStates?: Record<string, GamePlayerState>
}): string[] {
  return (input.activePlayerIdentities ?? []).filter((participantIdentity) => (
    !input.playerStates?.[participantIdentity]?.eliminated
  ))
}

function getNextAttackerIdentity(input: {
  turnOrder?: string[]
  activePlayerIdentities: string[]
  currentAttackerIdentity?: string
  playerStates?: Record<string, GamePlayerState>
}): {
  turnOrder: string[]
  currentTurnIndex: number
  attackerIdentity?: string
} {
  let turnOrder = (input.turnOrder ?? input.activePlayerIdentities)
    .filter((participantIdentity) => (
      input.activePlayerIdentities.includes(participantIdentity)
    ))

  input.activePlayerIdentities.forEach((participantIdentity) => {
    if (!turnOrder.includes(participantIdentity)) {
      turnOrder = [...turnOrder, participantIdentity]
    }
  })

  if (turnOrder.length === 0) {
    return {
      turnOrder,
      currentTurnIndex: 0,
      attackerIdentity: undefined,
    }
  }

  const startIndex = Math.max(
    0,
    turnOrder.findIndex((participantIdentity) => (
      participantIdentity === input.currentAttackerIdentity
    )),
  )

  for (let offset = 1; offset <= turnOrder.length; offset += 1) {
    const candidateIndex = (startIndex + offset) % turnOrder.length
    const candidateIdentity = turnOrder[candidateIndex]

    if (!input.playerStates?.[candidateIdentity]?.eliminated) {
      return {
        turnOrder,
        currentTurnIndex: candidateIndex,
        attackerIdentity: candidateIdentity,
      }
    }
  }

  return {
    turnOrder,
    currentTurnIndex: startIndex,
    attackerIdentity: undefined,
  }
}

function createWaitingFairPlayCheckStatus(input: {
  participantIdentity: string
  participantName?: string
  message?: string
}): GameFairPlayCheckParticipantStatus {
  return {
    participantIdentity: input.participantIdentity,
    participantName: input.participantName,
    cameraReady: false,
    faceReady: false,
    mouthReady: false,
    smileReady: false,
    passed: false,
    failed: false,
    step: 'camera',
    message: input.message ?? '카메라를 켜고 얼굴을 보여주세요.',
    updatedAt: new Date().toISOString(),
  }
}

function createFairPlayCheckState(input: {
  activePlayerIdentities: string[]
  participantNamesByIdentity: Record<string, string>
  previous?: GameFairPlayCheckState
}): GameFairPlayCheckState {
  const participants = Object.fromEntries(
    input.activePlayerIdentities.map((participantIdentity) => {
      const previousStatus = input.previous?.participants[participantIdentity]

      return [
        participantIdentity,
        previousStatus
          ? {
              ...previousStatus,
              participantName:
                input.participantNamesByIdentity[participantIdentity]
                ?? previousStatus.participantName,
            }
          : createWaitingFairPlayCheckStatus({
              participantIdentity,
              participantName: input.participantNamesByIdentity[participantIdentity],
            }),
      ]
    }),
  )

  return {
    startedAt: input.previous?.startedAt ?? new Date().toISOString(),
    activePlayerIdentities: input.activePlayerIdentities,
    participants,
    passedAt: input.previous?.passedAt,
  }
}

function isFairPlayCheckPassed(
  status: GameFairPlayCheckParticipantStatus | undefined,
): boolean {
  return Boolean(
    status
    && status.cameraReady
    && status.faceReady
    && status.mouthReady
    && status.smileReady
    && status.passed,
  )
}

function isPreGameFairPlayPhase(phase: GamePhase): boolean {
  return (
    phase === 'waiting'
    || phase === 'ready'
    || phase === 'post-game'
    || phase === 'auto-start-pending'
    || phase === 'fair-play-check'
  )
}

function getActiveDefenderIdentitiesForAttack(input: {
  defenderIdentities?: string[]
  playerStates?: Record<string, GamePlayerState>
}): string[] {
  return (input.defenderIdentities ?? []).filter((participantIdentity) => (
    !input.playerStates?.[participantIdentity]?.eliminated
  ))
}

function mapFaceCheckUiStateToStatus(input: {
  checkState: FairPlayCheckUiState
  meetingId: string
  roomCode: string
  participantIdentity: string
  participantName?: string
}): GameFairPlayCheckStatus {
  const step =
    input.checkState.step === 'look-forward'
      ? 'face'
      : input.checkState.step === 'mouth-open'
        ? 'mouth'
      : input.checkState.step === 'failed'
        ? input.checkState.message.includes('입') ? 'mouth' : 'face'
      : input.checkState.step

  return {
    type: 'fair-play-check-status',
    meetingId: input.meetingId,
    roomCode: input.roomCode,
    participantIdentity: input.participantIdentity,
    participantName: input.participantName,
    cameraReady: true,
    faceReady:
      step === 'mouth'
      || step === 'smile'
      || step === 'passed',
    mouthReady: step === 'smile' || step === 'passed',
    smileReady: step === 'passed',
    passed: input.checkState.passed,
    failed: input.checkState.failed,
    step,
    message: input.checkState.message,
    updatedAt: new Date().toISOString(),
  }
}

function createCameraRequiredFairPlayStatus(input: {
  meetingId: string
  roomCode: string
  participantIdentity: string
  participantName?: string
}): GameFairPlayCheckStatus {
  return {
    type: 'fair-play-check-status',
    meetingId: input.meetingId,
    roomCode: input.roomCode,
    participantIdentity: input.participantIdentity,
    participantName: input.participantName,
    cameraReady: false,
    faceReady: false,
    mouthReady: false,
    smileReady: false,
    passed: false,
    failed: false,
    step: 'camera',
    message: '카메라를 켜고 얼굴을 보여주세요.',
    updatedAt: new Date().toISOString(),
  }
}

type MeetingRoomPageProps = {
  meetingId: string
  roomCode: string
  roomName: string
  participants: Participant[]
  participantCount: number
  initialLives: 1 | 3 | 5
  targetLanguage: LanguageCode
  autoStartCaption: boolean
  deviceSelection: MediaDeviceSelection
  initialHostParticipantIdentity?: string
  initialGameState?: GameStateSnapshot
  hostControlToken?: string
  onLocalMediaChange: (media: LocalMediaState) => void
  onDeviceSelectionChange: (selection: MediaDeviceSelection) => void
  onPreferencesChange: (preferences: MeetingPreferences) => void
  onReconnectMedia: () => void
  onReturnHome: () => void
  onLeave: () => void
}

type LiveKitConnectionPhase =
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'local'
  | 'kicked'
  | 'ended'
  | 'leaving'

export function MeetingRoomPage({
  meetingId,
  roomCode,
  roomName,
  participants,
  participantCount,
  initialLives,
  targetLanguage,
  autoStartCaption,
  deviceSelection,
  initialHostParticipantIdentity,
  initialGameState,
  hostControlToken,
  onLocalMediaChange,
  onDeviceSelectionChange,
  onPreferencesChange,
  onReconnectMedia,
  onReturnHome,
  onLeave,
}: MeetingRoomPageProps) {
  const initialLocalParticipant = participants.find(
    (participant) => participant.role === 'local',
  )
  const entryMode = initialLocalParticipant?.meetingRole === 'participant'
    ? 'join'
    : 'host'
  const isJoinFlow = entryMode === 'join'
  const restoredMeetingSession = loadMeetingSession(meetingId)
  const [transcripts, setTranscripts] = useState<Transcript[]>(() => {
    if (restoredMeetingSession?.transcripts.length) {
      return dedupeTranscripts(restoredMeetingSession.transcripts)
    }

    const storedTranscripts = loadMeetingTranscripts(meetingId)
    if (storedTranscripts.length > 0) {
      return dedupeTranscripts(storedTranscripts)
    }

    return ENABLE_MOCK_DATA
      ? dedupeTranscripts(mockTranscripts.map((transcript) => ({
          ...transcript,
          meetingId,
        })))
      : []
  })
  const [chatMessages, setChatMessages] = useState(
    () => (
      restoredMeetingSession?.chatMessages.length
        ? dedupeChatMessages(restoredMeetingSession.chatMessages)
        : dedupeChatMessages(loadChatMessages(meetingId))
    ),
  )
  const [translations, setTranslations] = useState<TranslationRecord[]>(
    () => dedupeTranslations([
      ...(restoredMeetingSession?.translations ?? []),
      ...loadTranslations(meetingId),
    ]),
  )
  const [translationTargetLanguage] =
    useState<LanguageCode>(
      targetLanguage === 'ko' || targetLanguage === 'en'
        ? targetLanguage
        : 'en',
    )
  const [autoTranslationEnabled] = useState(false)
  const [translatingKeys, setTranslatingKeys] = useState<string[]>([])
  const [sttEnabled, setSttEnabled] = useState(false)
  const [
    isSpeechRecognitionActive,
    setIsSpeechRecognitionActive,
  ] = useState(false)
  const [speechMessage, setSpeechMessage] = useState('')
  const [liveCaptionText, setLiveCaptionText] = useState('')
  const [speechRecognitionLanguage, setSpeechRecognitionLanguage] =
    useState<SpeechRecognitionLanguage>('ko-KR')
  const [captionSize, setCaptionSize] = useState<CaptionSize>(
    () => loadCaptionPreferences().size,
  )
  const [showCaptionHint, setShowCaptionHint] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'focus'>('grid')
  const [selectedMainParticipantId, setSelectedMainParticipantId] = useState(
    () => (
      participants.find((participant) => participant.isSpeaking)?.id
      ?? participants.find((participant) => participant.role === 'local')?.id
      ?? participants[0]?.id
    ),
  )
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false)
  const [participantToRemove, setParticipantToRemove] =
    useState<Participant | null>(null)
  const [isRemovingParticipant, setIsRemovingParticipant] = useState(false)
  const [participantRemoveMessage, setParticipantRemoveMessage] = useState('')
  const [settingsMessage, setSettingsMessage] = useState('')
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [speakerDevices, setSpeakerDevices] = useState<MediaDeviceInfo[]>([])
  const [isChangingDevice, setIsChangingDevice] = useState(false)
  const [screenShareStream, setScreenShareStream] =
    useState<MediaStream | null>(null)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isScreenShareExpanded, setIsScreenShareExpanded] = useState(false)
  const [screenShareMessage, setScreenShareMessage] = useState('')
  const [isEndModalOpen, setIsEndModalOpen] = useState(false)
  const [isEndingMeeting, setIsEndingMeeting] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')
  const [liveKitConnection, setLiveKitConnection] =
    useState<LiveKitConnectionDetails | null>(null)
  const [isLiveKitConnected, setIsLiveKitConnected] = useState(false)
  const [isLiveKitOverlayOpen, setIsLiveKitOverlayOpen] = useState(false)
  const [liveKitStatus, setLiveKitStatus] =
    useState<LiveKitConnectionPhase>('connecting')
  const [liveKitParticipants, setLiveKitParticipants] =
    useState<Participant[]>([])
  const [liveKitScreenShare, setLiveKitScreenShare] =
    useState<LiveKitScreenShare | null>(null)
  const [isLiveKitConnecting, setIsLiveKitConnecting] = useState(false)
  const [isLiveKitDataReady, setIsLiveKitDataReady] = useState(false)
  const [liveKitMessage, setLiveKitMessage] = useState('')
  const [hostTransferNotice, setHostTransferNotice] = useState('')
  const [roomHostParticipantIdentity, setRoomHostParticipantIdentity] =
    useState<string | undefined>(
      initialHostParticipantIdentity
      ?? (initialLocalParticipant?.meetingRole === 'host'
        ? initialLocalParticipant.liveKitIdentity
        : undefined),
    )
  const [roomHostControlToken, setRoomHostControlToken] =
    useState<string | undefined>(hostControlToken)
  const [wasRemovedFromMeeting, setWasRemovedFromMeeting] = useState(false)
  const [isMeetingEndedRemotely, setIsMeetingEndedRemotely] = useState(false)
  const [chatSendMessage, setChatSendMessage] = useState('')
  const [recordingEnabled, setRecordingEnabled] = useState(
    () => restoredMeetingSession?.recordingEnabled ?? true,
  )
  const [roomParticipants, setRoomParticipants] = useState<Participant[]>(() => {
    return initialLocalParticipant
      ? [
          initialLocalParticipant,
          ...(
            isJoinFlow
              ? []
              : ENABLE_MOCK_DATA
                ? createMockRemoteParticipants(Math.max(0, participantCount - 1))
                : []
          ),
        ]
      : participants.slice(0, participantCount)
  })
  const [gameState, setGameState] = useState<GameStateSnapshot>(() => (
    initialGameState
    ?? createGameStateSnapshot({
        meetingId,
        roomCode,
        participantCount,
        participants: roomParticipants,
        previousRevision: 0,
        initialLives,
        hostParticipantIdentity: roomHostParticipantIdentity,
      })
  ))
  const [readyParticipantIdentities, setReadyParticipantIdentities] = useState<string[]>([])
  const [isUploadingAttackContent, setIsUploadingAttackContent] = useState(false)
  const [attackContentMessage, setAttackContentMessage] = useState('')
  const [gameTimelineEvents, setGameTimelineEvents] =
    useState<GameTimelineEvent[]>([])
  const [fairPlayWarning, setFairPlayWarning] =
    useState<FairPlayWarningState>({ active: false })
  const [fairPlayDebug, setFairPlayDebug] =
    useState<FairPlayDebugState | null>(null)
  const [audioFairPlayDebug, setAudioFairPlayDebug] =
    useState<AudioLaughDebugState | null>(null)
  const [audioFairPlayUnavailableReason, setAudioFairPlayUnavailableReason] =
    useState('')
  const [autoReadyRemainingSeconds, setAutoReadyRemainingSeconds] =
    useState<number | null>(null)
  const [autoStartRemainingSeconds, setAutoStartRemainingSeconds] =
    useState<number | null>(null)
  const [copyTooltipPosition, setCopyTooltipPosition] = useState<{
    top: number
    left: number
  } | null>(null)
  const copyMessageTimerRef = useRef<number | null>(null)
  const roomCodeButtonRef = useRef<HTMLButtonElement>(null)
  const captionButtonRef = useRef<HTMLButtonElement>(null)
  const controlBarParticipantsButtonRef = useRef<HTMLButtonElement>(null)
  const controlBarSettingsButtonRef = useRef<HTMLButtonElement>(null)
  const autoStartAttemptedRef = useRef(false)
  const autoLiveKitConnectRoomRef = useRef<string | null>(null)
  const liveKitConnectingRoomRef = useRef<string | null>(null)
  const liveKitConnectedRoomRef = useRef<string | null>(null)
  const autoStartInProgressRef = useRef(false)
  const captionRestartTimerRef = useRef<number | null>(null)
  const liveCaptionClearTimerRef = useRef<number | null>(null)
  const hostTransferNoticeTimerRef = useRef<number | null>(null)
  const gameAutoStartTimerRef = useRef<number | null>(null)
  const gameAutoReadyIntervalRef = useRef<number | null>(null)
  const gameAutoStartIntervalRef = useRef<number | null>(null)
  const matchStartInFlightRef = useRef(false)
  const lastAutoStartLogRemainingRef = useRef<number | null>(null)
  const countdownCompletionTimerRef = useRef<number | null>(null)
  const roleRevealCompletionTimerRef = useRef<number | null>(null)
  const attackCompletionTimerRef = useRef<number | null>(null)
  const roundTransitionTimerRef = useRef<number | null>(null)
  const postGameTransitionTimerRef = useRef<number | null>(null)
  const processedAttackStartRequestsRef = useRef(new Set<string>())
  const processedAttackContentRequestsRef = useRef(new Set<string>())
  const screenShareStreamRef = useRef<MediaStream | null>(null)
  const fairPlayVideoRef = useRef<HTMLVideoElement>(null)
  const fairPlayDetectorRef = useRef<FairPlayDetector | null>(null)
  const fairPlayDetectorModeRef = useRef<
    'idle' | 'face-check' | 'attack-detection'
  >('idle')
  const fairPlayDetectorSessionKeyRef = useRef('')
  const audioLaughDetectorRef = useRef<AudioLaughDetector | null>(null)
  const audioLaughTrackIdRef = useRef('')
  const fairPlayDebugRef = useRef<FairPlayDebugState | null>(null)
  const fairPlayWarningRef =
    useRef<FairPlayWarningState>({ active: false })
  const fairPlayCheckStatusKeyRef = useRef('')
  const publishFairPlayCheckStatusRef =
    useRef<(status: GameFairPlayCheckStatus) => void>(() => undefined)
  const localParticipantIdentityRef = useRef<string | undefined>(undefined)
  const processedFairPlayEventIdsRef = useRef(new Set<string>())
  const localFairPlayEventReportedRef = useRef(new Set<string>())
  const localFairPlayAttackReportRef = useRef(new Set<string>())
  const processedGameTimelineEventIdsRef = useRef(new Set<string>())
  const processedGameResultSignaturesRef = useRef(new Map<string, number>())
  const processedHostTransferEventIdsRef = useRef(new Set<string>())
  const eliminatedParticipantRemovalTimersRef =
    useRef(new Map<string, number>())
  const removedEliminatedParticipantIdentitiesRef = useRef(new Set<string>())
  const liveKitMediaControllerRef =
    useRef<LiveKitMediaController | null>(null)
  const liveKitDataControllerRef =
    useRef<LiveKitDataController | null>(null)
  const publishedTranscriptIdsRef = useRef(new Set<string>())
  const meetingExitInProgressRef = useRef(false)
  const meetingSessionSaveTimerRef = useRef<number | null>(null)
  const meetingSessionSnapshotRef = useRef('')
  const gameStateRef = useRef(gameState)
  const readyParticipantIdentitiesRef = useRef(readyParticipantIdentities)
  const gameStateSnapshotKeyRef = useRef('')
  const publishedGameStateSnapshotRef = useRef('')
  const requestedGameStateRef = useRef(false)
  const liveKitParticipantsSnapshotRef = useRef('')
  const lastNoSpeechMessageAtRef = useRef(0)
  const speechRecognitionEnabledRef = useRef(false)
  const pendingTranslationKeysRef = useRef(new Set<string>())
  const translationQueueRef = useRef(Promise.resolve())
  const translationsRef = useRef<TranslationRecord[]>([])
  const translatingKeysRef = useRef<string[]>([])
  const liveKitLocalParticipantRef = useRef<{
    id: number
    name: string
    language: LanguageCode
    meetingRole: 'host' | 'participant'
  } | null>(null)
  const terminalPhaseRef =
    useRef<Extract<LiveKitConnectionPhase, 'kicked' | 'ended' | 'leaving'> | null>(null)

  const setSpeechRecognitionEnabled = (enabled: boolean) => {
    speechRecognitionEnabledRef.current = enabled
    setSttEnabled(enabled)
  }

  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  useEffect(() => {
    readyParticipantIdentitiesRef.current = readyParticipantIdentities
  }, [readyParticipantIdentities])

  useEffect(() => {
    const eliminationRemovalTimers = eliminatedParticipantRemovalTimersRef.current

    return () => {
      speechRecognitionEnabledRef.current = false
      stopSpeechRecognition()
      stopScreenShare(screenShareStreamRef.current)
      if (copyMessageTimerRef.current !== null) {
        window.clearTimeout(copyMessageTimerRef.current)
      }
      if (captionRestartTimerRef.current !== null) {
        window.clearTimeout(captionRestartTimerRef.current)
      }
      if (liveCaptionClearTimerRef.current !== null) {
        window.clearTimeout(liveCaptionClearTimerRef.current)
      }
      if (hostTransferNoticeTimerRef.current !== null) {
        window.clearTimeout(hostTransferNoticeTimerRef.current)
      }
      if (gameAutoStartTimerRef.current !== null) {
        window.clearTimeout(gameAutoStartTimerRef.current)
      }
      if (gameAutoReadyIntervalRef.current !== null) {
        window.clearInterval(gameAutoReadyIntervalRef.current)
      }
      if (gameAutoStartIntervalRef.current !== null) {
        window.clearInterval(gameAutoStartIntervalRef.current)
      }
      if (countdownCompletionTimerRef.current !== null) {
        window.clearTimeout(countdownCompletionTimerRef.current)
      }
      if (roleRevealCompletionTimerRef.current !== null) {
        window.clearTimeout(roleRevealCompletionTimerRef.current)
      }
      if (attackCompletionTimerRef.current !== null) {
        window.clearTimeout(attackCompletionTimerRef.current)
      }
      if (roundTransitionTimerRef.current !== null) {
        window.clearTimeout(roundTransitionTimerRef.current)
      }
      if (postGameTransitionTimerRef.current !== null) {
        window.clearTimeout(postGameTransitionTimerRef.current)
      }
      eliminationRemovalTimers.forEach((timer) => {
        window.clearTimeout(timer)
      })
      eliminationRemovalTimers.clear()
      if (meetingSessionSaveTimerRef.current !== null) {
        window.clearTimeout(meetingSessionSaveTimerRef.current)
      }
      void fairPlayDetectorRef.current?.close()
      void audioLaughDetectorRef.current?.close()
    }
  }, [])

  useEffect(() => {
    const sortedTranscripts = dedupeTranscripts(transcripts)
    saveMeetingTranscripts(meetingId, sortedTranscripts)
  }, [meetingId, transcripts])

  useEffect(() => {
    const sortedMessages = dedupeChatMessages(chatMessages)
    saveChatMessages(meetingId, sortedMessages)
  }, [chatMessages, meetingId])

  useEffect(() => {
    saveTranslations(meetingId, translations)
    translationsRef.current = translations
  }, [meetingId, translations])

  useEffect(() => {
    translatingKeysRef.current = translatingKeys
  }, [translatingKeys])

  useEffect(() => {
    saveCaptionPreferences({ size: captionSize })
  }, [captionSize])

  useEffect(() => {
    if (!isEndModalOpen) {
      return
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isEndingMeeting) {
        setIsEndModalOpen(false)
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isEndModalOpen, isEndingMeeting])

  useEffect(() => {
    if (!isScreenShareExpanded) {
      return
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsScreenShareExpanded(false)
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isScreenShareExpanded])

  useEffect(() => {
    if (!participantToRemove) {
      return
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isRemovingParticipant) {
        setParticipantToRemove(null)
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isRemovingParticipant, participantToRemove])

  const showLiveCaptionText = (text: string, persistMs = 0) => {
    if (liveCaptionClearTimerRef.current !== null) {
      window.clearTimeout(liveCaptionClearTimerRef.current)
      liveCaptionClearTimerRef.current = null
    }

    setLiveCaptionText(text)

    if (persistMs > 0) {
      liveCaptionClearTimerRef.current = window.setTimeout(() => {
        setLiveCaptionText('')
        liveCaptionClearTimerRef.current = null
      }, persistMs)
    }
  }

  const getTranscriptSourceLanguage = (): LanguageCode => (
    speechRecognitionLanguage === 'en-US' ? 'en' : 'ko'
  )

  const addTranscript = (sourceText: string): Transcript | null => {
    const currentUser = isLiveKitConnected
      ? liveKitParticipants.find(
          (participant) => participant.role === 'local',
        )
      : roomParticipants.find(
          (participant) => participant.role === 'local',
        )

    if (!currentUser) {
      return null
    }

    const now = new Date()
    const pendingTranslations = getPendingTranslationText()
    const numericTranscriptId = now.getTime()
    const transcriptId = crypto.randomUUID?.()
      ?? `transcript-${numericTranscriptId}`
    const pendingText =
      pendingTranslations[targetLanguage as SupportedLanguage]
      ?? pendingTranslations.en
    const newTranscript: Transcript = {
      id: numericTranscriptId,
      transcriptId,
      meetingId,
      roomCode,
      participantId: currentUser.id,
      speakerId: currentUser.id,
      speakerIdentity: currentUser.liveKitIdentity ?? String(currentUser.id),
      speakerRole: currentUser.meetingRole === 'host' ? 'host' : 'guest',
      time: now.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      createdAt: now.toISOString(),
      speakerName: currentUser.name,
      sourceLanguage: getTranscriptSourceLanguage(),
      recognitionLanguage: speechRecognitionLanguage,
      sourceText,
      targetLanguage,
      translatedText: pendingText,
      translationSource: 'mock',
      translatedTextByLanguage: {
        ...pendingTranslations,
        [targetLanguage]: pendingText,
      },
      isFinal: true,
    }

    setTranscripts((previous) => {
      const updatedTranscripts = dedupeTranscripts([...previous, newTranscript])
      return updatedTranscripts
    })
    return newTranscript
  }

  const publishLiveKitTranscript = (transcript: Transcript) => {
    const transcriptKey = transcript.transcriptId ?? String(transcript.id)
    if (
      !isLiveKitConnected
      || publishedTranscriptIdsRef.current.has(transcriptKey)
    ) {
      return
    }

    const controller = liveKitDataControllerRef.current
    if (!controller) {
      console.warn(
        '[livekit-transcript] Data controller is not ready; transcript remains local.',
        { transcriptId: transcriptKey },
      )
      return
    }

    publishedTranscriptIdsRef.current.add(transcriptKey)
    void controller.publishTranscriptMessage({
      type: 'transcript-created',
      payload: transcriptToLiveKitPayload(transcript, {
        roomCode,
        speakerIdentity: transcript.speakerIdentity,
        speakerRole: transcript.speakerRole,
        language: transcript.recognitionLanguage,
      }),
    }).catch((error) => {
      publishedTranscriptIdsRef.current.delete(transcriptKey)
      console.error(
        '[livekit-transcript] Failed to publish transcript',
        error,
      )
    })
  }

  const startRecognitionForParticipant = (
    localParticipant: Participant,
  ): boolean => {
    return startSpeechRecognition({
      language: speechRecognitionLanguage,
      shouldRestart: () => (
        speechRecognitionEnabledRef.current
        && (
          displayedLocalParticipant?.isMicOn
          ?? localParticipant.isMicOn
        )
      ),
      onInterimResult: (interimText) => {
        showLiveCaptionText(interimText)
      },
      onResult: async (sourceText) => {
        showLiveCaptionText(sourceText, 3600)
        const newTranscript = addTranscript(sourceText)

        if (newTranscript === null) {
          return
        }

        publishLiveKitTranscript(newTranscript)
      },
      onStart: () => {
        autoStartInProgressRef.current = false
        setSpeechRecognitionEnabled(true)
        setIsSpeechRecognitionActive(true)
        setRoomParticipants(updateParticipantMediaState(
          localParticipant.id,
          { isSpeaking: true },
        ))
      },
      onEnd: () => {
        autoStartInProgressRef.current = false
        setIsSpeechRecognitionActive(false)
        setRoomParticipants(updateParticipantMediaState(
          localParticipant.id,
          { isSpeaking: false },
        ))
      },
      onError: (errorCode) => {
        const wasAutoStart = autoStartInProgressRef.current
        autoStartInProgressRef.current = false
        setRoomParticipants(updateParticipantMediaState(
          localParticipant.id,
          { isSpeaking: false },
        ))
        if (errorCode === 'aborted') {
          setIsSpeechRecognitionActive(false)
          setSpeechMessage('')
          return
        }
        if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
          setSpeechRecognitionEnabled(false)
          setIsSpeechRecognitionActive(false)
          setSpeechMessage('마이크 권한을 확인해 주세요.')
          return
        }
        if (errorCode === 'network') {
          setSpeechRecognitionEnabled(false)
          setIsSpeechRecognitionActive(false)
          setSpeechMessage('음성 인식 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.')
          return
        }
        if (errorCode === 'no-speech') {
          setIsSpeechRecognitionActive(false)
          const now = Date.now()
          if (now - lastNoSpeechMessageAtRef.current > 8000) {
            lastNoSpeechMessageAtRef.current = now
            setSpeechMessage('말하면 자동으로 자막이 기록됩니다.')
          }
          return
        }
        setSpeechMessage(
          wasAutoStart
            ? '실시간 자막을 시작하려면 자막 버튼을 눌러주세요.'
            : errorCode === 'unsupported'
              ? '이 브라우저에서는 음성 인식을 지원하지 않습니다.'
              : `실시간 자막 오류: ${errorCode}`,
        )
        setIsSpeechRecognitionActive(false)
      },
    })
  }

  const handleToggleSpeechRecognition = () => {
    const isAutoStart = autoStartInProgressRef.current
    if (!isAutoStart) {
      setShowCaptionHint(false)
    }

    const localParticipant = displayedLocalParticipant
      ?? roomParticipants.find(
        (participant) => participant.role === 'local',
      )
    const supported = isSpeechRecognitionSupported()
    setSpeechMessage('')

    if (sttEnabled || isSpeechRecognitionActive || getSpeechRecognitionStatus()) {
      setSpeechRecognitionEnabled(false)
      stopSpeechRecognition()
      setIsSpeechRecognitionActive(false)
      if (localParticipant) {
        setRoomParticipants(updateParticipantMediaState(
          localParticipant.id,
          { isSpeaking: false },
        ))
      }
      return
    }

    if (!localParticipant) {
      autoStartInProgressRef.current = false
      setSpeechRecognitionEnabled(false)
      setSpeechMessage('로컬 참가자 정보를 찾을 수 없습니다.')
      return
    }

    if (!localParticipant?.isMicOn) {
      autoStartInProgressRef.current = false
      setSpeechRecognitionEnabled(false)
      setSpeechMessage('마이크를 켜야 실시간 자막을 사용할 수 있어요.')
      return
    }

    if (!supported) {
      autoStartInProgressRef.current = false
      setSpeechRecognitionEnabled(false)
      setSpeechMessage('이 브라우저에서는 음성 인식을 지원하지 않습니다.')
      return
    }

    if (getSpeechRecognitionStatus()) {
      return
    }

    setSpeechRecognitionEnabled(true)
    const started = startRecognitionForParticipant(localParticipant)

    if (!started) {
      autoStartInProgressRef.current = false
      setSpeechRecognitionEnabled(false)
      setSpeechMessage('실시간 자막을 시작하려면 자막 버튼을 눌러주세요.')
    }
  }

  const reconnectLocalMedia = async (
    localParticipant: Participant,
    kind: 'audio' | 'video',
  ): Promise<Participant | null> => {
    setSpeechMessage('')

    try {
      const stream = await requestMediaStream({
        videoDeviceId: deviceSelection.videoDeviceId || undefined,
        audioDeviceId: deviceSelection.audioDeviceId || undefined,
      })
      const cameraEnabled =
        kind === 'video' ? true : localParticipant.isCameraOn
      const microphoneEnabled =
        kind === 'audio' ? true : localParticipant.isMicOn

      toggleTrack(stream, 'video', cameraEnabled)
      toggleTrack(stream, 'audio', microphoneEnabled)
      const reconnectedParticipant: Participant = {
        ...localParticipant,
        mediaStream: stream,
        isCameraOn: cameraEnabled,
        isMicOn: microphoneEnabled,
      }
      setRoomParticipants(updateParticipantMediaState(
        localParticipant.id,
        {
          mediaStream: stream,
          isCameraOn: cameraEnabled,
          isMicOn: microphoneEnabled,
        },
      ))
      onLocalMediaChange({
        stream,
        cameraEnabled,
        microphoneEnabled,
      })
      return reconnectedParticipant
    } catch (error) {
      setSpeechMessage(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? '마이크 권한이 차단되었습니다. 브라우저 주소창의 권한 설정을 확인해주세요.'
          : '카메라 또는 마이크를 다시 연결하지 못했습니다. 설정 화면에서 장치를 확인해주세요.',
      )
      return null
    }
  }

  const openSettings = useCallback(async () => {
    setIsParticipantsOpen(false)
    setIsSettingsOpen(true)
    setSettingsMessage('')

    try {
      const [nextVideoDevices, nextAudioDevices, nextSpeakerDevices] = await Promise.all([
        getVideoInputDevices(),
        getAudioInputDevices(),
        getAudioOutputDevices(),
      ])
      setVideoDevices(nextVideoDevices)
      setAudioDevices(nextAudioDevices)
      setSpeakerDevices(nextSpeakerDevices)
    } catch {
      setSettingsMessage('장치 목록을 불러오는 중 문제가 발생했습니다.')
    }
  }, [])

  const updateLocalParticipant = (
    updates: Partial<Pick<Participant, 'name' | 'language' | 'avatarLabel'>>,
  ): Participant | null => {
    const currentLocalParticipant = roomParticipants.find(
      (participant) => participant.role === 'local',
    )

    if (!currentLocalParticipant) {
      return null
    }

    const updatedParticipant = {
      ...currentLocalParticipant,
      ...updates,
    }
    setRoomParticipants((current) => current.map((participant) => (
      participant.id === currentLocalParticipant.id
        ? updatedParticipant
        : participant
    )))
    return updatedParticipant
  }

  const changeDisplayName = (name: string) => {
    const displayName = name || ''
    updateLocalParticipant({
      name: displayName,
      avatarLabel: getParticipantInitials(displayName),
    })
    onPreferencesChange({
      displayName,
      sourceLanguage:
        localParticipant?.language ?? participants[0]?.language ?? 'ko',
      targetLanguage,
      participantCount,
      autoStartCaption,
    })
  }

  const changeSourceLanguage = (language: LanguageCode) => {
    const updatedParticipant = updateLocalParticipant({ language })

    if (!updatedParticipant) {
      return
    }

    onPreferencesChange({
      displayName: updatedParticipant.name,
      sourceLanguage: language,
      targetLanguage,
      participantCount,
      autoStartCaption,
    })

    if (sttEnabled || isSpeechRecognitionActive || getSpeechRecognitionStatus()) {
      setSpeechRecognitionEnabled(true)
      stopSpeechRecognition()
      setIsSpeechRecognitionActive(false)
      setRoomParticipants(updateParticipantMediaState(
        updatedParticipant.id,
        { isSpeaking: false },
      ))

      if (captionRestartTimerRef.current !== null) {
        window.clearTimeout(captionRestartTimerRef.current)
      }
      captionRestartTimerRef.current = window.setTimeout(() => {
        startRecognitionForParticipant(updatedParticipant)
      }, 250)
    }
  }

  const changeTargetLanguage = (language: LanguageCode) => {
    onPreferencesChange({
      displayName: localParticipant?.name ?? '',
      sourceLanguage: localParticipant?.language ?? 'ko',
      targetLanguage: language,
      participantCount,
      autoStartCaption,
    })
  }

  const changeMeetingDevice = async (
    kind: 'video' | 'audio' | 'speaker',
    deviceId: string,
  ) => {
    if (kind === 'speaker') {
      onDeviceSelectionChange({
        ...deviceSelection,
        speakerDeviceId: deviceId,
      })
      return
    }

    if (
      localParticipantId === undefined
      || !localParticipantName
      || !localParticipantLanguage
      || !localParticipantMeetingRole
    ) {
      return
    }

    const nextSelection = {
      ...deviceSelection,
      [kind === 'video' ? 'videoDeviceId' : 'audioDeviceId']: deviceId,
    }
    setIsChangingDevice(true)
    setSettingsMessage('')

    try {
      const stream = await requestMediaStream({
        videoDeviceId: nextSelection.videoDeviceId || undefined,
        audioDeviceId: nextSelection.audioDeviceId || undefined,
      })
      toggleTrack(stream, 'video', localParticipant.isCameraOn)
      toggleTrack(stream, 'audio', localParticipant.isMicOn)
      setRoomParticipants(updateParticipantMediaState(
        localParticipant.id,
        { mediaStream: stream },
      ))
      onDeviceSelectionChange(nextSelection)
      onLocalMediaChange({
        stream,
        cameraEnabled: localParticipant.isCameraOn,
        microphoneEnabled: localParticipant.isMicOn,
      })
    } catch {
      setSettingsMessage('장치를 변경하는 중 문제가 발생했습니다.')
    } finally {
      setIsChangingDevice(false)
    }
  }

  const toggleLocalMedia = async (kind: 'audio' | 'video') => {
    const localParticipant = roomParticipants.find(
      (participant) => participant.role === 'local',
    )

    if (!localParticipant) {
      return
    }

    const stateKey = kind === 'video' ? 'isCameraOn' : 'isMicOn'
    const liveKitLocalParticipant = liveKitParticipants.find(
      (participant) => participant.role === 'local',
    )
    const currentEnabled = isLiveKitConnected && liveKitLocalParticipant
      ? liveKitLocalParticipant[stateKey]
      : localParticipant[stateKey]
    const nextEnabled = !currentEnabled

    if (isLiveKitConnected) {
      const controller = liveKitMediaControllerRef.current

      if (!controller) {
        setSpeechMessage('방 미디어 연결을 준비하는 중입니다.')
        return
      }

      try {
        if (kind === 'video') {
          await controller.setCameraEnabled(nextEnabled)
        } else {
          await controller.setMicrophoneEnabled(nextEnabled)
        }

        if (
          kind === 'audio'
          && !nextEnabled
          && (sttEnabled || isSpeechRecognitionActive)
        ) {
          setSpeechRecognitionEnabled(false)
          stopSpeechRecognition()
          setIsSpeechRecognitionActive(false)
        }
      } catch (error) {
        console.error('[livekit] Failed to toggle local media', {
          kind,
          error,
        })
        setSpeechMessage(
          kind === 'audio'
            ? '마이크 상태를 변경하지 못했습니다.'
            : '카메라 상태를 변경하지 못했습니다.',
        )
      }
      return
    }

    const tracks = kind === 'video'
      ? localParticipant.mediaStream?.getVideoTracks() ?? []
      : localParticipant.mediaStream?.getAudioTracks() ?? []
    const liveTracks = tracks.filter((track) => track.readyState === 'live')

    if (nextEnabled && liveTracks.length === 0) {
      if (localParticipant.mediaStream) {
        await reconnectLocalMedia(localParticipant, kind)
      }
      return
    }

    liveTracks.forEach((track) => {
      track.enabled = nextEnabled
    })

    setRoomParticipants(updateParticipantMediaState(
      localParticipant.id,
      {
        [stateKey]: nextEnabled,
        ...(kind === 'audio' && !nextEnabled ? { isSpeaking: false } : {}),
      },
    ))

    onLocalMediaChange({
      stream: localParticipant.mediaStream ?? null,
      cameraEnabled:
        kind === 'video' ? nextEnabled : localParticipant.isCameraOn,
      microphoneEnabled:
        kind === 'audio' ? nextEnabled : localParticipant.isMicOn,
    })

    if (
      kind === 'audio'
      && !nextEnabled
      && (sttEnabled || isSpeechRecognitionActive)
    ) {
      setSpeechRecognitionEnabled(false)
      stopSpeechRecognition()
      setIsSpeechRecognitionActive(false)
    }
  }

  const copyRoomCode = async () => {
    const copied = await copyToClipboard(roomCode)
    const rect = roomCodeButtonRef.current?.getBoundingClientRect()

    if (rect) {
      setCopyTooltipPosition({
        top: rect.bottom + 10,
        left: rect.left + (rect.width / 2),
      })
    }

    setCopyMessage(
      copied
        ? '방 코드가 복사되었습니다.'
        : '복사에 실패했습니다.',
    )

    if (copyMessageTimerRef.current !== null) {
      window.clearTimeout(copyMessageTimerRef.current)
    }
    copyMessageTimerRef.current = window.setTimeout(() => {
      setCopyMessage('')
      setCopyTooltipPosition(null)
    }, 1800)
  }

  useEffect(() => {
    if (!copyMessage) {
      return
    }

    const updateCopyTooltipPosition = () => {
      const rect = roomCodeButtonRef.current?.getBoundingClientRect()

      if (!rect) {
        return
      }

      setCopyTooltipPosition({
        top: rect.bottom + 10,
        left: rect.left + (rect.width / 2),
      })
    }

    updateCopyTooltipPosition()
    window.addEventListener('resize', updateCopyTooltipPosition)
    window.addEventListener('scroll', updateCopyTooltipPosition, true)

    return () => {
      window.removeEventListener('resize', updateCopyTooltipPosition)
      window.removeEventListener('scroll', updateCopyTooltipPosition, true)
    }
  }, [copyMessage])

  const localParticipant = roomParticipants.find(
    (participant) => participant.role === 'local',
  )
  const localParticipantId = localParticipant?.id
  const localParticipantName = localParticipant?.name
  const localParticipantLanguage = localParticipant?.language
  const localParticipantMeetingRole = localParticipant?.meetingRole

  useEffect(() => {
    liveKitLocalParticipantRef.current =
      localParticipantId !== undefined
      && localParticipantName
      && localParticipantLanguage
      && localParticipantMeetingRole
        ? {
            id: localParticipantId,
            name: localParticipantName,
            language: localParticipantLanguage,
            meetingRole: localParticipantMeetingRole,
          }
        : null
  }, [
    localParticipantId,
    localParticipantLanguage,
    localParticipantMeetingRole,
    localParticipantName,
  ])

  const sendChatMessage = async (message: string) => {
    setChatSendMessage('')

    const isWaitingForLiveConnection =
      liveKitStatus === 'connecting'
      || liveKitStatus === 'leaving'
      || liveKitStatus === 'ended'
      || liveKitStatus === 'kicked'

    if (isWaitingForLiveConnection) {
      setChatSendMessage('방에 연결된 후 채팅을 보낼 수 있습니다.')
      return
    }

    const sender = isLiveKitConnected
      ? liveKitParticipants.find(
          (participant) => participant.role === 'local',
        )
      : localParticipant

    if (!sender || !message.trim()) {
      return
    }

    const senderRole = sender.meetingRole === 'host' ? 'host' : 'guest'
    const newMessage = createChatMessage({
      meetingId,
      senderId: sender.id,
      senderName: sender.name,
      senderIdentity: sender.liveKitIdentity ?? String(sender.id),
      senderRole,
      roomCode,
      language: sender.language,
      message,
    })
    setChatMessages((current) => (
      current.some((item) => item.id === newMessage.id)
        ? current
        : dedupeChatMessages([...current, newMessage])
    ))

    if (isLiveKitConnected) {
      try {
        await liveKitDataControllerRef.current
          ?.publishChatMessage({
          type: 'chat-message',
          payload: chatMessageToLiveKitPayload(newMessage, {
            roomCode,
            senderIdentity: sender.liveKitIdentity ?? String(sender.id),
            senderRole,
            language: sender.language,
          }),
        })
        console.debug('[chat] message sent', newMessage.id)
      } catch (error) {
        console.warn('[livekit-chat] Failed to publish chat message', error)
        setChatSendMessage('메시지를 보내지 못했습니다.')
      }
    }
  }

  const getEffectiveTranslationTarget = useCallback((
    sourceLanguage: LanguageCode,
  ): LanguageCode => (
    sourceLanguage === 'ko'
      ? 'en'
      : sourceLanguage === 'en'
        ? 'ko'
        : translationTargetLanguage
  ), [translationTargetLanguage])

  const waitForTranslationSlot = () => (
    new Promise((resolve) => {
      window.setTimeout(resolve, 380)
    })
  )

  const translateConversationItem = useCallback(async (
    sourceType: TranslationSourceType,
    sourceId: string,
    sourceText: string,
    sourceLanguage: LanguageCode,
    options: { force?: boolean, targetLanguage?: LanguageCode } = {},
  ) => {
    if (!TRANSLATION_MODE_CONFIG.canUseManualTranslation) {
      setSettingsMessage('번역 기능은 프리미엄 계정에서 제공될 예정이며 현재 개발 중입니다.')
      return
    }

    const target = options.targetLanguage ?? getEffectiveTranslationTarget(sourceLanguage)
    const cacheKey = getTranslationCacheKey(sourceType, sourceId, target)
    const existingTranslation = findTranslation(
      translationsRef.current,
      sourceType,
      sourceId,
      target,
    )

    if (existingTranslation?.status === 'success') {
      return
    }
    if (
      existingTranslation
      && existingTranslation.status !== 'skipped'
      && !options.force
    ) {
      return
    }
    if (pendingTranslationKeysRef.current.has(cacheKey)) {
      return
    }

    pendingTranslationKeysRef.current.add(cacheKey)

    setTranslatingKeys((current) => (
      current.includes(cacheKey) ? current : [...current, cacheKey]
    ))

    const runTranslation = async () => {
      await waitForTranslationSlot()
      console.debug('[translation-queue] processing', {
        sourceType,
        sourceId,
        sourceLanguage,
        targetLanguage: target,
        sourceTextLength: sourceText.trim().length,
      })
      const translation = await createManualTranslation({
        roomCode,
        sourceType,
        sourceId,
        sourceText,
        sourceLanguage,
        targetLanguage: target,
      })

      setTranslations((current) => {
        const existing = findTranslation(current, sourceType, sourceId, target)
        if (existing?.status === 'success' && !options.force) {
          return current
        }

        return dedupeTranslations([
          ...current.filter((item) => !(
            item.sourceType === sourceType
            && item.sourceId === sourceId
            && item.targetLanguage === target
          )),
          translation,
        ])
      })

      if (
        translation.status === 'success'
        && sourceType === 'transcript'
        && Date.now() - Date.parse(translation.createdAt) < 5000
      ) {
        showLiveCaptionText(
          `${sourceText}\n${translation.translatedText}`,
          4200,
        )
      }

      if (isLiveKitConnected) {
        await liveKitDataControllerRef.current
          ?.publishTranslationMessage({
            type: 'translation',
            payload: translation,
          })
          .catch((error) => {
            console.warn('[livekit-translation] Failed to publish translation', error)
          })
      }
    }

    translationQueueRef.current = translationQueueRef.current
      .then(runTranslation, runTranslation)
      .catch((error) => {
        console.warn('[translation] Failed to translate item', {
          sourceType,
          sourceId,
          sourceLanguage,
          targetLanguage: target,
          error,
        })
        setSettingsMessage('번역에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      })
      .finally(() => {
        pendingTranslationKeysRef.current.delete(cacheKey)
        setTranslatingKeys((current) => (
          current.filter((item) => item !== cacheKey)
        ))
      })

    await translationQueueRef.current
  }, [
    getEffectiveTranslationTarget,
    isLiveKitConnected,
    roomCode,
  ])

  useEffect(() => {
    if (!TRANSLATION_MODE_CONFIG.canUseAutoTranslation) {
      return
    }

    if (!autoTranslationEnabled) {
      return
    }

    chatMessages.forEach((message) => {
      if (message.type !== 'user' || !message.message.trim()) {
        return
      }

      const sourceLanguage: LanguageCode =
        /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(message.message)
          ? 'ko'
          : /[A-Za-z]/.test(message.message)
            ? 'en'
            : message.language === 'ko'
              || message.language === 'en'
              ? message.language
              : 'en'
      const target = getEffectiveTranslationTarget(sourceLanguage)

      if (
        findTranslation(translations, 'chat', message.id, target)
        || pendingTranslationKeysRef.current.has(getTranslationCacheKey('chat', message.id, target))
        || translatingKeys.includes(getTranslationCacheKey('chat', message.id, target))
      ) {
        return
      }

      void translateConversationItem(
        'chat',
        message.id,
        message.message,
        sourceLanguage,
        { targetLanguage: target },
      )
    })

    transcripts.forEach((transcript, index) => {
      const sourceId = transcript.transcriptId ?? String(transcript.id)
      const target = getEffectiveTranslationTarget(transcript.sourceLanguage)
      const previousTranscript = transcripts[index - 1]

      if (
        !transcript.sourceText.trim()
        || !shouldAutoTranslateText(
          transcript.sourceText,
          transcript.sourceLanguage,
          previousTranscript?.sourceText,
        )
        || findTranslation(translations, 'transcript', sourceId, target)
        || pendingTranslationKeysRef.current.has(getTranslationCacheKey('transcript', sourceId, target))
        || translatingKeys.includes(getTranslationCacheKey('transcript', sourceId, target))
      ) {
        return
      }

      void translateConversationItem(
        'transcript',
        sourceId,
        transcript.sourceText,
        transcript.sourceLanguage,
        { targetLanguage: target },
      )
    })
  }, [
    autoTranslationEnabled,
    chatMessages,
    getEffectiveTranslationTarget,
    transcripts,
    translations,
    translateConversationItem,
    translatingKeys,
  ])

  const connectLiveKitRoom = useCallback(async (options?: {
    force?: boolean
  }) => {
    if (terminalPhaseRef.current) {
      return
    }

    const participantForConnection = liveKitLocalParticipantRef.current

    if (!participantForConnection) {
      return
    }

    const forceReconnect = options?.force ?? false
    const roomNameForConnection = roomCode || meetingId
    const isAlreadyConnectedToRoom =
      liveKitConnectedRoomRef.current === roomNameForConnection
      || (
        isLiveKitConnected
        && liveKitConnection?.roomName === roomNameForConnection
      )
      || (
        liveKitStatus === 'connected'
        && liveKitConnection?.roomName === roomNameForConnection
      )
    const isAlreadyConnectingToRoom =
      liveKitConnectingRoomRef.current === roomNameForConnection
      || (
        isLiveKitConnecting
        && liveKitConnection?.roomName === roomNameForConnection
    )

    if (!forceReconnect && isAlreadyConnectedToRoom) {
      return
    }

    if (!forceReconnect && isAlreadyConnectingToRoom) {
      return
    }

    if (
      liveKitConnection
      && liveKitConnection.roomName !== roomNameForConnection
    ) {
      liveKitMediaControllerRef.current?.disconnect()
      setLiveKitConnection(null)
      setIsLiveKitConnected(false)
      setLiveKitParticipants([])
      setLiveKitScreenShare(null)
      liveKitConnectedRoomRef.current = null
    }

    liveKitConnectingRoomRef.current = roomNameForConnection
    setIsLiveKitConnecting(true)
    setLiveKitStatus('connecting')
    setLiveKitMessage('')

    try {
      const connection = await requestLiveKitToken({
        roomName: roomNameForConnection,
        participantName: participantForConnection.name,
        language: participantForConnection.language,
      })

      if (liveKitConnectingRoomRef.current !== roomNameForConnection) {
        return
      }

      if (terminalPhaseRef.current) {
        return
      }

      if (connection.hostParticipantIdentity) {
        setRoomHostParticipantIdentity(connection.hostParticipantIdentity)
      }

      if (connection.hostControlToken) {
        setRoomHostControlToken(connection.hostControlToken)
      }

      if (
        connection.gameState
        && shouldAcceptServerRoomSnapshot(
          gameStateRef.current,
          connection.gameState,
        )
      ) {
        const scopedGameState = scopePostGameSnapshotToRoster(
          connection.gameState,
          gameStateRef.current,
        )

        gameStateRef.current = scopedGameState
        setReadyParticipantIdentities(
          scopedGameState.participants
            .filter((participant) => participant.isReady)
            .map((participant) => participant.participantIdentity)
            .filter((participantIdentity): participantIdentity is string => (
              typeof participantIdentity === 'string'
            )),
        )
        setGameState(scopedGameState)
        logRejoinDebug('server token snapshot applied', {
          phase: scopedGameState.phase,
          hostParticipantIdentity: scopedGameState.hostParticipantIdentity,
        })
      }

      setLiveKitConnection(connection)
      setIsLiveKitOverlayOpen(false)
      setIsSettingsOpen(false)
    } catch (error) {
      const reason = error instanceof Error
        ? error.message
        : '방 연결을 준비하지 못했습니다.'
      setLiveKitConnection(null)
      setIsLiveKitConnected(false)
      if (terminalPhaseRef.current) {
        return
      }
      setLiveKitStatus('failed')
      setLiveKitMessage(
        `방 연결에 실패했습니다. 로컬 모드로 계속 진행합니다. ${reason}`,
      )
    } finally {
      if (liveKitConnectingRoomRef.current === roomNameForConnection) {
        liveKitConnectingRoomRef.current = null
      }
      setIsLiveKitConnecting(false)
    }
  }, [
    isLiveKitConnecting,
    isLiveKitConnected,
    liveKitConnection,
    liveKitStatus,
    meetingId,
    roomCode,
  ])

  useEffect(() => {
    if (terminalPhaseRef.current) {
      return
    }

    if (localParticipantId === undefined) {
      return
    }

    const roomNameForConnection = roomCode || meetingId

    if (
      autoLiveKitConnectRoomRef.current === roomNameForConnection
      || liveKitConnectingRoomRef.current === roomNameForConnection
      || liveKitConnectedRoomRef.current === roomNameForConnection
      || liveKitConnection?.roomName === roomNameForConnection
    ) {
      return
    }

    autoLiveKitConnectRoomRef.current = roomNameForConnection
    void connectLiveKitRoom()
  }, [
    connectLiveKitRoom,
    liveKitConnection?.roomName,
    localParticipantId,
    meetingId,
    roomCode,
  ])

  const markParticipantKicked = useCallback((
    reason: 'removed_by_host' | 'eliminated' = 'removed_by_host',
  ) => {
    if (terminalPhaseRef.current === 'kicked') {
      return
    }

    const controller = liveKitMediaControllerRef.current
    terminalPhaseRef.current = 'kicked'
    meetingExitInProgressRef.current = true
    setSpeechRecognitionEnabled(false)
    stopSpeechRecognition()
    setIsSpeechRecognitionActive(false)
    setWasRemovedFromMeeting(true)
    setIsMeetingEndedRemotely(false)
    setIsEndingMeeting(false)
    setIsEndModalOpen(false)
    setParticipantToRemove(null)
    setIsParticipantsOpen(false)
    setIsSettingsOpen(false)
    setIsLiveKitOverlayOpen(false)
    setIsScreenShareExpanded(false)
    setLiveKitStatus('kicked')
    setLiveKitMessage(
      reason === 'eliminated'
        ? '탈락하여 방에서 퇴장합니다.'
        : '방장에 의해 방에서 퇴장되었습니다.',
    )
    setIsLiveKitConnecting(false)
    setIsLiveKitConnected(false)
    setIsLiveKitDataReady(false)
    setLiveKitConnection(null)
    setLiveKitScreenShare(null)
    setLiveKitParticipants([])
    liveKitParticipantsSnapshotRef.current = ''
    liveKitMediaControllerRef.current = null
    liveKitDataControllerRef.current = null
    liveKitConnectedRoomRef.current = null
    liveKitConnectingRoomRef.current = null
    autoLiveKitConnectRoomRef.current = roomCode || meetingId
    controller?.disconnect()
  }, [meetingId, roomCode])

  const removeParticipant = async () => {
    if (isRemovingParticipant) {
      return
    }

    const removedParticipant = participantToRemove
    const currentHost = isLiveKitConnected
      ? liveKitParticipants.find((participant) => participant.role === 'local')
      : localParticipant

    if (
      !removedParticipant
      || removedParticipant.role !== 'remote'
      || currentHost?.meetingRole !== 'host'
    ) {
      setParticipantToRemove(null)
      return
    }

    setIsRemovingParticipant(true)
    setParticipantRemoveMessage('')

    const addRemovalSystemMessage = async () => {
      const systemMessage = createSystemMessage({
        meetingId,
        message: `${removedParticipant.name}님이 방장에 의해 퇴장되었습니다.`,
      })
      setChatMessages((current) => dedupeChatMessages([
        ...current,
        systemMessage,
      ]))

      if (isLiveKitConnected) {
        await liveKitDataControllerRef.current
          ?.publishChatMessage({
            type: 'system-message',
            payload: chatMessageToLiveKitPayload(systemMessage, {
              roomCode,
              senderIdentity:
                currentHost?.liveKitIdentity
                ?? liveKitConnection?.participantIdentity
                ?? 'system',
              senderRole: 'system',
              language: currentHost?.language ?? 'ko',
            }),
          })
          .catch((error) => {
            console.error(
              '[livekit-chat] Failed to publish participant removal system message',
              error,
            )
          })
      }
    }

    try {
      if (isLiveKitConnected) {
        if (
          !liveKitConnection
          || !removedParticipant.liveKitIdentity
          || !currentHost.liveKitIdentity
        ) {
          throw new Error('LiveKit participant identity is missing.')
        }

        const removeRequest = {
          roomName: liveKitConnection.roomName,
          targetParticipantIdentity: removedParticipant.liveKitIdentity,
          requesterParticipantIdentity: currentHost.liveKitIdentity,
          requesterMeetingRole: currentHost.meetingRole,
          hostControlToken: roomHostControlToken,
        } as const

        await liveKitDataControllerRef.current
          ?.publishMeetingControlMessage({
            type: 'participant-kicked',
            payload: {
              meetingId,
              roomName: removeRequest.roomName,
              targetParticipantIdentity: removeRequest.targetParticipantIdentity,
              removedByParticipantIdentity:
                removeRequest.requesterParticipantIdentity,
              removedByName: currentHost.name,
              reason: 'removed_by_host',
              timestamp: new Date().toISOString(),
            },
          })
          .catch((error) => {
            console.warn(
              '[livekit] Failed to publish participant kick notice before removal',
              error,
            )
          })

        await new Promise((resolve) => window.setTimeout(resolve, 150))
        await removeLiveKitParticipant(removeRequest)

        await addRemovalSystemMessage()
        setParticipantRemoveMessage('참가자를 내보냈습니다.')
        setLiveKitParticipants((current) => current.filter(
          (participant) =>
            participant.liveKitIdentity !== removeRequest.targetParticipantIdentity,
        ))

        if (selectedMainParticipantId === removedParticipant.id) {
          setSelectedMainParticipantId(currentHost.id)
        }

        onPreferencesChange({
          displayName: currentHost.name,
          sourceLanguage: currentHost.language,
          targetLanguage,
          participantCount: Math.max(1, liveKitParticipants.length - 1),
          autoStartCaption,
        })
        setParticipantToRemove(null)
        return
      }

      const nextParticipants = roomParticipants.filter(
        (participant) => participant.id !== removedParticipant.id,
      )

      setRoomParticipants(nextParticipants)
      await addRemovalSystemMessage()

      if (selectedMainParticipantId === removedParticipant.id) {
        setSelectedMainParticipantId(
          nextParticipants.find((participant) => participant.role === 'local')?.id
          ?? nextParticipants[0]?.id,
        )
      }

      onPreferencesChange({
        displayName: currentHost.name,
        sourceLanguage: currentHost.language,
        targetLanguage,
        participantCount: nextParticipants.length,
        autoStartCaption,
      })
      setParticipantToRemove(null)
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : '알 수 없는 오류가 발생했습니다.'
      console.error('[livekit] Failed to remove participant', {
        error,
        message,
      })
      setParticipantRemoveMessage(
        `참가자를 내보내지 못했습니다: ${message}`,
      )
    } finally {
      setIsRemovingParticipant(false)
    }
  }

  const liveKitConnectionPhase = liveKitStatus
  const isTerminalConnectionPhase =
    liveKitConnectionPhase === 'kicked'
    || liveKitConnectionPhase === 'ended'
    || liveKitConnectionPhase === 'leaving'
  const isConnectionPending = (
    liveKitConnectionPhase === 'connecting'
    || (
      isJoinFlow
      && (
        liveKitConnectionPhase === 'local'
        || (
          liveKitConnectionPhase === 'connected'
          && liveKitParticipants.length === 0
        )
      )
    )
  ) && liveKitParticipants.length === 0 && !isTerminalConnectionPhase
  const shouldHoldVideoForConnection =
    isConnectionPending && !wasRemovedFromMeeting && !isMeetingEndedRemotely
  const canUseMockParticipants =
    !isTerminalConnectionPhase
    && (
      liveKitConnectionPhase === 'failed'
      || (!isJoinFlow && liveKitConnectionPhase === 'local')
    )
  const displayedParticipants = useMemo(() => {
    const applyRoomHostRole = (nextParticipants: Participant[]): Participant[] => (
      roomHostParticipantIdentity
        ? nextParticipants.map((participant) => ({
            ...participant,
            meetingRole:
              getParticipantGameIdentity(participant) === roomHostParticipantIdentity
                ? 'host'
                : 'participant',
          }))
        : nextParticipants
    )

    if (isTerminalConnectionPhase && wasRemovedFromMeeting) {
      return []
    }

    if (isLiveKitConnected && liveKitParticipants.length > 0) {
      return applyRoomHostRole(liveKitParticipants)
    }

    if (shouldHoldVideoForConnection || !canUseMockParticipants) {
      return []
    }

    return applyRoomHostRole(roomParticipants)
  }, [
    canUseMockParticipants,
    isTerminalConnectionPhase,
    isLiveKitConnected,
    liveKitParticipants,
    roomHostParticipantIdentity,
    roomParticipants,
    shouldHoldVideoForConnection,
    wasRemovedFromMeeting,
  ])
  const displayedLocalParticipant = displayedParticipants.find(
    (participant) => participant.role === 'local',
  )
  const activeReadyParticipantIdentities = useMemo(
    () => filterReadyParticipantIdentities(
      displayedParticipants,
      readyParticipantIdentities,
    ),
    [displayedParticipants, readyParticipantIdentities],
  )

  useEffect(() => {
    readyParticipantIdentitiesRef.current = activeReadyParticipantIdentities
  }, [activeReadyParticipantIdentities])


  useEffect(() => {
    if (displayedParticipants.length === 0) {
      return
    }

    const snapshot = JSON.stringify({
      meetingId,
      roomCode,
      roomName,
      participantIds: displayedParticipants.map((participant) => [
        participant.id,
        participant.liveKitIdentity,
        participant.name,
        participant.isCameraOn,
        participant.isMicOn,
      ]),
      chatIds: chatMessages.map((message) => message.id),
      transcriptIds: transcripts.map((transcript) => transcript.id),
      translationIds: translations.map((translation) => translation.translationId),
    })

    if (snapshot === meetingSessionSnapshotRef.current) {
      return
    }
    meetingSessionSnapshotRef.current = snapshot

    if (meetingSessionSaveTimerRef.current !== null) {
      window.clearTimeout(meetingSessionSaveTimerRef.current)
    }

    meetingSessionSaveTimerRef.current = window.setTimeout(() => {
      saveMeetingSession({
        meetingId,
        roomCode,
        roomName,
        title: roomName,
        participants: displayedParticipants,
        chatMessages,
        transcripts,
        translations,
        recordingEnabled,
        createdAt: restoredMeetingSession?.createdAt,
        startedAt: restoredMeetingSession?.startedAt,
      })
    }, 400)
  }, [
    chatMessages,
    displayedParticipants,
    meetingId,
    restoredMeetingSession?.createdAt,
    restoredMeetingSession?.startedAt,
    roomCode,
    roomName,
    transcripts,
    translations,
    recordingEnabled,
  ])

  const localParticipantIdentity =
    displayedLocalParticipant?.liveKitIdentity
    ?? liveKitConnection?.participantIdentity
    ?? (
      displayedLocalParticipant
        ? String(displayedLocalParticipant.id)
        : undefined
    )
  const authoritativeHostParticipantIdentity =
    roomHostParticipantIdentity ?? gameState.hostParticipantIdentity
  const isCurrentUserHost =
    Boolean(
      localParticipantIdentity
      && authoritativeHostParticipantIdentity
      && localParticipantIdentity === authoritativeHostParticipantIdentity,
    )
    || (
      !authoritativeHostParticipantIdentity
      && (displayedLocalParticipant ?? localParticipant)?.meetingRole === 'host'
    )
  const gameStatusText =
    `${gameState.connectedParticipantCount}/${gameState.participantCount}명`
  const readyStatusText =
    `${gameState.readyParticipantCount} / ${Math.max(2, gameState.connectedParticipantCount)} READY`
  const isLocalParticipantReady = localParticipantIdentity
    ? activeReadyParticipantIdentities.includes(localParticipantIdentity)
    : false
  const localFairPlayCheckStatus:
    GameFairPlayCheckParticipantStatus | undefined = undefined

  useEffect(() => {
    localParticipantIdentityRef.current = localParticipantIdentity
  }, [localParticipantIdentity])

  useEffect(() => {
    logLocalParticipantDebug({
      identity: localParticipantIdentity,
      name: displayedLocalParticipant?.name,
      liveKitIdentity: displayedLocalParticipant?.liveKitIdentity,
      role: displayedLocalParticipant?.role,
      meetingRole: displayedLocalParticipant?.meetingRole,
      detectorTarget: displayedLocalParticipant?.liveKitIdentity,
      hasLocalStream: Boolean(displayedLocalParticipant?.mediaStream),
    })
  }, [
    displayedLocalParticipant?.liveKitIdentity,
    displayedLocalParticipant?.mediaStream,
    displayedLocalParticipant?.meetingRole,
    displayedLocalParticipant?.name,
    displayedLocalParticipant?.role,
    localParticipantIdentity,
  ])

  useEffect(() => {
    logRoomAuthorityDebug({
      roomCode,
      hostParticipantIdentity: authoritativeHostParticipantIdentity,
      localParticipantIdentity,
      isCurrentUserHost,
      participants: displayedParticipants.map((participant) => ({
        identity: getParticipantGameIdentity(participant),
        name: participant.name,
        role: participant.role,
        meetingRole: participant.meetingRole,
      })),
    })
  }, [
    authoritativeHostParticipantIdentity,
    displayedParticipants,
    isCurrentUserHost,
    localParticipantIdentity,
    roomCode,
  ])

  const applyHostChanged = useCallback((payload: {
    meetingId: string
    roomName: string
    previousHostParticipantIdentity: string
    newHostParticipantIdentity: string
    newHostName: string
    newHostControlToken?: string
    changedAt: string
    reason: 'host_eliminated' | 'host_left'
  }) => {
    if (
      payload.meetingId !== meetingId
      || payload.roomName !== (liveKitConnection?.roomName ?? roomCode)
    ) {
      return
    }

    const transferEventId = [
      payload.previousHostParticipantIdentity,
      payload.newHostParticipantIdentity,
      payload.changedAt,
    ].join(':')

    logHostTransferDebug('host changed', {
      from: payload.previousHostParticipantIdentity,
      to: payload.newHostParticipantIdentity,
      reason: payload.reason,
    })
    if (!processedHostTransferEventIdsRef.current.has(transferEventId)) {
      processedHostTransferEventIdsRef.current.add(transferEventId)
      const systemMessage = createSystemMessage({
        meetingId,
        message: `${payload.newHostName}님이 새 방장이 되었습니다.`,
      })
      setChatMessages((current) => dedupeChatMessages([
        ...current,
        systemMessage,
      ]))
    }
    setRoomHostParticipantIdentity(payload.newHostParticipantIdentity)
    setGameState((current) => {
      const nextSnapshot = {
        ...current,
        hostParticipantIdentity: payload.newHostParticipantIdentity,
        participants: current.participants.map((participant) => ({
          ...participant,
          role:
            participant.participantIdentity === payload.newHostParticipantIdentity
              ? 'host'
              : 'participant',
        })),
        updatedAt: payload.changedAt,
      } satisfies GameStateSnapshot

      gameStateRef.current = nextSnapshot
      gameStateSnapshotKeyRef.current = getGameStateSnapshotKey(nextSnapshot)
      return nextSnapshot
    })
    setLiveKitParticipants((current) => current.map((participant) => ({
      ...participant,
      meetingRole:
        getParticipantGameIdentity(participant)
          === payload.newHostParticipantIdentity
          ? 'host'
          : 'participant',
    })))
    setRoomParticipants((current) => current.map((participant) => ({
      ...participant,
      meetingRole:
        getParticipantGameIdentity(participant)
          === payload.newHostParticipantIdentity
          ? 'host'
          : 'participant',
    })))

    if (
      payload.newHostControlToken
      && localParticipantIdentityRef.current === payload.newHostParticipantIdentity
    ) {
      setRoomHostControlToken(payload.newHostControlToken)
      setLiveKitMessage('방장 권한을 이어받았습니다.')
      setHostTransferNotice('YOU ARE HOST')
      if (hostTransferNoticeTimerRef.current !== null) {
        window.clearTimeout(hostTransferNoticeTimerRef.current)
      }
      hostTransferNoticeTimerRef.current = window.setTimeout(() => {
        setHostTransferNotice('')
        hostTransferNoticeTimerRef.current = null
      }, 3500)
      logPostGameDebug('authority changed', {
        hostParticipantIdentity: payload.newHostParticipantIdentity,
      })
    }
  }, [liveKitConnection?.roomName, meetingId, roomCode])

  const canToggleReady =
    Boolean(localParticipantIdentity)
    && isLiveKitDataReady
    && (
      gameState.phase === 'waiting'
      || gameState.phase === 'ready'
      || gameState.phase === 'post-game'
    )
  const canStartGame =
    isCurrentUserHost
    && gameState.phase === 'ready'
    && gameState.connectedParticipantCount >= 2
    && gameState.connectedParticipantCount >= gameState.participantCount
    && gameState.readyParticipantCount === gameState.connectedParticipantCount

  useEffect(() => {
    if (
      gameState.phase !== 'waiting'
      && gameState.phase !== 'ready'
      && gameState.phase !== 'post-game'
    ) {
      return
    }

    logNextMatchDebug('state', {
      ready: `${gameState.readyParticipantCount}/${gameState.connectedParticipantCount}`,
      host: roomHostParticipantIdentity,
      localParticipantIdentity,
      isHost: isCurrentUserHost,
      canStart: canStartGame,
      phase: gameState.phase,
    })
  }, [
    canStartGame,
    gameState.connectedParticipantCount,
    gameState.phase,
    gameState.readyParticipantCount,
    isCurrentUserHost,
    localParticipantIdentity,
    roomHostParticipantIdentity,
  ])

  const canRequestAttackStart =
    Boolean(localParticipantIdentity)
    && gameState.phase === 'attack-ready'
    && gameState.attackerIdentity === localParticipantIdentity
    && typeof gameState.roundNumber === 'number'
    && Boolean(gameState.attackContent)
  const shouldShowGameRoleBadges =
    gameState.phase === 'role-reveal'
    || gameState.phase === 'attack-ready'
    || gameState.phase === 'attack-active'
    || gameState.phase === 'attack-ended'
    || gameState.phase === 'round-result'
    || gameState.phase === 'round-ended'
  const localGameRole =
    shouldShowGameRoleBadges
      && localParticipantIdentity
      && gameState.attackerIdentity === localParticipantIdentity
      ? 'attacker'
      : shouldShowGameRoleBadges
        && localParticipantIdentity
        && gameState.defenderIdentities?.includes(localParticipantIdentity)
        ? 'defender'
        : undefined
  const attackerName =
    gameState.participants.find(
      (participant) => participant.participantIdentity === gameState.attackerIdentity,
    )?.name
    ?? displayedParticipants.find(
      (participant) => (
        getParticipantGameIdentity(participant) === gameState.attackerIdentity
      ),
    )?.name
    ?? '공격자'
  const getGameParticipantName = useCallback((participantIdentity?: string) => (
    gameState.participants.find(
      (participant) => participant.participantIdentity === participantIdentity,
    )?.name
    ?? displayedParticipants.find(
      (participant) => (
        getParticipantGameIdentity(participant) === participantIdentity
      ),
    )?.name
    ?? participantIdentity
    ?? '참가자'
  ), [displayedParticipants, gameState.participants])
  const appendGameTimelineEvent = useCallback((event: GameTimelineEvent) => {
    if (processedGameTimelineEventIdsRef.current.has(event.id)) {
      return
    }

    processedGameTimelineEventIdsRef.current.add(event.id)
    setGameTimelineEvents((current) => [...current, event])
  }, [])

  useEffect(() => {
    if (
      gameState.phase !== 'attack-active'
      || !gameState.attackContent
      || typeof gameState.attackSequence !== 'number'
    ) {
      return
    }

    const attackId = [
      gameState.roundNumber ?? 'round',
      gameState.attackSequence,
      gameState.attackerIdentity ?? 'attacker',
    ].join(':')

    appendGameTimelineEvent({
      id: `attack:${attackId}`,
      type: 'attack',
      attackId,
      participantIdentity: gameState.attackerIdentity,
      displayName: getGameParticipantName(gameState.attackerIdentity),
      media: gameState.attackContent,
      timestamp: gameState.attackStartedAt ?? gameState.updatedAt,
    })
  }, [
    appendGameTimelineEvent,
    gameState.attackContent,
    gameState.attackSequence,
    gameState.attackStartedAt,
    gameState.attackerIdentity,
    gameState.phase,
    gameState.roundNumber,
    gameState.updatedAt,
    getGameParticipantName,
  ])

  useEffect(() => {
    if (
      gameState.phase !== 'attack-ended'
      && gameState.phase !== 'post-game'
      || typeof gameState.attackSequence !== 'number'
    ) {
      return
    }

    const attackId = [
      gameState.roundNumber ?? 'round',
      gameState.attackSequence,
      gameState.attackerIdentity ?? 'attacker',
    ].join(':')
    const hitIdentities =
      gameState.penalizedParticipantIdentitiesForCurrentAttack ?? []
    const hitIdentitySet = new Set(hitIdentities)
    const defenderResults = (gameState.defenderIdentities ?? []).map(
      (participantIdentity) => ({
        participantIdentity,
        displayName: getGameParticipantName(participantIdentity),
        hit: hitIdentitySet.has(participantIdentity),
        eliminated:
          gameState.playerStates?.[participantIdentity]?.eliminated ?? false,
      }),
    )
    const title =
      gameState.attackEndReason === 'all-defenders-hit'
        ? 'ALL DEFENDERS HIT!'
        : 'ATTACK RESULT'
    const message = hitIdentities.length
      ? hitIdentities
        .map((participantIdentity) => (
          `${getGameParticipantName(participantIdentity)} LIFE -1`
        ))
        .join(' · ')
      : '아무도 웃지 않았습니다.'

    appendGameTimelineEvent({
      id: `attack-result:${attackId}:${gameState.attackEndReason ?? 'ended'}`,
      type: 'attack-result',
      attackId,
      title,
      message,
      defenderResults,
      timestamp: gameState.updatedAt,
    })
  }, [
    appendGameTimelineEvent,
    gameState.attackEndReason,
    gameState.attackSequence,
    gameState.attackerIdentity,
    gameState.defenderIdentities,
    gameState.penalizedParticipantIdentitiesForCurrentAttack,
    gameState.phase,
    gameState.playerStates,
    gameState.roundNumber,
    gameState.updatedAt,
    getGameParticipantName,
  ])

  useEffect(() => {
    if (gameState.phase !== 'post-game') {
      return
    }

    const winnerIdentity =
      gameState.activePlayerIdentities?.length === 1
        ? gameState.activePlayerIdentities[0]
        : undefined

    if (!winnerIdentity) {
      return
    }

    const eliminatedParticipants = Object.entries(gameState.playerStates ?? {})
      .filter(([, playerState]) => playerState.eliminated)
      .map(([participantIdentity]) => ({
        participantIdentity,
        displayName: getGameParticipantName(participantIdentity),
      }))
    const winnerName = getGameParticipantName(winnerIdentity)
    const resultSignature = [
      winnerIdentity,
      eliminatedParticipants
        .map((participant) => participant.participantIdentity)
        .sort()
        .join(','),
    ].join('|')
    const lastPublishedAt =
      processedGameResultSignaturesRef.current.get(resultSignature)

    if (lastPublishedAt && Date.now() - lastPublishedAt < 10_000) {
      logGameResultDebug('duplicate ignored', {
        matchId: resultSignature,
        winnerIdentity,
      })
      return
    }

    processedGameResultSignaturesRef.current.set(resultSignature, Date.now())

    appendGameTimelineEvent({
      id: [
        'game-result',
        resultSignature,
        winnerIdentity,
      ].join(':'),
      type: 'game-result',
      title: 'GAME RESULT',
      message: `${winnerName} WINS!`,
      winnerParticipantIdentity: winnerIdentity,
      winnerName,
      eliminatedParticipants,
      timestamp: gameState.updatedAt,
    })
    logGameResultDebug('published=true', {
      matchId: resultSignature,
      winnerIdentity,
    })
  }, [
    appendGameTimelineEvent,
    gameState.activePlayerIdentities,
    gameState.attackSequence,
    gameState.phase,
    gameState.playerStates,
    gameState.roundNumber,
    gameState.updatedAt,
    getGameParticipantName,
  ])

  useEffect(() => {
    Object.entries(gameState.playerStates ?? {}).forEach(
      ([participantIdentity, playerState]) => {
        if (!playerState.eliminated) {
          return
        }

        appendGameTimelineEvent({
          id: `elimination:${participantIdentity}`,
          type: 'elimination',
          participantIdentity,
          displayName: getGameParticipantName(participantIdentity),
          timestamp: gameState.updatedAt,
        })
      },
    )
  }, [
    appendGameTimelineEvent,
    gameState.playerStates,
    gameState.updatedAt,
    getGameParticipantName,
  ])
  const participantNamesByIdentity = useMemo(() => (
    Object.fromEntries(
      displayedParticipants
        .slice(0, participantCount)
        .map((participant) => [
          getParticipantGameIdentity(participant),
          participant.name,
        ]),
    )
  ), [displayedParticipants, participantCount])
  const fairPlayCheckParticipants = useMemo(() => [], [])
  const winnerName =
    gameState.phase === 'game-over'
      ? getGameParticipantName(gameState.attackerIdentity)
      : undefined
  const connectionLoadingTitle =
    liveKitConnectionPhase === 'connected' && liveKitParticipants.length === 0
      ? '참가자 정보를 불러오는 중입니다...'
      : '방에 연결 중입니다...'

  useEffect(() => {
    logFairPlayCheckDebug('phase received', {
      participantIdentity: localParticipantIdentity,
      role: isCurrentUserHost ? 'host' : 'guest',
      phase: gameState.phase,
    })
  }, [gameState.phase, isCurrentUserHost, localParticipantIdentity])

  const createCurrentGameStateSnapshot = useCallback(() => {
    const currentGameState = gameStateRef.current
    const visibleParticipantIdentities = new Set(
      displayedParticipants
        .slice(0, participantCount)
        .map(getParticipantGameIdentity),
    )
    let phase: GamePhase | undefined = (
      currentGameState.phase === 'auto-start-pending'
      || currentGameState.phase === 'countdown'
      || currentGameState.phase === 'game-started'
      || currentGameState.phase === 'role-reveal'
      || currentGameState.phase === 'attack-ready'
      || currentGameState.phase === 'attack-active'
      || currentGameState.phase === 'attack-ended'
      || currentGameState.phase === 'round-result'
      || currentGameState.phase === 'round-ended'
      || currentGameState.phase === 'game-over'
    )
      ? currentGameState.phase
      : undefined
    let activePlayerIdentities = currentGameState.activePlayerIdentities
    let autoStartAt = currentGameState.autoStartAt
    let gameOverAt = currentGameState.gameOverAt
    let postGameAt = currentGameState.postGameAt
    let turnOrder = currentGameState.turnOrder
    let currentTurnIndex = currentGameState.currentTurnIndex
    let attackerIdentity = currentGameState.attackerIdentity
    let defenderIdentities = currentGameState.defenderIdentities
    let roleRevealStartedAt = currentGameState.roleRevealStartedAt
    let roleRevealDurationMs = currentGameState.roleRevealDurationMs
    let attackStartedAt = currentGameState.attackStartedAt
    let attackDurationMs = currentGameState.attackDurationMs
    let attackEndsAt = currentGameState.attackEndsAt
    let attackEndReason = currentGameState.attackEndReason
    let attackSequence = currentGameState.attackSequence
    let attackContent = currentGameState.attackContent
    let playerStates = currentGameState.playerStates
    let roundResult = currentGameState.roundResult
    let fairPlay = currentGameState.fairPlay

    if (currentGameState.phase !== 'ready') {
      autoStartAt = undefined
    }

    if (currentGameState.phase !== 'game-over') {
      gameOverAt = undefined
      postGameAt = undefined
    }

    if (currentGameState.phase === 'post-game') {
      activePlayerIdentities = undefined
      turnOrder = undefined
      currentTurnIndex = undefined
      attackerIdentity = undefined
      defenderIdentities = undefined
      roleRevealStartedAt = undefined
      roleRevealDurationMs = undefined
      attackStartedAt = undefined
      attackDurationMs = undefined
      attackEndsAt = undefined
      attackEndReason = undefined
      attackSequence = undefined
      attackContent = null
      playerStates = undefined
      roundResult = null
      gameOverAt = undefined
      postGameAt = undefined
    }

    if (!phase || phase === 'auto-start-pending') {
      fairPlay = currentGameState.fairPlay?.lastEvent
        ? { lastEvent: currentGameState.fairPlay.lastEvent }
        : undefined
    }
    const shouldReconcileRoles =
      phase === 'role-reveal'
      || phase === 'attack-ready'
      || phase === 'attack-active'
      || phase === 'attack-ended'
      || phase === 'round-result'
      || phase === 'round-ended'
      || phase === 'game-over'

    if (shouldReconcileRoles) {
      activePlayerIdentities = (activePlayerIdentities ?? []).filter(
        (participantIdentity) => visibleParticipantIdentities.has(participantIdentity),
      )

      if (activePlayerIdentities.length < 2) {
        phase = 'waiting'
        activePlayerIdentities = undefined
        turnOrder = undefined
        currentTurnIndex = undefined
        attackerIdentity = undefined
        defenderIdentities = undefined
        roleRevealStartedAt = undefined
        roleRevealDurationMs = undefined
        attackStartedAt = undefined
        attackDurationMs = undefined
        attackEndsAt = undefined
        attackEndReason = undefined
        attackContent = null
        playerStates = undefined
        roundResult = null
        fairPlay = undefined
      } else {
        turnOrder = (turnOrder ?? activePlayerIdentities).filter(
          (participantIdentity) => activePlayerIdentities?.includes(participantIdentity),
        )
        activePlayerIdentities.forEach((participantIdentity) => {
          if (!turnOrder?.includes(participantIdentity)) {
            turnOrder = [...(turnOrder ?? []), participantIdentity]
          }
        })

        if (!attackerIdentity || !activePlayerIdentities.includes(attackerIdentity)) {
          const nextAttackerIdentity = turnOrder.find(
            (participantIdentity) => activePlayerIdentities?.includes(participantIdentity),
          )
          attackerIdentity = nextAttackerIdentity
          if (phase === 'attack-active') {
            phase = 'attack-ready'
            attackStartedAt = undefined
            attackDurationMs = undefined
            attackEndsAt = undefined
          }
          attackContent = null
          roundResult = null
        }

        currentTurnIndex = Math.max(
          0,
          turnOrder.findIndex(
            (participantIdentity) => participantIdentity === attackerIdentity,
          ),
        )
        defenderIdentities = getDefenderIdentities(
          activePlayerIdentities,
          attackerIdentity,
        )
      }
    }

    return createGameStateSnapshot({
      meetingId,
      roomCode,
      participantCount,
      participants: displayedParticipants,
      previousRevision: currentGameState.revision,
      hostParticipantIdentity: currentGameState.hostParticipantIdentity,
      readyParticipantIdentities: activeReadyParticipantIdentities,
      initialLives: currentGameState.initialLives ?? initialLives,
      autoStartAt,
      gameOverAt,
      postGameAt,
      phase,
      countdownStartedAt: currentGameState.countdownStartedAt,
      countdownDurationMs: currentGameState.countdownDurationMs,
      roundNumber: currentGameState.roundNumber,
      activePlayerIdentities,
      turnOrder,
      currentTurnIndex,
      attackerIdentity,
      defenderIdentities,
      roleRevealStartedAt,
      roleRevealDurationMs,
      attackStartedAt,
      attackDurationMs,
      attackEndsAt,
      attackEndReason,
      attackSequence,
      attackContent,
      playerStates,
      roundResult,
      fairPlay,
    })
  }, [
    displayedParticipants,
    activeReadyParticipantIdentities,
    meetingId,
    participantCount,
    roomCode,
    initialLives,
  ])

  const publishGameStateSnapshot = useCallback(async (
    snapshot: GameStateSnapshot,
  ) => {
    const controller = liveKitDataControllerRef.current

    if (!controller || !isLiveKitConnected) {
      return
    }

    await controller.publishGameMessage({
      type: 'game-state-snapshot',
      payload: snapshot,
    }).catch((error) => {
      console.warn('[livekit-game] Failed to publish game state snapshot', error)
    })
  }, [isLiveKitConnected])

  const publishGameStateRequest = useCallback(async () => {
    const controller = liveKitDataControllerRef.current

    if (!controller || !isLiveKitConnected || isCurrentUserHost) {
      return
    }

    await controller.publishGameMessage({
      type: 'game-state-request',
      payload: createGameStateRequest({
        meetingId,
        roomCode,
        requesterParticipantIdentity: localParticipantIdentity,
      }),
    }).catch((error) => {
      console.warn('[livekit-game] Failed to request game state', error)
    })
  }, [
    isCurrentUserHost,
    isLiveKitConnected,
    localParticipantIdentity,
    meetingId,
    roomCode,
  ])

  const applyFairPlayCheckStatusFromHost = useCallback((
    status: GameFairPlayCheckStatus,
  ) => {
    const currentGameState = gameStateRef.current
    const activePlayerIdentities = displayedParticipants
      .slice(0, participantCount)
      .map(getParticipantGameIdentity)

    if (
      !isCurrentUserHost
      || status.meetingId !== meetingId
      || status.roomCode !== roomCode
      || !isPreGameFairPlayPhase(currentGameState.phase)
      || !activePlayerIdentities.includes(status.participantIdentity)
    ) {
      return
    }

    logFairPlayCheckDebug('participant status received', {
      participantIdentity: status.participantIdentity,
      step: status.step,
      cameraReady: status.cameraReady,
      faceReady: status.faceReady,
      mouthReady: status.mouthReady,
      smileReady: status.smileReady,
      passed: status.passed,
    })

    const nextCheck = createFairPlayCheckState({
      activePlayerIdentities,
      participantNamesByIdentity,
      previous: currentGameState.fairPlay?.check,
    })
    nextCheck.participants[status.participantIdentity] = {
      participantIdentity: status.participantIdentity,
      participantName: status.participantName,
      cameraReady: status.cameraReady,
      faceReady: status.faceReady,
      mouthReady: status.mouthReady,
      smileReady: status.smileReady,
      passed: status.passed,
      failed: status.failed,
      step: status.step,
      message: status.message,
      checkVersion: status.checkVersion,
      calibrationVersion: status.calibrationVersion,
      updatedAt: status.updatedAt,
    }

    const nextSnapshot = createGameStateSnapshot({
      meetingId,
      roomCode,
      participantCount,
      participants: displayedParticipants,
      previousRevision: currentGameState.revision,
      hostParticipantIdentity: currentGameState.hostParticipantIdentity,
      readyParticipantIdentities: activeReadyParticipantIdentities,
      initialLives: currentGameState.initialLives ?? initialLives,
      phase: currentGameState.phase === 'fair-play-check'
        ? undefined
        : currentGameState.phase,
      roundNumber: currentGameState.roundNumber,
      activePlayerIdentities: currentGameState.activePlayerIdentities,
      turnOrder: currentGameState.turnOrder,
      currentTurnIndex: currentGameState.currentTurnIndex,
      playerStates: currentGameState.playerStates,
      roundResult: null,
      fairPlay: {
        ...currentGameState.fairPlay,
        check: nextCheck,
      },
    })
    const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

    if (snapshotKey === gameStateSnapshotKeyRef.current) {
      return
    }

    gameStateSnapshotKeyRef.current = snapshotKey
    gameStateRef.current = nextSnapshot
    setGameState(nextSnapshot)
    publishedGameStateSnapshotRef.current = snapshotKey
    logFairPlayCheckDebug('aggregate updated', {
      participantIdentity: status.participantIdentity,
      activePlayerCount: activePlayerIdentities.length,
      passedCount: activePlayerIdentities.filter((participantIdentity) => (
        isFairPlayCheckPassed(nextCheck.participants[participantIdentity])
      )).length,
    })
    if (import.meta.env.DEV) {
      console.info('[fair-play-shared]', {
        identity: status.participantIdentity,
        status: status.passed ? 'passed' : 'checking',
        host: currentGameState.hostParticipantIdentity,
      })
    }
    void publishGameStateSnapshot(nextSnapshot)
  }, [
    activeReadyParticipantIdentities,
    displayedParticipants,
    initialLives,
    isCurrentUserHost,
    meetingId,
    participantCount,
    participantNamesByIdentity,
    publishGameStateSnapshot,
    roomCode,
  ])

  const publishFairPlayCheckStatus = useCallback((
    status: GameFairPlayCheckStatus,
  ) => {
    const statusKey = JSON.stringify({
      participantIdentity: status.participantIdentity,
      cameraReady: status.cameraReady,
      faceReady: status.faceReady,
      mouthReady: status.mouthReady,
      smileReady: status.smileReady,
      passed: status.passed,
      failed: status.failed,
      step: status.step,
      message: status.message,
      checkVersion: status.checkVersion,
      calibrationVersion: status.calibrationVersion,
    })

    if (statusKey === fairPlayCheckStatusKeyRef.current) {
      return
    }

    fairPlayCheckStatusKeyRef.current = statusKey

    logFairPlayCheckDebug('status changed', {
      participantIdentity: status.participantIdentity,
      step: status.step,
      cameraReady: status.cameraReady,
      faceReady: status.faceReady,
      mouthReady: status.mouthReady,
      smileReady: status.smileReady,
      passed: status.passed,
    })
    if (import.meta.env.DEV && status.passed) {
      console.info('[fair-play-publish]', {
        identity: status.participantIdentity,
        status: 'passed',
        camera: status.cameraReady,
        face: status.faceReady,
        mouth: status.mouthReady,
        smile: status.smileReady,
      })
    }

    if (isCurrentUserHost) {
      applyFairPlayCheckStatusFromHost(status)
      return
    }

    const controller = liveKitDataControllerRef.current

    if (!controller || !isLiveKitConnected || !isLiveKitDataReady) {
      return
    }

    void controller.publishGameMessage({
      type: 'fair-play-check-status',
      payload: status,
    }).catch((error) => {
      console.warn('[livekit-game] Failed to publish fair play check status', error)
    })
    logFairPlayCheckDebug('status published', {
      participantIdentity: status.participantIdentity,
      step: status.step,
      passed: status.passed,
    })
  }, [
    applyFairPlayCheckStatusFromHost,
    isCurrentUserHost,
    isLiveKitConnected,
    isLiveKitDataReady,
  ])

  useEffect(() => {
    publishFairPlayCheckStatusRef.current = publishFairPlayCheckStatus
  }, [publishFairPlayCheckStatus])

  const handleToggleReady = useCallback(() => {
    if (
      !localParticipantIdentity
      || !(
        gameStateRef.current.phase === 'waiting'
        || gameStateRef.current.phase === 'ready'
        || gameStateRef.current.phase === 'post-game'
      )
    ) {
      return
    }

    const nextIsReady =
      !readyParticipantIdentitiesRef.current.includes(localParticipantIdentity)

    setReadyParticipantIdentities((current) => {
      const currentSet = new Set(current)

      if (nextIsReady) {
        currentSet.add(localParticipantIdentity)
      } else {
        currentSet.delete(localParticipantIdentity)
      }

      return Array.from(currentSet)
    })

    if (isCurrentUserHost) {
      return
    }

    const controller = liveKitDataControllerRef.current

    if (!controller || !isLiveKitConnected || !isLiveKitDataReady) {
      return
    }

    void controller.publishGameMessage({
      type: 'game-ready-change',
      payload: createGameReadyChange({
        meetingId,
        roomCode,
        participantIdentity: localParticipantIdentity,
        isReady: nextIsReady,
      }),
    }).catch((error) => {
      console.warn('[livekit-game] Failed to publish ready state', error)
    })
  }, [
    isCurrentUserHost,
    isLiveKitConnected,
    isLiveKitDataReady,
    localParticipantIdentity,
    meetingId,
    roomCode,
  ])

  useEffect(() => {
    if (gameAutoReadyIntervalRef.current !== null) {
      window.clearInterval(gameAutoReadyIntervalRef.current)
      gameAutoReadyIntervalRef.current = null
    }

    const shouldAutoReady =
      Boolean(localParticipantIdentity)
      && isLiveKitDataReady
      && (
        gameState.phase === 'waiting'
        || gameState.phase === 'ready'
        || gameState.phase === 'post-game'
      )
      && !isLocalParticipantReady
      && !wasRemovedFromMeeting

    if (!shouldAutoReady) {
      const resetTimer = window.setTimeout(() => {
        setAutoReadyRemainingSeconds(null)
      }, 0)

      return () => window.clearTimeout(resetTimer)
    }

    const startedAt = Date.now()
    const updateRemaining = () => {
      const remainingMs = Math.max(
        0,
        GAME_AUTO_READY_DELAY_MS - (Date.now() - startedAt),
      )
      setAutoReadyRemainingSeconds(Math.ceil(remainingMs / 1000))

      if (remainingMs <= 0) {
        if (gameAutoReadyIntervalRef.current !== null) {
          window.clearInterval(gameAutoReadyIntervalRef.current)
          gameAutoReadyIntervalRef.current = null
        }
        setAutoReadyRemainingSeconds(null)
        handleToggleReady()
      }
    }

    const firstTickTimer = window.setTimeout(updateRemaining, 0)
    gameAutoReadyIntervalRef.current = window.setInterval(updateRemaining, 250)

    return () => {
      window.clearTimeout(firstTickTimer)
      if (gameAutoReadyIntervalRef.current !== null) {
        window.clearInterval(gameAutoReadyIntervalRef.current)
        gameAutoReadyIntervalRef.current = null
      }
    }
  }, [
    gameState.phase,
    handleToggleReady,
    isLiveKitDataReady,
    isLocalParticipantReady,
    localParticipantIdentity,
    wasRemovedFromMeeting,
  ])

  const cancelGameAutoStartTimers = useCallback((reason: string) => {
    let cancelled = false
    if (gameAutoStartTimerRef.current !== null) {
      window.clearTimeout(gameAutoStartTimerRef.current)
      gameAutoStartTimerRef.current = null
      cancelled = true
    }
    if (gameAutoStartIntervalRef.current !== null) {
      window.clearInterval(gameAutoStartIntervalRef.current)
      gameAutoStartIntervalRef.current = null
      cancelled = true
    }
    if (cancelled) {
      logAutoStartDebug(
        reason === 'manual-start' ? 'cancelled by manual start' : 'cancelled',
        { reason },
      )
    }
  }, [])

  const handleStartGame = useCallback((source: 'manual' | 'auto' = 'manual') => {
    const startSource = source === 'auto' ? 'auto' : 'manual'
    const currentGameState = gameStateRef.current

    if (
      !isCurrentUserHost
      || currentGameState.phase !== 'ready'
      || currentGameState.connectedParticipantCount < 2
      || currentGameState.connectedParticipantCount
        < currentGameState.participantCount
      || currentGameState.readyParticipantCount
        !== currentGameState.connectedParticipantCount
    ) {
      return
    }

    if (matchStartInFlightRef.current) {
      logMatchStartDebug('duplicate start ignored', {
        source: startSource,
        phase: currentGameState.phase,
        revision: currentGameState.revision,
      })
      return
    }

    const activePlayerIdentities =
      getActivePlayerIdentities({
        participants: displayedParticipants,
        participantCount,
        readyParticipantIdentities: activeReadyParticipantIdentities,
      })

    if (activePlayerIdentities.length < 2) {
      return
    }

    const fairPlayCheck = createFairPlayCheckState({
      activePlayerIdentities,
      participantNamesByIdentity,
      previous: currentGameState.fairPlay?.check,
    })
    const allPassed = activePlayerIdentities.every((participantIdentity) => (
      isFairPlayCheckPassed(fairPlayCheck.participants[participantIdentity])
    ))

    if (!allPassed) {
      return
    }

    matchStartInFlightRef.current = true
    cancelGameAutoStartTimers(`${startSource}-start`)
    setAutoStartRemainingSeconds(null)
    logMatchStartDebug(
      startSource === 'auto' ? 'auto-start fired' : 'host manual start',
      {
        revision: currentGameState.revision,
        participantCount: currentGameState.connectedParticipantCount,
        roster: activePlayerIdentities,
      },
    )

    const turnOrder = createTurnOrder(activePlayerIdentities)
    const now = new Date().toISOString()
    const nextSnapshot = createGameStateSnapshot({
      meetingId,
      roomCode,
      participantCount,
      participants: displayedParticipants,
      previousRevision: currentGameState.revision,
      hostParticipantIdentity: currentGameState.hostParticipantIdentity,
      readyParticipantIdentities: activeReadyParticipantIdentities,
      initialLives: currentGameState.initialLives ?? initialLives,
      phase: 'countdown',
      countdownStartedAt: now,
      countdownDurationMs: GAME_COUNTDOWN_DURATION_MS,
      roundNumber: currentGameState.roundNumber ?? 1,
      activePlayerIdentities,
      turnOrder,
      currentTurnIndex: currentGameState.currentTurnIndex ?? 0,
      playerStates: createInitialPlayerStates(
        activePlayerIdentities,
        currentGameState.initialLives ?? initialLives,
      ),
      roundResult: null,
      fairPlay: {
        ...currentGameState.fairPlay,
        check: {
          ...fairPlayCheck,
          passedAt: now,
        },
      },
    })

    const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

    gameStateSnapshotKeyRef.current = snapshotKey
    gameStateRef.current = nextSnapshot
    setGameState(nextSnapshot)
    publishedGameStateSnapshotRef.current = snapshotKey
    logMatchStartDebug('countdown started', {
      source: startSource,
      countdownStartedAt: nextSnapshot.countdownStartedAt,
      countdownDurationMs: nextSnapshot.countdownDurationMs,
      revision: nextSnapshot.revision,
    })
    void publishGameStateSnapshot(nextSnapshot)
  }, [
    activeReadyParticipantIdentities,
    cancelGameAutoStartTimers,
    displayedParticipants,
    initialLives,
    isCurrentUserHost,
    meetingId,
    participantNamesByIdentity,
    participantCount,
    publishGameStateSnapshot,
    roomCode,
  ])

  const applyFairPlayEventFromHost = useCallback((
    senderParticipantIdentity: string,
    event: Pick<
      GameFairPlayEventRequest,
      'eventId' | 'reason' | 'roundNumber' | 'attackSequence' | 'detectedAt'
    >,
  ) => {
    const currentGameState = gameStateRef.current
    const attackId = [
      currentGameState.roundNumber ?? event.roundNumber,
      currentGameState.attackSequence ?? event.attackSequence ?? 'attack',
      currentGameState.attackerIdentity ?? 'attacker',
    ].join(':')
    const remainingLife =
      currentGameState.playerStates?.[senderParticipantIdentity]?.lives
      ?? currentGameState.initialLives
      ?? initialLives

    if (processedFairPlayEventIdsRef.current.has(event.eventId)) {
      logGameDamageDebug('damage ignored: duplicate event', {
        attackId,
        defenderIdentity: senderParticipantIdentity,
        damageApplied: false,
        remainingLife,
      })
      return
    }

    processedFairPlayEventIdsRef.current.add(event.eventId)

    if (
      !isCurrentUserHost
      || currentGameState.phase !== 'attack-active'
      || currentGameState.roundNumber !== event.roundNumber
      || currentGameState.attackSequence !== event.attackSequence
      || !currentGameState.activePlayerIdentities?.includes(senderParticipantIdentity)
      || currentGameState.attackerIdentity === senderParticipantIdentity
      || !currentGameState.defenderIdentities?.includes(senderParticipantIdentity)
      || currentGameState.playerStates?.[senderParticipantIdentity]?.eliminated
    ) {
      logGameDamageDebug('damage ignored: invalid attack state', {
        attackId,
        defenderIdentity: senderParticipantIdentity,
        damageApplied: false,
        remainingLife,
      })
      return
    }

    if (
      currentGameState.penalizedParticipantIdentitiesForCurrentAttack
        ?.includes(senderParticipantIdentity)
    ) {
      logGameDamageDebug('damage ignored: already applied this attack', {
        attackId,
        defenderIdentity: senderParticipantIdentity,
        damageApplied: false,
        remainingLife,
      })
      return
    }

    const playerStates = {
      ...(currentGameState.playerStates ?? {}),
    }
    const previousLives =
      playerStates[senderParticipantIdentity]?.lives
      ?? currentGameState.initialLives
      ?? initialLives
    const currentLives = Math.max(0, previousLives - 1)
    const eliminated = currentLives === 0
    playerStates[senderParticipantIdentity] = {
      lives: currentLives,
      eliminated,
    }
    const penalizedParticipantIdentities = [
      ...(currentGameState.penalizedParticipantIdentitiesForCurrentAttack ?? []),
      senderParticipantIdentity,
    ]
    const activeDefenderIdentities = getActiveDefenderIdentitiesForAttack({
      defenderIdentities: currentGameState.defenderIdentities,
      playerStates: currentGameState.playerStates,
    })
    const hitDefenderIdentitySet = new Set(penalizedParticipantIdentities)
    const allDefendersHit =
      activeDefenderIdentities.length > 0
      && activeDefenderIdentities.every((participantIdentity) => (
        hitDefenderIdentitySet.has(participantIdentity)
      ))
    const alivePlayerIdentitiesAfterDamage = getAlivePlayerIdentities({
      activePlayerIdentities: currentGameState.activePlayerIdentities,
      playerStates,
    })
    const matchEnded =
      allDefendersHit
      && alivePlayerIdentitiesAfterDamage.length <= 1

    if (allDefendersHit && attackCompletionTimerRef.current !== null) {
      window.clearTimeout(attackCompletionTimerRef.current)
      attackCompletionTimerRef.current = null
    }

    const nextSnapshot = createGameStateSnapshot({
      meetingId,
      roomCode,
      participantCount,
      participants: displayedParticipants,
      previousRevision: currentGameState.revision,
      hostParticipantIdentity: currentGameState.hostParticipantIdentity,
      readyParticipantIdentities: matchEnded
        ? []
        : activeReadyParticipantIdentities,
      initialLives: currentGameState.initialLives ?? initialLives,
      phase: matchEnded
        ? 'post-game'
        : allDefendersHit
          ? 'attack-ended'
          : 'attack-active',
      countdownStartedAt: currentGameState.countdownStartedAt,
      countdownDurationMs: currentGameState.countdownDurationMs,
      roundNumber: currentGameState.roundNumber,
      activePlayerIdentities: matchEnded
        ? alivePlayerIdentitiesAfterDamage
        : currentGameState.activePlayerIdentities,
      turnOrder: currentGameState.turnOrder,
      currentTurnIndex: currentGameState.currentTurnIndex,
      attackerIdentity: currentGameState.attackerIdentity,
      defenderIdentities: currentGameState.defenderIdentities,
      roleRevealStartedAt: currentGameState.roleRevealStartedAt,
      roleRevealDurationMs: currentGameState.roleRevealDurationMs,
      attackStartedAt: currentGameState.attackStartedAt,
      attackDurationMs: currentGameState.attackDurationMs,
      attackEndsAt: currentGameState.attackEndsAt,
      attackEndReason: allDefendersHit ? 'all-defenders-hit' : undefined,
      attackSequence: currentGameState.attackSequence,
      attackContent: currentGameState.attackContent,
      playerStates,
      penalizedParticipantIdentitiesForCurrentAttack:
        penalizedParticipantIdentities,
      roundResult: currentGameState.roundResult,
      fairPlay: {
        ...currentGameState.fairPlay,
        check: matchEnded
          ? createFairPlayCheckState({
              activePlayerIdentities: alivePlayerIdentitiesAfterDamage,
              participantNamesByIdentity,
              previous: currentGameState.fairPlay?.check,
            })
          : currentGameState.fairPlay?.check,
        lastEvent: {
          eventId: event.eventId,
          participantIdentity: senderParticipantIdentity,
          reason: event.reason,
          roundNumber: event.roundNumber,
          attackSequence: event.attackSequence,
          previousLives,
          currentLives,
          eliminated,
          detectedAt: event.detectedAt,
        },
      },
    })
    const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

    const timer = window.setTimeout(() => {
      gameStateSnapshotKeyRef.current = snapshotKey
      gameStateRef.current = nextSnapshot
      if (matchEnded) {
        setReadyParticipantIdentities([])
      }
      setGameState(nextSnapshot)
      publishedGameStateSnapshotRef.current = snapshotKey
      logGameDamageDebug('damage applied', {
        attackId,
        defenderIdentity: senderParticipantIdentity,
        damageApplied: true,
        remainingLife: currentLives,
        allDefendersHit,
        matchEnded,
      })
      void publishGameStateSnapshot(nextSnapshot)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [
    activeReadyParticipantIdentities,
    displayedParticipants,
    isCurrentUserHost,
    initialLives,
    meetingId,
    participantNamesByIdentity,
    participantCount,
    publishGameStateSnapshot,
    roomCode,
  ])

  const handleLocalFairPlayEvent = useCallback((event: Omit<
    GameFairPlayEventRequest,
    'type' | 'meetingId' | 'roomCode' | 'roundNumber' | 'attackSequence'
  >) => {
    const currentGameState = gameStateRef.current
    const attackId = [
      currentGameState.roundNumber ?? 'round',
      currentGameState.attackSequence ?? 'attack',
      currentGameState.attackerIdentity ?? 'attacker',
      localParticipantIdentity ?? 'defender',
    ].join(':')

    if (
      !localParticipantIdentity
      || currentGameState.phase !== 'attack-active'
      || currentGameState.attackerIdentity === localParticipantIdentity
      || !currentGameState.defenderIdentities?.includes(localParticipantIdentity)
      || currentGameState.playerStates?.[localParticipantIdentity]?.eliminated
      || currentGameState.penalizedParticipantIdentitiesForCurrentAttack
        ?.includes(localParticipantIdentity)
      || typeof currentGameState.roundNumber !== 'number'
      || localFairPlayAttackReportRef.current.has(attackId)
      || localFairPlayEventReportedRef.current.has(event.eventId)
    ) {
      return
    }

    localFairPlayEventReportedRef.current.add(event.eventId)
    localFairPlayAttackReportRef.current.add(attackId)

    if (isCurrentUserHost) {
      applyFairPlayEventFromHost(localParticipantIdentity, {
        eventId: event.eventId,
        reason: event.reason,
        roundNumber: currentGameState.roundNumber,
        attackSequence: currentGameState.attackSequence,
        detectedAt: event.detectedAt,
      })
      return
    }

    const controller = liveKitDataControllerRef.current
    if (!controller || !isLiveKitConnected || !isLiveKitDataReady) {
      return
    }

    void controller.publishGameMessage({
      type: 'fair-play-event-request',
      payload: {
        type: 'fair-play-event-request',
        meetingId,
        roomCode,
        eventId: event.eventId,
        reason: event.reason,
        roundNumber: currentGameState.roundNumber,
        attackSequence: currentGameState.attackSequence,
        detectorVersion: event.detectorVersion,
        scoreSummary: event.scoreSummary,
        detectedAt: event.detectedAt,
      },
    })
  }, [
    applyFairPlayEventFromHost,
    isCurrentUserHost,
    isLiveKitConnected,
    isLiveKitDataReady,
    localParticipantIdentity,
    meetingId,
    roomCode,
  ])

  const handleAudioLaughEvent = useCallback((event: AudioLaughEvent) => {
    const currentGameState = gameStateRef.current
    const visualDebug = fairPlayDebugRef.current
    const visualWarning = fairPlayWarningRef.current
    const currentLocalParticipantIdentity = localParticipantIdentityRef.current

    if (
      !currentLocalParticipantIdentity
      || currentGameState.phase !== 'attack-active'
      || currentGameState.penalizedParticipantIdentitiesForCurrentAttack
        ?.includes(currentLocalParticipantIdentity)
    ) {
      return
    }

    const visualSignalScore =
      ((visualDebug?.smileScore ?? 0) * 0.72)
      + ((visualDebug?.cheekScore ?? 0) * 0.28)
    const hasVisualLaughSignal =
      visualDebug?.laughState === 'candidate'
      || visualSignalScore >= 0.42
    const isMouthOccluded =
      visualWarning.reason === 'mouth-occluded'
      || visualDebug?.mouthOccluded === true
    const isFaceHidden =
      visualWarning.reason === 'face-not-visible'
      || visualDebug?.faceVisible === false
    const isFaceVisible = visualDebug?.faceVisible === true
    const reason =
      isMouthOccluded && event.audioLaughScore >= AUDIO_LAUGH_TRIGGER_THRESHOLD
        ? 'occluded-audio-laugh'
        : isFaceHidden && event.audioLaughScore >= AUDIO_LAUGH_TRIGGER_THRESHOLD
          ? 'hidden-audio-laugh'
          : hasVisualLaughSignal && event.audioLaughScore >= AUDIO_LAUGH_TRIGGER_THRESHOLD
            ? 'multimodal-laugh'
            : isFaceVisible && event.audioLaughScore >= AUDIO_LAUGH_VERY_HIGH_THRESHOLD
              ? 'audio-laugh'
              : null

    if (!reason) {
      return
    }

    handleLocalFairPlayEvent({
      eventId: event.eventId,
      reason,
      detectorVersion: 'fusion-audio-visual-mvp-1',
      scoreSummary: {
        smileScore: visualDebug?.smileScore,
        cheekScore: visualDebug?.cheekScore,
        audioLaughScore: event.audioLaughScore,
        audioTopCategoryName: event.topCategoryName,
        audioTopCategoryScore: event.topCategoryScore,
      },
      detectedAt: event.detectedAt,
    })
  }, [
    handleLocalFairPlayEvent,
  ])

  const startAttackFromHost = useCallback((requesterIdentity: string) => {
    const currentGameState = gameStateRef.current
    const currentRoundNumber = currentGameState.roundNumber
    const currentAttackSequence = currentGameState.attackSequence ?? 0
    const requestKey = [
      currentRoundNumber ?? 'round',
      currentAttackSequence,
      requesterIdentity,
    ].join(':')

    if (
      !isCurrentUserHost
      || currentGameState.phase !== 'attack-ready'
      || !currentGameState.attackerIdentity
      || currentGameState.attackerIdentity !== requesterIdentity
      || typeof currentRoundNumber !== 'number'
      || !currentGameState.activePlayerIdentities?.includes(requesterIdentity)
      || !currentGameState.attackContent
      || currentGameState.attackStartedAt
      || processedAttackStartRequestsRef.current.has(requestKey)
    ) {
      return
    }

    processedAttackStartRequestsRef.current.add(requestKey)

    const attackStartedAt = new Date()
    const attackEndsAt = new Date(
      attackStartedAt.getTime() + GAME_ATTACK_DURATION_MS,
    )
    const nextSnapshot = createGameStateSnapshot({
      meetingId,
      roomCode,
      participantCount,
      participants: displayedParticipants,
      previousRevision: currentGameState.revision,
      hostParticipantIdentity: currentGameState.hostParticipantIdentity,
      readyParticipantIdentities: activeReadyParticipantIdentities,
      initialLives: currentGameState.initialLives ?? initialLives,
      phase: 'attack-active',
      countdownStartedAt: currentGameState.countdownStartedAt,
      countdownDurationMs: currentGameState.countdownDurationMs,
      roundNumber: currentRoundNumber,
      activePlayerIdentities: currentGameState.activePlayerIdentities,
      turnOrder: currentGameState.turnOrder,
      currentTurnIndex: currentGameState.currentTurnIndex,
      attackerIdentity: currentGameState.attackerIdentity,
      defenderIdentities: currentGameState.defenderIdentities,
      roleRevealStartedAt: currentGameState.roleRevealStartedAt,
      roleRevealDurationMs: currentGameState.roleRevealDurationMs,
      attackStartedAt: attackStartedAt.toISOString(),
      attackDurationMs: GAME_ATTACK_DURATION_MS,
      attackEndsAt: attackEndsAt.toISOString(),
      attackSequence: currentAttackSequence + 1,
      attackContent: currentGameState.attackContent,
      playerStates: currentGameState.playerStates,
      penalizedParticipantIdentitiesForCurrentAttack: [],
      roundResult: null,
    })
    const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

    const timer = window.setTimeout(() => {
      gameStateSnapshotKeyRef.current = snapshotKey
      gameStateRef.current = nextSnapshot
      setGameState(nextSnapshot)
      publishedGameStateSnapshotRef.current = snapshotKey
      void publishGameStateSnapshot(nextSnapshot)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [
    activeReadyParticipantIdentities,
    displayedParticipants,
    initialLives,
    isCurrentUserHost,
    meetingId,
    participantCount,
    publishGameStateSnapshot,
    roomCode,
  ])

  const approveAttackContentFromHost = useCallback(async (
    contentId: string,
    senderParticipantIdentity: string,
    requestedRoundNumber: number,
    requestedAttackSequence?: number,
  ) => {
    const currentGameState = gameStateRef.current
    const currentAttackSequence = currentGameState.attackSequence
    const requestKey = [
      currentGameState.roundNumber ?? 'round',
      currentAttackSequence ?? 'sequence',
      senderParticipantIdentity,
      contentId,
    ].join(':')

    if (
      !isCurrentUserHost
      || currentGameState.phase !== 'attack-ready'
      || currentGameState.attackerIdentity !== senderParticipantIdentity
      || currentGameState.roundNumber !== requestedRoundNumber
      || currentAttackSequence !== requestedAttackSequence
      || !currentGameState.activePlayerIdentities?.includes(senderParticipantIdentity)
      || processedAttackContentRequestsRef.current.has(requestKey)
    ) {
      return
    }

    processedAttackContentRequestsRef.current.add(requestKey)

    try {
      const metadata = await fetchAttackContentMetadata(contentId)
      const normalizedMetadataRoomCode = metadata.roomCode.trim().toUpperCase()

      if (
        metadata.contentId !== contentId
        || normalizedMetadataRoomCode !== roomCode
        || metadata.uploaderParticipantIdentity !== senderParticipantIdentity
      ) {
        return
      }

      const latestGameState = gameStateRef.current

      if (
        latestGameState.phase !== 'attack-ready'
        || latestGameState.attackerIdentity !== senderParticipantIdentity
        || latestGameState.roundNumber !== requestedRoundNumber
        || latestGameState.attackSequence !== requestedAttackSequence
      ) {
        return
      }

      const nextAttackContent: GameAttackContent = {
        contentId: metadata.contentId,
        mimeType: metadata.mimeType,
        size: metadata.size,
        uploaderParticipantIdentity: metadata.uploaderParticipantIdentity,
        roomCode: normalizedMetadataRoomCode,
        roundNumber: requestedRoundNumber,
        version: (latestGameState.attackContent?.version ?? 0) + 1,
        createdAt: metadata.createdAt,
      }
      const nextSnapshot = createGameStateSnapshot({
        meetingId,
        roomCode,
        participantCount,
        participants: displayedParticipants,
        previousRevision: latestGameState.revision,
        hostParticipantIdentity: latestGameState.hostParticipantIdentity,
        readyParticipantIdentities: activeReadyParticipantIdentities,
        initialLives: currentGameState.initialLives ?? initialLives,
        phase: 'attack-ready',
        countdownStartedAt: latestGameState.countdownStartedAt,
        countdownDurationMs: latestGameState.countdownDurationMs,
        roundNumber: latestGameState.roundNumber,
        activePlayerIdentities: latestGameState.activePlayerIdentities,
        turnOrder: latestGameState.turnOrder,
        currentTurnIndex: latestGameState.currentTurnIndex,
        attackerIdentity: latestGameState.attackerIdentity,
        defenderIdentities: latestGameState.defenderIdentities,
        roleRevealStartedAt: latestGameState.roleRevealStartedAt,
        roleRevealDurationMs: latestGameState.roleRevealDurationMs,
        attackSequence: latestGameState.attackSequence,
        attackContent: nextAttackContent,
        playerStates: latestGameState.playerStates,
        roundResult: null,
      })
      const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

      gameStateSnapshotKeyRef.current = snapshotKey
      gameStateRef.current = nextSnapshot
      setGameState(nextSnapshot)
      publishedGameStateSnapshotRef.current = snapshotKey
      void publishGameStateSnapshot(nextSnapshot)
    } catch (error) {
      console.warn('[livekit-game] Failed to approve attack image', error)
    }
  }, [
    activeReadyParticipantIdentities,
    displayedParticipants,
    initialLives,
    isCurrentUserHost,
    meetingId,
    participantCount,
    publishGameStateSnapshot,
    roomCode,
  ])

  const handleUploadAttackContent = useCallback(async (file: File) => {
    const currentGameState = gameStateRef.current

    if (
      !localParticipantIdentity
      || currentGameState.phase !== 'attack-ready'
      || currentGameState.attackerIdentity !== localParticipantIdentity
      || typeof currentGameState.roundNumber !== 'number'
    ) {
      return
    }

    setIsUploadingAttackContent(true)
    setAttackContentMessage('이미지를 업로드하고 있습니다...')

    try {
      const metadata = await uploadAttackContent({ roomCode, file })
      const latestGameState = gameStateRef.current

      if (
        latestGameState.phase !== 'attack-ready'
        || latestGameState.attackerIdentity !== localParticipantIdentity
        || latestGameState.roundNumber !== currentGameState.roundNumber
      ) {
        setAttackContentMessage('공격 상태가 변경되어 이미지를 적용하지 않았습니다.')
        return
      }

      if (isCurrentUserHost) {
        await approveAttackContentFromHost(
          metadata.contentId,
          localParticipantIdentity,
          latestGameState.roundNumber,
          latestGameState.attackSequence,
        )
        setAttackContentMessage('공격 이미지가 준비되었습니다.')
        return
      }

      const controller = liveKitDataControllerRef.current

      if (!controller || !isLiveKitConnected || !isLiveKitDataReady) {
        setAttackContentMessage('이미지를 업로드했지만 Host에게 전달하지 못했습니다.')
        return
      }

      await controller.publishGameMessage({
        type: 'attack-content-submit-request',
        payload: createGameAttackContentSubmitRequest({
          meetingId,
          roomCode,
          contentId: metadata.contentId,
          roundNumber: latestGameState.roundNumber,
          attackSequence: latestGameState.attackSequence,
        }),
      })
      setAttackContentMessage('이미지를 업로드했습니다. Host 승인 중입니다.')
    } catch (error) {
      setAttackContentMessage(
        error instanceof Error
          ? error.message
          : getAttackContentErrorMessage('ATTACK_CONTENT_UPLOAD_FAILED'),
      )
    } finally {
      setIsUploadingAttackContent(false)
    }
  }, [
    approveAttackContentFromHost,
    isCurrentUserHost,
    isLiveKitConnected,
    isLiveKitDataReady,
    localParticipantIdentity,
    meetingId,
    roomCode,
  ])

  const handleRequestAttackStart = useCallback(() => {
    if (
      !localParticipantIdentity
      || gameStateRef.current.phase !== 'attack-ready'
      || gameStateRef.current.attackerIdentity !== localParticipantIdentity
      || typeof gameStateRef.current.roundNumber !== 'number'
      || !gameStateRef.current.attackContent
    ) {
      return
    }

    const roundNumber = gameStateRef.current.roundNumber

    if (isCurrentUserHost) {
      startAttackFromHost(localParticipantIdentity)
      return
    }

    const controller = liveKitDataControllerRef.current

    if (!controller || !isLiveKitConnected || !isLiveKitDataReady) {
      return
    }

    const currentGameState = gameStateRef.current

    void controller.publishGameMessage({
      type: 'attack-start-request',
      payload: createGameAttackStartRequest({
        meetingId,
        roomCode,
        roundNumber,
        attackSequence: currentGameState.attackSequence,
      }),
    }).catch((error) => {
      console.warn('[livekit-game] Failed to request attack start', error)
    })
  }, [
    isCurrentUserHost,
    isLiveKitConnected,
    isLiveKitDataReady,
    localParticipantIdentity,
    meetingId,
    roomCode,
    startAttackFromHost,
  ])

  const handleStartNextRound = useCallback(() => {
    const currentGameState = gameStateRef.current

    if (
      !isCurrentUserHost
      || !(
        currentGameState.phase === 'round-ended'
        || (
          currentGameState.phase === 'round-result'
          && currentGameState.roundResult
        )
      )
    ) {
      return
    }

    const alivePlayerIdentities = getAlivePlayerIdentities({
      activePlayerIdentities: currentGameState.activePlayerIdentities,
      playerStates: currentGameState.playerStates,
    })

    if (alivePlayerIdentities.length <= 1) {
      const winnerIdentity = alivePlayerIdentities[0]
      const postGameFairPlay = createFairPlayCheckState({
        activePlayerIdentities: alivePlayerIdentities,
        participantNamesByIdentity,
        previous: currentGameState.fairPlay?.check,
      })
      const nextSnapshot = createGameStateSnapshot({
        meetingId,
        roomCode,
        participantCount,
        participants: displayedParticipants,
        previousRevision: currentGameState.revision,
        hostParticipantIdentity: currentGameState.hostParticipantIdentity,
        readyParticipantIdentities: activeReadyParticipantIdentities,
        initialLives: currentGameState.initialLives ?? initialLives,
        phase: 'post-game',
        roundNumber: currentGameState.roundNumber,
        activePlayerIdentities: alivePlayerIdentities,
        turnOrder: currentGameState.turnOrder,
        currentTurnIndex: currentGameState.currentTurnIndex,
        attackerIdentity: currentGameState.attackerIdentity,
        defenderIdentities: [],
        attackSequence: currentGameState.attackSequence,
        playerStates: currentGameState.playerStates,
        roundResult: currentGameState.roundResult,
        attackContent: null,
        fairPlay: {
          ...currentGameState.fairPlay,
          check: postGameFairPlay,
        },
      })
      const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

      logPostGameDebug('game over entered', {
        winnerIdentity,
        revision: nextSnapshot.revision,
      })
      gameStateSnapshotKeyRef.current = snapshotKey
      gameStateRef.current = nextSnapshot
      setGameState(nextSnapshot)
      publishedGameStateSnapshotRef.current = snapshotKey
      void publishGameStateSnapshot(nextSnapshot)
      return
    }

    const nextAttacker =
      currentGameState.phase === 'round-ended'
        ? {
            turnOrder: (currentGameState.turnOrder ?? alivePlayerIdentities)
              .filter((participantIdentity) => (
                alivePlayerIdentities.includes(participantIdentity)
              )),
            currentTurnIndex: Math.max(
              0,
              (currentGameState.turnOrder ?? alivePlayerIdentities).findIndex(
                (participantIdentity) => (
                  participantIdentity === currentGameState.attackerIdentity
                ),
              ),
            ),
            attackerIdentity: currentGameState.attackerIdentity,
          }
        : getNextAttackerIdentity({
            turnOrder: currentGameState.turnOrder,
            activePlayerIdentities: alivePlayerIdentities,
            currentAttackerIdentity: currentGameState.attackerIdentity,
            playerStates: currentGameState.playerStates,
          })

    if (!nextAttacker.attackerIdentity) {
      return
    }

    const nextRoundNumber =
      currentGameState.phase === 'round-ended'
        ? currentGameState.roundNumber
        : (currentGameState.roundNumber ?? 1) + 1
    const nextSnapshot = createGameStateSnapshot({
      meetingId,
      roomCode,
      participantCount,
      participants: displayedParticipants,
      previousRevision: currentGameState.revision,
      hostParticipantIdentity: currentGameState.hostParticipantIdentity,
      readyParticipantIdentities: activeReadyParticipantIdentities,
      initialLives: currentGameState.initialLives ?? initialLives,
      phase: 'attack-ready',
      countdownStartedAt: currentGameState.countdownStartedAt,
      countdownDurationMs: currentGameState.countdownDurationMs,
      roundNumber: nextRoundNumber,
      activePlayerIdentities: alivePlayerIdentities,
      turnOrder: nextAttacker.turnOrder,
      currentTurnIndex: nextAttacker.currentTurnIndex,
      attackerIdentity: nextAttacker.attackerIdentity,
      defenderIdentities: getDefenderIdentities(
        alivePlayerIdentities,
        nextAttacker.attackerIdentity,
      ),
      attackSequence: currentGameState.attackSequence,
      playerStates: currentGameState.playerStates,
      roundResult: null,
      attackContent: null,
      fairPlay: currentGameState.fairPlay,
    })
    const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

    gameStateSnapshotKeyRef.current = snapshotKey
    gameStateRef.current = nextSnapshot
    setGameState(nextSnapshot)
    publishedGameStateSnapshotRef.current = snapshotKey
    void publishGameStateSnapshot(nextSnapshot)
  }, [
    activeReadyParticipantIdentities,
    displayedParticipants,
    isCurrentUserHost,
    initialLives,
    meetingId,
    participantNamesByIdentity,
    participantCount,
    publishGameStateSnapshot,
    roomCode,
  ])

  useEffect(() => {
    if (
      !isCurrentUserHost
      || gameState.phase !== 'round-ended'
      || wasRemovedFromMeeting
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      const currentGameState = gameStateRef.current

      if (
        currentGameState.phase !== 'round-ended'
        || currentGameState.roundNumber !== gameState.roundNumber
        || currentGameState.attackSequence !== gameState.attackSequence
      ) {
        return
      }

      handleStartNextRound()
    }, GAME_TURN_HANDOFF_DURATION_MS)

    return () => window.clearTimeout(timer)
  }, [
    gameState.attackSequence,
    gameState.initialLives,
    gameState.phase,
    gameState.roundNumber,
    handleStartNextRound,
    isCurrentUserHost,
    wasRemovedFromMeeting,
  ])

  useEffect(() => {
    if (!isCurrentUserHost || wasRemovedFromMeeting) {
      return
    }

    const nextSnapshot = createCurrentGameStateSnapshot()
    const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

    if (snapshotKey !== gameStateSnapshotKeyRef.current) {
      gameStateSnapshotKeyRef.current = snapshotKey
      gameStateRef.current = nextSnapshot
      setGameState(nextSnapshot)
    }

    if (
      !isLiveKitConnected
      || !isLiveKitDataReady
      || snapshotKey === publishedGameStateSnapshotRef.current
    ) {
      return
    }

    if (isPreGameFairPlayPhase(nextSnapshot.phase)) {
      logNextMatchDebug('bootstrap snapshot publish', {
        phase: nextSnapshot.phase,
        host: nextSnapshot.hostParticipantIdentity,
        roster: nextSnapshot.participants
          .map((participant) => participant.participantIdentity)
          .filter(Boolean),
        fairPlayRequired:
          nextSnapshot.fairPlay?.check?.activePlayerIdentities ?? [],
        ready: nextSnapshot.participants
          .filter((participant) => participant.isReady)
          .map((participant) => participant.participantIdentity)
          .filter(Boolean),
      })
    }

    publishedGameStateSnapshotRef.current = snapshotKey
    void publishGameStateSnapshot(nextSnapshot)
  }, [
    createCurrentGameStateSnapshot,
    isCurrentUserHost,
    isLiveKitConnected,
    isLiveKitDataReady,
    publishGameStateSnapshot,
    activeReadyParticipantIdentities,
    wasRemovedFromMeeting,
  ])

  useEffect(() => {
    if (!isCurrentUserHost || wasRemovedFromMeeting) {
      return
    }

    const currentGameState = gameStateRef.current
    const isRoomFull =
      currentGameState.participantCount >= 2
      && currentGameState.connectedParticipantCount
        >= currentGameState.participantCount

    if (currentGameState.phase === 'auto-start-pending') {
      if (gameAutoStartTimerRef.current !== null) {
        window.clearTimeout(gameAutoStartTimerRef.current)
        gameAutoStartTimerRef.current = null
      }

      const nextReadyIdentities = filterReadyParticipantIdentities(
        displayedParticipants.slice(0, participantCount),
        activeReadyParticipantIdentities,
      )
      const nextSnapshot = createGameStateSnapshot({
        meetingId,
        roomCode,
        participantCount,
        participants: displayedParticipants,
        previousRevision: currentGameState.revision,
        hostParticipantIdentity: currentGameState.hostParticipantIdentity,
        readyParticipantIdentities: nextReadyIdentities,
        phase: isRoomFull ? undefined : 'waiting',
        roundResult: null,
        fairPlay: currentGameState.fairPlay,
      })
      const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

      const timer = window.setTimeout(() => {
        gameStateSnapshotKeyRef.current = snapshotKey
        gameStateRef.current = nextSnapshot
        setReadyParticipantIdentities(nextReadyIdentities)
        setGameState(nextSnapshot)
        publishedGameStateSnapshotRef.current = snapshotKey
        void publishGameStateSnapshot(nextSnapshot)
      }, 0)

      return () => window.clearTimeout(timer)
    }
  }, [
    activeReadyParticipantIdentities,
    displayedParticipants,
    gameState.connectedParticipantCount,
    gameState.participantCount,
    gameState.phase,
    isCurrentUserHost,
    meetingId,
    participantCount,
    publishGameStateSnapshot,
    roomCode,
    wasRemovedFromMeeting,
  ])

  useEffect(() => {
    if (gameState.phase === 'waiting' || gameState.phase === 'ready') {
      matchStartInFlightRef.current = false
    }
  }, [gameState.phase])

  useEffect(() => {
    cancelGameAutoStartTimers(`phase-${gameState.phase}`)
    const resetTimer = window.setTimeout(() => {
      if (gameState.phase !== 'ready') {
        setAutoStartRemainingSeconds(null)
      }
    }, 0)

    return () => window.clearTimeout(resetTimer)
  }, [cancelGameAutoStartTimers, gameState.phase])

  useEffect(() => {
    if (
      !isCurrentUserHost
      || wasRemovedFromMeeting
      || gameState.phase !== 'ready'
    ) {
      return
    }

    if (!canStartGame) {
      if (!gameState.autoStartAt) {
        return
      }

      const currentGameState = gameStateRef.current
      const nextSnapshot = createGameStateSnapshot({
        meetingId,
        roomCode,
        participantCount,
        participants: displayedParticipants,
        previousRevision: currentGameState.revision,
        hostParticipantIdentity: currentGameState.hostParticipantIdentity,
        readyParticipantIdentities: activeReadyParticipantIdentities,
        initialLives: currentGameState.initialLives ?? initialLives,
        phase: currentGameState.phase,
        autoStartAt: undefined,
        fairPlay: currentGameState.fairPlay,
      })
      const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

      gameStateSnapshotKeyRef.current = snapshotKey
      gameStateRef.current = nextSnapshot
      setGameState(nextSnapshot)
      publishedGameStateSnapshotRef.current = snapshotKey
      void publishGameStateSnapshot(nextSnapshot)
      return
    }

    if (gameState.autoStartAt) {
      logAutoStartDebug('existing schedule preserved', {
        autoStartAt: gameState.autoStartAt,
        revision: gameState.revision,
      })
      return
    }

    const autoStartAt = new Date(Date.now() + GAME_AUTO_START_DELAY_MS)
      .toISOString()
    const currentGameState = gameStateRef.current
    const nextSnapshot = createGameStateSnapshot({
      meetingId,
      roomCode,
      participantCount,
      participants: displayedParticipants,
      previousRevision: currentGameState.revision,
      hostParticipantIdentity: currentGameState.hostParticipantIdentity,
      readyParticipantIdentities: activeReadyParticipantIdentities,
      initialLives: currentGameState.initialLives ?? initialLives,
      phase: 'ready',
      autoStartAt,
      roundResult: null,
      fairPlay: currentGameState.fairPlay,
    })
    const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

    gameStateSnapshotKeyRef.current = snapshotKey
    gameStateRef.current = nextSnapshot
    setGameState(nextSnapshot)
    publishedGameStateSnapshotRef.current = snapshotKey
    logAutoStartDebug('all-ready entered', {
      revision: currentGameState.revision,
    })
    logAutoStartDebug('scheduled', {
      sequenceId: nextSnapshot.revision,
      autoStartAt,
    })
    void publishGameStateSnapshot(nextSnapshot)
  }, [
    activeReadyParticipantIdentities,
    canStartGame,
    displayedParticipants,
    gameState.autoStartAt,
    gameState.phase,
    gameState.revision,
    initialLives,
    isCurrentUserHost,
    meetingId,
    participantCount,
    publishGameStateSnapshot,
    roomCode,
    wasRemovedFromMeeting,
  ])

  useEffect(() => {
    if (gameAutoStartIntervalRef.current !== null) {
      window.clearInterval(gameAutoStartIntervalRef.current)
      gameAutoStartIntervalRef.current = null
    }

    if (gameState.phase !== 'ready' || !gameState.autoStartAt) {
      const resetTimer = window.setTimeout(() => {
        setAutoStartRemainingSeconds(null)
      }, 0)

      return () => window.clearTimeout(resetTimer)
    }

    const autoStartAtMs = Date.parse(gameState.autoStartAt)

    if (!Number.isFinite(autoStartAtMs)) {
      return
    }

    const updateRemaining = () => {
      const remainingMs = Math.max(
        0,
        autoStartAtMs - Date.now(),
      )
      const remainingSeconds = Math.ceil(remainingMs / 1000)

      setAutoStartRemainingSeconds(remainingSeconds)

      if (
        remainingSeconds > 0
        && remainingSeconds !== lastAutoStartLogRemainingRef.current
      ) {
        lastAutoStartLogRemainingRef.current = remainingSeconds
        logAutoStartDebug('tick', { remaining: remainingSeconds })
      }
    }

    const firstTickTimer = window.setTimeout(updateRemaining, 0)
    gameAutoStartIntervalRef.current = window.setInterval(updateRemaining, 250)

    return () => {
      window.clearTimeout(firstTickTimer)
      if (gameAutoStartIntervalRef.current !== null) {
        window.clearInterval(gameAutoStartIntervalRef.current)
        gameAutoStartIntervalRef.current = null
      }
    }
  }, [
    gameState.autoStartAt,
    gameState.phase,
  ])

  useEffect(() => {
    if (gameAutoStartTimerRef.current !== null) {
      window.clearTimeout(gameAutoStartTimerRef.current)
      gameAutoStartTimerRef.current = null
    }

    if (
      !isCurrentUserHost
      || wasRemovedFromMeeting
      || gameState.phase !== 'ready'
      || !gameState.autoStartAt
    ) {
      return
    }

    const autoStartAtMs = Date.parse(gameState.autoStartAt)

    if (!Number.isFinite(autoStartAtMs)) {
      return
    }

    const delayMs = Math.max(0, autoStartAtMs - Date.now())

    gameAutoStartTimerRef.current = window.setTimeout(() => {
      const currentGameState = gameStateRef.current

      if (
        currentGameState.phase !== 'ready'
        || currentGameState.autoStartAt !== gameState.autoStartAt
      ) {
        return
      }

      logAutoStartDebug('triggered', {
        autoStartAt: currentGameState.autoStartAt,
        revision: currentGameState.revision,
      })
      setAutoStartRemainingSeconds(null)
      handleStartGame('auto')
    }, delayMs)

    return () => {
      if (gameAutoStartTimerRef.current !== null) {
        window.clearTimeout(gameAutoStartTimerRef.current)
        gameAutoStartTimerRef.current = null
      }
    }
  }, [
    gameState.autoStartAt,
    gameState.phase,
    handleStartGame,
    isCurrentUserHost,
    wasRemovedFromMeeting,
  ])

  useEffect(() => {
    if (countdownCompletionTimerRef.current !== null) {
      window.clearTimeout(countdownCompletionTimerRef.current)
      countdownCompletionTimerRef.current = null
    }

    if (
      !isCurrentUserHost
      || gameState.phase !== 'countdown'
      || !gameState.countdownStartedAt
    ) {
      return
    }

    const countdownStartedAtMs = Date.parse(gameState.countdownStartedAt)

    if (!Number.isFinite(countdownStartedAtMs)) {
      return
    }

    const countdownDurationMs =
      gameState.countdownDurationMs ?? GAME_COUNTDOWN_DURATION_MS
    const countdownEndsAt = countdownStartedAtMs + countdownDurationMs
    const delayMs = Math.max(0, countdownEndsAt - Date.now())

    countdownCompletionTimerRef.current = window.setTimeout(() => {
      const currentGameState = gameStateRef.current

      if (
        currentGameState.phase !== 'countdown'
        || currentGameState.countdownStartedAt !== gameState.countdownStartedAt
      ) {
        return
      }

      const nextSnapshot = createGameStateSnapshot({
        meetingId,
        roomCode,
        participantCount,
        participants: displayedParticipants,
        previousRevision: currentGameState.revision,
        hostParticipantIdentity: currentGameState.hostParticipantIdentity,
        readyParticipantIdentities: activeReadyParticipantIdentities,
      initialLives: currentGameState.initialLives ?? initialLives,
        phase: 'game-started',
        countdownStartedAt: currentGameState.countdownStartedAt,
        countdownDurationMs: currentGameState.countdownDurationMs,
        roundNumber: currentGameState.roundNumber,
        activePlayerIdentities: currentGameState.activePlayerIdentities,
        turnOrder: currentGameState.turnOrder,
        currentTurnIndex: currentGameState.currentTurnIndex,
        playerStates: currentGameState.playerStates,
        roundResult: currentGameState.roundResult,
        fairPlay: currentGameState.fairPlay,
      })
      const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

      countdownCompletionTimerRef.current = null
      gameStateSnapshotKeyRef.current = snapshotKey
      gameStateRef.current = nextSnapshot
      setGameState(nextSnapshot)
      publishedGameStateSnapshotRef.current = snapshotKey
      logMatchStartDebug('match started', {
        countdownStartedAt: currentGameState.countdownStartedAt,
        revision: nextSnapshot.revision,
      })
      void publishGameStateSnapshot(nextSnapshot)
    }, delayMs)

    return () => {
      if (countdownCompletionTimerRef.current !== null) {
        window.clearTimeout(countdownCompletionTimerRef.current)
        countdownCompletionTimerRef.current = null
      }
    }
  }, [
    activeReadyParticipantIdentities,
    displayedParticipants,
    gameState.countdownDurationMs,
    gameState.countdownStartedAt,
    gameState.phase,
    initialLives,
    isCurrentUserHost,
    meetingId,
    participantCount,
    publishGameStateSnapshot,
    roomCode,
  ])

  useEffect(() => {
    if (
      !isCurrentUserHost
      || gameState.phase !== 'game-started'
      || Boolean(gameState.attackerIdentity)
      || wasRemovedFromMeeting
    ) {
      return
    }

    const activePlayerIdentities = getActivePlayerIdentities({
      participants: displayedParticipants,
      participantCount,
      readyParticipantIdentities: activeReadyParticipantIdentities,
    })

    if (activePlayerIdentities.length < 2) {
      const nextSnapshot = createGameStateSnapshot({
        meetingId,
        roomCode,
        participantCount,
        participants: displayedParticipants,
        previousRevision: gameStateRef.current.revision,
        hostParticipantIdentity: gameStateRef.current.hostParticipantIdentity,
        readyParticipantIdentities: activeReadyParticipantIdentities,
        initialLives: gameState.initialLives ?? initialLives,
        phase: 'waiting',
      })
      const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

      gameStateSnapshotKeyRef.current = snapshotKey
      gameStateRef.current = nextSnapshot
      setGameState(nextSnapshot)
      publishedGameStateSnapshotRef.current = snapshotKey
      void publishGameStateSnapshot(nextSnapshot)
      return
    }

    const turnOrder = createTurnOrder(activePlayerIdentities)
    const attackerIdentity = turnOrder[0]
    const nextSnapshot = createGameStateSnapshot({
      meetingId,
      roomCode,
      participantCount,
      participants: displayedParticipants,
      previousRevision: gameStateRef.current.revision,
      hostParticipantIdentity: gameStateRef.current.hostParticipantIdentity,
      readyParticipantIdentities: activeReadyParticipantIdentities,
      initialLives: gameState.initialLives ?? initialLives,
      phase: 'role-reveal',
      countdownStartedAt: gameStateRef.current.countdownStartedAt,
      countdownDurationMs: gameStateRef.current.countdownDurationMs,
      roundNumber: 1,
      activePlayerIdentities,
      turnOrder,
      currentTurnIndex: 0,
      attackerIdentity,
      defenderIdentities: getDefenderIdentities(activePlayerIdentities, attackerIdentity),
      roleRevealStartedAt: new Date().toISOString(),
      roleRevealDurationMs: GAME_ROLE_REVEAL_DURATION_MS,
      playerStates:
        gameState.playerStates ?? createInitialPlayerStates(
          activePlayerIdentities,
          gameState.initialLives ?? initialLives,
        ),
      roundResult: null,
      fairPlay: gameState.fairPlay,
    })
    const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

    gameStateSnapshotKeyRef.current = snapshotKey
    gameStateRef.current = nextSnapshot
    setGameState(nextSnapshot)
    publishedGameStateSnapshotRef.current = snapshotKey
    void publishGameStateSnapshot(nextSnapshot)
  }, [
    activeReadyParticipantIdentities,
    displayedParticipants,
    gameState.attackerIdentity,
    gameState.activePlayerIdentities,
    gameState.fairPlay,
    gameState.initialLives,
    gameState.playerStates,
    gameState.turnOrder,
    gameState.phase,
    initialLives,
    isCurrentUserHost,
    meetingId,
    participantCount,
    publishGameStateSnapshot,
    roomCode,
    wasRemovedFromMeeting,
  ])

  useEffect(() => {
    if (roleRevealCompletionTimerRef.current !== null) {
      window.clearTimeout(roleRevealCompletionTimerRef.current)
      roleRevealCompletionTimerRef.current = null
    }

    if (
      !isCurrentUserHost
      || gameState.phase !== 'role-reveal'
      || !gameState.roleRevealStartedAt
      || wasRemovedFromMeeting
    ) {
      return
    }

    const roleRevealStartedAtMs = Date.parse(gameState.roleRevealStartedAt)

    if (!Number.isFinite(roleRevealStartedAtMs)) {
      return
    }

    const roleRevealDurationMs =
      gameState.roleRevealDurationMs ?? GAME_ROLE_REVEAL_DURATION_MS
    const roleRevealEndsAt = roleRevealStartedAtMs + roleRevealDurationMs
    const delayMs = Math.max(0, roleRevealEndsAt - Date.now())

    roleRevealCompletionTimerRef.current = window.setTimeout(() => {
      const currentGameState = gameStateRef.current

      if (
        currentGameState.phase !== 'role-reveal'
        || currentGameState.roleRevealStartedAt !== gameState.roleRevealStartedAt
      ) {
        return
      }

      const nextSnapshot = createGameStateSnapshot({
        meetingId,
        roomCode,
        participantCount,
        participants: displayedParticipants,
        previousRevision: currentGameState.revision,
        hostParticipantIdentity: currentGameState.hostParticipantIdentity,
        readyParticipantIdentities: activeReadyParticipantIdentities,
      initialLives: currentGameState.initialLives ?? initialLives,
        phase: 'attack-ready',
        countdownStartedAt: currentGameState.countdownStartedAt,
        countdownDurationMs: currentGameState.countdownDurationMs,
        roundNumber: currentGameState.roundNumber,
        activePlayerIdentities: currentGameState.activePlayerIdentities,
        turnOrder: currentGameState.turnOrder,
        currentTurnIndex: currentGameState.currentTurnIndex,
        attackerIdentity: currentGameState.attackerIdentity,
        defenderIdentities: currentGameState.defenderIdentities,
        roleRevealStartedAt: currentGameState.roleRevealStartedAt,
        roleRevealDurationMs: currentGameState.roleRevealDurationMs,
        attackContent: null,
        playerStates: currentGameState.playerStates,
        roundResult: null,
      })
      const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

      roleRevealCompletionTimerRef.current = null
      gameStateSnapshotKeyRef.current = snapshotKey
      gameStateRef.current = nextSnapshot
      setGameState(nextSnapshot)
      publishedGameStateSnapshotRef.current = snapshotKey
      void publishGameStateSnapshot(nextSnapshot)
    }, delayMs)

    return () => {
      if (roleRevealCompletionTimerRef.current !== null) {
        window.clearTimeout(roleRevealCompletionTimerRef.current)
        roleRevealCompletionTimerRef.current = null
      }
    }
  }, [
    activeReadyParticipantIdentities,
    displayedParticipants,
    gameState.phase,
    gameState.roleRevealDurationMs,
    gameState.roleRevealStartedAt,
    initialLives,
    isCurrentUserHost,
    meetingId,
    participantCount,
    publishGameStateSnapshot,
    roomCode,
    wasRemovedFromMeeting,
  ])

  useEffect(() => {
    if (attackCompletionTimerRef.current !== null) {
      window.clearTimeout(attackCompletionTimerRef.current)
      attackCompletionTimerRef.current = null
    }

    if (
      !isCurrentUserHost
      || gameState.phase !== 'attack-active'
      || !gameState.attackEndsAt
      || wasRemovedFromMeeting
    ) {
      return
    }

    const attackEndsAtMs = Date.parse(gameState.attackEndsAt)

    if (!Number.isFinite(attackEndsAtMs)) {
      return
    }

    const delayMs = Math.max(0, attackEndsAtMs - Date.now())

    attackCompletionTimerRef.current = window.setTimeout(() => {
      const currentGameState = gameStateRef.current

      if (
        currentGameState.phase !== 'attack-active'
        || currentGameState.attackSequence !== gameState.attackSequence
        || currentGameState.attackEndsAt !== gameState.attackEndsAt
      ) {
        return
      }

      const nextSnapshot = createGameStateSnapshot({
        meetingId,
        roomCode,
        participantCount,
        participants: displayedParticipants,
        previousRevision: currentGameState.revision,
        hostParticipantIdentity: currentGameState.hostParticipantIdentity,
        readyParticipantIdentities: activeReadyParticipantIdentities,
      initialLives: currentGameState.initialLives ?? initialLives,
        phase: 'attack-ended',
        countdownStartedAt: currentGameState.countdownStartedAt,
        countdownDurationMs: currentGameState.countdownDurationMs,
        roundNumber: currentGameState.roundNumber,
        activePlayerIdentities: currentGameState.activePlayerIdentities,
        turnOrder: currentGameState.turnOrder,
        currentTurnIndex: currentGameState.currentTurnIndex,
        attackerIdentity: currentGameState.attackerIdentity,
        defenderIdentities: currentGameState.defenderIdentities,
        roleRevealStartedAt: currentGameState.roleRevealStartedAt,
        roleRevealDurationMs: currentGameState.roleRevealDurationMs,
        attackStartedAt: currentGameState.attackStartedAt,
        attackDurationMs: currentGameState.attackDurationMs,
        attackEndsAt: currentGameState.attackEndsAt,
        attackEndReason: 'timeout',
        attackSequence: currentGameState.attackSequence,
        attackContent: currentGameState.attackContent,
        playerStates: currentGameState.playerStates,
        penalizedParticipantIdentitiesForCurrentAttack:
          currentGameState.penalizedParticipantIdentitiesForCurrentAttack,
        roundResult: null,
      })
      const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

      attackCompletionTimerRef.current = null
      gameStateSnapshotKeyRef.current = snapshotKey
      gameStateRef.current = nextSnapshot
      setGameState(nextSnapshot)
      publishedGameStateSnapshotRef.current = snapshotKey
      void publishGameStateSnapshot(nextSnapshot)
    }, delayMs)

    return () => {
      if (attackCompletionTimerRef.current !== null) {
        window.clearTimeout(attackCompletionTimerRef.current)
        attackCompletionTimerRef.current = null
      }
    }
  }, [
    activeReadyParticipantIdentities,
    displayedParticipants,
    gameState.attackSequence,
    gameState.attackEndsAt,
    gameState.initialLives,
    gameState.phase,
    initialLives,
    isCurrentUserHost,
    meetingId,
    participantCount,
    publishGameStateSnapshot,
    roomCode,
    wasRemovedFromMeeting,
  ])

  useEffect(() => {
    if (roundTransitionTimerRef.current !== null) {
      window.clearTimeout(roundTransitionTimerRef.current)
      roundTransitionTimerRef.current = null
    }

    if (
      !isCurrentUserHost
      || gameState.phase !== 'attack-ended'
      || wasRemovedFromMeeting
    ) {
      return
    }

    roundTransitionTimerRef.current = window.setTimeout(() => {
      const currentGameState = gameStateRef.current

      if (
        currentGameState.phase !== 'attack-ended'
        || currentGameState.attackSequence !== gameState.attackSequence
        || currentGameState.roundNumber !== gameState.roundNumber
      ) {
        return
      }

      const visibleParticipantIdentities = new Set(
        displayedParticipants
          .slice(0, participantCount)
          .map(getParticipantGameIdentity),
      )
      const activePlayerIdentities = getAlivePlayerIdentities({
        activePlayerIdentities: (currentGameState.activePlayerIdentities ?? [])
        .filter((participantIdentity) => (
          visibleParticipantIdentities.has(participantIdentity)
        )),
        playerStates: currentGameState.playerStates,
      })

      if (activePlayerIdentities.length < 2) {
        const winnerIdentity = activePlayerIdentities[0]
        const nextSnapshot = createGameStateSnapshot({
          meetingId,
          roomCode,
          participantCount,
          participants: displayedParticipants,
          previousRevision: currentGameState.revision,
          hostParticipantIdentity: currentGameState.hostParticipantIdentity,
          readyParticipantIdentities: winnerIdentity
            ? []
            : activeReadyParticipantIdentities,
          initialLives: currentGameState.initialLives ?? initialLives,
          phase: winnerIdentity ? 'post-game' : 'waiting',
          roundNumber: currentGameState.roundNumber,
          activePlayerIdentities,
          turnOrder: currentGameState.turnOrder,
          currentTurnIndex: currentGameState.currentTurnIndex,
          attackerIdentity: currentGameState.attackerIdentity,
          defenderIdentities: [],
          playerStates: currentGameState.playerStates,
          penalizedParticipantIdentitiesForCurrentAttack: [],
          roundResult: currentGameState.roundResult,
        })
        const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

        if (winnerIdentity) {
          logPostGameDebug('game over entered', {
            winnerIdentity,
            revision: nextSnapshot.revision,
          })
        }
        roundTransitionTimerRef.current = null
        gameStateSnapshotKeyRef.current = snapshotKey
        gameStateRef.current = nextSnapshot
        if (winnerIdentity) {
          setReadyParticipantIdentities([])
        }
        setGameState(nextSnapshot)
        publishedGameStateSnapshotRef.current = snapshotKey
        void publishGameStateSnapshot(nextSnapshot)
        return
      }

      const nextAttacker = getNextAttackerIdentity({
        turnOrder: currentGameState.turnOrder,
        activePlayerIdentities,
        currentAttackerIdentity: currentGameState.attackerIdentity,
        playerStates: currentGameState.playerStates,
      })

      const nextSnapshot = createGameStateSnapshot({
        meetingId,
        roomCode,
        participantCount,
        participants: displayedParticipants,
        previousRevision: currentGameState.revision,
        hostParticipantIdentity: currentGameState.hostParticipantIdentity,
        readyParticipantIdentities: activeReadyParticipantIdentities,
      initialLives: currentGameState.initialLives ?? initialLives,
        phase: 'round-ended',
        countdownStartedAt: currentGameState.countdownStartedAt,
        countdownDurationMs: currentGameState.countdownDurationMs,
        roundNumber: (currentGameState.roundNumber ?? 1) + 1,
        activePlayerIdentities,
        turnOrder: nextAttacker.turnOrder,
        currentTurnIndex: nextAttacker.currentTurnIndex,
        attackerIdentity: nextAttacker.attackerIdentity,
        defenderIdentities: getDefenderIdentities(
          activePlayerIdentities,
          nextAttacker.attackerIdentity,
        ),
        attackSequence: currentGameState.attackSequence,
        attackContent: null,
        playerStates: currentGameState.playerStates,
        penalizedParticipantIdentitiesForCurrentAttack: [],
        roundResult: null,
        fairPlay: currentGameState.fairPlay,
      })
      const snapshotKey = getGameStateSnapshotKey(nextSnapshot)

      roundTransitionTimerRef.current = null
      gameStateSnapshotKeyRef.current = snapshotKey
      gameStateRef.current = nextSnapshot
      setGameState(nextSnapshot)
      setAttackContentMessage('')
      publishedGameStateSnapshotRef.current = snapshotKey
      void publishGameStateSnapshot(nextSnapshot)
    }, GAME_ATTACK_END_REVIEW_DURATION_MS)

    return () => {
      if (roundTransitionTimerRef.current !== null) {
        window.clearTimeout(roundTransitionTimerRef.current)
        roundTransitionTimerRef.current = null
      }
    }
  }, [
    activeReadyParticipantIdentities,
    displayedParticipants,
    gameState.attackSequence,
    gameState.initialLives,
    gameState.phase,
    gameState.roundNumber,
    initialLives,
    isCurrentUserHost,
    meetingId,
    participantCount,
    publishGameStateSnapshot,
    roomCode,
    wasRemovedFromMeeting,
  ])

  useEffect(() => {
    if (postGameTransitionTimerRef.current !== null) {
      window.clearTimeout(postGameTransitionTimerRef.current)
      postGameTransitionTimerRef.current = null
    }

    if (gameState.phase === 'game-over' && !wasRemovedFromMeeting) {
      logPostGameDebug('waiting for server authoritative post-game', {
        postGameAt: gameState.postGameAt,
        isCurrentUserHost,
      })
    }

    return () => {
      if (postGameTransitionTimerRef.current !== null) {
        window.clearTimeout(postGameTransitionTimerRef.current)
        postGameTransitionTimerRef.current = null
      }
    }
  }, [
    gameState.phase,
    gameState.postGameAt,
    isCurrentUserHost,
    wasRemovedFromMeeting,
  ])

  useEffect(() => {
    if (
      !isCurrentUserHost
      || !isLiveKitConnected
      || !liveKitConnection
      || wasRemovedFromMeeting
    ) {
      return
    }

    const currentHost = displayedParticipants.find(
      (participant) => participant.meetingRole === 'host',
    )

    if (
      !currentHost?.liveKitIdentity
      || !roomHostControlToken
    ) {
      return
    }

    Object.entries(gameState.playerStates ?? {}).forEach(
      ([participantIdentity, playerState]) => {
        if (
          !playerState.eliminated
          || removedEliminatedParticipantIdentitiesRef.current.has(
            participantIdentity,
          )
          || eliminatedParticipantRemovalTimersRef.current.has(
            participantIdentity,
          )
        ) {
          return
        }

        const targetParticipant = displayedParticipants.find(
          (participant) => (
            getParticipantGameIdentity(participant) === participantIdentity
          ),
        )

        if (!targetParticipant?.liveKitIdentity) {
          return
        }

        const timer = window.setTimeout(() => {
          eliminatedParticipantRemovalTimersRef.current.delete(participantIdentity)
          removedEliminatedParticipantIdentitiesRef.current.add(participantIdentity)

          const removedByName = currentHost.name
          const dataController = liveKitDataControllerRef.current

          void dataController?.publishMeetingControlMessage({
            type: 'participant-kicked',
            payload: {
              meetingId,
              roomName: liveKitConnection.roomName,
              targetParticipantIdentity: participantIdentity,
              removedByParticipantIdentity: currentHost.liveKitIdentity ?? '',
              removedByName,
              reason: 'eliminated',
              timestamp: new Date().toISOString(),
            },
          }).catch((error) => {
            console.warn('[livekit] Failed to publish elimination removal notice', error)
          })

          void removeLiveKitParticipant({
            roomName: liveKitConnection.roomName,
            targetParticipantIdentity: participantIdentity,
            requesterParticipantIdentity: currentHost.liveKitIdentity ?? '',
            requesterMeetingRole: currentHost.meetingRole,
            hostControlToken: roomHostControlToken,
          }).then(async (response) => {
            if (response.hostChanged) {
              const hostChangedPayload = {
                meetingId,
                roomName: liveKitConnection.roomName,
                ...response.hostChanged,
              }

              logHostTransferDebug('current host eliminated', {
                removedParticipantIdentity: participantIdentity,
              })
              logHostTransferDebug('candidate selected', {
                candidateIdentity: response.hostChanged.newHostParticipantIdentity,
              })
              applyHostChanged(hostChangedPayload)
              await dataController?.publishMeetingControlMessage({
                type: 'host-changed',
                payload: hostChangedPayload,
              }).catch((error) => {
                console.warn('[livekit] Failed to publish host succession notice', error)
              })
            }

            if (participantIdentity === localParticipantIdentityRef.current) {
              markParticipantKicked('eliminated')
            }

            setLiveKitParticipants((current) => current.filter(
              (participant) => participant.liveKitIdentity !== participantIdentity,
            ))
            logHostTransferDebug('old host removed', {
              removedParticipantIdentity: participantIdentity,
            })
          }).catch((error) => {
            removedEliminatedParticipantIdentitiesRef.current.delete(participantIdentity)
            console.warn('[livekit] Failed to remove eliminated participant', error)
          })
        }, 2000)

        eliminatedParticipantRemovalTimersRef.current.set(
          participantIdentity,
          timer,
        )
      },
    )
  }, [
    applyHostChanged,
    displayedParticipants,
    gameState.playerStates,
    isCurrentUserHost,
    isLiveKitConnected,
    liveKitConnection,
    markParticipantKicked,
    meetingId,
    roomHostControlToken,
    wasRemovedFromMeeting,
  ])

  useEffect(() => {
    if (!isLiveKitConnected || !isLiveKitDataReady) {
      requestedGameStateRef.current = false
      return
    }

    if (isCurrentUserHost || requestedGameStateRef.current) {
      return
    }

    requestedGameStateRef.current = true
    void publishGameStateRequest()
  }, [
    isCurrentUserHost,
    isLiveKitDataReady,
    isLiveKitConnected,
    publishGameStateRequest,
  ])

  const toggleParticipantsPanel = useCallback(() => {
    setIsScreenShareExpanded(false)
    setIsSettingsOpen(false)
    setIsParticipantsOpen((current) => !current)
  }, [])

  const toggleSettingsPanel = useCallback(() => {
    setIsScreenShareExpanded(false)

    if (isSettingsOpen) {
      setIsSettingsOpen(false)
      window.setTimeout(() => {
        controlBarSettingsButtonRef.current?.focus()
      }, 0)
      return
    }

    setIsParticipantsOpen(false)
    void openSettings()
  }, [isSettingsOpen, openSettings])

  useEffect(() => {
    if (
      !isParticipantsOpen
      && !isSettingsOpen
    ) {
      return
    }

    const closePanelOnEscape = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape'
        || isEndModalOpen
        || isScreenShareExpanded
        || participantToRemove
      ) {
        return
      }

      if (isParticipantsOpen) {
        setIsParticipantsOpen(false)
        window.setTimeout(() => {
          controlBarParticipantsButtonRef.current?.focus()
        }, 0)
        return
      }

      if (isSettingsOpen) {
        setIsSettingsOpen(false)
        window.setTimeout(() => {
          controlBarSettingsButtonRef.current?.focus()
        }, 0)
      }
    }

    window.addEventListener('keydown', closePanelOnEscape)
    return () => window.removeEventListener('keydown', closePanelOnEscape)
  }, [
    isEndModalOpen,
    isParticipantsOpen,
    isSettingsOpen,
    isScreenShareExpanded,
    participantToRemove,
  ])

  const updateLiveKitParticipants = useCallback((nextParticipants: Participant[]) => {
    const snapshot = JSON.stringify(nextParticipants.map((participant) => [
      participant.id,
      participant.liveKitIdentity,
      participant.name,
      participant.role,
      participant.meetingRole,
      participant.language,
      participant.isCameraOn,
      participant.isMicOn,
      participant.isSpeaking,
      participant.cameraTrackSid,
      participant.cameraTrackId,
      participant.microphoneTrackSid,
      participant.microphoneTrackId,
      participant.mediaStream?.getVideoTracks()[0]?.id,
      participant.liveKitTrackVersion,
    ]))

    if (snapshot === liveKitParticipantsSnapshotRef.current) {
      return
    }

    liveKitParticipantsSnapshotRef.current = snapshot
    setLiveKitParticipants(nextParticipants)
  }, [])

  const activeScreenShareStream = wasRemovedFromMeeting
    ? null
    : isLiveKitConnected
      ? liveKitScreenShare?.stream ?? null
      : screenShareStream
  const isScreenShareLayoutActive = Boolean(activeScreenShareStream)
  const isScreenShareFullscreen =
    isScreenShareExpanded && Boolean(activeScreenShareStream)
  const isLocalScreenSharing = isLiveKitConnected
    ? Boolean(liveKitScreenShare?.isLocal)
    : isScreenSharing
  const canSendChatMessage = !wasRemovedFromMeeting
    && liveKitStatus !== 'connecting'
    && liveKitStatus !== 'leaving'
    && liveKitStatus !== 'ended'
    && liveKitStatus !== 'kicked'
  const fairPlayLocalStream = displayedLocalParticipant?.mediaStream ?? null
  const isLocalFairPlayDamageLocked = Boolean(
    localParticipantIdentity
    && gameState.penalizedParticipantIdentitiesForCurrentAttack
      ?.includes(localParticipantIdentity),
  )
  const fairPlayLocalAudioTrack =
    fairPlayLocalStream?.getAudioTracks()[0] ?? null
  const fairPlayLocalVideoTrack =
    fairPlayLocalStream?.getVideoTracks()[0] ?? null
  const isLocalFairPlayCameraReady = Boolean(
    fairPlayLocalVideoTrack
    && fairPlayLocalVideoTrack.enabled
    && !fairPlayLocalVideoTrack.muted
    && fairPlayLocalVideoTrack.readyState === 'live',
  )
  const shouldRunFairPlayCheck = false
  const shouldRunAttackFairPlay =
    gameState.phase === 'attack-active'
    && localGameRole === 'defender'
    && Boolean(localParticipantIdentity)
    && !gameState.playerStates?.[localParticipantIdentity ?? '']?.eliminated
    && !isLocalFairPlayDamageLocked
  const shouldRunAudioFairPlay =
    shouldRunAttackFairPlay
    && Boolean(fairPlayLocalAudioTrack)
  const localFairPlaySessionKey = ''

  useEffect(() => {
    const video = fairPlayVideoRef.current

    if (!video) {
      return
    }

    if (video.srcObject !== fairPlayLocalStream) {
      video.srcObject = fairPlayLocalStream
    }

    if (fairPlayLocalStream) {
      void video.play().catch(() => undefined)
    }
  }, [fairPlayLocalStream])

  useEffect(() => {
    fairPlayCheckStatusKeyRef.current = ''
  }, [gameState.fairPlay?.check?.startedAt, gameState.phase])

  useEffect(() => {
    if (gameState.phase !== 'attack-active') {
      return
    }

    localFairPlayAttackReportRef.current.clear()
  }, [gameState.attackSequence, gameState.phase])

  useEffect(() => {
    if (!shouldRunFairPlayCheck) {
      return
    }

    logFairPlayCheckDebug('local camera ready', {
      participantIdentity: localParticipantIdentity,
      cameraReady: isLocalFairPlayCameraReady,
      hasStream: Boolean(fairPlayLocalStream),
      hasVideoTrack: Boolean(fairPlayLocalVideoTrack),
      trackEnabled: fairPlayLocalVideoTrack?.enabled,
      trackMuted: fairPlayLocalVideoTrack?.muted,
      trackReadyState: fairPlayLocalVideoTrack?.readyState,
    })
  }, [
    fairPlayLocalStream,
    fairPlayLocalVideoTrack,
    isLocalFairPlayCameraReady,
    localParticipantIdentity,
    shouldRunFairPlayCheck,
  ])

  useEffect(() => {
    const video = fairPlayVideoRef.current

    if (!video || !fairPlayLocalStream) {
      fairPlayDetectorRef.current?.stop()
      fairPlayDetectorModeRef.current = 'idle'
      if (import.meta.env.DEV && shouldRunFairPlayCheck) {
        console.info('[fair-play-not-started]', {
          reason: !video ? 'no-video-element' : 'no-local-stream',
          participantIdentity: localParticipantIdentity,
          sessionId: localFairPlaySessionKey,
        })
      }
      if (shouldRunFairPlayCheck && localParticipantIdentity) {
        publishFairPlayCheckStatus(createCameraRequiredFairPlayStatus({
          meetingId,
          roomCode,
          participantIdentity: localParticipantIdentity,
          participantName: displayedLocalParticipant?.name,
        }))
      }
      const timer = window.setTimeout(() => {
        fairPlayWarningRef.current = { active: false }
        fairPlayDebugRef.current = null
        setFairPlayWarning({ active: false })
        setFairPlayDebug(null)
      }, 0)

      return () => window.clearTimeout(timer)
    }

    const isPreGameFaceCheckSession = false

    if (
      isPreGameFaceCheckSession
      && localFairPlaySessionKey
      && fairPlayDetectorSessionKeyRef.current !== localFairPlaySessionKey
    ) {
      void fairPlayDetectorRef.current?.close()
      fairPlayDetectorRef.current = null
      fairPlayDetectorModeRef.current = 'idle'
      fairPlayCheckStatusKeyRef.current = ''
      fairPlayDetectorSessionKeyRef.current = localFairPlaySessionKey
      if (import.meta.env.DEV) {
        console.info('[fair-play-session]', {
          id: localFairPlaySessionKey,
          participant: localParticipantIdentity,
          required: true,
        })
      }
    } else if (!isPreGameFaceCheckSession && !shouldRunAttackFairPlay) {
      fairPlayDetectorSessionKeyRef.current = ''
    }

    if (!fairPlayDetectorRef.current) {
      fairPlayDetectorRef.current = new FairPlayDetector(video, {
        onFairPlayEvent: handleLocalFairPlayEvent,
        onCheckState: (checkState) => {
          const participantIdentity = localParticipantIdentityRef.current

          if (!participantIdentity) {
            return
          }

          publishFairPlayCheckStatusRef.current(mapFaceCheckUiStateToStatus({
            checkState,
            meetingId,
            roomCode,
            participantIdentity,
            participantName: displayedLocalParticipant?.name,
          }))
        },
        onCheckResult: (result) => {
          const participantIdentity = localParticipantIdentityRef.current

          if (!participantIdentity) {
            return
          }

          if (import.meta.env.DEV) {
            console.info('[fair-play-local]', {
              identity: participantIdentity,
              camera: true,
              face: result.passed,
              mouth: result.passed,
              smile: result.passed,
              passed: result.passed,
            })
          }

          publishFairPlayCheckStatusRef.current({
            ...createCameraRequiredFairPlayStatus({
              meetingId,
              roomCode,
              participantIdentity,
              participantName: displayedLocalParticipant?.name,
            }),
            cameraReady: true,
            faceReady: result.passed,
            mouthReady: result.passed,
            smileReady: result.passed,
            passed: result.passed,
            failed: !result.passed,
            step: result.passed ? 'passed' : 'smile',
            message: result.passed
              ? 'FAIR PLAY CHECK 통과'
              : '웃음 테스트를 다시 진행해 주세요.',
            checkVersion: result.checkVersion,
            calibrationVersion: result.calibrationVersion,
            updatedAt: new Date().toISOString(),
          })
        },
        onWarning: (warning) => {
          fairPlayWarningRef.current = warning
          setFairPlayWarning(warning)
        },
        onDebug: (debug) => {
          fairPlayDebugRef.current = debug
          if (FAIR_PLAY_DEBUG_ENABLED) {
            setFairPlayDebug(debug)
          }
        },
      })
      if (import.meta.env.DEV) {
        console.info('[fair-play-detector]', {
          instance: 'created',
          closed: false,
          sessionId: fairPlayDetectorSessionKeyRef.current,
        })
      }
    } else {
      fairPlayDetectorRef.current.setVideo(video)
      if (import.meta.env.DEV) {
        console.info('[fair-play-detector]', {
          instance: 'reused',
          closed: false,
          sessionId: fairPlayDetectorSessionKeyRef.current,
        })
      }
    }

    const publishCameraRequiredStatus = () => {
      if (!shouldRunFairPlayCheck || !localParticipantIdentity) {
        return
      }

      publishFairPlayCheckStatus(createCameraRequiredFairPlayStatus({
        meetingId,
        roomCode,
        participantIdentity: localParticipantIdentity,
        participantName: displayedLocalParticipant?.name,
      }))
    }

    if (shouldRunAttackFairPlay) {
      if (fairPlayDetectorModeRef.current !== 'attack-detection') {
        fairPlayDetectorRef.current.stop()
        fairPlayDetectorModeRef.current = 'attack-detection'
        void fairPlayDetectorRef.current.startAttackDetection().catch((error) => {
          console.warn('[fair-play] Failed to start attack detector', error)
          fairPlayDetectorModeRef.current = 'idle'
        })
      }
      return
    }

    if (shouldRunFairPlayCheck) {
      if (import.meta.env.DEV) {
        console.info('[fair-play-video]', {
          element: true,
          srcObject: Boolean(video.srcObject),
          trackState: fairPlayLocalVideoTrack?.readyState,
          trackEnabled: fairPlayLocalVideoTrack?.enabled,
          trackMuted: fairPlayLocalVideoTrack?.muted,
          readyState: video.readyState,
          sessionId: localFairPlaySessionKey,
        })
      }

      if (!isLocalFairPlayCameraReady) {
        fairPlayDetectorRef.current.stop()
        fairPlayDetectorModeRef.current = 'idle'
        if (import.meta.env.DEV) {
          console.info('[fair-play-not-started]', {
            reason: fairPlayLocalVideoTrack?.readyState === 'ended'
              ? 'track-ended'
              : 'camera-not-ready',
            participantIdentity: localParticipantIdentity,
            sessionId: localFairPlaySessionKey,
          })
        }
        publishCameraRequiredStatus()
        return
      }

      if (fairPlayDetectorModeRef.current !== 'face-check') {
        fairPlayDetectorRef.current.stop()
        fairPlayDetectorModeRef.current = 'face-check'
        logFairPlayCheckDebug('detector started', {
          participantIdentity: localParticipantIdentity,
        })
        void fairPlayDetectorRef.current.startFaceCheck().catch((error) => {
          console.warn('[fair-play] Failed to start pre-game face check', error)
          fairPlayDetectorModeRef.current = 'idle'
        })
      } else if (import.meta.env.DEV) {
        console.info('[fair-play-not-started]', {
          reason: 'already-running-current-session',
          participantIdentity: localParticipantIdentity,
          sessionId: localFairPlaySessionKey,
        })
      }
      return
    }

    fairPlayDetectorRef.current.stop()
    fairPlayDetectorModeRef.current = 'idle'
    const timer = window.setTimeout(() => {
      fairPlayWarningRef.current = { active: false }
      fairPlayDebugRef.current = null
      setFairPlayWarning({ active: false })
      setFairPlayDebug(null)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [
    displayedLocalParticipant?.name,
    fairPlayLocalStream,
    handleLocalFairPlayEvent,
    isLocalFairPlayCameraReady,
    localFairPlaySessionKey,
    localParticipantIdentity,
    meetingId,
    publishFairPlayCheckStatus,
    roomCode,
    fairPlayLocalVideoTrack,
    shouldRunAttackFairPlay,
    shouldRunFairPlayCheck,
  ])

  useEffect(() => {
    const audioTrack = fairPlayLocalAudioTrack
    const audioTrackId = audioTrack?.id ?? ''

    if (
      !shouldRunAudioFairPlay
      || !audioTrack
      || audioTrack.readyState === 'ended'
    ) {
      audioLaughDetectorRef.current?.stop()
      const timer = window.setTimeout(() => {
        setAudioFairPlayDebug(null)
        setAudioFairPlayUnavailableReason('')
      }, 0)

      return () => window.clearTimeout(timer)
    }

    if (
      audioLaughDetectorRef.current
      && audioLaughTrackIdRef.current !== audioTrackId
    ) {
      void audioLaughDetectorRef.current.close()
      audioLaughDetectorRef.current = null
      audioLaughTrackIdRef.current = ''
    }

    if (!audioLaughDetectorRef.current) {
      audioLaughTrackIdRef.current = audioTrackId
      audioLaughDetectorRef.current = new AudioLaughDetector(
        new MediaStream([audioTrack]),
        {
          onAudioLaughEvent: handleAudioLaughEvent,
          onDebug: (debug) => {
            if (FAIR_PLAY_DEBUG_ENABLED) {
              setAudioFairPlayDebug(debug)
            }
          },
          onUnavailable: (reason) => {
            setAudioFairPlayUnavailableReason(reason)
          },
        },
      )
    }

    void audioLaughDetectorRef.current.start().catch((error) => {
      const reason =
        error instanceof Error
          ? error.message
          : '오디오 웃음 감지를 시작하지 못했습니다.'
      setAudioFairPlayUnavailableReason(reason)
    })
  }, [
    fairPlayLocalAudioTrack,
    handleAudioLaughEvent,
    shouldRunAudioFairPlay,
  ])

  const activeMainParticipantId = displayedParticipants.some(
    (participant) => participant.id === selectedMainParticipantId,
  )
    ? selectedMainParticipantId
    : (
        displayedParticipants.find(
          (participant) => participant.role === 'local',
        )?.id ?? displayedParticipants[0]?.id
      )

  const endScreenShare = useCallback(() => {
    const currentStream = screenShareStreamRef.current
    screenShareStreamRef.current = null
    stopScreenShare(currentStream)
    setScreenShareStream(null)
    setIsScreenSharing(false)
    setIsScreenShareExpanded(false)
  }, [])

  const disconnectLiveKitRoom = useCallback(async () => {
    const controller = liveKitMediaControllerRef.current

    if (isLiveKitConnected && liveKitScreenShare?.isLocal) {
      await controller?.setScreenShareEnabled(false).catch((error) => {
        console.error('[livekit] Failed to stop screen share before leave', error)
      })
    }

    controller?.disconnect()
  }, [isLiveKitConnected, liveKitScreenShare?.isLocal])

  const finalizeMeetingAndNavigate = useCallback(async (
    nextChatMessages = chatMessages,
    endedBy?: string,
  ) => {
    meetingExitInProgressRef.current = true
    const endedAt = new Date().toISOString()
    const finalSession = saveMeetingSession({
      meetingId,
      roomCode,
      roomName,
      title: roomName,
      createdAt: restoredMeetingSession?.createdAt,
      startedAt: restoredMeetingSession?.startedAt,
      endedAt,
      endedBy,
      participants: displayedParticipants,
      chatMessages: nextChatMessages,
      transcripts,
      translations,
      recordingEnabled,
      summaryStatus: 'ready',
    })
    saveEndedMeetingSessionToHistory(finalSession)
    setSpeechRecognitionEnabled(false)
    stopSpeechRecognition()
    setIsSpeechRecognitionActive(false)
    endScreenShare()
    if (
      liveKitConnection
      && terminalPhaseRef.current !== 'ended'
    ) {
      await leaveFreeBetaRoom({
        roomName: liveKitConnection.roomName,
        participantIdentity:
          displayedLocalParticipant?.liveKitIdentity
          ?? liveKitConnection.participantIdentity,
      }).catch((error) => {
        console.warn('[free-beta] Failed to mark room leave', error)
      })
    }
    await disconnectLiveKitRoom()
    if (import.meta.env.DEV && localParticipant?.mediaStream) {
      console.info('[room-camera] unpublished-preserve-local-track')
    }
    saveMeetingTranscripts(meetingId, transcripts)
    saveChatMessages(meetingId, nextChatMessages)

    await new Promise((resolve) => window.setTimeout(resolve, 180))
    onLeave()
  }, [
    chatMessages,
    disconnectLiveKitRoom,
    endScreenShare,
    localParticipant,
    liveKitConnection,
    meetingId,
    onLeave,
    recordingEnabled,
    transcripts,
    translations,
    displayedLocalParticipant?.liveKitIdentity,
    displayedParticipants,
    restoredMeetingSession?.createdAt,
    restoredMeetingSession?.startedAt,
    roomCode,
    roomName,
  ])

  const appendSystemChatMessage = useCallback((message: string) => {
    const systemMessage = createSystemMessage({
      meetingId,
      message,
    })
    const nextMessages = dedupeChatMessages([...chatMessages, systemMessage])
    setChatMessages(nextMessages)
    saveChatMessages(meetingId, nextMessages)
    return {
      systemMessage,
      nextMessages,
    }
  }, [chatMessages, meetingId])

  const confirmEndMeeting = async () => {
    if (isEndingMeeting) {
      return
    }

    setIsEndingMeeting(true)

    const actor = displayedLocalParticipant ?? localParticipant

    try {
      if (isLiveKitConnected && actor?.meetingRole === 'host') {
        terminalPhaseRef.current = 'ended'
        setLiveKitStatus('ended')
        const dataController = liveKitDataControllerRef.current
        const endedAt = new Date().toISOString()
        const { systemMessage, nextMessages } = appendSystemChatMessage(
          `${actor.name}님이 방을 종료했습니다.`,
        )

        if (
          liveKitConnection
          && actor.liveKitIdentity
        ) {
          await endFreeBetaRoom({
            roomName: liveKitConnection.roomName,
            requesterParticipantIdentity: actor.liveKitIdentity,
            requesterMeetingRole: actor.meetingRole,
            hostControlToken: roomHostControlToken,
          }).catch((error) => {
            console.warn('[free-beta] Failed to verify host room end', error)
          })
        }

        if (dataController) {
          await dataController.publishChatMessage({
            type: 'system-message',
            payload: chatMessageToLiveKitPayload(systemMessage, {
              roomCode,
              senderIdentity:
                actor.liveKitIdentity
                ?? liveKitConnection?.participantIdentity
                ?? 'system',
              senderRole: 'system',
              language: actor.language,
            }),
          }).catch((error) => {
            console.error(
              '[livekit-chat] Failed to publish meeting end system message',
              error,
            )
          })

          await dataController.publishMeetingControlMessage({
            type: 'meeting-ended',
            payload: {
              meetingId,
              roomName: liveKitConnection?.roomName ?? roomCode ?? meetingId,
              endedByParticipantIdentity: actor.liveKitIdentity ?? '',
              endedByName: actor.name,
              endedAt,
            },
          })
        }

        await finalizeMeetingAndNavigate(nextMessages, actor.name)
        return
      }

      terminalPhaseRef.current = 'leaving'
      setLiveKitStatus('leaving')
      await finalizeMeetingAndNavigate(chatMessages, actor?.name)
    } catch (error) {
      console.error('[meeting-room] Failed to complete leave flow', error)
      await finalizeMeetingAndNavigate(chatMessages, actor?.name)
    }
  }

  const receiveLiveKitDataMessage = useCallback(
    (
      message: LiveKitDataMessage,
      senderParticipantIdentity?: string,
    ) => {
      if (message.type === 'participant-kicked') {
        const localIdentity =
          displayedLocalParticipant?.liveKitIdentity
          ?? liveKitConnection?.participantIdentity

        if (
          localIdentity
          && message.payload.targetParticipantIdentity === localIdentity
        ) {
          markParticipantKicked(message.payload.reason)
        }
        return
      }

      if (message.type === 'host-changed') {
        applyHostChanged(message.payload)
        return
      }

      if (message.type === 'meeting-ended') {
        terminalPhaseRef.current = 'ended'
        meetingExitInProgressRef.current = true
        setLiveKitStatus('ended')
        setIsMeetingEndedRemotely(true)
        setLiveKitMessage('방장이 방을 종료했습니다.')
        const nextMessages = [
          ...chatMessages,
          createSystemMessage({
            meetingId,
            message: `${message.payload.endedByName}님이 방을 종료했습니다.`,
          }),
        ]
        setChatMessages(nextMessages)
        void finalizeMeetingAndNavigate(nextMessages, message.payload.endedByName)
        return
      }

      if (message.type === 'game-state-snapshot') {
        const expectedHostIdentity =
          gameStateRef.current.hostParticipantIdentity
          ?? displayedParticipants.find(
            (participant) => participant.meetingRole === 'host',
          )?.liveKitIdentity
          ?? displayedParticipants.find(
            (participant) => participant.meetingRole === 'host',
          )?.id.toString()
        const isAuthoritativeServerSnapshot = !senderParticipantIdentity
        const isExpectedHostSnapshot =
          (
            !expectedHostIdentity
            || message.payload.hostParticipantIdentity === expectedHostIdentity
          )
          && (
            !expectedHostIdentity
            || senderParticipantIdentity === expectedHostIdentity
          )

        if (
          (
            isAuthoritativeServerSnapshot
            || (!isCurrentUserHost && isExpectedHostSnapshot)
          )
          && (
            isAuthoritativeServerSnapshot
              ? shouldAcceptServerRoomSnapshot(
                  gameStateRef.current,
                  message.payload,
                )
              : shouldAcceptGameStateSnapshot(
                  gameStateRef.current,
                  message.payload,
                )
          )
        ) {
          const scopedGameState = scopePostGameSnapshotToRoster(
            message.payload,
            gameStateRef.current,
          )

          setRoomHostParticipantIdentity(scopedGameState.hostParticipantIdentity)
          logRejoinDebug('current room phase applied', {
            phase: scopedGameState.phase,
            revision: scopedGameState.revision,
          })
          if (import.meta.env.DEV) {
            console.info('[fair-play-shared]', {
              phase: scopedGameState.phase,
              participants: scopedGameState.fairPlay?.check?.activePlayerIdentities
                .map((participantIdentity) => ({
                  identity: participantIdentity,
                  status: isFairPlayCheckPassed(
                    scopedGameState.fairPlay?.check?.participants[
                      participantIdentity
                    ],
                  )
                    ? 'passed'
                    : 'checking',
                })) ?? [],
            })
          }
          gameStateRef.current = scopedGameState
          setReadyParticipantIdentities(
            scopedGameState.participants
              .filter((participant) => participant.isReady)
              .map((participant) => participant.participantIdentity)
              .filter((participantIdentity): participantIdentity is string => (
                typeof participantIdentity === 'string'
              )),
          )
          setGameState(scopedGameState)
        }
        return
      }

      if (message.type === 'game-ready-change') {
        if (
          !isCurrentUserHost
          || message.payload.meetingId !== meetingId
          || message.payload.roomCode !== roomCode
          || !displayedParticipants.some(
            (participant) => (
              getParticipantGameIdentity(participant)
                === message.payload.participantIdentity
            ),
          )
        ) {
          return
        }

        setReadyParticipantIdentities((current) => {
          const currentSet = new Set(
            filterReadyParticipantIdentities(displayedParticipants, current),
          )

          if (message.payload.isReady) {
            currentSet.add(message.payload.participantIdentity)
          } else {
            currentSet.delete(message.payload.participantIdentity)
          }

          return Array.from(currentSet)
        })
        return
      }

      if (message.type === 'fair-play-check-status') {
        if (
          senderParticipantIdentity
          && senderParticipantIdentity !== message.payload.participantIdentity
        ) {
          return
        }

        applyFairPlayCheckStatusFromHost(message.payload)
        return
      }

      if (message.type === 'attack-start-request') {
        const currentGameState = gameStateRef.current

        if (
          !isCurrentUserHost
          || !senderParticipantIdentity
          || message.payload.meetingId !== meetingId
          || message.payload.roomCode !== roomCode
          || currentGameState.phase !== 'attack-ready'
          || currentGameState.attackerIdentity !== senderParticipantIdentity
          || currentGameState.roundNumber !== message.payload.roundNumber
          || !currentGameState.activePlayerIdentities?.includes(senderParticipantIdentity)
          || !currentGameState.attackContent
          || currentGameState.attackStartedAt
        ) {
          return
        }

        startAttackFromHost(senderParticipantIdentity)
        return
      }

      if (message.type === 'attack-content-submit-request') {
        if (
          !isCurrentUserHost
          || !senderParticipantIdentity
          || message.payload.meetingId !== meetingId
          || message.payload.roomCode !== roomCode
        ) {
          return
        }

        void approveAttackContentFromHost(
          message.payload.contentId,
          senderParticipantIdentity,
          message.payload.roundNumber,
          message.payload.attackSequence,
        )
        return
      }

      if (message.type === 'fair-play-event-request') {
        if (
          !isCurrentUserHost
          || !senderParticipantIdentity
          || message.payload.meetingId !== meetingId
          || message.payload.roomCode !== roomCode
        ) {
          return
        }

        applyFairPlayEventFromHost(senderParticipantIdentity, {
          eventId: message.payload.eventId,
          reason: message.payload.reason,
          roundNumber: message.payload.roundNumber,
          attackSequence: message.payload.attackSequence,
          detectedAt: message.payload.detectedAt,
        })
        return
      }

      if (message.type === 'game-state-request') {
        if (
          isCurrentUserHost
          && message.payload.meetingId === meetingId
          && message.payload.roomCode === roomCode
        ) {
          const nextSnapshot = createCurrentGameStateSnapshot()
          gameStateRef.current = nextSnapshot
          setGameState(nextSnapshot)
          void publishGameStateSnapshot(nextSnapshot)
        }
        return
      }

      if (message.type === 'transcript-created') {
        // TODO: Translate the received sourceText again for each receiver's
        // targetLanguage when per-user translation is introduced.
        const speakerParticipant = displayedParticipants.find(
          (participant) => (
            participant.liveKitIdentity === message.payload.speakerId
            || String(participant.id) === message.payload.speakerId
          ),
        )
        const incomingTranscript = liveKitPayloadToTranscript(
          message.payload,
          {
            participantId: speakerParticipant?.id,
            speakerNumericId: speakerParticipant?.id,
            targetLanguage,
          },
        )

        setTranscripts((current) => {
          const incomingKey =
            incomingTranscript.transcriptId ?? String(incomingTranscript.id)
          if (
            current.some((item) => (
              (item.transcriptId ?? String(item.id)) === incomingKey
            ))
          ) {
            return current
          }

          return dedupeTranscripts([...current, incomingTranscript])
        })
        return
      }

      if (message.type === 'translation') {
        setTranslations((current) => {
          if (
            findTranslation(
              current,
              message.payload.sourceType,
              message.payload.sourceId,
              message.payload.targetLanguage,
            )
          ) {
            return current
          }

          return dedupeTranslations([...current, message.payload])
        })
        return
      }

      const isChatLikeMessage =
        message.type === 'chat-message' || message.type === 'system-message'

      if (!isChatLikeMessage) {
        return
      }

      const senderParticipant = displayedParticipants.find(
        (participant) => (
          participant.liveKitIdentity === message.payload.senderId
          || String(participant.id) === message.payload.senderId
        ),
      )
      const incomingChatMessage = liveKitPayloadToChatMessage(
        message.payload,
        senderParticipant?.id ?? null,
      )
      setChatMessages((current) => {
        if (current.some((item) => item.id === incomingChatMessage.id)) {
          return current
        }

        console.debug('[chat] message received', incomingChatMessage.id)
        return dedupeChatMessages([...current, incomingChatMessage])
      })
    },
    [
      chatMessages,
      displayedLocalParticipant,
      displayedParticipants,
      finalizeMeetingAndNavigate,
      approveAttackContentFromHost,
      applyFairPlayCheckStatusFromHost,
      applyFairPlayEventFromHost,
      applyHostChanged,
      createCurrentGameStateSnapshot,
      isCurrentUserHost,
      liveKitConnection?.participantIdentity,
      markParticipantKicked,
      meetingId,
      publishGameStateSnapshot,
      roomCode,
      startAttackFromHost,
      targetLanguage,
    ],
  )

  const toggleScreenShare = async () => {
    setScreenShareMessage('')

    if (isLiveKitConnected) {
      const controller = liveKitMediaControllerRef.current

      if (!controller) {
        setScreenShareMessage('화면 공유 연결을 준비하는 중입니다.')
        return
      }

      if (liveKitScreenShare && !liveKitScreenShare.isLocal) {
        setScreenShareMessage('이미 화면 공유가 진행 중입니다.')
        return
      }

      try {
        await controller.setScreenShareEnabled(
          !liveKitScreenShare?.isLocal,
        )
      } catch (error) {
        if (
          error instanceof DOMException
          && (error.name === 'AbortError' || error.name === 'NotAllowedError')
        ) {
          return
        }

        console.error('[livekit] Failed to toggle screen share', error)
        setScreenShareMessage('화면 공유 상태를 변경하지 못했습니다.')
      }
      return
    }

    if (isScreenSharing) {
      endScreenShare()
      return
    }

    if (!isScreenShareSupported()) {
      setScreenShareMessage('현재 브라우저에서는 화면 공유를 지원하지 않습니다.')
      return
    }

    try {
      const stream = await startScreenShare()
      const videoTrack = stream.getVideoTracks()[0]

      if (!videoTrack) {
        stopScreenShare(stream)
        return
      }

      screenShareStreamRef.current = stream
      setScreenShareStream(stream)
      setIsScreenSharing(true)

      videoTrack.addEventListener('ended', () => {
        if (screenShareStreamRef.current === stream) {
          screenShareStreamRef.current = null
          setScreenShareStream(null)
          setIsScreenSharing(false)
          setIsScreenShareExpanded(false)
        }
      }, { once: true })
    } catch (error) {
      if (
        error instanceof DOMException
        && (error.name === 'AbortError' || error.name === 'NotAllowedError')
      ) {
        return
      }

      setScreenShareMessage('화면 공유를 시작하지 못했습니다.')
    }
  }

  useEffect(() => {
    if (!autoStartCaption || autoStartAttemptedRef.current) {
      return
    }

    const timer = window.setTimeout(() => {
      if (autoStartAttemptedRef.current) {
        return
      }

      autoStartAttemptedRef.current = true

      if (!localParticipant?.isMicOn) {
        setSpeechMessage('마이크를 켜야 실시간 자막을 사용할 수 있어요.')
        return
      }

      autoStartInProgressRef.current = true
      captionButtonRef.current?.click()
    }, 250)

    return () => window.clearTimeout(timer)
  }, [autoStartCaption, localParticipant?.isMicOn])

  return (
    <section className="meeting-page">
      <video
        ref={fairPlayVideoRef}
        className="fair-play-analysis-video"
        muted
        playsInline
        aria-hidden="true"
      />
      {hostTransferNotice && (
        <div
          className="host-transfer-notice"
          role="status"
          aria-live="polite"
        >
          <strong>{hostTransferNotice}</strong>
          <span>방장 권한을 넘겨받았습니다.</span>
        </div>
      )}
      {copyMessage && copyTooltipPosition && createPortal(
        <span
          className={`meeting-copy-feedback is-portal ${copyMessage.includes('실패') ? 'is-error' : ''}`}
          role="status"
          aria-live="polite"
          style={{
            top: copyTooltipPosition.top,
            left: copyTooltipPosition.left,
          }}
        >
          {copyMessage}
        </span>,
        document.body,
      )}
      <header className="meeting-header">
        <div className="meeting-header-main">
          <Logo />
          <span className="meeting-header-divider" />
          <strong>{roomName}</strong>
          <span className="meeting-room-code-wrap">
            <button
              ref={roomCodeButtonRef}
              className="meeting-room-code"
              type="button"
              onClick={copyRoomCode}
              aria-label={`${roomCode} 방 코드 복사`}
              title="방 코드 복사"
            >
              {roomCode} <Icon name="copy" size={13} />
            </button>
          </span>
          <span className="participant-count">
            <Icon name="users" size={15} /> {displayedParticipants.length}
          </span>
          <span
            className={`livekit-header-mode is-${liveKitStatus}`}
            title={liveKitMessage || undefined}
          >
            {liveKitStatus === 'connected'
              ? '연결됨'
              : liveKitStatus === 'connecting'
                ? '연결 중'
                : liveKitStatus === 'failed'
                  ? '연결 실패'
                  : liveKitStatus === 'kicked'
                    ? '퇴장됨'
                    : liveKitStatus === 'ended'
                      ? '종료됨'
                      : liveKitStatus === 'leaving'
                        ? '나가는 중'
                        : '로컬 모드'}
          </span>
        </div>
        <div className="meeting-meta">
          <span className="meeting-time"><Icon name="clock" size={14} /> 10:02 AM</span>
          <span className="live-pill"><i /> LIVE 18:24</span>
        </div>
      </header>

      {(liveKitStatus === 'failed' || liveKitStatus === 'local') && (
        <div className="livekit-connection-notice" role="status">
          {liveKitStatus === 'failed'
            ? '방 연결에 실패했습니다. 로컬 데모 모드입니다. 실제 화상방 연결이 아닙니다.'
            : '로컬 데모 모드입니다. 실제 화상방 연결이 아닙니다.'}
        </div>
      )}

      <div
        className={[
          'meeting-layout',
          'meet-meet-game-layout-shell',
          viewMode === 'focus' ? 'is-focus-mode' : '',
          isScreenShareFullscreen ? 'screen-share-fullscreen' : '',
        ].filter(Boolean).join(' ')}
      >
        <div
          className={[
            'video-area',
            isScreenShareLayoutActive ? 'has-screen-share' : '',
            isScreenShareFullscreen ? 'is-screen-share-fullscreen' : '',
          ].filter(Boolean).join(' ')}
        >
          {wasRemovedFromMeeting ? (
            <div className="meeting-connection-state is-terminal">
              <Icon name="users" size={28} />
              <strong>방장에 의해 방에서 퇴장되었습니다.</strong>
              <p>다시 참여하려면 초대 링크 또는 룸코드로 재입장해 주세요.</p>
            </div>
          ) : isMeetingEndedRemotely ? (
            <div className="meeting-connection-state">
              <span className="meeting-connection-spinner" />
              <strong>방이 종료되었습니다.</strong>
              <p>홈으로 이동하고 있어요.</p>
            </div>
          ) : isEndingMeeting ? (
            <div className="meeting-connection-state">
              <span className="meeting-connection-spinner" />
              <strong>방을 정리하고 있어요.</strong>
              <p>잠시 후 홈으로 이동합니다.</p>
            </div>
          ) : shouldHoldVideoForConnection ? (
            <div className="meeting-connection-state">
              <span className="meeting-connection-spinner" />
              <strong>{connectionLoadingTitle}</strong>
              <p>참가자 화면을 불러오고 있어요.</p>
            </div>
          ) : (
            <>
              {isScreenShareFullscreen && activeScreenShareStream ? (
                <ScreenShareCard
                  stream={activeScreenShareStream}
                  participantName={
                    isLiveKitConnected
                      ? liveKitScreenShare?.participantName
                      : localParticipant?.name
                  }
                  canStop={!isLiveKitConnected || isLocalScreenSharing}
                  isExpanded={isScreenShareFullscreen}
                  onExpand={() => {
                    setIsParticipantsOpen(false)
                    setIsSettingsOpen(false)
                    setIsScreenShareExpanded(true)
                  }}
                  onCollapse={() => setIsScreenShareExpanded(false)}
                  onStop={() => void toggleScreenShare()}
                />
              ) : isParticipantsOpen ? (
                <div className="players-mode-root">
                  <PlayerGallery
                    participants={displayedParticipants}
                    maxParticipants={participantCount}
                    phase={gameState.phase}
                    roundNumber={gameState.roundNumber}
                    countdownStartedAt={gameState.countdownStartedAt}
                    countdownDurationMs={gameState.countdownDurationMs}
                    attackEndsAt={gameState.attackEndsAt}
                    maxLives={gameState.initialLives ?? initialLives}
                    selectedParticipantId={activeMainParticipantId}
                    readyParticipantIdentities={activeReadyParticipantIdentities}
                    attackerIdentity={
                      shouldShowGameRoleBadges
                        ? gameState.attackerIdentity
                        : undefined
                    }
                    defenderIdentities={
                      shouldShowGameRoleBadges
                        ? gameState.defenderIdentities
                        : undefined
                    }
                    isAttackActive={gameState.phase === 'attack-active'}
                    playerStates={gameState.playerStates}
                    fairPlayWarningParticipantIdentity={
                      fairPlayWarning.active
                        ? localParticipantIdentity
                        : undefined
                    }
                    onSelectParticipant={(participantId) => {
                      setSelectedMainParticipantId(participantId)
                    }}
                    onReconnectMedia={onReconnectMedia}
                    onReturnToGame={() => {
                      setIsParticipantsOpen(false)
                      window.setTimeout(() => {
                        controlBarParticipantsButtonRef.current?.focus()
                      }, 0)
                    }}
                  />
                </div>
              ) : (
                <MeetMeetRoomLayout
                  participants={displayedParticipants}
                  selectedParticipantId={activeMainParticipantId}
                  readyParticipantIdentities={activeReadyParticipantIdentities}
                  attackerIdentity={
                    shouldShowGameRoleBadges
                      ? gameState.attackerIdentity
                      : undefined
                  }
                  defenderIdentities={
                    shouldShowGameRoleBadges
                      ? gameState.defenderIdentities
                      : undefined
                  }
                  isAttackActive={gameState.phase === 'attack-active'}
                  playerStates={gameState.playerStates}
                  maxLives={gameState.initialLives ?? initialLives}
                  fairPlayWarningParticipantIdentity={
                    fairPlayWarning.active
                      ? localParticipantIdentity
                      : undefined
                  }
                  onSelectParticipant={(participantId) => {
                    setSelectedMainParticipantId(participantId)
                    setViewMode('focus')
                  }}
                  onReconnectMedia={onReconnectMedia}
                  board={(
                    <GameBoard
                      phase={gameState.phase}
                      statusText={gameStatusText}
                      chatMessages={chatMessages}
                      timelineEvents={gameTimelineEvents}
                      localParticipantId={
                        displayedLocalParticipant?.id ?? localParticipant?.id
                      }
                      onSendChatMessage={sendChatMessage}
                      canSendChatMessage={canSendChatMessage}
                      chatSendMessage={chatSendMessage}
                      countdownStartedAt={gameState.countdownStartedAt}
                      countdownDurationMs={gameState.countdownDurationMs}
                      attackEndsAt={gameState.attackEndsAt}
                      attackDurationMs={gameState.attackDurationMs}
                      attackEndReason={gameState.attackEndReason}
                      attackContent={gameState.attackContent}
                      roundNumber={gameState.roundNumber}
                      activePlayerIdentities={gameState.activePlayerIdentities}
                      attackSequence={gameState.attackSequence}
                      maxLives={gameState.initialLives ?? initialLives}
                      attackerName={attackerName}
                      participantNamesByIdentity={participantNamesByIdentity}
                      playerStates={gameState.playerStates}
                      roundResult={gameState.roundResult}
                      fairPlayCheckParticipants={fairPlayCheckParticipants}
                      localFairPlayCheckStatus={localFairPlayCheckStatus}
                      fairPlayWarning={fairPlayWarning}
                      fairPlayLastEvent={gameState.fairPlay?.lastEvent}
                      fairPlayDamageLocked={Boolean(
                        isLocalFairPlayDamageLocked
                      )}
                      isAudioFairPlayActive={shouldRunAudioFairPlay}
                      audioFairPlayDebug={
                        FAIR_PLAY_DEBUG_ENABLED ? audioFairPlayDebug : null
                      }
                      audioFairPlayUnavailableReason={
                        FAIR_PLAY_DEBUG_ENABLED
                          ? audioFairPlayUnavailableReason
                          : ''
                      }
                      fairPlayDebug={FAIR_PLAY_DEBUG_ENABLED ? fairPlayDebug : null}
                      winnerName={winnerName}
                      localGameRole={localGameRole}
                      readyStatusText={readyStatusText}
                      isLocalReady={isLocalParticipantReady}
                      canToggleReady={canToggleReady}
                      autoReadyRemainingSeconds={autoReadyRemainingSeconds}
                      autoStartRemainingSeconds={autoStartRemainingSeconds}
                      isHost={isCurrentUserHost}
                      canStartGame={canStartGame}
                      canRequestAttackStart={canRequestAttackStart}
                      isUploadingAttackContent={
                        gameState.phase === 'attack-ready'
                        && isUploadingAttackContent
                      }
                      attackContentMessage={
                        gameState.phase === 'attack-ready'
                          ? attackContentMessage
                          : ''
                      }
                      onToggleReady={handleToggleReady}
                      onStartGame={() => handleStartGame('manual')}
                      onUploadAttackContent={handleUploadAttackContent}
                      onRequestAttackStart={handleRequestAttackStart}
                      onStartNextRound={handleStartNextRound}
                      screenShareSlot={
                        activeScreenShareStream ? (
                          <ScreenShareCard
                            stream={activeScreenShareStream}
                            participantName={
                              isLiveKitConnected
                                ? liveKitScreenShare?.participantName
                                : localParticipant?.name
                            }
                            canStop={!isLiveKitConnected || isLocalScreenSharing}
                            isExpanded={false}
                            onExpand={() => {
                              setIsParticipantsOpen(false)
                              setIsSettingsOpen(false)
                              setIsScreenShareExpanded(true)
                            }}
                            onCollapse={() => setIsScreenShareExpanded(false)}
                            onStop={() => void toggleScreenShare()}
                          />
                        ) : undefined
                      }
                    />
                  )}
                />
              )}
            </>
          )}
        </div>
      </div>

      {isSettingsOpen && (
        <MeetingSettingsPanel
          participant={localParticipant}
          targetLanguage={targetLanguage}
          autoStartCaption={autoStartCaption}
          recordingEnabled={recordingEnabled}
          deviceSelection={deviceSelection}
          videoDevices={videoDevices}
          audioDevices={audioDevices}
          speakerDevices={speakerDevices}
          isChangingDevice={isChangingDevice}
          message={settingsMessage}
          captionSize={captionSize}
          speechRecognitionLanguage={speechRecognitionLanguage}
          onClose={() => {
            setIsSettingsOpen(false)
            window.setTimeout(() => {
              controlBarSettingsButtonRef.current?.focus()
            }, 0)
          }}
          onDisplayNameChange={changeDisplayName}
          onSourceLanguageChange={changeSourceLanguage}
          onTargetLanguageChange={changeTargetLanguage}
          onDeviceChange={(kind, deviceId) => {
            void changeMeetingDevice(kind, deviceId)
          }}
          onCaptionSizeChange={setCaptionSize}
          onSpeechRecognitionLanguageChange={setSpeechRecognitionLanguage}
          onRecordingEnabledChange={setRecordingEnabled}
        />
      )}

      {participantToRemove && (
        <RemoveParticipantModal
          participant={participantToRemove}
          isRemoving={isRemovingParticipant}
          message={participantRemoveMessage}
          onCancel={() => {
            if (!isRemovingParticipant) {
              setParticipantRemoveMessage('')
              setParticipantToRemove(null)
            }
          }}
          onConfirm={() => void removeParticipant()}
        />
      )}

      {liveKitConnection && (
        <Suspense fallback={null}>
          <LiveKitTestRoom
            connection={liveKitConnection}
            localMediaStream={localParticipant?.mediaStream ?? null}
            isOverlayOpen={isLiveKitOverlayOpen}
            onConnectedChange={(connected) => {
              if (terminalPhaseRef.current) {
                return
              }

              setIsLiveKitConnected(connected)
              if (connected) {
                liveKitConnectedRoomRef.current = liveKitConnection.roomName
                liveKitConnectingRoomRef.current = null
                autoLiveKitConnectRoomRef.current = liveKitConnection.roomName
                setLiveKitStatus('connected')
                setLiveKitMessage('')
              }
            }}
            onParticipantsChange={(nextParticipants) => {
              if (terminalPhaseRef.current === 'kicked') {
                return
              }

              updateLiveKitParticipants(nextParticipants)
            }}
            onMediaControllerChange={(controller) => {
              liveKitMediaControllerRef.current = controller
            }}
            onScreenShareChange={(screenShare) => {
              if (terminalPhaseRef.current === 'kicked') {
                return
              }

              setLiveKitScreenShare(screenShare)
              if (!screenShare) {
                setIsScreenShareExpanded(false)
              }
            }}
            onDataControllerChange={(controller) => {
              liveKitDataControllerRef.current = controller
              setIsLiveKitDataReady(Boolean(controller))
            }}
            onDataMessage={receiveLiveKitDataMessage}
            onConnectionError={() => {
              if (terminalPhaseRef.current) {
                return
              }

              setLiveKitStatus('failed')
              setLiveKitMessage(
                '방 연결에 실패했습니다. 로컬 모드로 계속 진행합니다.',
              )
            }}
            onRemovedFromMeeting={() => {
              markParticipantKicked()
            }}
            onHide={() => setIsLiveKitOverlayOpen(false)}
            onDisconnect={() => {
              liveKitMediaControllerRef.current = null
              liveKitDataControllerRef.current = null
              setIsLiveKitDataReady(false)
              setIsLiveKitConnected(false)
              liveKitConnectedRoomRef.current = null
              liveKitConnectingRoomRef.current = null

              if (terminalPhaseRef.current === 'kicked') {
                setLiveKitStatus('kicked')
                setLiveKitMessage('방장에 의해 방에서 퇴장되었습니다.')
                return
              }

              if (terminalPhaseRef.current === 'ended') {
                setLiveKitStatus('ended')
                return
              }

              if (terminalPhaseRef.current === 'leaving') {
                setLiveKitStatus('leaving')
                return
              }

              if (!meetingExitInProgressRef.current && !wasRemovedFromMeeting) {
                setLiveKitStatus((current) => (
                  current === 'failed'
                    ? 'failed'
                    : isJoinFlow
                      ? 'connecting'
                      : 'local'
                ))
              }
              if (!meetingExitInProgressRef.current) {
                setLiveKitParticipants([])
                liveKitParticipantsSnapshotRef.current = ''
              }
              setLiveKitScreenShare(null)
              setLiveKitConnection(null)
            }}
          />
        </Suspense>
      )}

      {wasRemovedFromMeeting && (
        <div className="meeting-end-backdrop" role="presentation">
          <section
            className="meeting-end-modal livekit-removed-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="livekit-removed-title"
          >
            <span className="meeting-end-icon">
              <Icon name="users" size={20} />
            </span>
            <h2 id="livekit-removed-title">
              방장에 의해 방에서 퇴장되었습니다.
            </h2>
            <p>
              방 연결이 종료되었습니다. 다시 참여하려면 홈에서 방 코드로
              입장해주세요.
            </p>
            <div className="meeting-end-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={onLeave}
              >
                홈으로 이동
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={onReturnHome}
              >
                홈으로 돌아가기
              </button>
            </div>
          </section>
        </div>
      )}

      {isEndModalOpen && (
        <EndMeetingModal
          isSaving={isEndingMeeting}
          title={
            isCurrentUserHost
              ? '방을 종료할까요?'
              : '방에서 나갈까요?'
          }
          description={
            isCurrentUserHost
              ? '모든 참가자의 연결이 종료되고 홈으로 이동합니다.'
              : '현재 방에서 나가고 홈으로 이동합니다.'
          }
          cancelLabel="취소"
          confirmLabel={isCurrentUserHost ? '방 종료' : '나가기'}
          savingLabel="정리 중..."
          onContinue={() => setIsEndModalOpen(false)}
          onConfirm={() => void confirmEndMeeting()}
        />
      )}

      {!wasRemovedFromMeeting && (
        <ControlBar
          participant={displayedLocalParticipant ?? localParticipant}
          isCaptionActive={sttEnabled}
          isScreenSharing={isLocalScreenSharing}
          isParticipantsOpen={isParticipantsOpen}
          isSettingsOpen={isSettingsOpen}
          isHost={isCurrentUserHost}
          recordingEnabled={recordingEnabled}
          viewMode={isScreenShareLayoutActive ? 'grid' : viewMode}
          showCaptionHint={showCaptionHint}
          captionMessage={
            speechMessage
            || (sttEnabled && !isSpeechRecognitionActive
              ? '실시간 자막 대기 중'
              : '')
          }
          liveCaptionText={liveCaptionText}
          screenShareMessage={screenShareMessage}
          captionButtonRef={captionButtonRef}
          participantsButtonRef={controlBarParticipantsButtonRef}
          settingsButtonRef={controlBarSettingsButtonRef}
          showTranslationLockButton={TRANSLATION_MODE_CONFIG.isPremiumLocked}
          onToggleMicrophone={() => void toggleLocalMedia('audio')}
          onToggleCaption={handleToggleSpeechRecognition}
          onToggleCamera={() => void toggleLocalMedia('video')}
          onLockedTranslationClick={() => {
            setSpeechMessage('실시간 번역 기능은 프리미엄 계정에서 제공될 예정이며 현재 개발 중입니다.')
          }}
          onToggleScreenShare={() => void toggleScreenShare()}
          onToggleViewMode={() => {
            if (!isScreenShareLayoutActive) {
              setViewMode((current) => current === 'grid' ? 'focus' : 'grid')
            }
          }}
          onOpenGameMode={() => {
            setIsParticipantsOpen(false)
          }}
          onToggleParticipants={toggleParticipantsPanel}
          onToggleSettings={toggleSettingsPanel}
          onRequestEnd={() => setIsEndModalOpen(true)}
        />
      )}

      <div
        className="mobile-orientation-gate"
        role="status"
        aria-live="polite"
      >
        <section
          className="mobile-orientation-card"
          aria-label="세로 화면 안내"
        >
          <span className="mobile-orientation-icon" aria-hidden="true">
            <Icon name="screen" size={34} />
          </span>
          <strong>세로 화면으로 돌려주세요</strong>
          <p>MEET MEET 게임룸은 세로 화면에 최적화되어 있어요.</p>
        </section>
      </div>
    </section>
  )
}
