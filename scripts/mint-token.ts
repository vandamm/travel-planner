// Local capability-token mint CLI — the ONLY place a token is minted outside the
// Worker. Bootstraps genesis (room #0) and any manual link. Signing uses the same
// `signToken` (HMAC-SHA256) the Worker uses, so a minted token verifies with
// `verifyToken`. TOKEN_SECRET comes from the environment or worker/.dev.vars —
// never hardcoded, never committed.
//
// Run (Node 22 has no bare-node loader for the extensionless worker imports):
//   npx tsx scripts/mint-token.ts <roomId> [view|edit|owner] [name]
// Prints the token; paste it as the link fragment: https://<app>/#<token>

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { signToken } from '../worker/src/token'
import type { Perm, TokenPayload } from '../src/data/token'

export interface MintOpts {
  roomId: string
  perm?: Perm
  name?: string
}

/** Sign a capability token for a room. Mirrors the Worker's mint so it verifies. */
export async function mintToken({ roomId, perm = 'owner', name }: MintOpts, secret: string): Promise<string> {
  if (!roomId) throw new Error('roomId is required')
  if (!secret) throw new Error('TOKEN_SECRET is required')
  // The CLI casts an untyped argv string to Perm, so validate here (the root
  // callsite) — an unknown perm would sign a payload that verifyToken rejects,
  // handing out a dead link with no feedback at mint time.
  if (!(['view', 'edit', 'owner'] as string[]).includes(perm)) {
    throw new Error(`invalid perm "${perm}" (expected view|edit|owner)`)
  }
  const payload: TokenPayload = { r: roomId, p: perm, v: 1, ...(name ? { n: name } : {}) }
  return signToken(payload, secret)
}

/** Pull a single `KEY=value` out of a `.dev.vars`/dotenv-style file body. */
export function parseDevVar(text: string, key: string): string | undefined {
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    if (trimmed.slice(0, eq).trim() !== key) continue
    const val = trimmed.slice(eq + 1).trim()
    // Match wrangler/dotenv: strip one pair of matching surrounding quotes, so a
    // quoted `TOKEN_SECRET="a b c"` signs with the same value the Worker verifies.
    if (val.length >= 2 && (val[0] === '"' || val[0] === "'") && val[val.length - 1] === val[0]) {
      return val.slice(1, -1)
    }
    return val
  }
  return undefined
}

function readSecret(): string {
  const fromEnv = process.env.TOKEN_SECRET
  if (fromEnv) return fromEnv
  try {
    const text = readFileSync(new URL('../worker/.dev.vars', import.meta.url), 'utf8')
    const fromFile = parseDevVar(text, 'TOKEN_SECRET')
    if (fromFile) return fromFile
  } catch {
    // no .dev.vars — fall through to the error below
  }
  throw new Error('TOKEN_SECRET not set (export it or add it to worker/.dev.vars)')
}

async function main(): Promise<void> {
  const [roomId, perm, name] = process.argv.slice(2)
  if (!roomId) {
    console.error('usage: mint-token <roomId> [view|edit|owner] [name]')
    process.exit(1)
  }
  const token = await mintToken({ roomId, perm: perm as Perm | undefined, name }, readSecret())
  console.log(token)
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
