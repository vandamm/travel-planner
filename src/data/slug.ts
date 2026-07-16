export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/

export function isValidSlug(value: string): boolean {
  return SLUG_RE.test(value)
}

export function slugFromName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '')
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
