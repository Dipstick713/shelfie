import { toPng } from 'html-to-image'

export async function downloadPng(node: HTMLElement, filename: string) {
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    // leave editor-only chrome (add/remove buttons) out of the image
    filter: (n) => !(n instanceof HTMLElement && (n.classList.contains('plus') || n.classList.contains('cell-remove'))),
    // keeps a broken/blocked image from failing the whole export
    imagePlaceholder:
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  })
  const name = `${filename.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'grid'}.png`
  if (await shareOnTouch(dataUrl, name)) return
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = name
  a.click()
}

/** On phones, hand the PNG to the share sheet ("Save Image" → Photos). Returns false to fall back to a download. */
async function shareOnTouch(dataUrl: string, name: string): Promise<boolean> {
  if (!window.matchMedia('(pointer: coarse)').matches || !navigator.canShare) return false
  const blob = await (await fetch(dataUrl)).blob()
  const file = new File([blob], name, { type: 'image/png' })
  if (!navigator.canShare({ files: [file] })) return false
  try {
    await navigator.share({ files: [file] })
    return true
  } catch (e) {
    // the user closing the sheet is fine; anything else (e.g. expired user gesture) falls back to download
    return e instanceof DOMException && e.name === 'AbortError'
  }
}
