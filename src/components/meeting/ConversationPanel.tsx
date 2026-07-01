import { useEffect, useRef, useState } from 'react'
import { getTranslatedText } from '../../fixtures/mockTranscripts'
import type { Participant } from '../../types/participant'
import type { Transcript } from '../../types/transcript'
import type { ChatMessage } from '../../types/chat'
import { Icon } from '../common/Icon'

export type ConversationTab = 'chat' | 'transcript'

type ConversationPanelProps = {
  participants: Participant[]
  transcripts: Transcript[]
  chatMessages: ChatMessage[]
  localParticipantId?: number
  targetLanguage: string
  isOpen: boolean
  activeTab: ConversationTab
  chatUnreadCount: number
  onTabChange: (tab: ConversationTab) => void
  onClose: () => void
  onSendChatMessage: (message: string) => void
}

const languageLabels: Record<string, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  fr: 'Français',
  zh: '中文',
}

export function ConversationPanel({
  participants,
  transcripts,
  chatMessages,
  localParticipantId,
  targetLanguage,
  isOpen,
  activeTab,
  chatUnreadCount,
  onTabChange,
  onClose,
  onSendChatMessage,
}: ConversationPanelProps) {
  const [chatInput, setChatInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const isComposingRef = useRef(false)

  useEffect(() => {
    const list = listRef.current

    if (list) {
      list.scrollTo({
        top: list.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [activeTab, transcripts.length, chatMessages.length])

  const sendChatMessage = () => {
    const message = chatInput.trim()

    if (!message) {
      return
    }

    onSendChatMessage(message)
    setChatInput('')
  }

  const renderTranscriptItems = () => (
    <div className="transcript-list" ref={listRef}>
      {transcripts.map((transcript) => {
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
              <div className="transcript-copy translated-copy">
                <span>Translated</span>
                <p className="transcript-translated">
                  {getTranslatedText(transcript, targetLanguage)}
                </p>
              </div>
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
            <strong>아직 채팅 메시지가 없습니다.</strong>
            <p>첫 메시지를 남겨 대화를 시작해 보세요.</p>
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
            </div>
          )
        })}
      </div>
      <div className="chat-composer">
        <textarea
          value={chatInput}
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
              sendChatMessage()
            }
          }}
          placeholder="메시지를 입력하세요..."
          rows={2}
        />
        <button
          type="button"
          onClick={sendChatMessage}
          disabled={!chatInput.trim()}
          aria-label="메시지 전송"
        >
          <Icon name="arrow-right" size={15} />
        </button>
      </div>
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
          <button className={`panel-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => onTabChange('chat')}>
            <Icon name="message" size={13} /> Chat
            {chatUnreadCount > 0 && (
              <span className="unread-badge">{Math.min(chatUnreadCount, 99)}</span>
            )}
          </button>
          <button className={`panel-tab ${activeTab === 'transcript' ? 'active' : ''}`} onClick={() => onTabChange('transcript')}>
            <Icon name="captions" size={13} /> Transcript
          </button>
        </div>
      </div>

      {activeTab === 'chat' ? renderChat() : renderTranscriptItems()}

      {activeTab === 'transcript' && (
        <div className="language-bar">
          <span><Icon name="globe" size={14} /> Translation language</span>
          <strong>{languageLabels[targetLanguage] ?? targetLanguage} <Icon name="chevron-down" size={12} /></strong>
        </div>
      )}
    </aside>
  )
}
