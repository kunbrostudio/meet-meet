import type { ReactNode } from 'react'
import type { ChatMessage } from '../../types/chat'
import type { GamePhase } from '../../types/game'
import { GameBoardHeader } from './GameBoardHeader'
import { GameChatPanel } from './GameChatPanel'

type GameBoardProps = {
  phase?: GamePhase
  statusText?: string
  chatMessages: ChatMessage[]
  localParticipantId?: number
  onSendChatMessage: (message: string) => void | Promise<void>
  canSendChatMessage?: boolean
  chatSendMessage?: string
  screenShareSlot?: ReactNode
}

export function GameBoard({
  phase = 'waiting',
  statusText,
  chatMessages,
  localParticipantId,
  onSendChatMessage,
  canSendChatMessage,
  chatSendMessage,
  screenShareSlot,
}: GameBoardProps) {
  return (
    <section className="game-board" aria-label="GAME BOARD">
      <GameBoardHeader phase={phase} statusText={statusText} />
      {screenShareSlot && (
        <div className="game-board-screen-share">
          {screenShareSlot}
        </div>
      )}
      <GameChatPanel
        messages={chatMessages}
        localParticipantId={localParticipantId}
        onSendMessage={onSendChatMessage}
        canSendMessage={canSendChatMessage}
        sendMessage={chatSendMessage}
      />
    </section>
  )
}
