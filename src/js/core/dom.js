// Real links open in a new tab; the prototype's '#mock' placeholders get intercepted in main.js
export function linkProps(href) {
  return /^https?:/i.test(href) ? { href, target: '_blank', rel: 'noopener noreferrer' } : { href }
}

export function h(tag, props, ...children) {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue
    if (key === 'class') el.className = value
    else if (key === 'style' && typeof value === 'object') {
      for (const [name, v] of Object.entries(value)) {
        if (name.startsWith('--')) el.style.setProperty(name, v)
        else el.style[name] = v
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value)
    } else el.setAttribute(key, value === true ? '' : String(value))
  }
  append(el, children)
  return el
}

export function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue
    el.append(child instanceof Node ? child : document.createTextNode(String(child)))
  }
}

export function icon(name, { size, className = '' } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', `icon ${className}`.trim())
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  if (size) {
    svg.setAttribute('width', size)
    svg.setAttribute('height', size)
  }
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use')
  use.setAttribute('href', `#i-${name}`)
  svg.append(use)
  return svg
}

// Swaps an icon's symbol without rebuilding the node
export function setIcon(svg, name) {
  svg.firstElementChild.setAttribute('href', `#i-${name}`)
}
