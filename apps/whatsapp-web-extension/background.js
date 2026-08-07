chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['apiUrl', 'dashboardUrl'], (stored) => {
    const defaults = {}
    if (!stored.apiUrl) defaults.apiUrl = 'http://localhost:5173/api'
    if (!stored.dashboardUrl) defaults.dashboardUrl = 'http://localhost:5173'
    if (Object.keys(defaults).length) chrome.storage.local.set(defaults)
  })
})
