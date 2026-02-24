require('dotenv').config()
require('electron-reload')(__dirname)
const { app, BrowserWindow, ipcMain, dialog, desktopCapturer, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { execFile } = require('child_process')

let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 960,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.setContentProtection(true)
  win.loadFile(path.join(__dirname, 'index.html'))
}

ipcMain.handle('get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 0, height: 0 }
    })
    return sources.map(s => ({ id: s.id, name: s.name }))
  } catch (e) {
    console.error('desktopCapturer error:', e)
    return []
  }
})

ipcMain.handle('pick-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  })
  if (canceled || !filePaths.length) return null
  return filePaths[0]
})

ipcMain.handle('open-folder', async (event, folder) => {
  shell.openPath(folder)
})

ipcMain.handle('save-video', async (event, buffer, folder, suffix) => {
  const filename = `recording-${Date.now()}${suffix ? '-' + suffix : ''}.webm`
  const filePath = path.join(folder, filename)
  fs.writeFileSync(filePath, Buffer.from(buffer))
  return filePath
})

ipcMain.handle('render-composite', async (event, opts) => {
  const { screenPath, cameraPath, keyframes, pipSize, screenFitMode, sourceWidth, sourceHeight, outputFolder } = opts
  const ffmpegPath = require('ffmpeg-static')
  const outputPath = path.join(outputFolder, `recording-${Date.now()}-edited.mp4`)

  // Canvas coordinates are 1920x1080; scale to source video resolution
  const canvasW = 1920
  const canvasH = 1080

  let args = ['-i', screenPath]

  if (cameraPath && keyframes && keyframes.some(kf => kf.pipVisible || kf.cameraFullscreen)) {
    args.push('-i', cameraPath)
    const filterComplex = buildFilterComplex(keyframes, pipSize, screenFitMode, sourceWidth, sourceHeight, canvasW, canvasH)
    args.push('-filter_complex', filterComplex, '-map', '[out]', '-map', '0:a?')
  } else {
    args.push('-map', '0:v', '-map', '0:a?')
  }

  args.push(
    '-c:v', 'libx264', '-crf', '12', '-preset', 'slow',
    '-c:a', 'aac', '-b:a', '192k',
    '-y', outputPath
  )

  console.log('ffmpeg args:', args.join(' '))

  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error('ffmpeg stderr:', stderr)
        reject(stderr || error.message)
      } else {
        resolve(outputPath)
      }
    })
  })
})

function buildFilterComplex(keyframes, pipSize, screenFitMode, sourceWidth, sourceHeight, canvasW, canvasH) {
  // Output at 16:9 based on source width, matching the canvas aspect ratio
  let outW = sourceWidth % 2 === 0 ? sourceWidth : sourceWidth - 1
  let outH = Math.round(outW * 9 / 16)
  if (outH % 2 !== 0) outH--

  // Scale from canvas coords (1920x1080) to output resolution (both 16:9, so uniform scale)
  const scale = outW / canvasW
  const actualPipSize = Math.round(pipSize * scale)
  const r = Math.round(12 * scale)
  const maxCoord = actualPipSize - 1 - r
  const rSq = r * r

  // Scale keyframe positions
  const scaledKeyframes = keyframes.map(kf => ({
    ...kf,
    pipX: Math.round(kf.pipX * scale),
    pipY: Math.round(kf.pipY * scale)
  }))

  // Screen: fit or fill into 16:9 output frame
  let screenFilter
  if (screenFitMode === 'fill') {
    screenFilter = `[0:v]scale=${outW}:${outH}:force_original_aspect_ratio=increase,crop=${outW}:${outH}[screen]`
  } else {
    screenFilter = `[0:v]scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:'(ow-iw)/2':'(oh-ih)/2':color=black[screen]`
  }

  const hasPip = keyframes.some(kf => kf.pipVisible)
  const hasCamFull = keyframes.some(kf => kf.cameraFullscreen)

  if (hasPip && hasCamFull) {
    // Both PiP and fullscreen: split camera input
    const alphaExpr = buildAlphaExpr(keyframes)
    const roundCorner = `lte(pow(max(0,max(${r}-X,X-${maxCoord})),2)+pow(max(0,max(${r}-Y,Y-${maxCoord})),2),${rSq})`
    const camPipFilter = `[cam1]setpts=PTS-STARTPTS,crop='min(iw,ih)':'min(iw,ih)':'(iw-min(iw,ih))/2':'(ih-min(iw,ih))/2',scale=${actualPipSize}:${actualPipSize},format=yuva420p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='255*${roundCorner}*(${alphaExpr})'[cam]`

    const camFullAlpha = buildCamFullAlphaExpr(keyframes)
    const camFullFilter = `[cam2]setpts=PTS-STARTPTS,scale=${outW}:${outH}:force_original_aspect_ratio=increase,crop=${outW}:${outH},format=yuva420p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='255*(${camFullAlpha})'[camfull]`

    const xExpr = buildPosExpr(scaledKeyframes, 'pipX')
    const yExpr = buildPosExpr(scaledKeyframes, 'pipY')

    return `${screenFilter};[1:v]split[cam1][cam2];${camPipFilter};${camFullFilter};[screen][cam]overlay=x='${xExpr}':y='${yExpr}':format=auto[with_pip];[with_pip][camfull]overlay=0:0:format=auto[out]`
  } else if (hasCamFull) {
    // Only fullscreen camera
    const camFullAlpha = buildCamFullAlphaExpr(keyframes)
    const camFullFilter = `[1:v]setpts=PTS-STARTPTS,scale=${outW}:${outH}:force_original_aspect_ratio=increase,crop=${outW}:${outH},format=yuva420p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='255*(${camFullAlpha})'[camfull]`

    return `${screenFilter};${camFullFilter};[screen][camfull]overlay=0:0:format=auto[out]`
  } else {
    // Only PiP (existing behavior)
    const alphaExpr = buildAlphaExpr(keyframes)
    const roundCorner = `lte(pow(max(0,max(${r}-X,X-${maxCoord})),2)+pow(max(0,max(${r}-Y,Y-${maxCoord})),2),${rSq})`
    const camFilter = `[1:v]setpts=PTS-STARTPTS,crop='min(iw,ih)':'min(iw,ih)':'(iw-min(iw,ih))/2':'(ih-min(iw,ih))/2',scale=${actualPipSize}:${actualPipSize},format=yuva420p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='255*${roundCorner}*(${alphaExpr})'[cam]`

    const xExpr = buildPosExpr(scaledKeyframes, 'pipX')
    const yExpr = buildPosExpr(scaledKeyframes, 'pipY')

    return `${screenFilter};${camFilter};[screen][cam]overlay=x='${xExpr}':y='${yExpr}':format=auto[out]`
  }
}

const TRANSITION_DURATION = 0.3

function buildPosExpr(keyframes, prop) {
  if (keyframes.length === 1) return String(Math.round(keyframes[0][prop]))
  let expr = String(Math.round(keyframes[0][prop]))
  for (let i = 1; i < keyframes.length; i++) {
    const prevVal = Math.round(keyframes[i - 1][prop])
    const currVal = Math.round(keyframes[i][prop])
    const t = keyframes[i].time
    const tStart = Math.max(keyframes[i - 1].time, t - TRANSITION_DURATION)
    const dur = t - tStart

    if (prevVal !== currVal && dur > 0) {
      const diff = currVal - prevVal
      expr = `if(gte(t,${t.toFixed(3)}),${currVal},if(gte(t,${tStart.toFixed(3)}),${prevVal}+${diff}*(t-${tStart.toFixed(3)})/${dur.toFixed(3)},${expr}))`
    } else {
      expr = `if(gte(t,${t.toFixed(3)}),${currVal},${expr})`
    }
  }
  return expr
}

function buildAlphaExpr(keyframes) {
  if (keyframes.length === 1) return keyframes[0].pipVisible ? '1' : '0'
  let expr = keyframes[0].pipVisible ? '1' : '0'
  for (let i = 1; i < keyframes.length; i++) {
    const prev = keyframes[i - 1]
    const curr = keyframes[i]
    const t = curr.time
    const tEnd = t + TRANSITION_DURATION

    if (prev.pipVisible !== curr.pipVisible) {
      if (curr.pipVisible) {
        // Fade in: 0 -> 1
        expr = `if(gte(T,${tEnd.toFixed(3)}),1,if(gte(T,${t.toFixed(3)}),(T-${t.toFixed(3)})/${TRANSITION_DURATION.toFixed(3)},${expr}))`
      } else {
        // Fade out: 1 -> 0
        expr = `if(gte(T,${tEnd.toFixed(3)}),0,if(gte(T,${t.toFixed(3)}),(${tEnd.toFixed(3)}-T)/${TRANSITION_DURATION.toFixed(3)},${expr}))`
      }
    } else {
      expr = `if(gte(T,${t.toFixed(3)}),${curr.pipVisible ? '1' : '0'},${expr})`
    }
  }
  return expr
}

function buildCamFullAlphaExpr(keyframes) {
  if (keyframes.length === 1) return keyframes[0].cameraFullscreen ? '1' : '0'
  let expr = keyframes[0].cameraFullscreen ? '1' : '0'
  for (let i = 1; i < keyframes.length; i++) {
    const prev = keyframes[i - 1]
    const curr = keyframes[i]
    const t = curr.time
    const tEnd = t + TRANSITION_DURATION
    const prevFull = prev.cameraFullscreen || false
    const currFull = curr.cameraFullscreen || false

    if (prevFull !== currFull) {
      if (currFull) {
        // Fade in: 0 -> 1
        expr = `if(gte(T,${tEnd.toFixed(3)}),1,if(gte(T,${t.toFixed(3)}),(T-${t.toFixed(3)})/${TRANSITION_DURATION.toFixed(3)},${expr}))`
      } else {
        // Fade out: 1 -> 0
        expr = `if(gte(T,${tEnd.toFixed(3)}),0,if(gte(T,${t.toFixed(3)}),(${tEnd.toFixed(3)}-T)/${TRANSITION_DURATION.toFixed(3)},${expr}))`
      }
    } else {
      expr = `if(gte(T,${t.toFixed(3)}),${currFull ? '1' : '0'},${expr})`
    }
  }
  return expr
}

// ===== Scribe Token Generation =====

ipcMain.handle('get-scribe-token', async () => {
  try {
    const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js')
    const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })
    const response = await client.tokens.singleUse.create('realtime_scribe')
    return response.token
  } catch (err) {
    console.error('Failed to get Scribe token:', err)
    throw err
  }
})

// ===== Trim Silence =====

ipcMain.handle('trim-silence', async (event, opts) => {
  const { screenPath, cameraPath, segments, outputFolder } = opts
  const ffmpegPath = require('ffmpeg-static')
  const PADDING = 0.15 // 150ms padding

  // Add padding and merge overlapping segments
  let padded = segments.map(s => ({
    start: Math.max(0, s.start - PADDING),
    end: s.end + PADDING
  }))

  // Sort by start time
  padded.sort((a, b) => a.start - b.start)

  // Merge overlapping/adjacent segments
  const merged = [padded[0]]
  for (let i = 1; i < padded.length; i++) {
    const last = merged[merged.length - 1]
    if (padded[i].start <= last.end) {
      last.end = Math.max(last.end, padded[i].end)
    } else {
      merged.push(padded[i])
    }
  }

  function buildTrimFilter(merged) {
    const parts = []
    const labels = []

    for (let i = 0; i < merged.length; i++) {
      const s = merged[i].start.toFixed(3)
      const e = merged[i].end.toFixed(3)
      parts.push(`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`)
      parts.push(`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}]`)
      labels.push(`[v${i}][a${i}]`)
    }

    parts.push(`${labels.join('')}concat=n=${merged.length}:v=1:a=1[outv][outa]`)
    return parts.join(';')
  }

  function trimFile(inputPath) {
    const ext = path.extname(inputPath)
    const base = path.basename(inputPath, ext)
    const outputPath = path.join(outputFolder, `${base}-trimmed${ext}`)
    const filter = buildTrimFilter(merged)

    const args = [
      '-i', inputPath,
      '-filter_complex', filter,
      '-map', '[outv]', '-map', '[outa]',
      '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0',
      '-c:a', 'libopus',
      '-y', outputPath
    ]

    return new Promise((resolve, reject) => {
      execFile(ffmpegPath, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          console.error('FFmpeg trim stderr:', stderr)
          reject(stderr || error.message)
        } else {
          resolve(outputPath)
        }
      })
    })
  }

  const results = {}

  // Run in parallel for screen and camera
  const promises = []
  if (screenPath) {
    promises.push(trimFile(screenPath).then(p => { results.screenPath = p }))
  }
  if (cameraPath) {
    promises.push(trimFile(cameraPath).then(p => { results.cameraPath = p }))
  }

  await Promise.all(promises)
  return results
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
