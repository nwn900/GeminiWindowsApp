const path = require('path')
const { app, BrowserWindow, Menu, Tray, shell } = require('electron')

const GEMINI_URL = 'https://gemini.google.com/app'
const IN_APP_HOST_SUFFIXES = [
  'gemini.google.com',
  'google.com',
  'googleusercontent.com',
  'accounts.google.com',
  'gstatic.com'
]
const STARTUP_ARG = '--launch-at-startup'
const SUPPORTS_LOGIN_ITEM_SETTINGS = ['darwin', 'win32'].includes(process.platform)
const UNRESPONSIVE_RESTART_DELAY_MS = 8000

let mainWindow = null
let tray = null
let isQuitting = false
let isRecoveringWindow = false
let lastMainWindowUrl = GEMINI_URL
let windowRecoveryTimer = null

if (typeof app.userAgentFallback === 'string') {
  app.userAgentFallback = app.userAgentFallback.replace(/\sElectron\/[^\s]+/, '')
}

if (process.platform === 'win32') {
  app.disableHardwareAcceleration()
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
}

function isMatchingHost(hostname, suffix) {
  return hostname === suffix || hostname.endsWith(`.${suffix}`)
}

function getLoginItemArgs() {
  if (!process.defaultApp) {
    return [STARTUP_ARG]
  }

  return [app.getAppPath(), STARTUP_ARG]
}

function getLoginItemSettingsQuery() {
  return {
    path: process.execPath,
    args: getLoginItemArgs()
  }
}

function getLoginItemOptions(openAtLogin) {
  return {
    openAtLogin,
    ...getLoginItemSettingsQuery()
  }
}

function opensAtLogin() {
  if (!SUPPORTS_LOGIN_ITEM_SETTINGS) {
    return false
  }

  return app.getLoginItemSettings(getLoginItemSettingsQuery()).openAtLogin
}

function createStartupMenuItem() {
  return {
    label: 'Launch at system startup',
    type: 'checkbox',
    checked: opensAtLogin(),
    enabled: SUPPORTS_LOGIN_ITEM_SETTINGS,
    click: (menuItem) => {
      if (!SUPPORTS_LOGIN_ITEM_SETTINGS) {
        return
      }

      app.setLoginItemSettings(getLoginItemOptions(menuItem.checked))
      refreshMenus()
    }
  }
}

function refreshMenus() {
  if (tray) {
    tray.setContextMenu(Menu.buildFromTemplate([
      {
        label: 'Open Gemini',
        click: showMainWindow
      },
      createStartupMenuItem(),
      { type: 'separator' },
      {
        label: 'Close Gemini',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ]))
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Gemini',
      submenu: [
        {
          label: 'Open Gemini',
          click: showMainWindow
        },
        createStartupMenuItem(),
        { type: 'separator' },
        {
          label: 'Close Gemini',
          click: () => {
            isQuitting = true
            app.quit()
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open gemini.google.com',
          click: () => {
            openExternal(GEMINI_URL)
          }
        }
      ]
    }
  ]))
}

function clearWindowRecoveryTimer() {
  if (!windowRecoveryTimer) {
    return
  }

  clearTimeout(windowRecoveryTimer)
  windowRecoveryTimer = null
}

function rememberMainWindowUrl(urlString) {
  if (!shouldStayInApp(urlString)) {
    return
  }

  lastMainWindowUrl = urlString
}

function recoverMainWindow(reason) {
  if (isQuitting || isRecoveringWindow || !mainWindow || mainWindow.isDestroyed()) {
    return
  }

  const currentWindow = mainWindow
  const bounds = currentWindow.getBounds()
  const shouldShowWindow = currentWindow.isVisible() || currentWindow.isFocused()

  isRecoveringWindow = true
  clearWindowRecoveryTimer()
  console.warn(`Gemini window became unresponsive (${reason}); recreating it.`)

  currentWindow.removeAllListeners('unresponsive')
  currentWindow.removeAllListeners('responsive')
  currentWindow.webContents.removeAllListeners('render-process-gone')
  currentWindow.destroy()

  createWindow({
    bounds,
    show: shouldShowWindow,
    url: lastMainWindowUrl
  })

  if (shouldShowWindow) {
    showMainWindow()
  }

  isRecoveringWindow = false
}

function scheduleMainWindowRecovery(reason) {
  if (isQuitting || isRecoveringWindow || windowRecoveryTimer || !mainWindow || mainWindow.isDestroyed()) {
    return
  }

  windowRecoveryTimer = setTimeout(() => {
    windowRecoveryTimer = null

recoverMainWindow(reason)
  }, UNRESPONSIVE_RESTART_DELAY_MS)
}

function shouldStayInApp(urlString) {
  if (urlString === 'about:blank') {
    return true
  }

  try {
    const url = new URL(urlString)

    if (!['http:', 'https:'].includes(url.protocol)) {
      return false
    }

    return IN_APP_HOST_SUFFIXES.some((suffix) => isMatchingHost(url.hostname, suffix))
  } catch {
    return false
  }
}

function openExternal(urlString) {
  if (!urlString) {
    return
  }

  shell.openExternal(urlString)
}

function configureWindow(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldStayInApp(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          width: 520,
          height: 760,
          parent: win
        }
      }
    }

    openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (shouldStayInApp(url)) {
      return
    }

    event.preventDefault()
    openExternal(url)
  })

  win.webContents.on('did-create-window', (childWindow) => {
    childWindow.setMenuBarVisibility(false)
    configureWindow(childWindow)
  })
}

function configureMainWindow(win) {
  win.on('unresponsive', () => {
    scheduleMainWindowRecovery('window-unresponsive')
  })

  win.on('responsive', () => {
    clearWindowRecoveryTimer()
  })

  win.webContents.on('did-navigate', (_, url) => {
    rememberMainWindowUrl(url)
  })

  win.webContents.on('did-navigate-in-page', (_, url) => {
    rememberMainWindowUrl(url)
  })

  win.webContents.on('render-process-gone', (_, details) => {
    recoverMainWindow(details.reason)
  })
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow()
    return
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show()
  }

  mainWindow.focus()
}

function hideToTray(win) {
  if (!win || win.isDestroyed()) {
    return
  }

  win.hide()
}

function createTray() {
  if (tray) {
    return
  }

  tray = new Tray(path.join(__dirname, 'icon.ico'))
  tray.setToolTip('Gemini')
  refreshMenus()
  tray.on('click', showMainWindow)
  tray.on('double-click', showMainWindow)
}

function createWindow(options = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    ...(options.bounds ?? {}),
    show: options.show ?? true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow = win
  configureWindow(win)
  configureMainWindow(win)
  rememberMainWindowUrl(options.url ?? lastMainWindowUrl)
  win.loadURL(options.url ?? lastMainWindowUrl)

  win.on('minimize', (event) => {
    event.preventDefault()
    hideToTray(win)
  })

  win.on('close', (event) => {
    if (isQuitting) {
      return
    }

    event.preventDefault()
    hideToTray(win)
  })

  win.on('closed', () => {
    clearWindowRecoveryTimer()
    if (mainWindow === win) {
      mainWindow = null
    }
  })

  return win
}

if (gotSingleInstanceLock) {
  app.on('second-instance', () => {
    showMainWindow()
  })

  app.whenReady().then(() => {
    createTray()
    refreshMenus()

    if (!process.argv.includes(STARTUP_ARG)) {
      createWindow()
    }
  })
}

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {})

app.on('activate', () => {
  showMainWindow()
})
