export default defineNuxtRouteMiddleware(async (to) => {
  const loginPath = `${useRuntimeConfig().app.baseURL}login`.replace(/\/{2,}/g, '/')
  if (to.path === '/login' || to.path === '/admin/login' || to.path === loginPath) return
  const fetch = useRequestFetch()
  try {
    await fetch('/api/admin/session')
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 401) {
      if (import.meta.client) window.location.assign(`${loginPath}?redirect=${encodeURIComponent(to.fullPath)}`)
      return abortNavigation()
    }
    throw error
  }
})
