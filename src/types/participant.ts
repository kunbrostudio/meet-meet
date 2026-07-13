import type { LanguageCode } from './transcript'

export type Participant = {
  id: number
  name: string
  displayName?: string
  role: 'local' | 'remote'
  meetingRole: 'host' | 'participant'
  language: LanguageCode
  isCameraOn: boolean
  isMicOn: boolean
  isSpeaking: boolean
  joinedAt: string
  avatarColor: string
  avatarLabel: string
  mediaStream?: MediaStream | null
  liveKitIdentity?: string
  cameraTrackSid?: string | null
  cameraTrackId?: string | null
  microphoneTrackSid?: string | null
  microphoneTrackId?: string | null
  liveKitTrackVersion?: number
}
