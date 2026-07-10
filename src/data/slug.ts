export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/

export function isValidSlug(value: string): boolean {
  return SLUG_RE.test(value)
}

export function slugFromPath(pathname: string): string | null {
  const slug = pathname.replace(/^\/+|\/+$/g, '')
  if (!slug || slug.includes('/')) return null
  try {
    const decoded = decodeURIComponent(slug)
    return isValidSlug(decoded) ? decoded : null
  } catch {
    return null
  }
}
