import type { SVGProps } from 'react'

const base = (props: SVGProps<SVGSVGElement>) => ({ width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...props })

export const Coin = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M9 9.5c0-1 1.3-1.5 3-1.5s3 .6 3 1.5-1.3 1.5-3 1.5-3 .6-3 1.5 1.3 1.5 3 1.5 3-.5 3-1.5M12 6v2M12 16v2" /></svg>
export const Wheat = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 22V9M12 9c-3 0-5-2-5-5 3 0 5 2 5 5zM12 9c3 0 5-2 5-5-3 0-5 2-5 5zM12 15c-3 0-5-2-5-5 3 0 5 2 5 5zM12 15c3 0 5-2 5-5-3 0-5 2-5 5z" /></svg>
export const Wood = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 9h13a3 3 0 0 1 0 6H4" /><ellipse cx="4" cy="12" rx="2" ry="3" /><path d="M4 12h.01" /></svg>
export const Iron = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M3 16l3-8h12l3 8z" /><path d="M7 16v3h10v-3" /></svg>
export const Flask = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /><path d="M7.5 15h9" /></svg>
export const Heart = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 21s-7-4.6-9-9a5 5 0 0 1 9-4 5 5 0 0 1 9 4c-2 4.4-9 9-9 9z" /></svg>
export const Shield = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></svg>
export const Swords = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M3 3l7 7M21 3l-7 7M6 18l-3 3M18 18l3 3M14 10l-8 8M10 10l8 8" /></svg>
export const Sound = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></svg>
export const Mute = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M17 9l4 6M21 9l-4 6" /></svg>
export const Chevron = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M9 6l6 6-6 6" /></svg>
export const Locate = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
export const Menu = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
export const Lightbulb = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" /></svg>
export const Close = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
