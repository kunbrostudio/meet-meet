import {
  Track,
  type LocalParticipant as LiveKitLocalParticipant,
  type Participant as LiveKitParticipant,
  type RemoteParticipant as LiveKitRemoteParticipant,
} from 'livekit-client'
import type { Participant } from '../types/participant'
import type { LanguageCode } from '../types/transcript'
import { getParticipantInitials } from './participantService'

type LiveKitParticipantMetadata = {
  name?: unknown
  language?: unknown
  meetingRole?: unknown
}

type ParticipantMappingOptions = {
  defaultLanguage?: LanguageCode
  trackVersion?: number
  localMediaStream?: MediaStream | null
}

const supportedLanguages = new Set<LanguageCode>([
  'ko',
  'en',
  'ja',
  'zh',
  'fr',
])

function parseMetadata(metadata?: string): LiveKitParticipantMetadata {
  if (!metadata) {
    return {}
  }

  try {
    const parsed = JSON.parse(metadata) as unknown
    return typeof parsed === 'object' && parsed !== null
      ? parsed as LiveKitParticipantMetadata
      : {}
  } catch {
    return {}
  }
}

function getStableParticipantId(identity: string): number {
  let hash = 0

  for (let index = 0; index < identity.length; index += 1) {
    hash = Math.imul(31, hash) + identity.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash) || 1
}

function getLanguage(
  metadata: LiveKitParticipantMetadata,
  fallback: LanguageCode,
): LanguageCode {
  return typeof metadata.language === 'string'
    && supportedLanguages.has(metadata.language as LanguageCode)
    ? metadata.language as LanguageCode
    : fallback
}

function getMeetingRole(
  metadata: LiveKitParticipantMetadata,
  fallback: Participant['meetingRole'],
): Participant['meetingRole'] {
  return metadata.meetingRole === 'host'
    || metadata.meetingRole === 'participant'
    ? metadata.meetingRole
    : fallback
}

function hasActiveTrack(
  participant: LiveKitParticipant,
  source: Track.Source.Camera | Track.Source.Microphone,
): boolean {
  const publication = participant.getTrackPublication(source)
  return Boolean(
    publication
    && !publication.isMuted
    && (publication.track?.mediaStreamTrack.enabled ?? true),
  )
}

function getPublicationTrackSid(
  participant: LiveKitParticipant,
  source: Track.Source.Camera | Track.Source.Microphone,
): string | null {
  const publication = participant.getTrackPublication(source)
  return publication?.trackSid ?? publication?.track?.sid ?? null
}

function getPublicationTrackId(
  participant: LiveKitParticipant,
  source: Track.Source.Camera | Track.Source.Microphone,
): string | null {
  return participant.getTrackPublication(source)
    ?.track
    ?.mediaStreamTrack
    ?.id ?? null
}

const participantVideoStreamCache = new Map<
  string,
  { trackId: string, stream: MediaStream }
>()

function createParticipantMediaStream(
  participant: LiveKitParticipant,
  fallbackStream?: MediaStream | null,
): MediaStream | null {
  const publication = participant.getTrackPublication(Track.Source.Camera)
  const mediaTrack = publication?.track?.mediaStreamTrack

  if (!mediaTrack || mediaTrack.readyState !== 'live') {
    const fallbackVideoTrack = fallbackStream?.getVideoTracks().find(
      (track) => track.readyState === 'live',
    )

    if (fallbackVideoTrack) {
      const cached = participantVideoStreamCache.get(participant.identity)

      if (cached?.trackId === fallbackVideoTrack.id) {
        return cached.stream
      }

      const stream = new MediaStream([fallbackVideoTrack])
      participantVideoStreamCache.set(participant.identity, {
        trackId: fallbackVideoTrack.id,
        stream,
      })

      return stream
    }

    participantVideoStreamCache.delete(participant.identity)
    return null
  }

  const cached = participantVideoStreamCache.get(participant.identity)

  if (cached?.trackId === mediaTrack.id) {
    return cached.stream
  }

  const stream = new MediaStream([mediaTrack])
  participantVideoStreamCache.set(participant.identity, {
    trackId: mediaTrack.id,
    stream,
  })

  return stream
}

function getAvatarColor(identity: string, role: Participant['role']): string {
  const hue = getStableParticipantId(identity) % 360
  const saturation = role === 'local' ? 76 : 58
  return `linear-gradient(145deg, hsl(${hue} ${saturation}% 62%), hsl(${hue} ${saturation}% 42%))`
}

function mapLiveKitParticipant(
  participant: LiveKitParticipant,
  role: Participant['role'],
  fallbackMeetingRole: Participant['meetingRole'],
  options: ParticipantMappingOptions = {},
): Participant {
  const metadata = parseMetadata(participant.metadata)
  const fallbackName = participant.name?.trim() || participant.identity
  const name = typeof metadata.name === 'string' && metadata.name.trim()
    ? metadata.name.trim()
    : fallbackName
  const defaultLanguage = options.defaultLanguage ?? 'ko'

  return {
    id: getStableParticipantId(participant.identity),
    name,
    displayName: name,
    role,
    meetingRole: getMeetingRole(metadata, fallbackMeetingRole),
    language: getLanguage(metadata, defaultLanguage),
    isCameraOn: hasActiveTrack(participant, Track.Source.Camera),
    isMicOn: hasActiveTrack(participant, Track.Source.Microphone),
    isSpeaking: participant.isSpeaking,
    joinedAt: participant.joinedAt?.toISOString() ?? new Date().toISOString(),
    avatarColor: getAvatarColor(participant.identity, role),
    avatarLabel: getParticipantInitials(name),
    mediaStream: createParticipantMediaStream(
      participant,
      role === 'local' ? options.localMediaStream : null,
    ),
    liveKitIdentity: participant.identity,
    cameraTrackSid: getPublicationTrackSid(participant, Track.Source.Camera),
    cameraTrackId: getPublicationTrackId(participant, Track.Source.Camera),
    microphoneTrackSid: getPublicationTrackSid(participant, Track.Source.Microphone),
    microphoneTrackId: getPublicationTrackId(participant, Track.Source.Microphone),
    liveKitTrackVersion: options.trackVersion,
  }
}

export function mapLiveKitLocalParticipantToParticipant(
  participant: LiveKitLocalParticipant,
  options: ParticipantMappingOptions = {},
): Participant {
  return mapLiveKitParticipant(participant, 'local', 'host', options)
}

export function mapLiveKitRemoteParticipantToParticipant(
  participant: LiveKitRemoteParticipant,
  options: ParticipantMappingOptions = {},
): Participant {
  return mapLiveKitParticipant(participant, 'remote', 'participant', options)
}

export function mapLiveKitParticipantsToParticipants(
  localParticipant: LiveKitLocalParticipant,
  remoteParticipants: Iterable<LiveKitRemoteParticipant>,
  options: ParticipantMappingOptions = {},
): Participant[] {
  return [
    mapLiveKitLocalParticipantToParticipant(localParticipant, options),
    ...Array.from(remoteParticipants, (participant) => (
      mapLiveKitRemoteParticipantToParticipant(participant, options)
    )),
  ]
}
