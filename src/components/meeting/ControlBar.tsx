import type { RefObject } from 'react'
import type { Participant } from '../../types'
import { Icon } from '../common/Icon'

type ControlBarProps = {
  participant: Participant | undefined
  isCaptionActive: boolean
  isScreenSharing: boolean
  isConversationOpen: boolean
  isParticipantsOpen: boolean
  isSettingsOpen: boolean
  isHost: boolean
  recordingEnabled: boolean
  chatUnreadCount: number
  viewMode: 'grid' | 'focus'
  showCaptionHint: boolean
  captionMessage: string
  liveCaptionText: string
  screenShareMessage: string
  captionButtonRef: RefObject<HTMLButtonElement | null>
  chatButtonRef?: RefObject<HTMLButtonElement | null>
  participantsButtonRef?: RefObject<HTMLButtonElement | null>
  settingsButtonRef?: RefObject<HTMLButtonElement | null>
  showTranslationLockButton?: boolean
  onToggleMicrophone: () => void
  onToggleCaption: () => void
  onToggleCamera: () => void
  onLockedTranslationClick?: () => void
  onToggleScreenShare: () => void
  onToggleViewMode: () => void
  onToggleParticipants: () => void
  onOpenChat: () => void
  onToggleSettings: () => void
  onRequestEnd: () => void
}

export function ControlBar({
  participant,
  isCaptionActive,
  isScreenSharing,
  isConversationOpen,
  isParticipantsOpen,
  isSettingsOpen,
  isHost,
  recordingEnabled,
  chatUnreadCount,
  viewMode,
  showCaptionHint,
  captionMessage,
  liveCaptionText,
  screenShareMessage,
  captionButtonRef,
  chatButtonRef,
  participantsButtonRef,
  settingsButtonRef,
  showTranslationLockButton = false,
  onToggleMicrophone,
  onToggleCaption,
  onToggleCamera,
  onLockedTranslationClick,
  onToggleScreenShare,
  onToggleViewMode,
  onToggleParticipants,
  onOpenChat,
  onToggleSettings,
  onRequestEnd,
}: ControlBarProps) {
  const isCaptionMessageError = Boolean(
    captionMessage
    && captionMessage !== '말하면 자동으로 자막이 기록됩니다.'
    && captionMessage !== '실시간 자막 대기 중'
    && captionMessage !== '실시간 번역 기능은 프리미엄 계정에서 제공될 예정이며 현재 개발 중입니다.'
  )

  return (
    <div className="meeting-controls-wrap">
      <div className="caption-status-stack">
        {screenShareMessage && (
          <div className="speech-status has-error">{screenShareMessage}</div>
        )}
        {showCaptionHint && (
          <div className="caption-guide">
            실시간 자막을 켜면 말한 내용이 자동으로 기록돼요.
          </div>
        )}
        <div className={`speech-status ${isCaptionMessageError ? 'has-error' : ''}`}>
          {captionMessage
            || (isCaptionActive ? '실시간 자막 기록 중' : '실시간 자막 꺼짐')}
        </div>
        <div className={`recording-status ${recordingEnabled ? 'is-on' : 'is-off'}`}>
          {recordingEnabled ? '기록 중' : '기록 저장 꺼짐'}
        </div>
        {liveCaptionText && (
          <div className="live-caption-preview" aria-live="polite">
            {liveCaptionText}
          </div>
        )}
      </div>
      <div className="meeting-controls">
        <ControlButton
          className={participant?.isMicOn ? '' : 'is-off'}
          icon={participant?.isMicOn ? 'mic' : 'mic-off'}
          label={participant?.isMicOn ? '마이크 끄기' : '마이크 켜기'}
          onClick={onToggleMicrophone}
        />
        <ControlButton
          buttonRef={captionButtonRef}
          className={isCaptionActive ? 'is-active' : ''}
          icon="captions"
          label={isCaptionActive ? '실시간 자막 끄기' : '실시간 자막 켜기'}
          onClick={onToggleCaption}
        />
        <ControlButton
          className={participant?.isCameraOn ? '' : 'is-off'}
          icon={participant?.isCameraOn ? 'video' : 'video-off'}
          label={participant?.isCameraOn ? '카메라 끄기' : '카메라 켜기'}
          onClick={onToggleCamera}
        />
        {showTranslationLockButton && (
          <ControlButton
            className="is-locked"
            icon="globe"
            label="실시간 번역 기능은 프리미엄 계정에서 제공될 예정이며 현재 개발 중입니다."
            lockBadge
            onClick={onLockedTranslationClick}
          />
        )}
        <ControlButton
          className={isScreenSharing ? 'is-active' : ''}
          icon="screen"
          label={isScreenSharing ? '화면 공유 중지' : '화면 공유 시작'}
          onClick={onToggleScreenShare}
        />
        <ControlButton
          className={viewMode === 'focus' ? 'is-active' : ''}
          icon="grid"
          label={viewMode === 'grid' ? '발표자 보기' : '그리드 보기'}
          onClick={onToggleViewMode}
        />
        <ControlButton
          buttonRef={participantsButtonRef}
          className={isParticipantsOpen ? 'is-active' : ''}
          icon="users"
          label="참가자 목록"
          onClick={onToggleParticipants}
        />
        <ControlButton
          buttonRef={chatButtonRef}
          className={isConversationOpen ? 'is-active' : ''}
          icon="message"
          label={
            isConversationOpen
              ? '채팅 닫기'
              : chatUnreadCount > 0
                ? `채팅 열기, 새 메시지 ${chatUnreadCount}개`
                : '채팅 열기'
          }
          badgeCount={chatUnreadCount}
          onClick={onOpenChat}
        />
        <ControlButton
          buttonRef={settingsButtonRef}
          className={isSettingsOpen ? 'is-active' : ''}
          icon="more"
          label="미팅 설정"
          onClick={onToggleSettings}
        />
        <ControlButton
          className="leave"
          icon="phone"
          label={isHost ? '회의 종료' : '나가기'}
          onClick={onRequestEnd}
        />
      </div>
    </div>
  )
}

type ControlButtonProps = {
  buttonRef?: RefObject<HTMLButtonElement | null>
  className?: string
  icon:
    | 'captions'
    | 'globe'
    | 'grid'
    | 'message'
    | 'mic'
    | 'mic-off'
    | 'more'
    | 'phone'
    | 'screen'
    | 'users'
    | 'video'
    | 'video-off'
  label: string
  badgeCount?: number
  lockBadge?: boolean
  onClick?: () => void
}

function ControlButton({
  buttonRef,
  className = '',
  icon,
  label,
  badgeCount = 0,
  lockBadge = false,
  onClick,
}: ControlButtonProps) {
  return (
    <button
      ref={buttonRef}
      className={`control-button ${className}`.trim()}
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon name={icon} size={17} />
      {badgeCount > 0 && (
        <span className="control-button-badge">
          {Math.min(badgeCount, 99)}
        </span>
      )}
      {lockBadge && (
        <span className="control-button-lock-badge">
          <Icon name="lock" size={9} strokeWidth={2.2} />
        </span>
      )}
    </button>
  )
}
