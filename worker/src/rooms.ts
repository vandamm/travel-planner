// GET/POST /api/rooms — list calendar summaries or create a slug room.
// Cloudflare Access gates both operations before these handlers run.

import * as Y from 'yjs'
import type { Env, LiveblocksApi } from './liveblocks'
import { isValidSlug } from '../../src/data/slug'
import { getTrip } from '../../src/data/doc'
import { setTrip } from '../../src/data/doc'
import { TRIP_COLORS } from '../../src/features/home/yearCalendar'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

interface CreateRoomBody {
  room?: unknown
  startDate?: unknown
  color?: unknown
}

function randomTripColor(): string {
  return TRIP_COLORS[Math.floor(Math.random() * TRIP_COLORS.length)]
}

export async function handleListRooms(request: Request, api: LiveblocksApi): Promise<Response> {
  const cursor = new URL(request.url).searchParams.get('cursor') || undefined
  const { rooms, nextCursor } = await api.listRooms(cursor)
  const settled = await Promise.allSettled(
    rooms
      .filter(({ id }) => isValidSlug(id))
      .map(async ({ id, createdAt }) => {
        const doc = new Y.Doc()
        const update = await api.getYUpdate(id)
        if (update.byteLength) Y.applyUpdate(doc, update)
        const trip = getTrip(doc)
        if (!trip.color) {
          setTrip(doc, { color: randomTripColor() })
          await api.sendYUpdate(id, Y.encodeStateAsUpdate(doc))
        }
        return { id, createdAt, ...getTrip(doc) }
      }),
  )
  const trips = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
  return json({ trips, nextCursor })
}

export async function handleCreateRoom(
  request: Request,
  _env: Env,
  api: LiveblocksApi,
): Promise<Response> {
  let body: CreateRoomBody = {}
  try {
    const text = await request.text()
    if (text) body = JSON.parse(text) as CreateRoomBody
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  const requested = typeof body.room === 'string' ? body.room.trim() : ''
  if (!isValidSlug(requested)) return json({ error: 'invalid room' }, 400)
  const roomId = requested

  if (await api.roomExists(roomId)) {
    return json({ error: 'room already exists' }, 409)
  }

  const created = await api.createRoom(roomId)
  const doc = new Y.Doc()
  setTrip(doc, {
    color: typeof body.color === 'string' && body.color ? body.color : randomTripColor(),
    ...(typeof body.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate)
      ? { startDate: body.startDate, endDate: body.startDate }
      : {}),
  })
  await api.sendYUpdate(created.id, Y.encodeStateAsUpdate(doc))
  return json({ id: created.id }, 201)
}
