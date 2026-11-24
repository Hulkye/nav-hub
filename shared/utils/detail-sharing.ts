export async function shareDetail(
  payload: { title: string; url: string },
  browser: { share?: (data: { title: string; url: string }) => Promise<void>; copy: (text: string) => Promise<void> }
): Promise<'shared' | 'copied' | 'cancelled'> {
  if (browser.share) {
    try { await browser.share(payload); return 'shared' }
    catch (error) { if (error instanceof Error && error.name === 'AbortError') return 'cancelled' }
  }
  await browser.copy(payload.url)
  return 'copied'
}
