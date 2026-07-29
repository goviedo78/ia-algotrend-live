const ALLOWED_REDIRECT_ROOTS = ['/account', '/cuenta', '/admin']

export function getSafeRedirectPath(value: string | undefined, fallback: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback
  }

  const target = new URL(value, 'https://gonovi.local')
  const allowed = ALLOWED_REDIRECT_ROOTS.some(
    (root) => target.pathname === root || target.pathname.startsWith(`${root}/`),
  )

  return allowed ? `${target.pathname}${target.search}` : fallback
}
