import { useEffect, useState } from 'react'
import './App.css'
import { AppHeader } from './components/common/AppHeader'
import { ENABLE_MOCK_DATA } from './constants/mockData'
import { LandingPage } from './pages/LandingPage'
import { MeetingHistoryPage } from './pages/MeetingHistoryPage'
import { MeetingRoomPage } from './pages/MeetingRoomPage'
import { MeetingSummaryPage } from './pages/MeetingSummaryPage'
import { SetupPage } from './pages/SetupPage'
import type {
  LocalMediaState,
  MediaDeviceSelection,
  MeetingPreferences,
  Room,
} from './types'
import { stopMediaStream } from './services/deviceService'
import {
  createRoom,
  createServerRoom,
  joinRoomByCode,
  joinServerRoomByCode,
  loadCurrentRoom,
  saveCurrentRoom,
} from './services/roomService'
import {
  clearActiveMeetingId,
  clearMeetingMeta,
  clearMeetingTranscripts,
  deleteMeetingHistoryItem,
  loadActiveMeetingId,
  loadMeetingMeta,
  loadMeetingTranscripts,
  saveActiveMeetingId,
  saveMeetingHistoryItem,
  saveMeetingMeta,
} from './services/transcriptStorageService'
import {
  createLocalParticipant,
  createMockRemoteParticipants,
} from './services/participantService'
import { clearChatMessages } from './services/chatService'
import {
  clearMeetingSession,
  loadMeetingSession,
  saveEndedMeetingSessionToHistory,
} from './services/meetingSessionStorageService'
import { cleanupExpiredAndOversizedRecords } from './services/localFirstStoragePolicyService'
import { clearTranslations } from './services/translationRecordService'

export type Page = 'landing' | 'setup' | 'meeting' | 'summary' | 'history'

const pagePaths: Record<Page, string> = {
  landing: '/',
  setup: '/setup',
  meeting: '/meeting',
  summary: '/summary',
  history: '/history',
}

const defaultPreferences: MeetingPreferences = {
  displayName: 'Ken Choi',
  sourceLanguage: 'ko',
  targetLanguage: 'ko',
  participantCount: 4,
  autoStartCaption: true,
}

function getPageFromPath(): Page {
  const entry = Object.entries(pagePaths).find(([, path]) => path === window.location.pathname)
  return (entry?.[0] as Page | undefined) ?? 'landing'
}

function getInitialMeetingState() {
  const summaryMeetingId =
    new URLSearchParams(window.location.search).get('meetingId')
  const storedMeetingId = summaryMeetingId ?? loadActiveMeetingId()
  const storedRoom = loadCurrentRoom()
  const meetingId = storedMeetingId ?? storedRoom?.meetingId
  const meta = meetingId ? loadMeetingMeta(meetingId) : null
  const room: Room = meetingId
    ? {
        meetingId,
        roomCode:
          meta?.roomCode
          ?? (storedRoom?.meetingId === meetingId ? storedRoom.roomCode : 'MER-LOCAL'),
        title: meta?.roomName ?? storedRoom?.title ?? 'Weekly Product Sync',
        createdAt: meta?.createdAt ?? storedRoom?.createdAt ?? new Date().toISOString(),
        meetingRole:
          meta?.meetingRole
          ?? storedRoom?.meetingRole
          ?? 'host',
        participantIdentity: storedRoom?.participantIdentity,
        hostControlToken: storedRoom?.hostControlToken,
        expiresAt: storedRoom?.expiresAt,
        maxParticipants: storedRoom?.maxParticipants,
      }
    : createRoom()

  return {
    room,
    meta,
  }
}

function App() {
  useEffect(() => {
    cleanupExpiredAndOversizedRecords()
  }, [])

  const [initialMeeting] = useState(getInitialMeetingState)
  const [page, setPage] = useState<Page>(getPageFromPath)
  const [currentRoom, setCurrentRoom] = useState(initialMeeting.room)
  const meetingId = currentRoom.meetingId
  const roomCode = currentRoom.roomCode
  const [meetingCreatedAt, setMeetingCreatedAt] = useState(
    initialMeeting.room.createdAt,
  )
  const [preferences, setPreferences] = useState<MeetingPreferences>(() => ({
    ...defaultPreferences,
    ...initialMeeting.meta?.preferences,
    participantCount:
      initialMeeting.meta?.participantCount
      ?? initialMeeting.meta?.preferences?.participantCount
      ?? defaultPreferences.participantCount,
  }))
  const [roomName, setRoomName] = useState(
    initialMeeting.room.title,
  )
  const [localMedia, setLocalMedia] = useState<LocalMediaState>({
    stream: null,
    cameraEnabled: true,
    microphoneEnabled: true,
  })
  const [deviceSelection, setDeviceSelection] = useState<MediaDeviceSelection>({
    videoDeviceId: '',
    audioDeviceId: '',
  })

  const clearLocalMedia = () => {
    setLocalMedia((current) => {
      stopMediaStream(current.stream)
      return {
        stream: null,
        cameraEnabled: true,
        microphoneEnabled: true,
      }
    })
  }

  useEffect(() => {
    const handlePopState = () => {
      const nextPage = getPageFromPath()
      if (nextPage !== 'setup' && nextPage !== 'meeting') {
        clearLocalMedia()
      }
      setPage(nextPage)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (nextPage: Page) => {
    if (nextPage !== 'setup' && nextPage !== 'meeting') {
      clearLocalMedia()
    }
    window.history.pushState({}, '', pagePaths[nextPage])
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const navigateToSummary = (summaryMeetingId: string) => {
    clearLocalMedia()
    window.history.pushState(
      {},
      '',
      `${pagePaths.summary}?meetingId=${encodeURIComponent(summaryMeetingId)}`,
    )
    setPage('summary')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const beginNewRoom = async () => {
    try {
      const room = await createServerRoom({
        participantName: preferences.displayName,
        language: preferences.sourceLanguage,
        title: 'Weekly Product Sync',
      })
      setCurrentRoom(room)
      setMeetingCreatedAt(room.createdAt)
      setRoomName(room.title)
      saveActiveMeetingId(room.meetingId)
      navigate('setup')
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : '회의실을 생성하지 못했습니다.'
      window.alert(message)
    }
  }

  const joinWithCode = async (code: string): Promise<string | null> => {
    let room: Room

    try {
      room = await joinServerRoomByCode({
        roomCode: code,
        participantName: preferences.displayName,
        language: preferences.sourceLanguage,
      })
    } catch (error) {
      const fallbackRoom = joinRoomByCode(code)

      if (!fallbackRoom) {
        return error instanceof Error
          ? error.message
          : '올바른 방 코드 형식이 아닙니다.'
      }

      return error instanceof Error
        ? error.message
        : '회의실에 입장하지 못했습니다.'
    }

    if (!room) {
      return '올바른 방 코드 형식이 아닙니다.'
    }

    setCurrentRoom(room)
    setMeetingCreatedAt(room.createdAt)
    setRoomName(room.title)
    saveActiveMeetingId(room.meetingId)
    saveMeetingMeta({
      meetingId: room.meetingId,
      roomCode: room.roomCode,
      roomName: room.title,
      meetingRole: room.meetingRole,
      participantCount: preferences.participantCount,
      createdAt: room.createdAt,
      updatedAt: new Date().toISOString(),
      preferences,
    })
    navigate('setup')
    return null
  }

  const startMeeting = (nextPreferences: MeetingPreferences) => {
    const now = new Date().toISOString()
    const meetingMeta = {
      meetingId,
      roomCode,
      roomName: currentRoom.title,
      meetingRole: currentRoom.meetingRole,
      participantCount: nextPreferences.participantCount,
      createdAt: meetingCreatedAt,
      updatedAt: now,
      preferences: nextPreferences,
    }
    setPreferences(nextPreferences)
    setRoomName(currentRoom.title)
    saveActiveMeetingId(meetingId)
    saveMeetingMeta(meetingMeta)
    navigate('meeting')
  }

  const participants = [
    {
      ...createLocalParticipant(
        preferences.displayName,
        preferences.sourceLanguage,
        localMedia.stream,
        currentRoom.meetingRole,
      ),
      joinedAt: meetingCreatedAt,
      isCameraOn: localMedia.cameraEnabled,
      isMicOn: localMedia.microphoneEnabled,
      liveKitIdentity: currentRoom.participantIdentity,
    },
    ...(
      ENABLE_MOCK_DATA
        ? createMockRemoteParticipants(
            Math.max(0, preferences.participantCount - 1),
          )
        : []
    ),
  ]

  const updateLocalMedia = (nextMedia: LocalMediaState) => {
    setLocalMedia((current) => {
      if (current.stream && current.stream !== nextMedia.stream) {
        stopMediaStream(current.stream)
      }
      return nextMedia
    })
  }

  const updateMeetingPreferences = (nextPreferences: MeetingPreferences) => {
    setPreferences(nextPreferences)
    saveMeetingMeta({
      meetingId,
      roomCode,
      roomName,
      meetingRole: currentRoom.meetingRole,
      participantCount: nextPreferences.participantCount,
      createdAt: meetingCreatedAt,
      updatedAt: new Date().toISOString(),
      preferences: nextPreferences,
    })
  }

  const endMeeting = () => {
    const endedAt = new Date().toISOString()
    const meetingSession = loadMeetingSession(meetingId)
    const transcripts =
      meetingSession?.transcripts ?? loadMeetingTranscripts(meetingId)
    const currentParticipantCount =
      meetingSession?.participants.length
      || participants.length
      || preferences.participantCount
    const usedLanguages = [...new Set(
      transcripts.flatMap((transcript) => [
        transcript.sourceLanguage,
        transcript.targetLanguage,
      ]),
    )]

    const meetingMeta = {
      meetingId,
      roomCode,
      roomName,
      meetingRole: currentRoom.meetingRole,
      participantCount: currentParticipantCount,
      createdAt: meetingCreatedAt,
      updatedAt: endedAt,
      preferences,
    }
    const historyItem = {
      meetingId,
      roomCode,
      title: meetingSession?.title ?? roomName,
      createdAt: meetingSession?.createdAt ?? meetingCreatedAt,
      endedAt: meetingSession?.endedAt ?? endedAt,
      participantCount: currentParticipantCount,
      transcriptCount: transcripts.length,
      usedLanguages,
    }

    saveMeetingMeta(meetingMeta)
    if (meetingSession) {
      saveEndedMeetingSessionToHistory({
        ...meetingSession,
        endedAt: meetingSession.endedAt ?? endedAt,
      }, meetingMeta)
    } else {
      saveMeetingHistoryItem(historyItem)
    }
    navigateToSummary(meetingId)
  }

  const startNewMeeting = () => {
    beginNewRoom()
  }

  const deleteMeetingRecord = () => {
    clearMeetingTranscripts(meetingId)
    clearChatMessages(meetingId)
    clearTranslations(meetingId)
    clearMeetingSession(meetingId)
    clearMeetingMeta(meetingId)
    deleteMeetingHistoryItem(meetingId)
    clearActiveMeetingId()
  }

  const openMeetingHistoryItem = (historyMeetingId: string) => {
    const meta = loadMeetingMeta(historyMeetingId)

    saveActiveMeetingId(historyMeetingId)

    if (meta) {
      const room: Room = {
        meetingId: historyMeetingId,
        roomCode: meta.roomCode ?? 'MER-LOCAL',
        title: meta.roomName,
        createdAt: meta.createdAt,
        meetingRole: meta.meetingRole ?? 'host',
      }
      setCurrentRoom(room)
      saveCurrentRoom(room)
      setMeetingCreatedAt(meta.createdAt)
      setRoomName(meta.roomName)
      setPreferences({
        ...defaultPreferences,
        ...meta.preferences,
        participantCount:
          meta.participantCount
          ?? meta.preferences?.participantCount
          ?? defaultPreferences.participantCount,
      })
    }

    navigateToSummary(historyMeetingId)
  }

  const goBackFromHistory = () => {
    if (window.history.length > 1) {
      window.history.back()
      return
    }

    navigateToSummary(meetingId)
  }

  return (
    <div className="app-shell">
      {(page === 'setup' || page === 'summary' || page === 'history') && (
        <AppHeader
          onLogoClick={() => navigate('landing')}
        />
      )}

      <main>
        {page === 'landing' && (
          <LandingPage
            onStart={beginNewRoom}
            onJoin={joinWithCode}
          />
        )}
        {page === 'setup' && (
          <SetupPage
            roomCode={roomCode}
            initialPreferences={preferences}
            localMedia={localMedia}
            deviceSelection={deviceSelection}
            canSetParticipantCount={currentRoom.meetingRole === 'host'}
            onLocalMediaChange={updateLocalMedia}
            onDeviceSelectionChange={setDeviceSelection}
            onBack={() => navigate('landing')}
            onJoin={startMeeting}
          />
        )}
        {page === 'meeting' && (
          <MeetingRoomPage
            key={meetingId}
            meetingId={meetingId}
            roomCode={roomCode}
            roomName={roomName}
            participants={participants}
            participantCount={preferences.participantCount}
            targetLanguage={preferences.targetLanguage}
            autoStartCaption={preferences.autoStartCaption}
            deviceSelection={deviceSelection}
            hostControlToken={currentRoom.hostControlToken}
            onLocalMediaChange={updateLocalMedia}
            onDeviceSelectionChange={setDeviceSelection}
            onPreferencesChange={updateMeetingPreferences}
            onReconnectMedia={() => navigate('setup')}
            onReturnHome={() => navigate('landing')}
            onLeave={endMeeting}
          />
        )}
        {page === 'summary' && (
          <MeetingSummaryPage
            meetingId={meetingId}
            roomCode={roomCode}
            roomName={roomName}
            participants={participants}
            targetLanguage={preferences.targetLanguage}
            onHome={() => navigate('landing')}
            onNewMeeting={startNewMeeting}
            onDeleteRecord={deleteMeetingRecord}
            onViewHistory={() => navigate('history')}
          />
        )}
        {page === 'history' && (
          <MeetingHistoryPage
            onBack={goBackFromHistory}
            onHome={() => navigate('landing')}
            onOpenMeeting={openMeetingHistoryItem}
          />
        )}
      </main>
    </div>
  )
}

export default App
