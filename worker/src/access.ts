import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Env } from './liveblocks'

export interface AccessIdentity {
  email: string
}

export class AccessConfigError extends Error {
  constructor() {
    super('Cloudflare Access is not configured')
    this.name = 'AccessConfigError'
  }
}

function teamDomain(env: Env): string {
  const raw = env.ACCESS_TEAM_DOMAIN?.replace(/\/+$/, '')
  if (!raw || !env.ACCESS_AUD) throw new AccessConfigError()
  return raw
}

export async function accessIdentity(request: Request, env: Env): Promise<AccessIdentity | null> {
  if (env.DEV_AUTH_EMAIL) return { email: env.DEV_AUTH_EMAIL }

  const token = request.headers.get('cf-access-jwt-assertion')
  if (!token) return null

  const issuer = teamDomain(env)
  const JWKS = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`))
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer,
      audience: env.ACCESS_AUD,
    })
    return typeof payload.email === 'string' ? { email: payload.email } : null
  } catch {
    return null
  }
}
