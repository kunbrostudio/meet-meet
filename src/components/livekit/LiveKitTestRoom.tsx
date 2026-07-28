import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
  useParticipants,
  useRoomContext,
} from '@livekit/components-react'
import '@livekit/components-styles'
import {
  RoomEvent,
  Track,
  VideoPresets,
  type RemoteParticipant,
  type Room,
} from 'livekit-client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  LiveKitConnectionDetails,
  LiveKitDataController,
  LiveKitMediaController,
  LiveKitScreenShare,
} from '../../services/livekitConnectionService'
import {
  decodeLiveKitDataMessage,
  encodeLiveKitDataMessage,
  LIVEKIT_CHAT_TOPIC,
  LIVEKIT_GAME_STATE_TOPIC,
  LIVEKIT_MEETING_CONTROL_TOPIC,
  LIVEKIT_TRANSCRIPT_TOPIC,
  LIVEKIT_TRANSLATION_TOPIC,
  type LiveKitDataMessage,
} from '../../services/livekitChatService'
import { mapLiveKitParticipantsToParticipants } from '../../services/livekitParticipantAdapter'
import type { Participant } from '../../types'

type LiveKitTestRoomProps = {
  connection: LiveKitConnectionDetails
  localMediaStream: MediaStream | null
  isOverlayOpen: boolean
  onConnectedChange: (connected: boolean) => void
  onParticipantsChange: (participants: Participant[]) => void
  onMediaControllerChange: (
    controller: LiveKitMediaController | null,
  ) => void
  onScreenShareChange: (screenShare: LiveKitScreenShare | null) => void
  onDataControllerChange: (
    controller: LiveKitDataController | null,
  ) => void
  onDataMessage: (message: LiveKitDataMessage) => void
  onConnectionError: (message: string) => void
  onRemovedFromMeeting: () => void
  onHide: () => void
  onDisconnect: () => void
}

export function LiveKitTestRoom({
  connection,
  localMediaStream,
  isOverlayOpen,
  onConnectedChange,
  onParticipantsChange,
  onMediaControllerChange,
  onScreenShareChange,
  onDataControllerChange,
  onDataMessage,
  onConnectionError,
  onRemovedFromMeeting,
  onHide,
  onDisconnect,
}: LiveKitTestRoomProps) {
  const onConnectedChangeRef = useLatestRef(onConnectedChange)
  const onParticipantsChangeRef = useLatestRef(onParticipantsChange)
  const onMediaControllerChangeRef = useLatestRef(onMediaControllerChange)
  const onScreenShareChangeRef = useLatestRef(onScreenShareChange)
  const onDataControllerChangeRef = useLatestRef(onDataControllerChange)
  const onDataMessageRef = useLatestRef(onDataMessage)
  const onConnectionErrorRef = useLatestRef(onConnectionError)
  const onRemovedFromMeetingRef = useLatestRef(onRemovedFromMeeting)
  const onHideRef = useLatestRef(onHide)
  const onDisconnectRef = useLatestRef(onDisconnect)

  const handleConnected = useCallback(() => {
    onConnectedChangeRef.current(true)
    onHideRef.current()
  }, [onConnectedChangeRef, onHideRef])

  const handleDisconnected = useCallback((reason?: unknown) => {
    if (isParticipantRemovedReason(reason)) {
      onRemovedFromMeetingRef.current()
      return
    }

    onConnectedChangeRef.current(false)
    onParticipantsChangeRef.current([])
    onMediaControllerChangeRef.current(null)
    onScreenShareChangeRef.current(null)
    onDataControllerChangeRef.current(null)

    onDisconnectRef.current()
  }, [
    onConnectedChangeRef,
    onDataControllerChangeRef,
    onDisconnectRef,
    onMediaControllerChangeRef,
    onParticipantsChangeRef,
    onRemovedFromMeetingRef,
    onScreenShareChangeRef,
  ])

  const handleError = useCallback((error: Error) => {
    onConnectedChangeRef.current(false)
    onConnectionErrorRef.current(error.message)
  }, [onConnectedChangeRef, onConnectionErrorRef])

  const handleMediaControllerChange = useCallback((
    controller: LiveKitMediaController | null,
  ) => {
    onMediaControllerChangeRef.current(controller)
  }, [onMediaControllerChangeRef])

  const handleDataControllerChange = useCallback((
    controller: LiveKitDataController | null,
  ) => {
    onDataControllerChangeRef.current(controller)
  }, [onDataControllerChangeRef])

  const handleDataMessage = useCallback((message: LiveKitDataMessage) => {
    onDataMessageRef.current(message)
  }, [onDataMessageRef])

  const handleParticipantsChange = useCallback((items: Participant[]) => {
    onParticipantsChangeRef.current(items)
  }, [onParticipantsChangeRef])

  const handleScreenShareChange = useCallback((
    screenShare: LiveKitScreenShare | null,
  ) => {
    onScreenShareChangeRef.current(screenShare)
  }, [onScreenShareChangeRef])

  return (
    <div
      className={[
        'livekit-test-backdrop',
        isOverlayOpen ? 'is-open' : 'is-minimized',
      ].join(' ')}
      aria-hidden={!isOverlayOpen}
    >
      <section className="livekit-test-shell" aria-label="방 연결">
        {isOverlayOpen && (
          <header className="livekit-test-header">
            <div>
              <span>ROOM CONNECTION</span>
              <h2>방 연결</h2>
              <p>{connection.roomName}</p>
            </div>
            <div className="livekit-test-header-actions">
              <button type="button" onClick={onHide}>닫기</button>
              <button type="button" onClick={onDisconnect}>연결 끊기</button>
            </div>
          </header>
        )}

        <div className="livekit-test-room" data-lk-theme="default">
          <LiveKitRoom
            serverUrl={connection.url}
            token={connection.token}
            connect
            audio={false}
            video={false}
            onConnected={handleConnected}
            onDisconnected={handleDisconnected}
            onError={handleError}
          >
            <LiveKitMediaControllerBridge
              onChange={handleMediaControllerChange}
            />
            <LiveKitDataBridge
              onControllerChange={handleDataControllerChange}
              onMessage={handleDataMessage}
            />
            <LiveKitLocalMediaPublisher stream={localMediaStream} />
            <LiveKitParticipantObserver onChange={handleParticipantsChange} />
            <LiveKitScreenShareObserver onChange={handleScreenShareChange} />
            {isOverlayOpen && <VideoConference />}
            <RoomAudioRenderer />
          </LiveKitRoom>
        </div>
      </section>
    </div>
  )
}

function useLatestRef<T>(value: T) {
  const ref = useRef(value)

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref
}

function isParticipantRemovedReason(reason: unknown): boolean {
  return String(reason ?? '').toUpperCase().includes('PARTICIPANT_REMOVED')
}

type LocalMediaPublishState = {
  publishingSources: Set<Track.Source>
  publishedTrackIds: Set<string>
}

const localMediaPublishStates = new WeakMap<Room, LocalMediaPublishState>()

function getLocalMediaPublishState(room: Room): LocalMediaPublishState {
  const state = localMediaPublishStates.get(room)

  if (state) {
    return state
  }

  const nextState = {
    publishingSources: new Set<Track.Source>(),
    publishedTrackIds: new Set<string>(),
  }
  localMediaPublishStates.set(room, nextState)

  return nextState
}

function getPublicationTrackId(
  room: Room,
  source: Track.Source.Camera | Track.Source.Microphone,
): string | null {
  return room.localParticipant
    .getTrackPublication(source)
    ?.track
    ?.mediaStreamTrack
    ?.id ?? null
}

function hasPublishedTrackId(room: Room, trackId: string): boolean {
  return Array.from(room.localParticipant.trackPublications.values()).some(
    (publication) => publication.track?.mediaStreamTrack?.id === trackId,
  )
}

function isLocalSourceEnabled(
  room: Room,
  source: Track.Source.Camera | Track.Source.Microphone,
): boolean {
  const publication = room.localParticipant.getTrackPublication(source)
  return Boolean(
    publication
    && !publication.isMuted
    && (publication.track?.mediaStreamTrack.enabled ?? true),
  )
}

function LiveKitDataBridge({
  onControllerChange,
  onMessage,
}: {
  onControllerChange: (controller: LiveKitDataController | null) => void
  onMessage: (message: LiveKitDataMessage) => void
}) {
  const room = useRoomContext()

  useEffect(() => {
    const controller: LiveKitDataController = {
      publishChatMessage: async (message) => {
        await room.localParticipant.publishData(
          encodeLiveKitDataMessage(message),
          {
            reliable: true,
            topic: LIVEKIT_CHAT_TOPIC,
          },
        )
      },
      publishTranscriptMessage: async (message) => {
        await room.localParticipant.publishData(
          encodeLiveKitDataMessage(message),
          {
            reliable: true,
            topic: LIVEKIT_TRANSCRIPT_TOPIC,
          },
        )
      },
      publishTranslationMessage: async (message) => {
        await room.localParticipant.publishData(
          encodeLiveKitDataMessage(message),
          {
            reliable: true,
            topic: LIVEKIT_TRANSLATION_TOPIC,
          },
        )
      },
      publishMeetingControlMessage: async (message) => {
        await room.localParticipant.publishData(
          encodeLiveKitDataMessage(message),
          {
            reliable: true,
            topic: LIVEKIT_MEETING_CONTROL_TOPIC,
          },
        )
      },
      publishGameMessage: async (message) => {
        await room.localParticipant.publishData(
          encodeLiveKitDataMessage(message),
          {
            reliable: true,
            topic: LIVEKIT_GAME_STATE_TOPIC,
          },
        )
      },
    }

    const handleDataReceived = (
      payload: Uint8Array,
      _participant: RemoteParticipant | undefined,
      _kind: unknown,
      topic?: string,
    ) => {
      if (
        topic !== LIVEKIT_CHAT_TOPIC
        && topic !== LIVEKIT_TRANSCRIPT_TOPIC
        && topic !== LIVEKIT_TRANSLATION_TOPIC
        && topic !== LIVEKIT_MEETING_CONTROL_TOPIC
        && topic !== LIVEKIT_GAME_STATE_TOPIC
      ) {
        return
      }

      const message = decodeLiveKitDataMessage(payload)
      const matchesTopic = (
        topic === LIVEKIT_MEETING_CONTROL_TOPIC
          ? message?.type === 'meeting-ended'
            || message?.type === 'participant-kicked'
          : topic === LIVEKIT_TRANSCRIPT_TOPIC
          ? message?.type === 'transcript-created'
          : topic === LIVEKIT_TRANSLATION_TOPIC
          ? message?.type === 'translation'
          : topic === LIVEKIT_GAME_STATE_TOPIC
          ? message?.type === 'game-state-snapshot'
            || message?.type === 'game-state-request'
          : message?.type === 'chat-message'
            || message?.type === 'system-message'
      )

      if (message && matchesTopic) {
        onMessage(message)
      }
    }

    onControllerChange(controller)
    room.on(RoomEvent.DataReceived, handleDataReceived)

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived)
      onControllerChange(null)
    }
  }, [onControllerChange, onMessage, room])

  return null
}

function LiveKitMediaControllerBridge({
  onChange,
}: {
  onChange: (controller: LiveKitMediaController | null) => void
}) {
  const room = useRoomContext()

  useEffect(() => {
    const controller: LiveKitMediaController = {
      setCameraEnabled: async (enabled) => {
        if (isLocalSourceEnabled(room, Track.Source.Camera) === enabled) {
          return
        }

        await room.localParticipant.setCameraEnabled(
          enabled,
          { resolution: VideoPresets.h720.resolution },
          { videoEncoding: VideoPresets.h720.encoding },
        )
      },
      setMicrophoneEnabled: async (enabled) => {
        if (isLocalSourceEnabled(room, Track.Source.Microphone) === enabled) {
          return
        }

        await room.localParticipant.setMicrophoneEnabled(enabled)
      },
      setScreenShareEnabled: async (enabled) => {
        await room.localParticipant.setScreenShareEnabled(enabled)
      },
      disconnect: () => {
        room.disconnect()
      },
    }

    onChange(controller)
    return () => onChange(null)
  }, [onChange, room])

  return null
}

function LiveKitScreenShareObserver({
  onChange,
}: {
  onChange: (screenShare: LiveKitScreenShare | null) => void
}) {
  const room = useRoomContext()

  useEffect(() => {
    const updateScreenShare = () => {
      const participants = [
        room.localParticipant,
        ...room.remoteParticipants.values(),
      ]

      for (const participant of participants) {
        const publication = participant.getTrackPublication(
          Track.Source.ScreenShare,
        )
        const mediaTrack = publication?.track?.mediaStreamTrack

        if (
          !publication
          || publication.isMuted
          || !mediaTrack
          || mediaTrack.readyState !== 'live'
        ) {
          continue
        }

        const mappedParticipants = participant.isLocal
          ? mapLiveKitParticipantsToParticipants(room.localParticipant, [])
          : mapLiveKitParticipantsToParticipants(
              room.localParticipant,
              [participant as RemoteParticipant],
            )
        const mappedParticipant = mappedParticipants.find(
          (item) => item.role === (participant.isLocal ? 'local' : 'remote'),
        )

        if (mappedParticipant) {
          onChange({
            participantId: mappedParticipant.id,
            participantName: mappedParticipant.name,
            isLocal: participant.isLocal,
            stream: new MediaStream([mediaTrack]),
          })
          return
        }
      }

      onChange(null)
    }

    room
      .on(RoomEvent.ParticipantConnected, updateScreenShare)
      .on(RoomEvent.ParticipantDisconnected, updateScreenShare)
      .on(RoomEvent.TrackPublished, updateScreenShare)
      .on(RoomEvent.TrackUnpublished, updateScreenShare)
      .on(RoomEvent.TrackSubscribed, updateScreenShare)
      .on(RoomEvent.TrackUnsubscribed, updateScreenShare)
      .on(RoomEvent.TrackMuted, updateScreenShare)
      .on(RoomEvent.TrackUnmuted, updateScreenShare)
      .on(RoomEvent.LocalTrackPublished, updateScreenShare)
      .on(RoomEvent.LocalTrackUnpublished, updateScreenShare)

    updateScreenShare()

    return () => {
      room
        .off(RoomEvent.ParticipantConnected, updateScreenShare)
        .off(RoomEvent.ParticipantDisconnected, updateScreenShare)
        .off(RoomEvent.TrackPublished, updateScreenShare)
        .off(RoomEvent.TrackUnpublished, updateScreenShare)
        .off(RoomEvent.TrackSubscribed, updateScreenShare)
        .off(RoomEvent.TrackUnsubscribed, updateScreenShare)
        .off(RoomEvent.TrackMuted, updateScreenShare)
        .off(RoomEvent.TrackUnmuted, updateScreenShare)
        .off(RoomEvent.LocalTrackPublished, updateScreenShare)
        .off(RoomEvent.LocalTrackUnpublished, updateScreenShare)
      onChange(null)
    }
  }, [onChange, room])

  return null
}

function LiveKitLocalMediaPublisher({
  stream,
}: {
  stream: MediaStream | null
}) {
  const room = useRoomContext()

  useEffect(() => {
    if (!stream) {
      return
    }

    let cancelled = false
    const publishState = getLocalMediaPublishState(room)

    const publishTracks = async () => {
      const tracks: Array<{
        track: MediaStreamTrack
        source: Track.Source.Camera | Track.Source.Microphone
      }> = [
        ...stream.getVideoTracks().map((track) => ({
          track,
          source: Track.Source.Camera as Track.Source.Camera,
        })),
        ...stream.getAudioTracks().map((track) => ({
          track,
          source: Track.Source.Microphone as Track.Source.Microphone,
        })),
      ]

      for (const { track, source } of tracks) {
        const existingSourceTrackId = getPublicationTrackId(room, source)
        const trackKey = `${source}:${track.id}`

        if (
          cancelled
          || track.readyState !== 'live'
          || publishState.publishingSources.has(source)
          || publishState.publishedTrackIds.has(trackKey)
          || hasPublishedTrackId(room, track.id)
        ) {
          continue
        }

        if (existingSourceTrackId) {
          publishState.publishedTrackIds.add(`${source}:${existingSourceTrackId}`)

          if (existingSourceTrackId === track.id) {
            continue
          }

          continue
        }

        publishState.publishingSources.add(source)

        try {
          await room.localParticipant.publishTrack(track, {
            source,
            ...(source === Track.Source.Camera
              ? {
                  videoEncoding: VideoPresets.h720.encoding,
                  videoSimulcastLayers: [
                    VideoPresets.h180,
                    VideoPresets.h360,
                  ],
                }
              : {}),
          })
          publishState.publishedTrackIds.add(trackKey)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)

          if (message.includes('same ID has already been published')) {
            publishState.publishedTrackIds.add(trackKey)
            continue
          }

          console.warn('[livekit] Failed to publish local media track', {
            source,
            error,
          })
        } finally {
          publishState.publishingSources.delete(source)
        }
      }
    }

    void publishTracks()

    return () => {
      cancelled = true
    }
  }, [room, stream])

  return null
}

function LiveKitParticipantObserver({
  onChange,
}: {
  onChange: (participants: Participant[]) => void
}) {
  const room = useRoomContext()
  const [trackRevision, setTrackRevision] = useState(0)
  const liveKitParticipants = useParticipants({
    updateOnlyOn: [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.ActiveSpeakersChanged,
      RoomEvent.ParticipantMetadataChanged,
      RoomEvent.ParticipantNameChanged,
    ],
  })

  useEffect(() => {
    const refreshParticipants = () => {
      setTrackRevision((revision) => revision + 1)
    }
    const observedEvents = [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.ActiveSpeakersChanged,
      RoomEvent.ParticipantMetadataChanged,
      RoomEvent.ParticipantNameChanged,
    ] as const

    observedEvents.forEach((eventName) => {
      room.on(eventName, refreshParticipants)
    })
    refreshParticipants()

    return () => {
      observedEvents.forEach((eventName) => {
        room.off(eventName, refreshParticipants)
      })
    }
  }, [room])

  const mappedParticipants = useMemo(
    () => mapLiveKitParticipantsToParticipants(
      room.localParticipant,
      liveKitParticipants.filter(
        (participant): participant is RemoteParticipant => !participant.isLocal,
      ),
      { trackVersion: trackRevision },
    ),
    [liveKitParticipants, room.localParticipant, trackRevision],
  )

  useEffect(() => {
    onChange(mappedParticipants)
  }, [mappedParticipants, onChange])

  return null
}
