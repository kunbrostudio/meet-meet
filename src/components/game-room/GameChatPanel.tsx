import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../types/chat'
import { Icon } from '../common/Icon'
import { GameBoardEmptyState } from './GameBoardEmptyState'

type GameChatPanelProps = {
  messages: ChatMessage[]
  localParticipantId?: number
  onSendMessage: (message: string) => void | Promise<void>
  canSendMessage?: boolean
  sendMessage?: string
}

export function GameChatPanel({
  messages,
  localParticipantId,
  onSendMessage,
  canSendMessage = true,
  sendMessage = '',
}: GameChatPanelProps) {
  const [chatInput, setChatInput] = useState('')
  const [isSending, setIsSending] = useState(false)
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
  }, [messages.length])

  const sendChatMessage = async () => {
    const message = chatInput.trim()

    if (!message || !canSendMessage || isSending) {
      return
    }

    setIsSending(true)
    try {
      await onSendMessage(message)
      setChatInput('')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className="game-chat-panel" aria-label="게임 보드 채팅">
      <div className="game-chat-list" ref={listRef}>
        {messages.length === 0 ? (
          <GameBoardEmptyState />
        ) : messages.map((chatMessage) => {
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

      <div className="game-chat-composer">
        <textarea
          value={chatInput}
          disabled={!canSendMessage || isSending}
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
            canSendMessage
              ? '메시지를 입력하세요...'
              : '방에 연결된 후 채팅을 보낼 수 있습니다.'
          }
          rows={2}
        />
        <button
          type="button"
          onClick={() => void sendChatMessage()}
          disabled={!canSendMessage || isSending || !chatInput.trim()}
          aria-label="메시지 전송"
        >
          <Icon name="arrow-right" size={15} />
        </button>
      </div>
      {(!canSendMessage || sendMessage) && (
        <p className="game-chat-feedback">
          {sendMessage || '방에 연결된 후 채팅을 보낼 수 있습니다.'}
        </p>
      )}
    </section>
  )
}
