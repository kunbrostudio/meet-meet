import type { Participant } from '../types/participant'
import type { LanguageCode } from '../types/transcript'

type ParticipantMediaUpdates = Partial<
  Pick<Participant, 'isCameraOn' | 'isMicOn' | 'isSpeaking' | 'mediaStream'>
>

const remoteParticipantTemplates: Array<{
  name: string
  language: LanguageCode
  avatarColor: string
  isMicOn?: boolean
  isSpeaking?: boolean
}> = [
  {
    name: 'Sarah Miller',
    language: 'en',
    avatarColor: 'linear-gradient(145deg, #d98270, #a84b43)',
    isSpeaking: true,
  },
  {
    name: 'Yuki Tanaka',
    language: 'ja',
    avatarColor: 'linear-gradient(145deg, #43b19e, #1c7569)',
  },
  {
    name: 'Lucas Martin',
    language: 'fr',
    avatarColor: 'linear-gradient(145deg, #9d7ae8, #6747b5)',
    isMicOn: false,
  },
]

export function getParticipantInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'SM'
}

export function createLocalParticipant(
  userName: string,
  language: LanguageCode,
  mediaStream: MediaStream | null,
  meetingRole: Participant['meetingRole'] = 'host',
): Participant {
  const name = userName.trim() || 'Ken Choi'

  return {
    id: 1,
    name,
    role: 'local',
    meetingRole,
    language,
    isCameraOn: mediaStream?.getVideoTracks().some((track) => track.enabled) ?? true,
    isMicOn: mediaStream?.getAudioTracks().some((track) => track.enabled) ?? true,
    isSpeaking: false,
    joinedAt: new Date().toISOString(),
    avatarColor: 'linear-gradient(145deg, #4f80f4, #2455c8)',
    avatarLabel: getParticipantInitials(name),
    mediaStream,
  }
}

export function createMockRemoteParticipants(count: number): Participant[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const template =
      remoteParticipantTemplates[index % remoteParticipantTemplates.length]
    const duplicateIndex =
      Math.floor(index / remoteParticipantTemplates.length) + 1
    const name = duplicateIndex > 1
      ? `${template.name} ${duplicateIndex}`
      : template.name

    return {
      id: index + 2,
      name,
      role: 'remote',
      meetingRole: 'participant',
      language: template.language,
      isCameraOn: true,
      isMicOn: template.isMicOn ?? true,
      isSpeaking: template.isSpeaking ?? false,
      joinedAt: new Date().toISOString(),
      avatarColor: template.avatarColor,
      avatarLabel: getParticipantInitials(name),
      mediaStream: null,
    }
  })
}

export function updateParticipantMediaState(
  participantId: number,
  updates: ParticipantMediaUpdates,
): (participants: Participant[]) => Participant[] {
  return (participants) => participants.map((participant) => (
    participant.id === participantId
      ? { ...participant, ...updates }
      : participant
  ))
}
