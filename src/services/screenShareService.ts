export function isScreenShareSupported(): boolean {
  return Boolean(navigator.mediaDevices?.getDisplayMedia)
}

export async function startScreenShare(): Promise<MediaStream> {
  if (!isScreenShareSupported()) {
    throw new Error('SCREEN_SHARE_UNSUPPORTED')
  }

  return navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
  })
}

export function stopScreenShare(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop())
}
