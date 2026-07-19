type LogoProps = {
  onClick?: () => void
}

export function Logo({ onClick }: LogoProps) {
  return (
    <button className="brand" type="button" onClick={onClick}>
      <span className="brand-mark" aria-hidden="true">
        MM
      </span>
      <span>MEET MEET</span>
    </button>
  )
}
