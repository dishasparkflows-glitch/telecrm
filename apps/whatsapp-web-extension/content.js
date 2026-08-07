const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g

const normalizeCandidate = (value) => {
  const match = String(value || '').match(PHONE_PATTERN)?.[0]
  if (!match) return ''
  const plus = match.trim().startsWith('+') ? '+' : ''
  const digits = match.replace(/\D/g, '')
  return digits.length >= 8 ? `${plus}${digits}` : ''
}

if (typeof module !== 'undefined') module.exports = { normalizeCandidate }

const detectActiveChat = () => {
  const header = document.querySelector('#main header')
  if (!header) return { phone: '', title: '' }

  const candidates = [
    header.querySelector('[data-testid="conversation-info-header-chat-title"]')?.textContent,
    header.querySelector('[title]')?.getAttribute('title'),
    header.textContent,
  ].filter(Boolean)

  for (const candidate of candidates) {
    const phone = normalizeCandidate(candidate)
    if (phone) return { phone, title: String(candidates[0] || candidate).trim() }
  }
  return { phone: '', title: String(candidates[0] || '').trim() }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SPARKCRM_GET_ACTIVE_CHAT') sendResponse(detectActiveChat())
  return true
})
