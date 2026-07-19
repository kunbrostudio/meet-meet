import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Icon } from '../components/common/Icon'
import { Logo } from '../components/common/Logo'
import { ENABLE_MOCK_DATA } from '../constants/mockData'
import { TRANSLATION_MODE_CONFIG } from '../constants/translationMode'
import { GameBoard } from '../components/game-room/GameBoard'
import { MeetMeetRoomLayout } from '../components/game-room/MeetMeetRoomLayout'
import { ScreenShareCard } from '../components/meeting/ScreenShareCard'
import { ControlBar } from '../components/meeting/ControlBar'
import { EndMeetingModal } from '../components/meeting/EndMeetingModal'
import { MeetingSettingsPanel } from '../components/meeting/MeetingSettingsPanel'
import { ParticipantsPanel } from '../components/meeting/ParticipantsPanel'
import { RemoveParticipantModal } from '../components/meeting/RemoveParticipantModal'
import type { Participant } from '../types/participant'
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
  stopMediaStream,
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

type MeetingRoomPageProps = {
  meetingId: string
  roomCode: string
  roomName: string
  participants: Participant[]
  participantCount: number
  targetLanguage: LanguageCode
  autoStartCaption: boolean
  deviceSelection: MediaDeviceSelection
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

type ConversationTab = 'chat'

export function MeetingRoomPage({
  meetingId,
  roomCode,
  roomName,
  participants,
  participantCount,
  targetLanguage,
  autoStartCaption,
  deviceSelection,
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
  const [isConversationOpen, setIsConversationOpen] = useState(true)
  const [conversationTab, setConversationTab] =
    useState<ConversationTab>('chat')
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
  const [liveKitMessage, setLiveKitMessage] = useState('')
  const [wasRemovedFromMeeting, setWasRemovedFromMeeting] = useState(false)
  const [isMeetingEndedRemotely, setIsMeetingEndedRemotely] = useState(false)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)
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
  const copyMessageTimerRef = useRef<number | null>(null)
  const captionButtonRef = useRef<HTMLButtonElement>(null)
  const controlBarChatButtonRef = useRef<HTMLButtonElement>(null)
  const controlBarParticipantsButtonRef = useRef<HTMLButtonElement>(null)
  const controlBarSettingsButtonRef = useRef<HTMLButtonElement>(null)
  const autoStartAttemptedRef = useRef(false)
  const autoLiveKitConnectRoomRef = useRef<string | null>(null)
  const liveKitConnectingRoomRef = useRef<string | null>(null)
  const liveKitConnectedRoomRef = useRef<string | null>(null)
  const autoStartInProgressRef = useRef(false)
  const captionRestartTimerRef = useRef<number | null>(null)
  const liveCaptionClearTimerRef = useRef<number | null>(null)
  const screenShareStreamRef = useRef<MediaStream | null>(null)
  const liveKitMediaControllerRef =
    useRef<LiveKitMediaController | null>(null)
  const liveKitDataControllerRef =
    useRef<LiveKitDataController | null>(null)
  const publishedTranscriptIdsRef = useRef(new Set<string>())
  const meetingExitInProgressRef = useRef(false)
  const meetingSessionSaveTimerRef = useRef<number | null>(null)
  const meetingSessionSnapshotRef = useRef('')
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
      if (meetingSessionSaveTimerRef.current !== null) {
        window.clearTimeout(meetingSessionSaveTimerRef.current)
      }
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
      setConversationTab('chat')
      setIsConversationOpen(true)
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
    setCopyMessage(
      copied
        ? '복사되었습니다.'
        : '복사에 실패했습니다.',
    )

    if (copyMessageTimerRef.current !== null) {
      window.clearTimeout(copyMessageTimerRef.current)
    }
    copyMessageTimerRef.current = window.setTimeout(() => {
      setCopyMessage('')
    }, 1800)
  }

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

  const markParticipantKicked = useCallback(() => {
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
    setIsConversationOpen(false)
    setIsParticipantsOpen(false)
    setIsSettingsOpen(false)
    setIsLiveKitOverlayOpen(false)
    setIsScreenShareExpanded(false)
    setLiveKitStatus('kicked')
    setLiveKitMessage('방장에 의해 방에서 퇴장되었습니다.')
    setIsLiveKitConnecting(false)
    setIsLiveKitConnected(false)
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
          hostControlToken,
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
    if (isTerminalConnectionPhase && wasRemovedFromMeeting) {
      return []
    }

    if (isLiveKitConnected && liveKitParticipants.length > 0) {
      return liveKitParticipants
    }

    if (shouldHoldVideoForConnection || !canUseMockParticipants) {
      return []
    }

    return roomParticipants
  }, [
    canUseMockParticipants,
    isTerminalConnectionPhase,
    isLiveKitConnected,
    liveKitParticipants,
    roomParticipants,
    shouldHoldVideoForConnection,
    wasRemovedFromMeeting,
  ])
  const displayedLocalParticipant = displayedParticipants.find(
    (participant) => participant.role === 'local',
  )

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

  const isCurrentUserHost =
    (displayedLocalParticipant ?? localParticipant)?.meetingRole === 'host'
  const connectionLoadingTitle =
    liveKitConnectionPhase === 'connected' && liveKitParticipants.length === 0
      ? '참가자 정보를 불러오는 중입니다...'
      : '방에 연결 중입니다...'

  const openConversationPanel = useCallback((tab: ConversationTab = 'chat') => {
    setIsScreenShareExpanded(false)
    const nextTab = tab
    setConversationTab(nextTab)
    setIsParticipantsOpen(false)
    setIsSettingsOpen(false)
    setIsConversationOpen(true)
    if (nextTab === 'chat') {
      setChatUnreadCount(0)
    }
  }, [])

  const toggleConversationPanel = useCallback((tab: ConversationTab = 'chat') => {
    openConversationPanel(tab)
  }, [openConversationPanel])

  const toggleParticipantsPanel = useCallback(() => {
    setIsScreenShareExpanded(false)
    setIsSettingsOpen(false)
    setIsParticipantsOpen((current) => {
      const nextOpen = !current

      if (!nextOpen) {
        window.setTimeout(() => {
          controlBarParticipantsButtonRef.current?.focus()
        }, 0)
      }

      return nextOpen
    })
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
    await disconnectLiveKitRoom()
    stopMediaStream(localParticipant?.mediaStream ?? null)
    saveMeetingTranscripts(meetingId, transcripts)
    saveChatMessages(meetingId, nextChatMessages)

    await new Promise((resolve) => window.setTimeout(resolve, 180))
    onLeave()
  }, [
    chatMessages,
    disconnectLiveKitRoom,
    endScreenShare,
    localParticipant,
    meetingId,
    onLeave,
    recordingEnabled,
    transcripts,
    translations,
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
            hostControlToken,
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
    (message: LiveKitDataMessage) => {
      if (message.type === 'participant-kicked') {
        const localIdentity =
          displayedLocalParticipant?.liveKitIdentity
          ?? liveKitConnection?.participantIdentity

        if (
          localIdentity
          && message.payload.targetParticipantIdentity === localIdentity
        ) {
          markParticipantKicked()
        }
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
      const localIdentity =
        displayedLocalParticipant?.liveKitIdentity
        ?? liveKitConnection?.participantIdentity
        ?? (
          displayedLocalParticipant
            ? String(displayedLocalParticipant.id)
            : undefined
        )
      const isMine =
        message.payload.senderId === localIdentity
        || (
          incomingChatMessage.senderId !== null
          && incomingChatMessage.senderId === displayedLocalParticipant?.id
        )

      if (
        message.type === 'chat-message'
        && !isMine
        && conversationTab !== 'chat'
      ) {
        setChatUnreadCount((current) => current + 1)
      }

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
      conversationTab,
      displayedLocalParticipant,
      displayedParticipants,
      finalizeMeetingAndNavigate,
      liveKitConnection?.participantIdentity,
      markParticipantKicked,
      meetingId,
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
      <header className="meeting-header">
        <div className="meeting-header-main">
          <Logo />
          <span className="meeting-header-divider" />
          <strong>{roomName}</strong>
          <span className="meeting-room-code-wrap">
            <button
              className="meeting-room-code"
              type="button"
              onClick={copyRoomCode}
              aria-label={`${roomCode} 방 코드 복사`}
              title="방 코드 복사"
            >
              {roomCode} <Icon name="copy" size={13} />
            </button>
            {copyMessage && (
              <span
                className={`meeting-copy-feedback ${copyMessage.includes('실패') ? 'is-error' : ''}`}
                role="status"
                aria-live="polite"
              >
                {copyMessage}
              </span>
            )}
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
              ) : (
                <MeetMeetRoomLayout
                  participants={displayedParticipants}
                  selectedParticipantId={activeMainParticipantId}
                  onSelectParticipant={(participantId) => {
                    setSelectedMainParticipantId(participantId)
                    setViewMode('focus')
                  }}
                  onReconnectMedia={onReconnectMedia}
                  board={(
                    <GameBoard
                      phase="waiting"
                      chatMessages={chatMessages}
                      localParticipantId={
                        displayedLocalParticipant?.id ?? localParticipant?.id
                      }
                      onSendChatMessage={sendChatMessage}
                      canSendChatMessage={canSendChatMessage}
                      chatSendMessage={chatSendMessage}
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

      {isParticipantsOpen && (
        <ParticipantsPanel
          participants={displayedParticipants}
          message={participantRemoveMessage}
          onClose={() => {
            setIsParticipantsOpen(false)
            window.setTimeout(() => {
              controlBarParticipantsButtonRef.current?.focus()
            }, 0)
          }}
          onRequestRemove={(participant) => {
            setParticipantRemoveMessage('')
            setParticipantToRemove(participant)
          }}
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
          isConversationOpen={isConversationOpen}
          isParticipantsOpen={isParticipantsOpen}
          isSettingsOpen={isSettingsOpen}
          isHost={isCurrentUserHost}
          recordingEnabled={recordingEnabled}
          chatUnreadCount={chatUnreadCount}
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
          chatButtonRef={controlBarChatButtonRef}
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
          onToggleParticipants={toggleParticipantsPanel}
          onOpenChat={() => toggleConversationPanel('chat')}
          onToggleSettings={toggleSettingsPanel}
          onRequestEnd={() => setIsEndModalOpen(true)}
        />
      )}
    </section>
  )
}
