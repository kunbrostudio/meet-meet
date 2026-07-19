import { Icon } from '../common/Icon'

export function GameBoardEmptyState() {
  return (
    <div className="game-board-empty-state">
      <span>
        <Icon name="message" size={20} />
      </span>
      <strong>친구들이 입장할 때까지 가볍게 대화해 보세요.</strong>
    </div>
  )
}
