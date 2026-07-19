import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../components/common/Icon'
import {
  getAudioInputDevices,
  getAudioOutputDevices,
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
  const [participantCount, setParticipantCount] = useState(
    Math.min(4, Math.max(2, initialPreferences.participantCount ?? 2)),
  )
  const [mediaError, setMediaError] = useState('')
  const [isCheckingMedia, setIsCheckingMedia] = useState(false)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [speakerDevices, setSpeakerDevices] = useState<MediaDeviceInfo[]>([])
  const [copyMessage, setCopyMessage] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const isMountedRef = useRef(true)
  const copyMessageTimerRef = useRef<number | null>(null)
  const autoMediaStartedRef = useRef(false)
  const mediaConnectedNoticeTimerRef = useRef<number | null>(null)
  const [showMediaConnectedNotice, setShowMediaConnectedNotice] = useState(false)

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
      if (mediaConnectedNoticeTimerRef.current !== null) {
        window.clearTimeout(mediaConnectedNoticeTimerRef.current)
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
      sourceLanguage: 'ko',
      targetLanguage: 'ko',
      participantCount,
      autoStartCaption: false,
    })
  }

  const connectMediaDevices = useCallback(async (
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

      const [nextVideoDevices, nextAudioDevices, nextSpeakerDevices] = await Promise.all([
        getVideoInputDevices(),
        getAudioInputDevices(),
        getAudioOutputDevices(),
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
        speakerDeviceId:
          selection.speakerDeviceId
          || nextSpeakerDevices[0]?.deviceId
          || '',
      }

      setVideoDevices(nextVideoDevices)
      setAudioDevices(nextAudioDevices)
      setSpeakerDevices(nextSpeakerDevices)
      onDeviceSelectionChange(nextSelection)
      toggleTrack(stream, 'video', cameraOn)
      toggleTrack(stream, 'audio', micOn)
      onLocalMediaChange({
        stream,
        cameraEnabled: cameraOn,
        microphoneEnabled: micOn,
      })
      setShowMediaConnectedNotice(true)
      if (mediaConnectedNoticeTimerRef.current !== null) {
        window.clearTimeout(mediaConnectedNoticeTimerRef.current)
      }
      mediaConnectedNoticeTimerRef.current = window.setTimeout(() => {
        setShowMediaConnectedNotice(false)
        mediaConnectedNoticeTimerRef.current = null
      }, 3200)
    } catch (error) {
      if (isMountedRef.current) {
        const [nextVideoDevices, nextAudioDevices, nextSpeakerDevices] = await Promise.all([
          getVideoInputDevices(),
          getAudioInputDevices(),
          getAudioOutputDevices(),
        ])
        setVideoDevices(nextVideoDevices)
        setAudioDevices(nextAudioDevices)
        setSpeakerDevices(nextSpeakerDevices)
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
  }, [
    cameraOn,
    micOn,
    onDeviceSelectionChange,
    onLocalMediaChange,
  ])

  useEffect(() => {
    if (autoMediaStartedRef.current || localMedia.stream) {
      return
    }

    autoMediaStartedRef.current = true
    void connectMediaDevices(deviceSelection)
  }, [connectMediaDevices, deviceSelection, localMedia.stream])

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

  const changeSpeakerDevice = (speakerDeviceId: string) => {
    onDeviceSelectionChange({
      ...deviceSelection,
      speakerDeviceId,
    })
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
      <div className="field">
        <label htmlFor="speaker-device">스피커 선택</label>
        <div className="select-wrap">
          <select
            id="speaker-device"
            value={deviceSelection.speakerDeviceId ?? ''}
            onChange={(event) => changeSpeakerDevice(event.target.value)}
            disabled={speakerDevices.length === 0}
          >
            {speakerDevices.length === 0 ? (
              <option value="">시스템 기본 스피커</option>
            ) : speakerDevices.map((device, index) => (
              <option value={device.deviceId} key={device.deviceId}>
                {device.label || `스피커 ${index + 1}`}
              </option>
            ))}
          </select>
          <Icon name="chevron-down" size={16} />
        </div>
      </div>
    </div>
  )

  const mediaStatus = (
    <>
      {mediaError ? (
        <div className="setup-status setup-status-error">
          {mediaError}
          <button
            className="setup-retry-button"
            type="button"
            onClick={() => void connectMediaDevices(deviceSelection)}
            disabled={isCheckingMedia}
          >
            {isCheckingMedia ? '권한 요청 중...' : '권한 다시 요청'}
          </button>
        </div>
      ) : isCheckingMedia ? (
        <div className="setup-status">
          <span className="meeting-connection-spinner" /> 카메라와 마이크를 연결하고 있어요
        </div>
      ) : showMediaConnectedNotice ? (
        <div className="setup-status setup-status-success-fade">
          <Icon name="check" size={14} /> 카메라와 마이크가 정상적으로 연결되었어요
        </div>
      ) : null}
    </>
  )

  return (
    <section className="setup-page">
      <div className="container">
        <div className="setup-heading">
          <h1>방 준비가 거의 끝났어요</h1>
          <p>카메라와 마이크를 확인하고 친구들을 초대해 주세요.</p>
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
            {mediaStatus}
          </div>

            <div className="setup-options">
            <h2>방 설정</h2>
            <p>입장 후에도 카메라와 마이크는 언제든 바꿀 수 있어요.</p>
            <div className="field">
              <label htmlFor="display-name">표시 이름</label>
              <input className="input" id="display-name" value={name} onChange={(event) => setName(event.target.value)} />
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
                    {[2, 3, 4].map((count) => (
                      <option value={count} key={count}>{count}명</option>
                    ))}
                  </select>
                  <Icon name="chevron-down" size={16} />
                </div>
              </div>
            )}
            <button className="button button-primary button-wide" type="button" onClick={startMeeting}>
              화상방 입장 <Icon name="arrow-right" size={16} />
            </button>
            <button className="back-link" type="button" onClick={onBack}><Icon name="arrow-left" size={14} /> 홈으로 돌아가기</button>
          </div>
        </div>
      </div>
    </section>
  )
}
