import { writeFile, mkdir } from 'node:fs/promises'
const targets = await fetch('http://127.0.0.1:9223/json').then(r => r.json())
const ws = new WebSocket(targets[0].webSocketDebuggerUrl)
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }))
let id = 0
const pending = new Map()
ws.addEventListener('message', event => {
  const data = JSON.parse(event.data)
  if (data.id) {
    const p = pending.get(data.id)
    pending.delete(data.id)
    data.error ? p.reject(data.error) : p.resolve(data.result)
  }
})
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const key = ++id
    pending.set(key, { resolve, reject })
    ws.send(JSON.stringify({ id: key, method, params }))
  })
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
await call('Page.enable')
await call('Runtime.enable')
const categories = [
  { id: 'tools', name: '效率工具', slug: 'tools', description: '让日常工作更顺手。', parent_id: null, sort_order: 1, site_count: 3 },
  { id: 'design', name: '设计灵感', slug: 'design', description: '', parent_id: null, sort_order: 2, site_count: 3 }
]
const sites = ['Notion', 'Figma', 'GitHub', 'Are.na', 'Readwise', 'Unsplash'].map((title, index) => ({
  id: String(index),
  title,
  slug: title.toLowerCase(),
  target_url: `https://${title.toLowerCase()}.com`,
  description: [
    '把笔记、项目和想法整理在一起。',
    '从一个想法到可以协作的设计。',
    '发现开源项目，与开发者一起创造。',
    '收集图像、文字和有意思的关联。',
    '重新遇见读过的好内容。',
    '为下一个项目找到合适的照片。'
  ][index],
  category_ids: [index % 2 ? 'design' : 'tools']
}))
await call('Fetch.enable', { patterns: [{ urlPattern: '*/api/public/sites*' }, { urlPattern: '*/api/public/categories*' }] })
ws.addEventListener('message', event => {
  const data = JSON.parse(event.data)
  if (data.method === 'Fetch.requestPaused') {
    const value = data.params.request.url.includes('/categories') ? { categories } : { sites }
    call('Fetch.fulfillRequest', {
      requestId: data.params.requestId,
      responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      body: Buffer.from(JSON.stringify(value)).toString('base64')
    })
  }
})
await mkdir('artifacts', { recursive: true })
const results = []
for (const [width, height] of [
  [1440, 1000],
  [768, 1024],
  [375, 812],
  [812, 375]
]) {
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await call('Page.navigate', { url: 'http://127.0.0.1:3000' })
  await evaluate(
    `new Promise(resolve => { const check = () => document.querySelector('#__nuxt')?.__vue_app__ ? resolve(true) : setTimeout(check, 100); check(); setTimeout(() => resolve(false), 10000) })`
  )
  await evaluate(
    `Promise.all(Object.values(document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt._asyncData).map(item => item.execute()))`
  )
  await evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`)
  const layout = await evaluate(
    `({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, cards: document.querySelectorAll('.site-card').length, title: document.querySelector('h1')?.textContent, background: getComputedStyle(document.body).backgroundColor })`
  )
  if (layout.scrollWidth > width) throw Error('Horizontal overflow: ' + JSON.stringify(layout))
  await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }).then(r =>
    writeFile(`artifacts/home-${width}.png`, Buffer.from(r.data, 'base64'))
  )
  results.push(layout)
}
await evaluate(`document.querySelectorAll('.category-filter')[1]?.click()`)
await evaluate(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`)
results.push(
  await evaluate(
    `({ selectedCategory: document.querySelector('.directory-title h2')?.textContent, pressed: document.querySelectorAll('.category-filter[aria-pressed="true"]').length })`
  )
)
await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'k', code: 'KeyK', modifiers: 4 })
results.push(await evaluate(`({ shortcutFocus: document.activeElement?.id })`))
await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'k', code: 'KeyK', modifiers: 4 })
await evaluate(`document.documentElement.dataset.theme = 'dark'`)
await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
await call('Page.captureScreenshot', { format: 'png' }).then(r => writeFile('artifacts/home-dark.png', Buffer.from(r.data, 'base64')))
await call('Page.navigate', { url: 'http://127.0.0.1:3000/search?q=Nuxt' })
await evaluate(
  `new Promise(r => { const check = () => document.querySelector('h1') ? r(true) : setTimeout(check, 100); check(); setTimeout(() => r(false), 10000) })`
)
results.push(await evaluate(`({ searchUrl: location.pathname + location.search, title: document.querySelector('h1')?.textContent })`))
console.log(JSON.stringify(results, null, 2))
ws.close()
