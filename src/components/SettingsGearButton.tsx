interface SettingsGearButtonProps {
  className?: string
  label: string
  onClick: () => void
}

export function SettingsGearButton({ className = '', label, onClick }: SettingsGearButtonProps) {
  return (
    <button
      type="button"
      className={`settings-toggle ${className}`.trim()}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M10.41 2.95a1.75 1.75 0 0 1 3.18 0l.38.9a7.93 7.93 0 0 1 1.43.59l.9-.36a1.75 1.75 0 0 1 2.24.93l.86 1.9a1.75 1.75 0 0 1-.53 2.14l-.72.58c.05.34.08.68.08 1.03s-.03.69-.08 1.03l.72.58a1.75 1.75 0 0 1 .53 2.14l-.86 1.9a1.75 1.75 0 0 1-2.24.93l-.9-.36c-.45.24-.93.44-1.43.59l-.38.9a1.75 1.75 0 0 1-3.18 0l-.38-.9a7.94 7.94 0 0 1-1.43-.59l-.9.36a1.75 1.75 0 0 1-2.24-.93l-.86-1.9a1.75 1.75 0 0 1 .53-2.14l.72-.58A7.07 7.07 0 0 1 5.98 12c0-.35.03-.69.08-1.03l-.72-.58a1.75 1.75 0 0 1-.53-2.14l.86-1.9a1.75 1.75 0 0 1 2.24-.93l.9.36c.45-.24.93-.44 1.43-.59l.38-.9ZM12 8.25A3.75 3.75 0 1 0 12 15.75A3.75 3.75 0 1 0 12 8.25Z"
          fill="currentColor"
        />
      </svg>
    </button>
  )
}
