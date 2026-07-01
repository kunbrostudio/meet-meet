import { Logo } from './Logo'

type AppHeaderProps = {
  onLogoClick: () => void
}

export function AppHeader({ onLogoClick }: AppHeaderProps) {
  return (
    <header className="app-header app-header-minimal">
      <div className="container header-inner">
        <Logo onClick={onLogoClick} />
        <span className="header-service-label">실시간 회의 통역</span>
      </div>
    </header>
  )
}
