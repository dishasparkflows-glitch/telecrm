const $ = (id) => document.getElementById(id)
let session = null
let currentLead = null
let stages = []
let users = []

const storageGet = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve))
const storageSet = (value) => new Promise((resolve) => chrome.storage.local.set(value, resolve))
const storageRemove = (keys) => new Promise((resolve) => chrome.storage.local.remove(keys, resolve))

const show = (id, visible = true) => $(id).classList.toggle('hidden', !visible)
const notify = (text, error = false) => {
  $('message').textContent = text
  $('message').classList.toggle('error', error)
  show('message')
  setTimeout(() => show('message', false), 4000)
}

const normalizeBase = (value) => String(value || '').trim().replace(/\/+$/, '')
const normalizePhone = (value) => String(value || '').replace(/[^0-9+]/g, '')

if (typeof module !== 'undefined') module.exports = { normalizeBase, normalizePhone }

const requestHostPermission = async (url) => {
  const origin = `${new URL(url).origin}/*`
  return chrome.permissions.request({ origins: [origin] })
}

const api = async (path, options = {}) => {
  const apiUrl = normalizeBase(session.apiUrl)
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (session.token) headers.Authorization = `Bearer ${session.token}`
  if (session.activeBranchId) headers['X-Branch-Id'] = session.activeBranchId
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`)
  return payload
}

const renderAuth = () => {
  const loggedIn = Boolean(session?.token)
  show('login', !loggedIn)
  show('workspace', loggedIn)
}

const fillSelect = (select, options) => {
  select.replaceChildren()
  options.forEach(({ value, label }) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    select.appendChild(option)
  })
}

const loadContext = async () => {
  const [profileResult, usersResult] = await Promise.allSettled([
    api('/tenants/profile'),
    api('/users?limit=100'),
  ])
  stages = profileResult.status === 'fulfilled' ? profileResult.value.data?.pipelineStages || [] : []
  users = usersResult.status === 'fulfilled' ? usersResult.value.data || [] : []
  if (!users.length && session.user) users = [session.user]

  fillSelect($('stageSelect'), stages.map((stage) => ({ value: stage.slug, label: stage.name })))
  fillSelect($('assigneeSelect'), [
    { value: '', label: 'Unassigned' },
    ...users.map((user) => ({ value: user._id, label: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email })),
  ])
}

const detectPhone = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url?.startsWith('https://web.whatsapp.com/')) throw new Error('Open an active chat in WhatsApp Web first')
  const result = await chrome.tabs.sendMessage(tab.id, { type: 'SPARKCRM_GET_ACTIVE_CHAT' })
  if (result?.phone) $('phone').value = result.phone
  if (!$('firstName').value && result?.title && !result.title.match(/^\+?[\d\s().-]+$/)) $('firstName').value = result.title.split(/\s+/)[0]
  if (!result?.phone) notify('Phone could not be detected. Enter it manually.', true)
}

const renderLead = (lead) => {
  currentLead = lead
  show('leadCard', Boolean(lead))
  show('createCard', !lead)
  if (!lead) return
  $('leadName').textContent = `${lead.firstName || ''} ${lead.lastName || ''}`.trim()
  $('leadStage').textContent = lead.stage || 'new'
  $('leadContact').textContent = [lead.phone, lead.company].filter(Boolean).join(' · ')
  $('stageSelect').value = lead.stage || ''
  $('assigneeSelect').value = typeof lead.assignedTo === 'object' ? lead.assignedTo?._id || '' : lead.assignedTo || ''
}

const findLead = async () => {
  const phone = normalizePhone($('phone').value)
  if (!phone) throw new Error('Enter a phone number')
  const result = await api(`/leads?search=${encodeURIComponent(phone)}&limit=10`)
  const digits = phone.replace(/\D/g, '')
  const lead = (result.data || []).find((item) => {
    const candidate = String(item.phone || '').replace(/\D/g, '')
    return candidate === digits || candidate.endsWith(digits) || digits.endsWith(candidate)
  })
  renderLead(lead || null)
  if (!lead) notify('No matching lead found. You can create one below.')
}

const login = async () => {
  const apiUrl = normalizeBase($('apiUrl').value || session.apiUrl)
  await requestHostPermission(apiUrl)
  session.apiUrl = apiUrl
  const result = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: $('email').value.trim(), password: $('password').value }),
  })
  session.token = result.data?.tokens?.accessToken
  session.refreshToken = result.data?.tokens?.refreshToken
  session.user = result.data?.user
  session.activeBranchId = session.user?.branchId?._id || session.user?.branchId || result.data?.branches?.find((branch) => branch.isDefault)?._id || ''
  if (!session.token) throw new Error('Login did not return an access token')
  await storageSet(session)
  renderAuth()
  await loadContext()
  await detectPhone().catch(() => {})
}

const createLead = async () => {
  const phone = normalizePhone($('phone').value)
  if (!phone || !$('firstName').value.trim()) throw new Error('First name and phone are required')
  const result = await api('/leads', {
    method: 'POST',
    body: JSON.stringify({
      firstName: $('firstName').value.trim(),
      lastName: $('lastName').value.trim(),
      company: $('company').value.trim(),
      phone,
      source: 'whatsapp',
      sourceDetails: 'WhatsApp Web Extension',
    }),
  })
  renderLead(result.data)
  notify(result.message || 'Lead created')
}

const updateStage = async () => {
  if (!currentLead) return
  const result = await api(`/leads/${currentLead._id}`, { method: 'PUT', body: JSON.stringify({ stage: $('stageSelect').value }) })
  renderLead(result.data)
  notify('Stage updated')
}

const assignLead = async () => {
  if (!currentLead) return
  const result = await api(`/leads/${currentLead._id}/assign`, { method: 'PUT', body: JSON.stringify({ assignedTo: $('assigneeSelect').value || null }) })
  renderLead(result.data)
  notify('Lead assignment updated')
}

const addNote = async () => {
  if (!currentLead || !$('note').value.trim()) return
  await api(`/leads/${currentLead._id}/notes`, { method: 'POST', body: JSON.stringify({ text: $('note').value.trim() }) })
  $('note').value = ''
  notify('Note added')
}

const run = (fn) => async () => {
  try { await fn() } catch (error) { notify(error.message, true) }
}

document.addEventListener('DOMContentLoaded', async () => {
  session = await storageGet(['apiUrl', 'dashboardUrl', 'token', 'refreshToken', 'user', 'activeBranchId'])
  $('apiUrl').value = session.apiUrl || 'http://localhost:5173/api'
  $('dashboardUrl').value = session.dashboardUrl || 'http://localhost:5173'
  renderAuth()
  if (session.token) await loadContext().catch((error) => notify(error.message, true))

  $('settingsToggle').addEventListener('click', () => show('settings', $('settings').classList.contains('hidden')))
  $('saveSettings').addEventListener('click', run(async () => {
    const apiUrl = normalizeBase($('apiUrl').value)
    const dashboardUrl = normalizeBase($('dashboardUrl').value)
    await requestHostPermission(apiUrl)
    session = { ...session, apiUrl, dashboardUrl }
    await storageSet({ apiUrl, dashboardUrl })
    show('settings', false)
    notify('Settings saved')
  }))
  $('loginButton').addEventListener('click', run(login))
  $('detectButton').addEventListener('click', run(detectPhone))
  $('findButton').addEventListener('click', run(findLead))
  $('createButton').addEventListener('click', run(createLead))
  $('stageSelect').addEventListener('change', run(updateStage))
  $('assigneeSelect').addEventListener('change', run(assignLead))
  $('addNoteButton').addEventListener('click', run(addNote))
  $('openLeadButton').addEventListener('click', () => currentLead && chrome.tabs.create({ url: `${normalizeBase(session.dashboardUrl)}/leads/${currentLead._id}` }))
  $('logoutButton').addEventListener('click', run(async () => {
    await storageRemove(['token', 'refreshToken', 'user', 'activeBranchId'])
    session.token = null
    currentLead = null
    renderAuth()
  }))

  if (session.token) await detectPhone().catch(() => {})
})
