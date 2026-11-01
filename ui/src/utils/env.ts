const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()

/** `?debug` exposes stores on window and shows the debug toolbar. */
export const DEBUG = params.has('debug')
/** `?turbo` removes animation and bot delays (used by automated soak tests). */
export const TURBO = params.has('turbo')
