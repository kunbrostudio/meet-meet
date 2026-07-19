import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../types/chat'
import { Icon } from '../common/Icon'

export type ConversationTab = 'chat'

type ConversationPanelProps = {
  chatMessages: ChatMessage[]
  localParticipantId?: number
  isOpen: boolean
  chatUnreadCount: number
  onClose: () => void
  onSendChatMessage: (message: string) => void | Promise<void>
  canSendChatMessage?: boolean
  chatSendMessage?: string
}

export function ConversationPanel({
  chatMessages,
  localParticipantId,
  isOpen,
  chatUnreadCount,
  onClose,
  onSendChatMessage,
  canSendChatMessage = true,
  chatSendMessage = '',
}: ConversationPanelProps) {
  const [chatInput, setChatInput] = useState('')
  const [isSendingChatMessage, setIsSendingChatMessage] = useState(false)
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
  }, [chatMessages.length])

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

  return (
    <aside
      className={`transcript-panel ${isOpen ? 'is-open' : 'is-closed'}`}
      inert={!isOpen}
      aria-label="채팅"
    >
      <div className="panel-header">
        <div className="panel-title-row">
          <div>
            <h2>Chat</h2>
            <p>방 안에서 주고받는 메시지</p>
          </div>
          <button
            className="conversation-close"
            type="button"
            onClick={(event) => {
              event.currentTarget.blur()
              onClose()
            }}
            aria-label="채팅 패널 닫기"
          >
            ×
          </button>
        </div>
        <div className="panel-tabs">
          <button className="panel-tab active" type="button">
            <Icon name="message" size={13} /> Chat
            {chatUnreadCount > 0 && (
              <span className="unread-badge">{Math.min(chatUnreadCount, 99)}</span>
            )}
          </button>
        </div>
      </div>

      <div className="chat-list" ref={listRef}>
        {chatMessages.length === 0 ? (
          <div className="chat-empty">
            <span><Icon name="message" size={20} /></span>
            <strong>아직 채팅이 없습니다.</strong>
            <p>친구들에게 메시지를 보내보세요.</p>
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
              : '방에 연결된 후 채팅을 보낼 수 있습니다.'
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
          {chatSendMessage || '방에 연결된 후 채팅을 보낼 수 있습니다.'}
        </p>
      )}
    </aside>
  )
}
