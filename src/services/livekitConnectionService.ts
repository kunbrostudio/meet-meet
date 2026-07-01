export type LiveKitMeetingRole = 'host' | 'participant'

export type LiveKitTokenRequest = {
  roomName: string
  participantName: string
  participantIdentity: string
  language?: string
  meetingRole?: LiveKitMeetingRole
}

export type LiveKitConnectionDetails = {
  url: string
  token: string
  roomName: string
  participantIdentity: string
}

export type LiveKitRemoveParticipantRequest = {
  roomName: string
  targetParticipantIdentity: string
  requesterParticipantIdentity: string
  requesterMeetingRole: LiveKitMeetingRole
}

export type LiveKitRemoveParticipantResponse = {
  ok: true
  alreadyRemoved?: boolean
  message?: string
  roomName: string
  removedParticipantIdentity: string
}

export type LiveKitMediaController = {
  setCameraEnabled: (enabled: boolean) => Promise<void>
  setMicrophoneEnabled: (enabled: boolean) => Promise<void>
  setScreenShareEnabled: (enabled: boolean) => Promise<void>
  disconnect: () => void
}

export type LiveKitScreenShare = {
  participantId: number
  participantName: string
  isLocal: boolean
  stream: MediaStream
}

export type LiveKitDataController = {
  publishChatMessage: (
    message: import('./livekitChatService').LiveKitDataMessage,
  ) => Promise<void>
  publishTranscriptMessage: (
    message: import('./livekitChatService').LiveKitDataMessage,
  ) => Promise<void>
  publishMeetingControlMessage: (
    message: import('./livekitChatService').LiveKitDataMessage,
  ) => Promise<void>
}

type LiveKitErrorResponse = {
  ok?: false
  error?: string
  message?: string
  reason?: string
  code?: string
  status?: number
}

export async function requestLiveKitToken(
  request: LiveKitTokenRequest,
): Promise<LiveKitConnectionDetails> {
  const response = await fetch('/api/livekit/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const details = await response.json().catch(
      () => ({} as LiveKitErrorResponse),
    ) as LiveKitErrorResponse
    throw new Error(
      details.message
      ?? details.reason
      ?? details.error
      ?? `LiveKit token request failed with status ${response.status}.`,
    )
  }

  const details = await response.json() as Partial<LiveKitConnectionDetails>

  if (
    !details.url
    || !details.token
    || !details.roomName
    || !details.participantIdentity
  ) {
    throw new Error('LiveKit token response is incomplete.')
  }

  return details as LiveKitConnectionDetails
}

export async function removeLiveKitParticipant(
  request: LiveKitRemoveParticipantRequest,
): Promise<LiveKitRemoveParticipantResponse> {
  const response = await fetch('/api/livekit/remove-participant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const details = await response.json().catch(
      () => ({} as LiveKitErrorResponse),
    ) as LiveKitErrorResponse
    const message =
      details.message
      ?? details.reason
      ?? details.error
      ?? `LiveKit remove participant request failed with status ${response.status}.`

    console.error('[livekit-remove] request failed', {
      status: response.status,
      ...details,
    })
    throw new Error(
      message,
    )
  }

  const details =
    await response.json() as Partial<LiveKitRemoveParticipantResponse>

  if (!details.ok || !details.roomName || !details.removedParticipantIdentity) {
    throw new Error('LiveKit remove participant response is incomplete.')
  }

  return details as LiveKitRemoveParticipantResponse
}
