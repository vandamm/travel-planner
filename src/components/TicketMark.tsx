import type { SVGProps } from 'react'

type TicketMarkProps = SVGProps<SVGSVGElement> & {
  title?: string
}

export function TicketMark({ className = '', title, ...props }: TicketMarkProps) {
  return (
    <svg
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      viewBox="0 0 48 48"
      className={className}
      {...props}
    >
      <rect width="48" height="48" rx="3" fill="#c0392b" />
      <path
        fill="#faf8f1"
        fillRule="evenodd"
        d="M13 17.5A2.5 2.5 0 0 1 15.5 15h17a2.5 2.5 0 0 1 2.5 2.5v4.18a3.2 3.2 0 0 0 0 6.64v4.18a2.5 2.5 0 0 1-2.5 2.5h-17a2.5 2.5 0 0 1-2.5-2.5v-4.18a3.2 3.2 0 0 0 0-6.64v-4.18Zm17 1.75a1 1 0 0 0-1 1v.75a1 1 0 1 0 2 0v-.75a1 1 0 0 0-1-1Zm0 5a1 1 0 0 0-1 1v1.5a1 1 0 1 0 2 0v-1.5a1 1 0 0 0-1-1Zm0 5.75a1 1 0 0 0-1 1v.75a1 1 0 1 0 2 0V31a1 1 0 0 0-1-1Z"
      />
      <circle cx="18.5" cy="24" r="2" fill="#c0392b" />
      <circle cx="24" cy="24" r="2" fill="#c0392b" />
    </svg>
  )
}
