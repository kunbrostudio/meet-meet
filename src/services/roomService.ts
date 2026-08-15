import { STORAGE_KEYS } from '../constants/storageKeys'
import type { GameParticipantStatus, GameStateSnapshot } from '../types/game'
import type { Room } from '../types'
import { apiUrl } from './apiClient'

const ROOM_CODE_PATTERN = /^MMT-[A-Z0-9]{6}$/
const ROOM_CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateMeetingId(): string {
  return crypto.randomUUID?.()
    ?? `meeting-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function generateRoomCode(): string {
  const suffix = Array.from(
    { length: 6 },
    () => ROOM_CODE_CHARACTERS[
      Math.floor(Math.random() * ROOM_CODE_CHARACTERS.length)
    ],
  ).join('')

  return `MMT-${suffix}`
}

export function saveCurrentRoom(room: Room): void {
  localStorage.setItem(STORAGE_KEYS.currentRoom, JSON.stringify(room))
}

export function loadCurrentRoom(): Room | null {
  try {
    const storedRoom = localStorage.getItem(STORAGE_KEYS.currentRoom)
    return storedRoom ? JSON.parse(storedRoom) as Room : null
  } catch (error) {
    console.error('[room-service] Failed to load current room', error)
    return null
  }
}

export function clearCurrentRoom(): void {
  localStorage.removeItem(STORAGE_KEYS.currentRoom)
}

export function createInviteLink(roomCode: string): string {
  const inviteUrl = new URL('/', window.location.origin)
  inviteUrl.searchParams.set('room', roomCode.trim().toUpperCase())
  return inviteUrl.toString()
}

export function parseRoomCodeFromUrl(): string | null {
  const roomCode = new URLSearchParams(window.location.search).get('room')
    ?.trim()
    .toUpperCase()

  return roomCode || null
}

export function normalizeRoomCode(roomCode: string): string | null {
  const normalizedCode = roomCode.trim().toUpperCase()
  return ROOM_CODE_PATTERN.test(normalizedCode) ? normalizedCode : null
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    return copied
  } catch (error) {
    console.error('[room-service] Failed to copy text', error)
    return false
  }
}

export function createRoom(): Room {
  const room: Room = {
    meetingId: generateMeetingId(),
    roomCode: generateRoomCode(),
    title: 'MEET MEET Room',
    createdAt: new Date().toISOString(),
    meetingRole: 'host',
  }

  saveCurrentRoom(room)
  return room
}

export function joinRoomByCode(roomCode: string): Room | null {
  const normalizedCode = normalizeRoomCode(roomCode)

  if (!normalizedCode) {
    return null
  }

  const room: Room = {
    meetingId: generateMeetingId(),
    roomCode: normalizedCode,
    title: 'MEET MEET Room',
    createdAt: new Date().toISOString(),
    meetingRole: 'participant',
  }

  saveCurrentRoom(room)
  return room
}

type FreeBetaRoomResponse = {
  ok?: boolean
  room?: {
    meetingId: string
    roomCode: string
    title: string
    createdAt: string
    meetingRole: 'host' | 'participant'
    participantIdentity?: string
    hostParticipantIdentity?: string
    hostControlToken?: string
    expiresAt?: string
    maxParticipants?: number
    participants?: GameParticipantStatus[]
    gameState?: GameStateSnapshot
  }
  error?: {
    code?: string
    message?: string
  }
  message?: string
  reason?: string
}

function getFreeBetaErrorMessage(
  response: FreeBetaRoomResponse,
  fallback: string,
): string {
  return response.error?.message
    ?? response.message
    ?? response.reason
    ?? fallback
}

function logRoomCreateResponse(
  status: number,
  response: FreeBetaRoomResponse,
) {
  if (!import.meta.env.DEV) {
    return
  }

  console.info('[room-create] response', {
    status,
    code: response.error?.code ?? null,
    message:
      response.error?.message
      ?? response.message
      ?? response.reason
      ?? null,
    roomCode: response.room?.roomCode ?? null,
  })
}

export async function createServerRoom(input: {
  participantName: string
  language: string
  title?: string
  participantCount?: number
}): Promise<Room> {
  const response = await fetch(apiUrl('/api/free-beta/rooms'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  const details = await response.json().catch(
    () => ({} as FreeBetaRoomResponse),
  ) as FreeBetaRoomResponse

  logRoomCreateResponse(response.status, details)

  if (!response.ok || !details.room) {
    throw new Error(
      getFreeBetaErrorMessage(details, '방을 생성하지 못했습니다.'),
    )
  }

  const room = details.room
  saveCurrentRoom(room)
  return room
}

export async function joinServerRoomByCode(input: {
  roomCode: string
  participantName: string
  language: string
}): Promise<Room> {
  const normalizedCode = normalizeRoomCode(input.roomCode)

  if (!normalizedCode) {
    throw new Error('올바른 방 코드 형식이 아닙니다.')
  }

  const response = await fetch(apiUrl('/api/free-beta/rooms/join'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...input,
      roomCode: normalizedCode,
    }),
  })
  const details = await response.json().catch(
    () => ({} as FreeBetaRoomResponse),
  ) as FreeBetaRoomResponse

  if (!response.ok || !details.room) {
    throw new Error(
      getFreeBetaErrorMessage(details, '방에 입장하지 못했습니다.'),
    )
  }

  const room = details.room
  saveCurrentRoom(room)
  return room
}
