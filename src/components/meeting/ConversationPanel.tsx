import { useEffect, useRef, useState } from 'react'
import type { Participant } from '../../types/participant'
import type { Transcript } from '../../types/transcript'
import type { ChatMessage } from '../../types/chat'
import type {
  LanguageCode,
  TranslationRecord,
  TranslationSourceType,
} from '../../types'
import { Icon } from '../common/Icon'

export type ConversationTab = 'chat' | 'transcript'

type ConversationPanelProps = {
  participants: Participant[]
  transcripts: Transcript[]
  chatMessages: ChatMessage[]
  localParticipantId?: number
  targetLanguage: string
  translationTargetLanguage: LanguageCode
  autoTranslationEnabled: boolean
  canUseManualTranslation: boolean
  canUseAutoTranslation: boolean
  canUseTranscriptView: boolean
  translationMode: string
  translations: TranslationRecord[]
  translatingKeys: string[]
  isOpen: boolean
  activeTab: ConversationTab
  chatUnreadCount: number
  onTabChange: (tab: ConversationTab) => void
  onClose: () => void
  onSendChatMessage: (message: string) => void | Promise<void>
  canSendChatMessage?: boolean
  chatSendMessage?: string
  onTranslationTargetLanguageChange: (language: LanguageCode) => void
  onAutoTranslationChange: (enabled: boolean) => void
  onTranslateItem: (
    sourceType: TranslationSourceType,
    sourceId: string,
    sourceText: string,
    sourceLanguage: LanguageCode,
    options?: { force?: boolean, targetLanguage?: LanguageCode },
  ) => void | Promise<void>
}

const languageLabels: Record<string, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  fr: 'Français',
  zh: '中文',
}

const lockedTranslationMessage =
  '번역 기능은 프리미엄 계정에서 제공될 예정이며 현재 개발 중입니다.'
const lockedTranscriptMessage =
  'Transcript 기능은 프리미엄 계정에서 제공될 예정이며 현재 개발 중입니다.'

export function ConversationPanel({
  participants,
  transcripts,
  chatMessages,
  localParticipantId,
  targetLanguage,
  translationTargetLanguage,
  autoTranslationEnabled,
  canUseManualTranslation,
  canUseAutoTranslation,
  canUseTranscriptView,
  translationMode,
  translations,
  translatingKeys,
  isOpen,
  activeTab,
  chatUnreadCount,
  onTabChange,
  onClose,
  onSendChatMessage,
  canSendChatMessage = true,
  chatSendMessage = '',
  onTranslationTargetLanguageChange,
  onAutoTranslationChange,
  onTranslateItem,
}: ConversationPanelProps) {
  const [chatInput, setChatInput] = useState('')
  const [isSendingChatMessage, setIsSendingChatMessage] = useState(false)
  const [translationNotice, setTranslationNotice] = useState('')
  const noticeTimerRef = useRef<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const isComposingRef = useRef(false)
  const effectiveActiveTab =
    !canUseTranscriptView && activeTab === 'transcript'
      ? 'chat'
      : activeTab

  const showLockedFeatureNotice = (message: string) => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current)
    }
    setTranslationNotice(message)
    noticeTimerRef.current = window.setTimeout(() => {
      setTranslationNotice('')
      noticeTimerRef.current = null
    }, 3600)
  }
  const showLockedTranslationNotice = () => {
    showLockedFeatureNotice(lockedTranslationMessage)
  }
  const showLockedTranscriptNotice = () => {
    showLockedFeatureNotice(lockedTranscriptMessage)
  }
  const getTranslationKey = (
    sourceType: TranslationSourceType,
    sourceId: string,
    targetLanguage = translationTargetLanguage,
  ) => `${sourceType}:${sourceId}:${targetLanguage}`
  const getEffectiveTranslationTarget = (
    sourceLanguage: LanguageCode,
  ): LanguageCode => {
    if (sourceLanguage === 'ko') {
      return 'en'
    }
    if (sourceLanguage === 'en') {
      return 'ko'
    }
    return translationTargetLanguage
  }
  const detectChatLanguage = (message: ChatMessage): LanguageCode => {
    if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(message.message)) {
      return 'ko'
    }
    if (/[A-Za-z]/.test(message.message)) {
      return 'en'
    }
    if (
      message.language === 'ko'
      || message.language === 'en'
      || message.language === 'ja'
      || message.language === 'zh'
      || message.language === 'fr'
    ) {
      return message.language
    }

    return 'en'
  }
  const renderTranslationAction = (
    sourceType: TranslationSourceType,
    sourceId: string,
    sourceText: string,
    sourceLanguage: LanguageCode,
  ) => {
    const effectiveTargetLanguage = getEffectiveTranslationTarget(sourceLanguage)
    const translation = translations.find((item) => (
      item.sourceType === sourceType
      && item.sourceId === sourceId
      && item.targetLanguage === effectiveTargetLanguage
    ))
    const key = getTranslationKey(
      sourceType,
      sourceId,
      effectiveTargetLanguage,
    )
    const isLoading = translatingKeys.includes(key)
    const isFailed = translation?.status === 'failed'
    const isSuccess = translation?.status === 'success'
    const shouldShowButton =
      canUseManualTranslation && (!autoTranslationEnabled || isFailed || isLoading)

    return (
      <div className="inline-translation">
        {isLoading && <p className="translation-loading">번역 중...</p>}
        {isSuccess && (
          <p className="translation-result">
            <span>{translation.targetLanguage.toUpperCase()}</span>
            {translation.translatedText}
          </p>
        )}
        {isFailed && (
          <p className="translation-failed">
            번역에 실패했습니다.
          </p>
        )}
        {shouldShowButton && (
          <button
            className="translation-button"
            type="button"
            disabled={isLoading || !sourceText.trim()}
            onClick={() => {
              console.debug('[translate-ui] manual click', {
                sourceType,
                sourceId,
                sourceTextLength: sourceText.trim().length,
                sourceLanguage,
                targetLanguage: effectiveTargetLanguage,
              })
              void onTranslateItem(
                sourceType,
                sourceId,
                sourceText,
                sourceLanguage,
                {
                  force: isFailed,
                  targetLanguage: effectiveTargetLanguage,
                },
              )
            }}
          >
            {isFailed ? '다시 시도' : '번역하기'}
          </button>
        )}
        {!canUseManualTranslation && !isSuccess && (
          <button
            className="translation-button is-locked"
            type="button"
            onClick={showLockedTranslationNotice}
            aria-label="잠긴 번역 기능 안내 보기"
          >
            <Icon name="lock" size={12} /> 번역하기
          </button>
        )}
      </div>
    )
  }

  useEffect(() => {
    const list = listRef.current

    if (list) {
      list.scrollTo({
        top: list.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [effectiveActiveTab, transcripts.length, chatMessages.length])

  useEffect(() => () => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current)
    }
  }, [])

  const sendChatMessage = async () => {
    const message = chatInput.trim()

    if (!message || !canSendChatMessage || isSendingChatMessage) {
      return
    }

    setIsSendingChatMessage(true)
    try {
      await onSendChatMessage(message)
      setChatInput('')
    } finally {
      setIsSendingChatMessage(false)
    }
  }

  const renderTranscriptItems = () => (
    <div className="transcript-list" ref={listRef}>
      {transcripts.length === 0 ? (
        <div className="chat-empty">
          <span><Icon name="captions" size={20} /></span>
          <strong>아직 자막 기록이 없습니다.</strong>
          <p>음성 인식을 시작하면 발화 내용이 여기에 표시됩니다.</p>
        </div>
      ) : transcripts.map((transcript) => {
        const participant = participants.find(
          (item) => item.id === transcript.participantId,
        )
        const participantName =
          participant?.name ?? transcript.speakerName
        const participantInitials =
          participant?.avatarLabel
          ?? participantName
            .split(/\s+/)
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
        const participantColor =
          participant?.avatarColor ?? 'linear-gradient(145deg, #4f80f4, #2455c8)'

        return (
          <div
            className={`transcript-item ${participant?.isSpeaking ? 'is-current' : ''}`}
            key={`${transcript.meetingId}-${transcript.id}`}
            data-translation-source={transcript.translationSource}
            title="번역 결과"
          >
            <div
              className="transcript-avatar"
              style={{ background: participantColor }}
            >
              {participantInitials}
            </div>
            <div className="transcript-content">
              <div className="transcript-head">
                <strong>{participantName}</strong>
                <time>{transcript.time}</time>
              </div>
              <div className="transcript-copy original-copy">
                <span>
                  Original · {languageLabels[
                    participant?.language ?? transcript.sourceLanguage
                  ] ?? transcript.sourceLanguage}
                </span>
                <p className="transcript-original">{transcript.sourceText}</p>
              </div>
              {renderTranslationAction(
                'transcript',
                transcript.transcriptId ?? String(transcript.id),
                transcript.sourceText,
                transcript.sourceLanguage,
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderChat = () => (
    <>
      <div className="chat-list" ref={listRef}>
      {chatMessages.length === 0 ? (
          <div className="chat-empty">
            <span><Icon name="message" size={20} /></span>
            <strong>아직 채팅이 없습니다.</strong>
            <p>메시지를 보내면 여기에 표시됩니다.</p>
          </div>
        ) : chatMessages.map((chatMessage) => {
          const isMine =
            chatMessage.type === 'user'
            && chatMessage.senderId === localParticipantId
          const time = new Intl.DateTimeFormat('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(new Date(chatMessage.createdAt))

          return (
            <div
              className={`chat-message ${isMine ? 'is-mine' : ''} ${chatMessage.type === 'system' ? 'is-system' : ''}`}
              key={chatMessage.id}
            >
              <div className="chat-message-meta">
                <strong>{chatMessage.senderName}</strong>
                <time>{time}</time>
              </div>
              <p>{chatMessage.message}</p>
              {canUseManualTranslation && chatMessage.type === 'user' && renderTranslationAction(
                'chat',
                chatMessage.id,
                chatMessage.message,
                detectChatLanguage(chatMessage),
              )}
            </div>
          )
        })}
      </div>
      <div className="chat-composer">
        <textarea
          value={chatInput}
          disabled={!canSendChatMessage || isSendingChatMessage}
          onChange={(event) => setChatInput(event.target.value)}
          onCompositionStart={() => {
            isComposingRef.current = true
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false
          }}
          onKeyDown={(event) => {
            const nativeEvent = event.nativeEvent
            const isImeComposing =
              isComposingRef.current
              || nativeEvent.isComposing
              || event.keyCode === 229

            if (isImeComposing) {
              return
            }

            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void sendChatMessage()
            }
          }}
          placeholder={
            canSendChatMessage
              ? '메시지를 입력하세요...'
              : '회의에 연결된 후 채팅을 보낼 수 있습니다.'
          }
          rows={2}
        />
        <button
          type="button"
          onClick={() => void sendChatMessage()}
          disabled={!canSendChatMessage || isSendingChatMessage || !chatInput.trim()}
          aria-label="메시지 전송"
        >
          <Icon name="arrow-right" size={15} />
        </button>
      </div>
      {(!canSendChatMessage || chatSendMessage) && (
        <p className="chat-send-feedback">
          {chatSendMessage || '회의에 연결된 후 채팅을 보낼 수 있습니다.'}
        </p>
      )}
    </>
  )

  return (
    <aside
      className={`transcript-panel ${isOpen ? 'is-open' : 'is-closed'}`}
      inert={!isOpen}
    >
      <div className="panel-header">
        <div className="panel-title-row">
          <div>
            <h2>Conversation</h2>
            <p>실시간 자막과 번역 기록</p>
          </div>
          <button
            className="conversation-close"
            type="button"
            onClick={(event) => {
              event.currentTarget.blur()
              onClose()
            }}
            aria-label="대화 패널 닫기"
          >
            ×
          </button>
        </div>
        <div className="panel-tabs">
          <button className={`panel-tab ${effectiveActiveTab === 'chat' ? 'active' : ''}`} onClick={() => onTabChange('chat')}>
            <Icon name="message" size={13} /> Chat
            {chatUnreadCount > 0 && (
              <span className="unread-badge">{Math.min(chatUnreadCount, 99)}</span>
            )}
          </button>
          <button
            className={[
              'panel-tab',
              effectiveActiveTab === 'transcript' ? 'active' : '',
              !canUseTranscriptView ? 'is-locked' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => {
              if (!canUseTranscriptView) {
                showLockedTranscriptNotice()
                return
              }
              onTabChange('transcript')
            }}
            aria-disabled={!canUseTranscriptView}
          >
            <Icon name="captions" size={13} /> Transcript
            {!canUseTranscriptView && (
              <span className="tab-lock-badge">
                <Icon name="lock" size={10} />
              </span>
            )}
          </button>
        </div>
        <div className="translation-target-control">
          {canUseAutoTranslation ? (
            <label className="auto-translation-toggle">
              <input
                type="checkbox"
                checked={autoTranslationEnabled}
                onChange={(event) => onAutoTranslationChange(event.target.checked)}
              />
              자동 번역
            </label>
          ) : (
            <button
              className="translation-mode-pill is-locked"
              type="button"
              onClick={showLockedTranslationNotice}
            >
              <Icon name="lock" size={11} /> 자동 번역
            </button>
          )}
          <span>번역</span>
          <select
            value={translationTargetLanguage}
            onMouseDown={(event) => {
              if (!canUseManualTranslation) {
                event.preventDefault()
                showLockedTranslationNotice()
              }
            }}
            onKeyDown={(event) => {
              if (!canUseManualTranslation) {
                event.preventDefault()
                showLockedTranslationNotice()
              }
            }}
            onChange={(event) => {
              if (!canUseManualTranslation) {
                showLockedTranslationNotice()
                return
              }
              onTranslationTargetLanguageChange(
                event.target.value as LanguageCode,
              )
            }}
            aria-label="번역 언어"
            aria-disabled={!canUseManualTranslation}
            className={!canUseManualTranslation ? 'is-locked' : ''}
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
          {!canUseManualTranslation && (
            <button
              className="translation-lock-chip"
              type="button"
              onClick={showLockedTranslationNotice}
            >
              <Icon name="lock" size={11} />
            </button>
          )}
        </div>
        {translationMode === 'free' && translationNotice && (
          <p className="translation-plan-notice">
            {translationNotice}
          </p>
        )}
      </div>

      {effectiveActiveTab === 'chat' ? renderChat() : renderTranscriptItems()}

      {effectiveActiveTab === 'transcript' && (
        <div className="language-bar">
          <span><Icon name="globe" size={14} /> Translation language</span>
          <strong>{languageLabels[translationTargetLanguage] ?? targetLanguage} <Icon name="chevron-down" size={12} /></strong>
        </div>
      )}
    </aside>
  )
}
