import { Icon } from './Icon'

type LogoProps = {
  onClick?: () => void
}

export function Logo({ onClick }: LogoProps) {
  return (
    <button className="brand" type="button" onClick={onClick}>
      <span className="brand-mark">
        <Icon name="wave" size={20} strokeWidth={2.2} />
      </span>
      <span>Say, Merang</span>
    </button>
  )
}
