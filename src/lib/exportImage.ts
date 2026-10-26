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
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `${filename.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'grid'}.png`
  a.click()
}
