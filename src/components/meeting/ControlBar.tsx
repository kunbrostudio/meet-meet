import type { RefObject } from 'react'
import type { Participant } from '../../types'
import { Icon } from '../common/Icon'

type ControlBarProps = {
  participant: Participant | undefined
  isCaptionActive?: boolean
  isScreenSharing: boolean
  isParticipantsOpen: boolean
  isSettingsOpen: boolean
  isHost: boolean
  recordingEnabled?: boolean
  viewMode: 'grid' | 'focus'
  showCaptionHint?: boolean
  captionMessage?: string
  liveCaptionText?: string
  screenShareMessage: string
  captionButtonRef?: RefObject<HTMLButtonElement | null>
  participantsButtonRef?: RefObject<HTMLButtonElement | null>
  settingsButtonRef?: RefObject<HTMLButtonElement | null>
  showTranslationLockButton?: boolean
  onToggleMicrophone: () => void
  onToggleCaption?: () => void
  onToggleCamera: () => void
  onLockedTranslationClick?: () => void
  onToggleScreenShare: () => void
  onToggleViewMode: () => void
  onOpenGameMode: () => void
  onToggleParticipants: () => void
  onToggleSettings: () => void
  onRequestEnd: () => void
}

export function ControlBar({
  participant,
  isParticipantsOpen,
  isSettingsOpen,
  isHost,
  screenShareMessage,
  participantsButtonRef,
  settingsButtonRef,
  onToggleMicrophone,
  onToggleCamera,
  onOpenGameMode,
  onToggleParticipants,
  onToggleSettings,
  onRequestEnd,
}: ControlBarProps) {
  return (
    <div className="meeting-controls-wrap">
      <div className="caption-status-stack">
        {screenShareMessage && (
          <div className="speech-status has-error">{screenShareMessage}</div>
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
          className={participant?.isCameraOn ? '' : 'is-off'}
          icon={participant?.isCameraOn ? 'video' : 'video-off'}
          label={participant?.isCameraOn ? '카메라 끄기' : '카메라 켜기'}
          onClick={onToggleCamera}
        />
        <ControlButton
          className={isParticipantsOpen ? '' : 'is-active'}
          icon="gamepad"
          label="GAME MODE"
          onClick={onOpenGameMode}
        />
        <ControlButton
          buttonRef={participantsButtonRef}
          className={isParticipantsOpen ? 'is-active' : ''}
          icon="users"
          label="PLAYERS"
          onClick={onToggleParticipants}
        />
        <ControlButton
          buttonRef={settingsButtonRef}
          className={isSettingsOpen ? 'is-active' : ''}
          icon="more"
          label="방 설정"
          onClick={onToggleSettings}
        />
        <ControlButton
          className="leave"
          icon="phone"
          label={isHost ? '방 종료' : '나가기'}
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
    | 'gamepad'
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
