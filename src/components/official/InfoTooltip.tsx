'use client'

// Tooltip rico con descripción + ejemplo. Hover desktop + focus/tap mobile/teclado.
// Usa "named group" /tip para no engancharse con groups ancestros (ej. <details>).
// align controla la posición horizontal en grids para que no se solapen entre sí.

export type TooltipAlign = 'left' | 'center' | 'right'

export type TooltipContent = {
  title: string
  body: string
  example: string
}

export function InfoTooltip({
  title,
  body,
  example,
  align = 'center',
}: TooltipContent & { align?: TooltipAlign }) {
  const alignCls =
    align === 'left' ? 'left-0'
    : align === 'right' ? 'right-0'
    : 'left-1/2 -translate-x-1/2'
  return (
    <span className="relative z-[100] inline-block group/tip ml-1.5 align-middle hover:z-[9999] focus-within:z-[9999]">
      <span
        role="button"
        aria-label={`Info: ${title}`}
        tabIndex={0}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-700 hover:bg-blue-500 focus:bg-blue-500 text-slate-200 text-[10px] font-bold cursor-help focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
      >
        ?
      </span>
      <div
        role="tooltip"
        className={`invisible opacity-0 group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100 absolute z-[9999] isolate bottom-full mb-2 ${alignCls} w-64 max-w-[calc(100vw-2rem)] p-3 bg-slate-950 border border-slate-700 rounded-lg shadow-2xl ring-1 ring-black/30 text-xs text-slate-300 leading-relaxed pointer-events-none transition-opacity duration-150 text-left normal-case whitespace-normal`}
      >
        <p className="font-bold text-slate-100 mb-1.5">{title}</p>
        <p className="mb-2 font-normal">{body}</p>
        <p className="text-[11px] text-emerald-400 italic font-normal">{example}</p>
      </div>
    </span>
  )
}
