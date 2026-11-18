// One coherent set: 24px grid, 1.5px stroke, round joins
const SYMBOLS = {
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  pause:
    '<rect x="7" y="5" width="3.4" height="14" rx=".6" fill="currentColor" stroke="none"/><rect x="13.6" y="5" width="3.4" height="14" rx=".6" fill="currentColor" stroke="none"/>',
  prev: '<path d="M7 5.5v13"/><path d="M18.5 6v12L9.5 12z" fill="currentColor"/>',
  next: '<path d="M17 5.5v13"/><path d="M5.5 6v12l9-6z" fill="currentColor"/>',
  keep: '<path d="M7 4.5h10v15l-5-3.6-5 3.6z"/>',
  kept: '<path d="M7 4.5h10v15l-5-3.6-5 3.6z" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2M12 8v.01"/>',
  external: '<path d="M9 7h8v8M17 7 8 16"/>',
  arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  back: '<path d="M20 12H5M11 6l-6 6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  volume: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
  mute: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
  library:
    '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
  sources:
    '<path d="M10 7h10M10 12h10M10 17h10"/><circle cx="5.5" cy="7" r="1.2" fill="currentColor"/><circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="5.5" cy="17" r="1.2" fill="currentColor"/>',
  prefs:
    '<path d="M4 8h16M4 16h16"/><circle cx="9" cy="8" r="2.2" fill="var(--paper-0)"/><circle cx="15" cy="16" r="2.2" fill="var(--paper-0)"/>',
}

export function mountIcons(parent) {
  const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  sprite.setAttribute('aria-hidden', 'true')
  sprite.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden')
  sprite.innerHTML = Object.entries(SYMBOLS)
    .map(
      ([name, body]) =>
        `<symbol id="i-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</symbol>`,
    )
    .join('')
  parent.prepend(sprite)
}
