const weekdays = [
  ['M', 'Monday'],
  ['T', 'Tuesday'],
  ['W', 'Wednesday'],
  ['T', 'Thursday'],
  ['F', 'Friday'],
  ['S', 'Saturday'],
  ['S', 'Sunday'],
]

document.querySelectorAll('.weekdays').forEach((row) => {
  row.replaceChildren(...weekdays.map(([short, full]) => {
    const cell = document.createElement('span')
    cell.textContent = short
    cell.setAttribute('aria-label', full)
    return cell
  }))
})

const toast = document.querySelector('[data-toast]')
let toastTimer

const timeline = document.querySelector('.route-segments .timeline')
const timelineAdd = timeline?.querySelector('.timeline-add')
const todayDot = timeline?.querySelector('.today-dot')

if (timeline && timelineAdd && todayDot && matchMedia('(hover: hover)').matches) {
  timeline.addEventListener('pointermove', (event) => {
    const timelineRect = timeline.getBoundingClientRect()
    const dotRect = todayDot.getBoundingClientRect()
    const railX = dotRect.left + dotRect.width / 2
    const railY = event.clientY - timelineRect.top
    const railStart = dotRect.top + dotRect.height / 2 - timelineRect.top
    const railEnd = timelineRect.height - 40
    const withinRail = railY > railStart + 24 && railY < railEnd - 24
    const overTrip = [...timeline.querySelectorAll('.route-segment')].some((segment) => {
      const rect = segment.getBoundingClientRect()
      return event.clientY >= rect.top - 4 && event.clientY <= rect.bottom + 4
    })
    const nearRail = Math.abs(event.clientX - railX) <= 22 && withinRail && !overTrip

    timelineAdd.classList.toggle('visible', nearRail)
    if (nearRail) timelineAdd.style.top = `${railY}px`
  })
  timeline.addEventListener('pointerleave', () => timelineAdd.classList.remove('visible'))
}

document.querySelectorAll('[data-prototype-action]').forEach((button) => {
  button.addEventListener('click', () => {
    if (!toast) return
    toast.textContent = button.dataset.prototypeAction
    toast.classList.add('visible')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 1600)
  })
})
