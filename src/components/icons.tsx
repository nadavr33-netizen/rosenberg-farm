import type { Cat } from "@/lib/types";

const SVG: Record<Cat, string> = {
  mango: '<svg viewBox="0 0 48 48" aria-hidden="true"><path class="ic-mango" d="M13 33c-5-9 1-21 13-22 8 0 12 6 10 13-2 9-12 15-19 13-2-1-3-2-4-4z"/><path class="ic-leaf" d="M27 11c2-5 7-7 12-6-2 5-6 7-12 6z"/><path class="ic-line" d="M26 11c0-2 1-4 2-5"/></svg>',
  avocado: '<svg viewBox="0 0 48 48" aria-hidden="true"><path class="ic-leaf" d="M24 6c5 0 7 7 9 13 4 4 6 9 5 14-2 8-9 10-14 10s-12-2-14-10c-1-5 1-10 5-14 2-6 4-13 9-13z"/><path class="ic-lime" d="M24 10c3 0 5 6 7 11 3 3 5 7 4 11-1 6-6 8-11 8s-10-2-11-8c-1-4 1-8 4-11 2-5 4-11 7-11z"/><circle class="ic-leaf" cx="24" cy="31" r="5.5"/></svg>',
  tomato: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle class="ic-tomato" cx="24" cy="27" r="15"/><path class="ic-leaf" d="M24 12l3 4 5-2-3 5 5 2-6 1-4 3-4-3-6-1 5-2-3-5 5 2z"/></svg>',
  oil: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="ic-olive" x="16" y="15" width="16" height="28" rx="4"/><rect class="ic-pit" x="20" y="6" width="8" height="6" rx="1.5"/><path class="ic-olive" d="M20 12h8v4h-8z"/><ellipse fill="#FFFEFA" opacity=".85" cx="24" cy="30" rx="5" ry="6.5"/></svg>',
};

export function CatIcon({ cat }: { cat: Cat }) {
  return <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: SVG[cat] }} />;
}

export const LOCK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const TICK = (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
);
export const CLOCK = (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
