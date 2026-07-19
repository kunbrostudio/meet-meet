export type MediaTrackKind = 'audio' | 'video'

export type MediaStreamRequest = {
  videoDeviceId?: string
  audioDeviceId?: string
}

export async function getMediaDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return []
  }

  return navigator.mediaDevices.enumerateDevices()
}

export async function getVideoInputDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await getMediaDevices()
  return devices.filter((device) => device.kind === 'videoinput')
}

export async function getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await getMediaDevices()
  return devices.filter((device) => device.kind === 'audioinput')
}

export async function getAudioOutputDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await getMediaDevices()
  return devices.filter((device) => device.kind === 'audiooutput')
}

export async function requestMediaStream({
  videoDeviceId,
  audioDeviceId,
}: MediaStreamRequest = {}): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Media devices are not supported in this browser.')
  }

  const videoConstraints: MediaTrackConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
    ...(videoDeviceId ? { deviceId: { exact: videoDeviceId } } : {}),
  }

  return navigator.mediaDevices.getUserMedia({
    video: videoConstraints,
    audio: audioDeviceId
      ? { deviceId: { exact: audioDeviceId } }
      : true,
  })
}

export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop())
}

export function toggleTrack(
  stream: MediaStream,
  kind: MediaTrackKind,
  enabled?: boolean,
): boolean {
  const tracks = kind === 'video'
    ? stream.getVideoTracks()
    : stream.getAudioTracks()
  const nextEnabled = enabled ?? !tracks.some((track) => track.enabled)

  tracks.forEach((track) => {
    track.enabled = nextEnabled
  })

  return nextEnabled
}
