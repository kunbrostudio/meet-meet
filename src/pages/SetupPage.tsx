import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/common/Icon'
import {
  getAudioInputDevices,
  getVideoInputDevices,
  requestMediaStream,
  toggleTrack,
} from '../services/deviceService'
import {
  copyToClipboard,
  createInviteLink,
} from '../services/roomService'
import type {
  LocalMediaState,
  MediaDeviceSelection,
  MeetingPreferences,
} from '../types/meeting'
import type { LanguageCode } from '../types/transcript'

type SetupPageProps = {
  roomCode: string
  initialPreferences: MeetingPreferences
  localMedia: LocalMediaState
  deviceSelection: MediaDeviceSelection
  canSetParticipantCount: boolean
  onLocalMediaChange: (media: LocalMediaState) => void
  onDeviceSelectionChange: (selection: MediaDeviceSelection) => void
  onBack: () => void
  onJoin: (preferences: MeetingPreferences) => void
}

export function SetupPage({
  roomCode,
  initialPreferences,
  localMedia,
  deviceSelection,
  canSetParticipantCount,
  onLocalMediaChange,
  onDeviceSelectionChange,
  onBack,
  onJoin,
}: SetupPageProps) {
  const [micOn, setMicOn] = useState(localMedia.microphoneEnabled)
  const [cameraOn, setCameraOn] = useState(localMedia.cameraEnabled)
  const [name, setName] = useState(initialPreferences.displayName)
  const [sourceLanguage, setSourceLanguage] = useState(initialPreferences.sourceLanguage)
  const [targetLanguage, setTargetLanguage] = useState(initialPreferences.targetLanguage)
  const [participantCount, setParticipantCount] = useState(
    initialPreferences.participantCount ?? 4,
  )
  const [autoStartCaption, setAutoStartCaption] = useState(
    initialPreferences.autoStartCaption ?? true,
  )
  const [mediaError, setMediaError] = useState('')
  const [isCheckingMedia, setIsCheckingMedia] = useState(false)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [copyMessage, setCopyMessage] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const isMountedRef = useRef(true)
  const copyMessageTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = localMedia.stream
    }
  }, [localMedia.stream])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      if (copyMessageTimerRef.current !== null) {
        window.clearTimeout(copyMessageTimerRef.current)
      }
    }
  }, [])

  const copyRoomInformation = async (
    text: string,
    successMessage = '복사되었습니다.',
  ) => {
    const copied = await copyToClipboard(text)
    setCopyMessage(
      copied
        ? successMessage
        : '복사에 실패했습니다.',
    )

    if (copyMessageTimerRef.current !== null) {
      window.clearTimeout(copyMessageTimerRef.current)
    }
    copyMessageTimerRef.current = window.setTimeout(() => {
      setCopyMessage('')
    }, 1800)
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'KC'

  const startMeeting = () => {
    onJoin({
      displayName: name.trim() || 'Ken Choi',
      sourceLanguage,
      targetLanguage,
      participantCount,
      autoStartCaption,
    })
  }

  const connectMediaDevices = async (
    selection: MediaDeviceSelection,
  ) => {
    setIsCheckingMedia(true)
    setMediaError('')

    try {
      const stream = await requestMediaStream({
        videoDeviceId: selection.videoDeviceId || undefined,
        audioDeviceId: selection.audioDeviceId || undefined,
      })

      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const [nextVideoDevices, nextAudioDevices] = await Promise.all([
        getVideoInputDevices(),
        getAudioInputDevices(),
      ])
      const activeVideoDeviceId =
        stream.getVideoTracks()[0]?.getSettings().deviceId
      const activeAudioDeviceId =
        stream.getAudioTracks()[0]?.getSettings().deviceId
      const nextSelection = {
        videoDeviceId:
          selection.videoDeviceId
          || activeVideoDeviceId
          || nextVideoDevices[0]?.deviceId
          || '',
        audioDeviceId:
          selection.audioDeviceId
          || activeAudioDeviceId
          || nextAudioDevices[0]?.deviceId
          || '',
      }

      setVideoDevices(nextVideoDevices)
      setAudioDevices(nextAudioDevices)
      onDeviceSelectionChange(nextSelection)
      toggleTrack(stream, 'video', cameraOn)
      toggleTrack(stream, 'audio', micOn)
      onLocalMediaChange({
        stream,
        cameraEnabled: cameraOn,
        microphoneEnabled: micOn,
      })
    } catch (error) {
      if (isMountedRef.current) {
        const [nextVideoDevices, nextAudioDevices] = await Promise.all([
          getVideoInputDevices(),
          getAudioInputDevices(),
        ])
        setVideoDevices(nextVideoDevices)
        setAudioDevices(nextAudioDevices)
        setMediaError(
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? '카메라/마이크 권한이 차단되었습니다. 브라우저 주소창의 권한 설정을 확인해주세요.'
            : '카메라 또는 마이크를 연결하지 못했습니다. 장치 연결 상태와 브라우저 권한을 확인해주세요.',
        )
      }
    } finally {
      if (isMountedRef.current) {
        setIsCheckingMedia(false)
      }
    }
  }

  const checkCameraAndMicrophone = () => {
    void connectMediaDevices(deviceSelection)
  }

  const changeVideoDevice = (videoDeviceId: string) => {
    const nextSelection = {
      ...deviceSelection,
      videoDeviceId,
    }
    onDeviceSelectionChange(nextSelection)
    void connectMediaDevices(nextSelection)
  }

  const changeAudioDevice = (audioDeviceId: string) => {
    const nextSelection = {
      ...deviceSelection,
      audioDeviceId,
    }
    onDeviceSelectionChange(nextSelection)
    void connectMediaDevices(nextSelection)
  }

  const toggleMicrophone = () => {
    const nextEnabled = localMedia.stream
      ? toggleTrack(localMedia.stream, 'audio')
      : !micOn
    setMicOn(nextEnabled)
    onLocalMediaChange({
      ...localMedia,
      microphoneEnabled: nextEnabled,
    })
  }

  const toggleCamera = () => {
    const nextEnabled = localMedia.stream
      ? toggleTrack(localMedia.stream, 'video')
      : !cameraOn
    setCameraOn(nextEnabled)
    onLocalMediaChange({
      ...localMedia,
      cameraEnabled: nextEnabled,
    })
  }

  const deviceSelectors = (
    <div className="setup-device-selectors">
      <div className="field">
        <label htmlFor="camera-device">카메라 선택</label>
        <div className="select-wrap">
          <select
            id="camera-device"
            value={deviceSelection.videoDeviceId}
            onChange={(event) => changeVideoDevice(event.target.value)}
            disabled={isCheckingMedia || videoDevices.length === 0}
          >
            {videoDevices.length === 0 ? (
              <option value="">사용 가능한 카메라가 없습니다.</option>
            ) : videoDevices.map((device, index) => (
              <option value={device.deviceId} key={device.deviceId}>
                {device.label || `카메라 ${index + 1}`}
              </option>
            ))}
          </select>
          <Icon name="chevron-down" size={16} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="microphone-device">마이크 선택</label>
        <div className="select-wrap">
          <select
            id="microphone-device"
            value={deviceSelection.audioDeviceId}
            onChange={(event) => changeAudioDevice(event.target.value)}
            disabled={isCheckingMedia || audioDevices.length === 0}
          >
            {audioDevices.length === 0 ? (
              <option value="">사용 가능한 마이크가 없습니다.</option>
            ) : audioDevices.map((device, index) => (
              <option value={device.deviceId} key={device.deviceId}>
                {device.label || `마이크 ${index + 1}`}
              </option>
            ))}
          </select>
          <Icon name="chevron-down" size={16} />
        </div>
      </div>
    </div>
  )

  return (
    <section className="setup-page">
      <div className="container">
        <div className="setup-heading">
          <h1>미팅 준비가 거의 끝났어요</h1>
          <p>카메라와 마이크를 확인하고, 사용할 언어를 선택해 주세요.</p>
          <div className="setup-room-share">
            <div className="setup-room-identity">
              <span>ROOM CODE</span>
              <strong>{roomCode}</strong>
            </div>
            <div className="setup-room-actions">
              <button type="button" onClick={() => copyRoomInformation(roomCode)}>
                <Icon name="copy" size={14} /> 방 코드 복사
              </button>
              <button
                type="button"
                onClick={() => copyRoomInformation(
                  createInviteLink(roomCode),
                  '초대 링크가 복사되었습니다.',
                )}
              >
                <Icon name="link" size={14} /> 초대 링크 복사
              </button>
            </div>
            {copyMessage && (
              <span
                className={`room-copy-feedback ${copyMessage.includes('실패') ? 'is-error' : ''}`}
                role="status"
                aria-live="polite"
              >
                {copyMessage}
              </span>
            )}
          </div>
        </div>
        <div className="setup-card">
          <div className="setup-preview-column">
            <div className="camera-preview">
              {localMedia.stream && (
                <video
                  ref={videoRef}
                  className={`camera-video ${cameraOn ? '' : 'is-hidden'}`}
                  autoPlay
                  muted
                  playsInline
                />
              )}
              {!localMedia.stream && cameraOn ? (
                <div className="camera-avatar">{initials}</div>
              ) : !cameraOn ? (
                <Icon name="video-off" size={48} />
              ) : null}
              <span className="camera-label">{name || '이름 없음'}</span>
              <div className="preview-controls">
                <button className={`round-control ${!micOn ? 'is-off' : ''}`} type="button" onClick={toggleMicrophone} aria-label="마이크 전환">
                  <Icon name={micOn ? 'mic' : 'mic-off'} size={18} />
                </button>
                <button className={`round-control ${!cameraOn ? 'is-off' : ''}`} type="button" onClick={toggleCamera} aria-label="카메라 전환">
                  <Icon name={cameraOn ? 'video' : 'video-off'} size={18} />
                </button>
              </div>
            </div>
            {deviceSelectors}
          </div>

          <div className="setup-options">
            <h2>내 미팅 설정</h2>
            <p>입장 후에도 언제든 변경할 수 있어요.</p>
            <div className="field">
              <label htmlFor="display-name">표시 이름</label>
              <input className="input" id="display-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="language">내가 말할 언어</label>
              <div className="select-wrap">
                <select id="language" value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value as LanguageCode)}>
                  <option value="ko">한국어 (Korean)</option>
                  <option value="en">English</option>
                  <option value="ja">日本語 (Japanese)</option>
                  <option value="fr">Français (French)</option>
                  <option value="zh">中文 (Chinese)</option>
                </select>
                <Icon name="chevron-down" size={16} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="translate-language">번역해서 볼 언어</label>
              <div className="select-wrap">
                <select id="translate-language" value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value as LanguageCode)}>
                  <option value="ko">한국어 (Korean)</option>
                  <option value="en">English</option>
                  <option value="ja">日本語 (Japanese)</option>
                  <option value="zh">中文 (Chinese)</option>
                </select>
                <Icon name="chevron-down" size={16} />
              </div>
            </div>
            {canSetParticipantCount && (
              <div className="field">
                <label htmlFor="participant-count">참가자 수</label>
                <div className="select-wrap">
                  <select
                    id="participant-count"
                    value={participantCount}
                    onChange={(event) => {
                      const nextParticipantCount = Number(event.target.value)
                      setParticipantCount(nextParticipantCount)
                    }}
                  >
                    {[1, 2, 3, 4, 6, 8].map((count) => (
                      <option value={count} key={count}>{count}명</option>
                    ))}
                  </select>
                  <Icon name="chevron-down" size={16} />
                </div>
              </div>
            )}
            <label className="caption-auto-start-option">
              <input
                type="checkbox"
                checked={autoStartCaption}
                onChange={(event) => setAutoStartCaption(event.target.checked)}
              />
              <span className="caption-auto-start-check">
                <Icon name="check" size={13} />
              </span>
              <span>입장 후 실시간 자막 자동 시작</span>
            </label>
            <button
              className="button button-secondary button-wide device-check-button"
              type="button"
              onClick={checkCameraAndMicrophone}
              disabled={isCheckingMedia}
            >
              <Icon name="camera" size={16} />
              {isCheckingMedia ? '권한 확인 중...' : '카메라/마이크 확인'}
            </button>
            {mediaError ? (
              <div className="setup-status setup-status-error">{mediaError}</div>
            ) : localMedia.stream ? (
              <div className="setup-status"><Icon name="check" size={14} /> 카메라와 마이크가 정상적으로 연결되었어요</div>
            ) : null}
            <button className="button button-primary button-wide" type="button" onClick={startMeeting}>
              Start <Icon name="arrow-right" size={16} />
            </button>
            <button className="back-link" type="button" onClick={onBack}><Icon name="arrow-left" size={14} /> 홈으로 돌아가기</button>
          </div>
        </div>
      </div>
    </section>
  )
}
