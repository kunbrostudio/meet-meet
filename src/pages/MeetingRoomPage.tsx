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
import {
  ConversationPanel,
  type ConversationTab,
} from '../components/meeting/ConversationPanel'
import { VideoGrid } from '../components/meeting/VideoGrid'
import { ScreenShareCard } from '../components/meeting/ScreenShareCard'
import { ControlBar } from '../components/meeting/ControlBar'
import { EndMeetingModal } from '../components/meeting/EndMeetingModal'
import { MeetingSettingsPanel } from '../components/meeting/MeetingSettingsPanel'
import { ParticipantsPanel } from '../components/meeting/ParticipantsPanel'
import { RemoveParticipantModal } from '../components/meeting/RemoveParticipantModal'
import type { Participant } from '../types/participant'
import type {
  LanguageCode,
  SupportedLanguage,
  Transcript,
  TranslationSource,
} from '../types/transcript'
import type {
  LocalMediaState,
  MediaDeviceSelection,
} from '../types/meeting'
import {
  getSpeechRecognitionStatus,
  isSpeechRecognitionSupported,
  startSpeechRecognition,
  stopSpeechRecognition,
} from '../services/speechService'
import { translateText } from '../services/translationService'
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
  removeLiveKitParticipant,
  requestLiveKitToken,
  type LiveKitConnectionDetails,
  type LiveKitDataController,
  type LiveKitMediaController,
  type LiveKitScreenShare,
} from '../services/livekitConnectionService'
import type { LiveKitDataMessage } from '../services/livekitChatService'

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
  targetLanguage,
  autoStartCaption,
  deviceSelection,
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
    return storedTranscripts.length > 0
      ? dedupeTranscripts(storedTranscripts)
      : dedupeTranscripts(mockTranscripts.map((transcript) => ({
          ...transcript,
          meetingId,
        })))
  })
  const [chatMessages, setChatMessages] = useState(
    () => (
      restoredMeetingSession?.chatMessages.length
        ? dedupeChatMessages(restoredMeetingSession.chatMessages)
        : dedupeChatMessages(loadChatMessages(meetingId))
    ),
  )
  const [
    isSpeechRecognitionActive,
    setIsSpeechRecognitionActive,
  ] = useState(false)
  const [speechMessage, setSpeechMessage] = useState('')
  const [captionSize, setCaptionSize] = useState<CaptionSize>(
    () => loadCaptionPreferences().size,
  )
  const [showCaptionHint, setShowCaptionHint] = useState(true)
  const [isConversationOpen, setIsConversationOpen] = useState(
    () => !window.matchMedia('(max-width: 900px)').matches,
  )
  const [conversationTab, setConversationTab] =
    useState<ConversationTab>('transcript')
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
  const [roomParticipants, setRoomParticipants] = useState<Participant[]>(() => {
    return initialLocalParticipant
      ? [
          initialLocalParticipant,
          ...(
            isJoinFlow
              ? []
              : createMockRemoteParticipants(Math.max(0, participantCount - 1))
          ),
        ]
      : participants.slice(0, participantCount)
  })
  const copyMessageTimerRef = useRef<number | null>(null)
  const captionButtonRef = useRef<HTMLButtonElement>(null)
  const controlBarChatButtonRef = useRef<HTMLButtonElement>(null)
  const controlBarParticipantsButtonRef = useRef<HTMLButtonElement>(null)
  const controlBarSettingsButtonRef = useRef<HTMLButtonElement>(null)
  const conversationOpenButtonRef = useRef<HTMLButtonElement>(null)
  const autoStartAttemptedRef = useRef(false)
  const autoLiveKitConnectRoomRef = useRef<string | null>(null)
  const liveKitConnectingRoomRef = useRef<string | null>(null)
  const liveKitConnectedRoomRef = useRef<string | null>(null)
  const autoStartInProgressRef = useRef(false)
  const captionRestartTimerRef = useRef<number | null>(null)
  const screenShareStreamRef = useRef<MediaStream | null>(null)
  const liveKitMediaControllerRef =
    useRef<LiveKitMediaController | null>(null)
  const liveKitDataControllerRef =
    useRef<LiveKitDataController | null>(null)
  const publishedTranscriptIdsRef = useRef(new Set<number>())
  const meetingExitInProgressRef = useRef(false)
  const meetingSessionSaveTimerRef = useRef<number | null>(null)
  const meetingSessionSnapshotRef = useRef('')
  const liveKitParticipantsSnapshotRef = useRef('')
  const lastNoSpeechMessageAtRef = useRef(0)
  const terminalPhaseRef =
    useRef<Extract<LiveKitConnectionPhase, 'kicked' | 'ended' | 'leaving'> | null>(null)

  useEffect(() => {
    return () => {
      stopSpeechRecognition()
      stopScreenShare(screenShareStreamRef.current)
      if (copyMessageTimerRef.current !== null) {
        window.clearTimeout(copyMessageTimerRef.current)
      }
      if (captionRestartTimerRef.current !== null) {
        window.clearTimeout(captionRestartTimerRef.current)
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
    const transcriptId = now.getTime()
    const pendingText =
      pendingTranslations[targetLanguage as SupportedLanguage]
      ?? pendingTranslations.en
    const newTranscript: Transcript = {
      id: transcriptId,
      meetingId,
      participantId: currentUser.id,
      speakerId: currentUser.id,
      time: now.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      createdAt: now.toISOString(),
      speakerName: currentUser.name,
      sourceLanguage: currentUser.language,
      sourceText,
      targetLanguage,
      translatedText: pendingText,
      translationSource: 'mock',
      translatedTextByLanguage: {
        ...pendingTranslations,
        [targetLanguage]: pendingText,
      },
    }

    setTranscripts((previous) => {
      const updatedTranscripts = dedupeTranscripts([...previous, newTranscript])
      return updatedTranscripts
    })
    return newTranscript
  }

  const updateTranscriptTranslation = (
    transcriptId: number,
    translatedText: string,
    translationSource: TranslationSource,
  ) => {
    setTranscripts((previous) => previous.map((transcript) => (
      transcript.id === transcriptId
        ? {
            ...transcript,
            translatedText,
            translationSource,
            translatedTextByLanguage: {
              ...transcript.translatedTextByLanguage,
              [targetLanguage]: translatedText,
            },
          }
        : transcript
    )))
  }

  const publishLiveKitTranscript = (transcript: Transcript) => {
    if (
      !isLiveKitConnected
      || publishedTranscriptIdsRef.current.has(transcript.id)
    ) {
      return
    }

    const controller = liveKitDataControllerRef.current
    if (!controller) {
      console.warn(
        '[livekit-transcript] Data controller is not ready; transcript remains local.',
        { transcriptId: transcript.id },
      )
      return
    }

    publishedTranscriptIdsRef.current.add(transcript.id)
    void controller.publishTranscriptMessage({
      type: 'transcript-created',
      payload: transcript,
    }).catch((error) => {
      publishedTranscriptIdsRef.current.delete(transcript.id)
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
      language: localParticipant.language,
      onResult: async (sourceText) => {
        const newTranscript = addTranscript(sourceText)

        if (newTranscript === null) {
          return
        }

        try {
          const translation = await translateText({
            text: sourceText,
            sourceLanguage: localParticipant.language,
            targetLanguage,
          })
          updateTranscriptTranslation(
            newTranscript.id,
            translation.translatedText,
            translation.source,
          )
          publishLiveKitTranscript({
            ...newTranscript,
            translatedText: translation.translatedText,
            translationSource: translation.source,
            translatedTextByLanguage: {
              ...newTranscript.translatedTextByLanguage,
              [targetLanguage]: translation.translatedText,
            },
          })
        } catch {
          publishLiveKitTranscript(newTranscript)
          setSpeechMessage('번역 결과를 생성하지 못했습니다. 다시 시도해주세요.')
        }
      },
      onStart: () => {
        autoStartInProgressRef.current = false
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
        setIsSpeechRecognitionActive(false)
        setRoomParticipants(updateParticipantMediaState(
          localParticipant.id,
          { isSpeaking: false },
        ))
        if (errorCode === 'aborted') {
          setSpeechMessage('')
          return
        }
        if (errorCode === 'no-speech') {
          const now = Date.now()
          if (now - lastNoSpeechMessageAtRef.current > 8000) {
            lastNoSpeechMessageAtRef.current = now
            setSpeechMessage('음성이 감지되지 않았어요.')
          }
          return
        }
        setSpeechMessage(
          wasAutoStart
            ? '실시간 자막을 시작하려면 자막 버튼을 눌러주세요.'
            : errorCode === 'unsupported'
              ? '현재 브라우저에서는 실시간 자막을 지원하지 않습니다. Chrome에서 테스트해주세요.'
              : `실시간 자막 오류: ${errorCode}`,
        )
      },
    })
  }

  const handleToggleSpeechRecognition = () => {
    const isAutoStart = autoStartInProgressRef.current
    if (!isAutoStart) {
      setConversationTab('transcript')
      setIsConversationOpen(true)
      setShowCaptionHint(false)
    }

    const localParticipant = roomParticipants.find(
      (participant) => participant.role === 'local',
    )
    const supported = isSpeechRecognitionSupported()
    setSpeechMessage('')

    if (isSpeechRecognitionActive || getSpeechRecognitionStatus()) {
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
      setSpeechMessage('로컬 참가자 정보를 찾을 수 없습니다.')
      return
    }

    if (!localParticipant?.isMicOn) {
      autoStartInProgressRef.current = false
      setSpeechMessage('마이크를 켜야 실시간 자막을 사용할 수 있어요.')
      return
    }

    if (!supported) {
      autoStartInProgressRef.current = false
      setSpeechMessage('현재 브라우저에서는 실시간 자막을 지원하지 않습니다. Chrome에서 테스트해주세요.')
      return
    }

    if (getSpeechRecognitionStatus()) {
      return
    }

    const started = startRecognitionForParticipant(localParticipant)

    if (!started && isAutoStart) {
      autoStartInProgressRef.current = false
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
    setIsConversationOpen(false)
    setIsParticipantsOpen(false)
    setIsSettingsOpen(true)
    setSettingsMessage('')

    try {
      const [nextVideoDevices, nextAudioDevices] = await Promise.all([
        getVideoInputDevices(),
        getAudioInputDevices(),
      ])
      setVideoDevices(nextVideoDevices)
      setAudioDevices(nextAudioDevices)
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

    if (isSpeechRecognitionActive || getSpeechRecognitionStatus()) {
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
    kind: 'video' | 'audio',
    deviceId: string,
  ) => {
    if (!localParticipant) {
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
        setSpeechMessage('회의 미디어 연결을 준비하는 중입니다.')
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
          && isSpeechRecognitionActive
        ) {
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
      && isSpeechRecognitionActive
    ) {
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

  const sendChatMessage = (message: string) => {
    const sender = isLiveKitConnected
      ? liveKitParticipants.find(
          (participant) => participant.role === 'local',
        )
      : localParticipant

    if (!sender || !message.trim()) {
      return
    }

    const newMessage = createChatMessage({
      meetingId,
      senderId: sender.id,
      senderName: sender.name,
      message,
    })
    setChatMessages((current) => (
      current.some((item) => item.id === newMessage.id)
        ? current
        : dedupeChatMessages([...current, newMessage])
    ))

    if (isLiveKitConnected) {
      void liveKitDataControllerRef.current
        ?.publishChatMessage({
          type: 'chat-message',
          payload: newMessage,
        })
        .catch((error) => {
          console.error('[livekit-chat] Failed to publish chat message', error)
        })
    }
  }

  const connectLiveKitRoom = useCallback(async (options?: {
    force?: boolean
  }) => {
    if (terminalPhaseRef.current) {
      return
    }

    if (!localParticipant) {
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
        participantName: localParticipant.name,
        participantIdentity: `${meetingId}-${localParticipant.id}`,
        language: localParticipant.language,
        meetingRole: localParticipant.meetingRole,
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
        : '회의 연결을 준비하지 못했습니다.'
      setLiveKitConnection(null)
      setIsLiveKitConnected(false)
      if (terminalPhaseRef.current) {
        return
      }
      setLiveKitStatus('failed')
      setLiveKitMessage(
        `회의 연결에 실패했습니다. 로컬 모드로 계속 진행합니다. ${reason}`,
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
    localParticipant,
    meetingId,
    roomCode,
  ])

  useEffect(() => {
    if (terminalPhaseRef.current) {
      return
    }

    if (!localParticipant) {
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
    localParticipant,
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
    setLiveKitMessage('방장에 의해 미팅에서 퇴장되었습니다.')
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
            payload: systemMessage,
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
  ])

  const isCurrentUserHost =
    (displayedLocalParticipant ?? localParticipant)?.meetingRole === 'host'
  const connectionLoadingTitle =
    liveKitConnectionPhase === 'connected' && liveKitParticipants.length === 0
      ? '참가자 정보를 불러오는 중입니다...'
      : '회의에 연결 중입니다...'

  const openConversationPanel = useCallback((tab: ConversationTab = 'chat') => {
    setIsScreenShareExpanded(false)
    setConversationTab(tab)
    setIsParticipantsOpen(false)
    setIsSettingsOpen(false)
    setIsConversationOpen(true)
    if (tab === 'chat') {
      setChatUnreadCount(0)
    }
  }, [])

  const closeConversationPanel = useCallback(() => {
    const activeElement = document.activeElement

    if (
      activeElement instanceof HTMLElement
      && activeElement.closest('.transcript-panel')
    ) {
      activeElement.blur()
    }

    setIsConversationOpen(false)
    window.setTimeout(() => {
      if (controlBarChatButtonRef.current) {
        controlBarChatButtonRef.current.focus()
        return
      }

      conversationOpenButtonRef.current?.focus()
    }, 0)
  }, [])

  const toggleConversationPanel = useCallback((tab: ConversationTab = 'chat') => {
    if (isConversationOpen) {
      closeConversationPanel()
      return
    }

    openConversationPanel(tab)
  }, [closeConversationPanel, isConversationOpen, openConversationPanel])

  const toggleParticipantsPanel = useCallback(() => {
    setIsScreenShareExpanded(false)
    setIsConversationOpen(false)
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

    setIsConversationOpen(false)
    setIsParticipantsOpen(false)
    void openSettings()
  }, [isSettingsOpen, openSettings])

  useEffect(() => {
    if (
      !isConversationOpen
      && !isParticipantsOpen
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

      if (isConversationOpen) {
        closeConversationPanel()
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
    closeConversationPanel,
    isConversationOpen,
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
      summaryStatus: 'ready',
    })
    saveEndedMeetingSessionToHistory(finalSession)
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
    transcripts,
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
          `${actor.name}님이 회의를 종료했습니다.`,
        )

        if (dataController) {
          await dataController.publishChatMessage({
            type: 'system-message',
            payload: systemMessage,
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
        setLiveKitMessage('방장이 회의를 종료했습니다.')
        const nextMessages = [
          ...chatMessages,
          createSystemMessage({
            meetingId,
            message: `${message.payload.endedByName}님이 회의를 종료했습니다.`,
          }),
        ]
        setChatMessages(nextMessages)
        void finalizeMeetingAndNavigate(nextMessages, message.payload.endedByName)
        return
      }

      if (message.type === 'transcript-created') {
        // TODO: Translate the received sourceText again for each receiver's
        // targetLanguage when per-user translation is introduced.
        setTranscripts((current) => (
          current.some((item) => item.id === message.payload.id)
            ? current
            : dedupeTranscripts([...current, message.payload])
        ))
        return
      }

      if (
        message.type === 'chat-message'
        && message.payload.senderId !== displayedLocalParticipant?.id
        && (!isConversationOpen || conversationTab !== 'chat')
      ) {
        setChatUnreadCount((current) => current + 1)
      }

      setChatMessages((current) => (
        current.some((item) => item.id === message.payload.id)
          ? current
          : dedupeChatMessages([...current, message.payload])
      ))
    },
    [
      chatMessages,
      conversationTab,
      displayedLocalParticipant?.id,
      displayedLocalParticipant?.liveKitIdentity,
      finalizeMeetingAndNavigate,
      isConversationOpen,
      liveKitConnection?.participantIdentity,
      markParticipantKicked,
      meetingId,
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

      {liveKitStatus === 'failed' && (
        <div className="livekit-connection-notice" role="status">
          회의 연결에 실패했습니다. 로컬 모드로 계속 진행합니다.
        </div>
      )}

      <div
        className={[
          'meeting-layout',
          isConversationOpen ? 'conversation-open' : 'conversation-closed',
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
              <strong>방장에 의해 미팅에서 퇴장되었습니다.</strong>
              <p>다시 참여하려면 초대 링크 또는 룸코드로 재입장해 주세요.</p>
            </div>
          ) : isMeetingEndedRemotely ? (
            <div className="meeting-connection-state">
              <span className="meeting-connection-spinner" />
              <strong>회의가 종료되었습니다.</strong>
              <p>회의 요약 화면으로 이동하고 있어요.</p>
            </div>
          ) : isEndingMeeting ? (
            <div className="meeting-connection-state">
              <span className="meeting-connection-spinner" />
              <strong>회의 기록을 저장하고 있어요.</strong>
              <p>잠시 후 요약 화면으로 이동합니다.</p>
            </div>
          ) : shouldHoldVideoForConnection ? (
            <div className="meeting-connection-state">
              <span className="meeting-connection-spinner" />
              <strong>{connectionLoadingTitle}</strong>
              <p>참가자 화면을 불러오고 있어요.</p>
            </div>
          ) : (
            <>
              {activeScreenShareStream && (
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
                    setIsConversationOpen(false)
                    setIsParticipantsOpen(false)
                    setIsSettingsOpen(false)
                    setIsScreenShareExpanded(true)
                  }}
                  onCollapse={() => setIsScreenShareExpanded(false)}
                  onStop={() => void toggleScreenShare()}
                />
              )}
              {!isScreenShareFullscreen && (
                <VideoGrid
                  participants={displayedParticipants}
                  transcripts={transcripts}
                  targetLanguage={targetLanguage}
                  captionSize={captionSize}
                  compact={isScreenShareLayoutActive}
                  viewMode={isScreenShareLayoutActive ? 'grid' : viewMode}
                  selectedParticipantId={activeMainParticipantId}
                  onSelectParticipant={(participantId) => {
                    setSelectedMainParticipantId(participantId)
                    if (!isScreenShareLayoutActive) {
                      setViewMode('focus')
                    }
                  }}
                  onReconnectMedia={onReconnectMedia}
                />
              )}
            </>
          )}
        </div>
        <ConversationPanel
          participants={displayedParticipants.length > 0 ? displayedParticipants : roomParticipants}
          transcripts={transcripts}
          chatMessages={chatMessages}
          localParticipantId={
            displayedLocalParticipant?.id ?? localParticipant?.id
          }
          targetLanguage={targetLanguage}
          isOpen={isConversationOpen}
          activeTab={conversationTab}
          chatUnreadCount={chatUnreadCount}
          onTabChange={(tab) => openConversationPanel(tab)}
          onClose={closeConversationPanel}
          onSendChatMessage={sendChatMessage}
        />
      </div>

      <button
        className={`conversation-mobile-backdrop ${isConversationOpen ? 'is-open' : ''}`}
        type="button"
        onClick={closeConversationPanel}
        aria-label="대화 패널 닫기"
        tabIndex={isConversationOpen ? 0 : -1}
      />

      {!isConversationOpen && (
        <button
          ref={conversationOpenButtonRef}
          className="conversation-open-button"
          type="button"
          onClick={() => openConversationPanel(
            chatUnreadCount > 0 ? 'chat' : conversationTab,
          )}
        >
          <Icon name="message" size={15} /> 대화 열기
          {chatUnreadCount > 0 && (
            <span className="conversation-open-badge">
              {Math.min(chatUnreadCount, 99)}
            </span>
          )}
        </button>
      )}

      {isSettingsOpen && (
        <MeetingSettingsPanel
          participant={localParticipant}
          targetLanguage={targetLanguage}
          autoStartCaption={autoStartCaption}
          deviceSelection={deviceSelection}
          videoDevices={videoDevices}
          audioDevices={audioDevices}
          isChangingDevice={isChangingDevice}
          message={settingsMessage}
          captionSize={captionSize}
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
                '회의 연결에 실패했습니다. 로컬 모드로 계속 진행합니다.',
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
                setLiveKitMessage('방장에 의해 미팅에서 퇴장되었습니다.')
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
              방장에 의해 미팅에서 퇴장되었습니다.
            </h2>
            <p>
              회의 연결이 종료되었습니다. 다시 참여하려면 홈에서 방 코드로
              입장해주세요.
            </p>
            <div className="meeting-end-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={onLeave}
              >
                요약 보기
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
              ? '회의를 종료할까요?'
              : '미팅에서 나갈까요?'
          }
          description={
            isCurrentUserHost
              ? '모든 참가자의 미팅이 종료되고 회의 요약 화면으로 이동합니다.'
              : '현재 미팅에서 나가고 회의 요약 화면으로 이동합니다.'
          }
          cancelLabel="취소"
          confirmLabel={isCurrentUserHost ? '회의 종료' : '나가기'}
          savingLabel="저장 중..."
          onContinue={() => setIsEndModalOpen(false)}
          onConfirm={() => void confirmEndMeeting()}
        />
      )}

      {!wasRemovedFromMeeting && (
        <ControlBar
          participant={displayedLocalParticipant ?? localParticipant}
          isCaptionActive={isSpeechRecognitionActive}
          isScreenSharing={isLocalScreenSharing}
          isConversationOpen={isConversationOpen}
          isParticipantsOpen={isParticipantsOpen}
          isSettingsOpen={isSettingsOpen}
          isHost={isCurrentUserHost}
          chatUnreadCount={chatUnreadCount}
          viewMode={isScreenShareLayoutActive ? 'grid' : viewMode}
          showCaptionHint={showCaptionHint}
          captionMessage={speechMessage}
          screenShareMessage={screenShareMessage}
          captionButtonRef={captionButtonRef}
          chatButtonRef={controlBarChatButtonRef}
          participantsButtonRef={controlBarParticipantsButtonRef}
          settingsButtonRef={controlBarSettingsButtonRef}
          onToggleMicrophone={() => void toggleLocalMedia('audio')}
          onToggleCaption={handleToggleSpeechRecognition}
          onToggleCamera={() => void toggleLocalMedia('video')}
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
