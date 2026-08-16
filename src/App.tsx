import { useEffect, useRef, useState } from 'react'
import './App.css'
import { ENABLE_MOCK_DATA } from './constants/mockData'
import { LandingPage } from './pages/LandingPage'
import { MeetingRoomPage } from './pages/MeetingRoomPage'
import type {
  LocalMediaState,
  GameReadySnapshot,
  MediaDeviceSelection,
  MeetingPreferences,
  Room,
} from './types'
import {
  createRoom,
  createServerRoom,
  clearCurrentRoom,
  joinServerRoomByCode,
  loadCurrentRoom,
  normalizeRoomCode,
} from './services/roomService'
import {
  clearActiveMeetingId,
  loadActiveMeetingId,
  loadMeetingMeta,
  saveActiveMeetingId,
  saveMeetingMeta,
} from './services/transcriptStorageService'
import {
  createLocalParticipant,
  createMockRemoteParticipants,
} from './services/participantService'
import { cleanupExpiredAndOversizedRecords } from './services/localFirstStoragePolicyService'

export type Page = 'landing' | 'meeting'

const pagePaths: Record<Page, string> = {
  landing: '/',
  meeting: '/meeting',
}

const defaultPreferences: MeetingPreferences = {
  displayName: 'Ken Choi',
  sourceLanguage: 'ko',
  targetLanguage: 'ko',
  participantCount: 2,
  initialLives: 3,
  autoStartCaption: false,
}

function getPageFromPath(): Page {
  if (window.location.pathname === '/setup') {
    window.history.replaceState({}, '', '/')
    return 'landing'
  }

  const entry = Object.entries(pagePaths).find(([, path]) => path === window.location.pathname)
  return entry?.[0] === 'meeting' ? 'meeting' : 'landing'
}

function getInitialMeetingState() {
  const storedMeetingId = loadActiveMeetingId()
  const storedRoom = loadCurrentRoom()
  const meetingId = storedMeetingId ?? storedRoom?.meetingId
  const meta = meetingId ? loadMeetingMeta(meetingId) : null
  const room: Room = meetingId
    ? {
        meetingId,
        roomCode:
          meta?.roomCode
          ?? (storedRoom?.meetingId === meetingId ? storedRoom.roomCode : 'MMT-LOCAL'),
        title: meta?.roomName ?? storedRoom?.title ?? 'MEET MEET Room',
        createdAt: meta?.createdAt ?? storedRoom?.createdAt ?? new Date().toISOString(),
        meetingRole:
          meta?.meetingRole
          ?? storedRoom?.meetingRole
          ?? 'host',
        participantIdentity: storedRoom?.participantIdentity,
        hostParticipantIdentity: storedRoom?.hostParticipantIdentity,
        hostControlToken: storedRoom?.hostControlToken,
        expiresAt: storedRoom?.expiresAt,
        maxParticipants: storedRoom?.maxParticipants,
        participants: storedRoom?.participants,
        gameState: storedRoom?.gameState,
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
  const localMediaRef = useRef(localMedia)
  const [gameReadySnapshot, setGameReadySnapshot] =
    useState<GameReadySnapshot | null>(null)
  const gameReadySnapshotRef = useRef<GameReadySnapshot | null>(null)
  const [deviceSelection, setDeviceSelection] = useState<MediaDeviceSelection>({
    videoDeviceId: '',
    audioDeviceId: '',
    speakerDeviceId: '',
  })

  useEffect(() => {
    localMediaRef.current = localMedia
  }, [localMedia])

  useEffect(() => {
    gameReadySnapshotRef.current = gameReadySnapshot
  }, [gameReadySnapshot])

  useEffect(() => {
    const handlePopState = () => {
      const nextPage = getPageFromPath()
      if (import.meta.env.DEV && nextPage !== 'meeting' && localMedia.stream) {
        console.info('[app-camera] route-change preserved', {
          trackId: localMedia.stream.getVideoTracks()[0]?.id,
        })
      }
      setPage(nextPage)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [localMedia.stream])

  const navigate = (nextPage: Page) => {
    if (import.meta.env.DEV && nextPage !== 'meeting' && localMedia.stream) {
      console.info('[app-camera] route-change preserved', {
        trackId: localMedia.stream.getVideoTracks()[0]?.id,
      })
    }
    window.history.pushState({}, '', pagePaths[nextPage])
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const videoTrack = localMedia.stream?.getVideoTracks()[0]

    if (!videoTrack) {
      return
    }

    const handleEnded = () => {
      window.setTimeout(() => {
        const latestMedia = localMediaRef.current
        const latestVideoTrack = latestMedia.stream?.getVideoTracks()[0]

        if (latestVideoTrack !== videoTrack || !latestMedia.cameraEnabled) {
          return
        }

        if (import.meta.env.DEV) {
          console.info('[app-camera] track ended unexpectedly', {
            trackId: videoTrack.id,
          })
        }

        const audioTracks = latestMedia.stream?.getAudioTracks() ?? []
        const nextMedia = {
          stream: audioTracks.length > 0 ? new MediaStream(audioTracks) : null,
          cameraEnabled: false,
          microphoneEnabled: latestMedia.microphoneEnabled,
        }

        localMediaRef.current = nextMedia
        gameReadySnapshotRef.current = null
        setGameReadySnapshot(null)
        setLocalMedia(nextMedia)
      }, 0)
    }

    videoTrack.addEventListener('ended', handleEnded)

    return () => {
      videoTrack.removeEventListener('ended', handleEnded)
    }
  }, [localMedia.stream])

  const enterMeetingRoom = (room: Room, nextPreferences: MeetingPreferences) => {
    const now = new Date().toISOString()
    const meetingMeta = {
      meetingId: room.meetingId,
      roomCode: room.roomCode,
      roomName: room.title,
      meetingRole: room.meetingRole,
      participantCount: nextPreferences.participantCount,
      createdAt: room.createdAt,
      updatedAt: now,
      preferences: nextPreferences,
    }
    setPreferences(nextPreferences)
    setRoomName(room.title)
    saveActiveMeetingId(room.meetingId)
    saveMeetingMeta(meetingMeta)
    navigate('meeting')
  }

  const createRoomFromLanding = async (
    nextPreferences: MeetingPreferences,
    nextRoomName: string,
  ): Promise<string | null> => {
    try {
      const room = await createServerRoom({
        participantName: nextPreferences.displayName,
        language: nextPreferences.sourceLanguage,
        title: nextRoomName,
        participantCount: nextPreferences.participantCount,
      })
      setCurrentRoom(room)
      setMeetingCreatedAt(room.createdAt)
      enterMeetingRoom(room, nextPreferences)
      return null
    } catch (error) {
      return error instanceof Error ? error.message : '방을 생성하지 못했습니다.'
    }
  }

  const joinWithCode = async (
    code: string,
    nextPreferences: MeetingPreferences,
  ): Promise<string | null> => {
    const normalizedCode = normalizeRoomCode(code)

    if (!normalizedCode) {
      return '올바른 방 코드 형식이 아닙니다.'
    }

    try {
      const room = await joinServerRoomByCode({
        roomCode: normalizedCode,
        participantName: nextPreferences.displayName,
        language: nextPreferences.sourceLanguage,
      })
      setCurrentRoom(room)
      setMeetingCreatedAt(room.createdAt)
      enterMeetingRoom(room, nextPreferences)
      return null
    } catch (error) {
      return error instanceof Error ? error.message : '방에 입장하지 못했습니다.'
    }
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
        const nextTracks = new Set(nextMedia.stream?.getTracks() ?? [])
        current.stream.getTracks().forEach((track) => {
          if (!nextTracks.has(track)) {
            if (import.meta.env.DEV) {
              console.info('[app-camera] explicitly stopped by app media update', {
                kind: track.kind,
                trackId: track.id,
              })
            }
            if (
              track.kind === 'video'
              && gameReadySnapshotRef.current?.verifiedTrackId === track.id
            ) {
              if (import.meta.env.DEV) {
                console.info('[game-ready] snapshot invalidated', {
                  reason: 'video-track-replaced',
                  verifiedTrackId: track.id,
                })
              }
              gameReadySnapshotRef.current = null
              setGameReadySnapshot(null)
            }
            track.stop()
          }
        })
      }

      if (
        import.meta.env.DEV
        && nextMedia.stream
        && current.stream === nextMedia.stream
      ) {
        console.info('[app-camera] session reused', {
          trackId: nextMedia.stream.getVideoTracks()[0]?.id,
        })
      }

      localMediaRef.current = nextMedia
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
    saveMeetingMeta({
      meetingId,
      roomCode,
      roomName,
      meetingRole: currentRoom.meetingRole,
      participantCount: participants.length || preferences.participantCount,
      createdAt: meetingCreatedAt,
      updatedAt: new Date().toISOString(),
      preferences,
    })
    clearActiveMeetingId()
    clearCurrentRoom()
    navigate('landing')
  }

  return (
    <div className="app-shell">
      <main>
        {page === 'landing' && (
          <LandingPage
            localMedia={localMedia}
            deviceSelection={deviceSelection}
            initialPreferences={preferences}
            onLocalMediaChange={updateLocalMedia}
            gameReadySnapshot={gameReadySnapshot}
            onGameReadySnapshotChange={setGameReadySnapshot}
            onDeviceSelectionChange={setDeviceSelection}
            onCreateRoom={createRoomFromLanding}
            onJoinRoom={joinWithCode}
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
            initialLives={preferences.initialLives ?? 3}
            targetLanguage={preferences.targetLanguage}
            autoStartCaption={preferences.autoStartCaption}
            deviceSelection={deviceSelection}
            initialHostParticipantIdentity={currentRoom.hostParticipantIdentity}
            initialGameState={currentRoom.gameState}
            hostControlToken={currentRoom.hostControlToken}
            onLocalMediaChange={updateLocalMedia}
            onDeviceSelectionChange={setDeviceSelection}
            onPreferencesChange={updateMeetingPreferences}
            onReconnectMedia={() => navigate('landing')}
            onReturnHome={() => navigate('landing')}
            onLeave={endMeeting}
          />
        )}
      </main>
    </div>
  )
}

export default App
