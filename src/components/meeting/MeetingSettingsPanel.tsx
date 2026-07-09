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
  isChangingDevice: boolean
  message: string
  captionSize: CaptionSize
  speechRecognitionLanguage: SpeechRecognitionLanguage
  onClose: () => void
  onDisplayNameChange: (name: string) => void
  onSourceLanguageChange: (language: LanguageCode) => void
  onTargetLanguageChange: (language: LanguageCode) => void
  onDeviceChange: (kind: 'video' | 'audio', deviceId: string) => void
  onCaptionSizeChange: (size: CaptionSize) => void
  onSpeechRecognitionLanguageChange: (
    language: SpeechRecognitionLanguage,
  ) => void
  onRecordingEnabledChange: (enabled: boolean) => void
}

export function MeetingSettingsPanel({
  participant,
  targetLanguage,
  autoStartCaption,
  recordingEnabled,
  deviceSelection,
  videoDevices,
  audioDevices,
  isChangingDevice,
  message,
  captionSize,
  speechRecognitionLanguage,
  onClose,
  onDisplayNameChange,
  onSourceLanguageChange,
  onTargetLanguageChange,
  onDeviceChange,
  onCaptionSizeChange,
  onSpeechRecognitionLanguageChange,
  onRecordingEnabledChange,
}: MeetingSettingsPanelProps) {
  return (
    <div className="meeting-settings-backdrop" onMouseDown={onClose}>
      <aside
        className="meeting-settings-panel"
        aria-label="미팅 설정"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="meeting-settings-header">
          <div>
            <span>MEETING PREFERENCES</span>
            <h2>미팅 설정</h2>
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
          <div className="field">
            <label htmlFor="meeting-source-language">내가 말할 언어</label>
            <div className="select-wrap">
              <select
                id="meeting-source-language"
                value={participant?.language ?? 'ko'}
                onChange={(event) => onSourceLanguageChange(
                  event.target.value as LanguageCode,
                )}
              >
                <option value="ko">한국어 (Korean)</option>
                <option value="en">English</option>
                <option value="ja">日本語 (Japanese)</option>
                <option value="zh">中文 (Chinese)</option>
                <option value="fr">Français (French)</option>
              </select>
              <Icon name="chevron-down" size={16} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="meeting-stt-language">음성 인식 언어</label>
            <div className="select-wrap">
              <select
                id="meeting-stt-language"
                value={speechRecognitionLanguage}
                onChange={(event) => onSpeechRecognitionLanguageChange(
                  event.target.value as SpeechRecognitionLanguage,
                )}
              >
                <option value="ko-KR">한국어 (ko-KR)</option>
                <option value="en-US">English (en-US)</option>
              </select>
              <Icon name="chevron-down" size={16} />
            </div>
            <p className="field-help">다음 실시간 자막 시작부터 적용됩니다.</p>
          </div>
          <div className="field">
            <label htmlFor="meeting-target-language">번역해서 볼 언어</label>
            <div className="select-wrap">
              <select
                id="meeting-target-language"
                value={targetLanguage}
                onChange={(event) => onTargetLanguageChange(
                  event.target.value as LanguageCode,
                )}
              >
                <option value="ko">한국어 (Korean)</option>
                <option value="en">English</option>
                <option value="ja">日本語 (Japanese)</option>
                <option value="zh">中文 (Chinese)</option>
              </select>
              <Icon name="chevron-down" size={16} />
            </div>
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
        </div>

        <div className="meeting-caption-setting">
          <span>실시간 자막 자동 시작</span>
          <strong className={autoStartCaption ? 'is-enabled' : ''}>
            {autoStartCaption ? '사용 중' : '사용 안 함'}
          </strong>
        </div>
        <label className="meeting-caption-setting recording-toggle">
          <span>회의 기록 저장</span>
          <input
            type="checkbox"
            checked={recordingEnabled}
            onChange={(event) => onRecordingEnabledChange(event.target.checked)}
          />
          <strong className={recordingEnabled ? 'is-enabled' : ''}>
            {recordingEnabled ? '기록 중' : '기록 저장 꺼짐'}
          </strong>
        </label>
        <section className="caption-display-settings">
          <div>
            <span>자막 표시 설정</span>
            <strong>자막 크기</strong>
          </div>
          <div className="caption-size-options" role="group" aria-label="자막 크기">
            {([
              ['small', '작게'],
              ['medium', '보통'],
              ['large', '크게'],
            ] as const).map(([size, label]) => (
              <button
                className={captionSize === size ? 'is-active' : ''}
                type="button"
                onClick={() => onCaptionSizeChange(size)}
                key={size}
              >
                {label}
              </button>
            ))}
          </div>
          <p>이 설정은 내 화면에만 적용돼요.</p>
        </section>
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
