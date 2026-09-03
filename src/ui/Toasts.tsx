import type { LogKind } from '../engine/types'

export interface Toast { id: number; kind: LogKind; text: string }

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={'toast kind-' + t.kind} onClick={() => onDismiss(t.id)}>
          <span className="toast-dot" />
          {t.text}
        </div>
      ))}
    </div>
  )
}
