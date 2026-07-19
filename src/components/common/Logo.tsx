type LogoProps = {
  onClick?: () => void
}

export function Logo({ onClick }: LogoProps) {
  return (
    <button className="brand" type="button" onClick={onClick}>
      <span className="brand-mark brand-symbol">
        <span className="brand-symbol-inner">
          <img src="/images/say-merang-symbol.png" alt="Say, Merang" />
        </span>
      </span>
      <span>Say, Merang</span>
    </button>
  )
}
