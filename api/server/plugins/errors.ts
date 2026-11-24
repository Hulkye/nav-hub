export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('error', (error, { event }) => {
    console.error('[server]', { method: event?.method, path: event?.path.split('?')[0], errorType: error.name })
  })
})
