import { h, icon, setIcon } from '../core/dom.js'

// Mobile only: the two primary actions stay within thumb reach
export function mountActionbar(root, { store, actions }) {
  const playIcon = icon('play')
  const play = h(
    'button',
    {
      class: 'btn btn--primary actionbar__play',
      type: 'button',
      'aria-label': 'Play',
      onClick: () => actions.togglePlayViewed(),
    },
    playIcon,
  )
  const discover = h(
    'button',
    { class: 'btn discover-btn', type: 'button', onClick: () => actions.discover() },
    h('span', null, 'Discover another'),
    icon('arrow'),
  )
  const el = h('div', { class: 'actionbar', role: 'group', 'aria-label': 'Quick actions' }, play, discover)
  root.append(el)

  function render({ viewed, player, draw }) {
    const same = Boolean(viewed) && player.record?.id === viewed.id
    const playing = same && player.status === 'playing'
    setIcon(playIcon, playing ? 'pause' : 'play')
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play')
    play.disabled = !viewed
    // The dock already carries transport for the record being played
    play.hidden = same
    discover.disabled = draw.status === 'drawing'
  }
  store.subscribe(render)
  render(store.get())
}
