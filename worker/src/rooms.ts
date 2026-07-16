// GET/POST /api/rooms — list calendar summaries or create a slug room.
// Cloudflare Access gates both operations before these handlers run.

import * as Y from 'yjs'
import type { Env, LiveblocksApi } from './liveblocks'
import { isValidSlug } from '../../src/data/slug'
import { getTrip } from '../../src/data/doc'
import { setTrip } from '../../src/data/doc'
import { tripSettingsSchema } from '../../src/data/tripSchema'
import { TRIP_COLORS } from '../../src/features/home/yearCalendar'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

interface CreateRoomBody {
  room?: unknown
  title?: unknown
  startDate?: unknown
  endDate?: unknown
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
  let body: unknown = {}
  try {
    const text = await request.text()
    if (text) body = JSON.parse(text) as unknown
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'invalid JSON body' }, 400)
  }
  const input = body as CreateRoomBody

  const requested = typeof input.room === 'string' ? input.room.trim() : ''
  if (!isValidSlug(requested)) return json({ error: 'invalid room' }, 400)
  const roomId = requested
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const parsedTrip = tripSettingsSchema.safeParse({
    title,
    startDate: input.startDate,
    endDate: input.endDate,
    color: typeof input.color === 'string' && input.color ? input.color : randomTripColor(),
  })
  if (
    !title ||
    !parsedTrip.success ||
    !parsedTrip.data.startDate ||
    !parsedTrip.data.endDate
  ) {
    return json({ error: 'invalid trip' }, 400)
  }

  if (await api.roomExists(roomId)) {
    return json({ error: 'room already exists' }, 409)
  }

  const created = await api.createRoom(roomId)
  const doc = new Y.Doc()
  setTrip(doc, {
    title: parsedTrip.data.title,
    startDate: parsedTrip.data.startDate,
    endDate: parsedTrip.data.endDate,
    color: parsedTrip.data.color,
  })
  await api.sendYUpdate(created.id, Y.encodeStateAsUpdate(doc))
  return json({ id: created.id }, 201)
}
