import type {
  CaptionSize,
  LanguageCode,
  MediaDeviceSelection,
  Participant,
  SpeechRecognitionLanguage,
} from '../../types'
import { Icon } from '../common/Icon'

type MeetingSettingsPanelProps = {
  participant: Participant | undefined
  targetLanguage: LanguageCode
  autoStartCaption: boolean
  recordingEnabled: boolean
  deviceSelection: MediaDeviceSelection
  videoDevices: MediaDeviceInfo[]
  audioDevices: MediaDeviceInfo[]
  speakerDevices: MediaDeviceInfo[]
  isChangingDevice: boolean
  message: string
  captionSize: CaptionSize
  speechRecognitionLanguage: SpeechRecognitionLanguage
  onClose: () => void
  onDisplayNameChange: (name: string) => void
  onSourceLanguageChange: (language: LanguageCode) => void
  onTargetLanguageChange: (language: LanguageCode) => void
  onDeviceChange: (kind: 'video' | 'audio' | 'speaker', deviceId: string) => void
  onCaptionSizeChange: (size: CaptionSize) => void
  onSpeechRecognitionLanguageChange: (
    language: SpeechRecognitionLanguage,
  ) => void
  onRecordingEnabledChange: (enabled: boolean) => void
}

export function MeetingSettingsPanel(props: MeetingSettingsPanelProps) {
  const {
    participant,
    deviceSelection,
    videoDevices,
    audioDevices,
    speakerDevices,
    isChangingDevice,
    message,
    onClose,
    onDisplayNameChange,
    onDeviceChange,
  } = props

  return (
    <div className="meeting-settings-backdrop" onMouseDown={onClose}>
      <aside
        className="meeting-settings-panel"
        aria-label="방 설정"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="meeting-settings-header">
          <div>
            <span>ROOM SETTINGS</span>
            <h2>방 설정</h2>
          </div>
          <button type="button" onClick={onClose}>닫기</button>
        </div>

        <div className="meeting-settings-fields">
          <div className="field">
            <label htmlFor="meeting-display-name">표시 이름</label>
            <input
              className="input"
              id="meeting-display-name"
              value={participant?.name ?? ''}
              onChange={(event) => onDisplayNameChange(event.target.value)}
            />
          </div>
          <DeviceSelect
            id="meeting-camera-device"
            label="카메라 선택"
            emptyLabel="사용 가능한 카메라가 없습니다."
            fallbackLabel="카메라"
            value={deviceSelection.videoDeviceId}
            devices={videoDevices}
            disabled={isChangingDevice}
            onChange={(deviceId) => onDeviceChange('video', deviceId)}
          />
          <DeviceSelect
            id="meeting-audio-device"
            label="마이크 선택"
            emptyLabel="사용 가능한 마이크가 없습니다."
            fallbackLabel="마이크"
            value={deviceSelection.audioDeviceId}
            devices={audioDevices}
            disabled={isChangingDevice}
            onChange={(deviceId) => onDeviceChange('audio', deviceId)}
          />
          <DeviceSelect
            id="meeting-speaker-device"
            label="스피커 선택"
            emptyLabel="시스템 기본 스피커"
            fallbackLabel="스피커"
            value={deviceSelection.speakerDeviceId ?? ''}
            devices={speakerDevices}
            disabled={isChangingDevice}
            onChange={(deviceId) => onDeviceChange('speaker', deviceId)}
          />
        </div>
        {message && <div className="meeting-settings-message">{message}</div>}
      </aside>
    </div>
  )
}

type DeviceSelectProps = {
  id: string
  label: string
  emptyLabel: string
  fallbackLabel: string
  value: string
  devices: MediaDeviceInfo[]
  disabled: boolean
  onChange: (deviceId: string) => void
}

function DeviceSelect({
  id,
  label,
  emptyLabel,
  fallbackLabel,
  value,
  devices,
  disabled,
  onChange,
}: DeviceSelectProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="select-wrap">
        <select
          id={id}
          value={value}
          disabled={disabled || devices.length === 0}
          onChange={(event) => onChange(event.target.value)}
        >
          {devices.length === 0 ? (
            <option value="">{emptyLabel}</option>
          ) : devices.map((device, index) => (
            <option value={device.deviceId} key={device.deviceId}>
              {device.label || `${fallbackLabel} ${index + 1}`}
            </option>
          ))}
        </select>
        <Icon name="chevron-down" size={16} />
      </div>
    </div>
  )
}
