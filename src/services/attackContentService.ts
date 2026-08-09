import { apiUrl } from './apiClient'

export const ATTACK_CONTENT_MAX_BYTES = 3 * 1024 * 1024
export const ATTACK_CONTENT_ACCEPT = 'image/jpeg,image/png,image/webp'

export type AttackContentMetadata = {
  contentId: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  size: number
  uploaderParticipantIdentity: string
  roomCode: string
  createdAt: string
}

type AttackContentErrorBody = {
  code?: string
  error?: string
  message?: string
}

export class AttackContentError extends Error {
  code: string
  status?: number

  constructor(message: string, code: string, status?: number) {
    super(message)
    this.name = 'AttackContentError'
    this.code = code
    this.status = status
  }
}

function isAllowedAttackContentType(type: string): boolean {
  return type === 'image/jpeg' || type === 'image/png' || type === 'image/webp'
}

async function parseErrorResponse(response: Response): Promise<AttackContentError> {
  let body: AttackContentErrorBody | null

  try {
    body = await response.json() as AttackContentErrorBody
  } catch {
    body = null
  }

  const code = body?.code ?? body?.error ?? `HTTP_${response.status}`
  const message = body?.message ?? getAttackContentErrorMessage(code)
  return new AttackContentError(message, code, response.status)
}

function assertAttackContentMetadata(value: unknown): AttackContentMetadata {
  const metadata = value as Partial<AttackContentMetadata>

  if (
    typeof metadata !== 'object'
    || metadata === null
    || typeof metadata.contentId !== 'string'
    || !isAllowedAttackContentType(metadata.mimeType ?? '')
    || typeof metadata.size !== 'number'
    || !Number.isFinite(metadata.size)
    || typeof metadata.uploaderParticipantIdentity !== 'string'
    || typeof metadata.roomCode !== 'string'
    || typeof metadata.createdAt !== 'string'
  ) {
    throw new AttackContentError(
      '이미지 정보를 확인하지 못했습니다.',
      'ATTACK_CONTENT_INVALID_RESPONSE',
    )
  }

  return metadata as AttackContentMetadata
}

export async function uploadAttackContent(input: {
  roomCode: string
  file: File
}): Promise<AttackContentMetadata> {
  if (!isAllowedAttackContentType(input.file.type)) {
    throw new AttackContentError(
      getAttackContentErrorMessage('ATTACK_CONTENT_UNSUPPORTED_TYPE'),
      'ATTACK_CONTENT_UNSUPPORTED_TYPE',
    )
  }

  if (input.file.size > ATTACK_CONTENT_MAX_BYTES) {
    throw new AttackContentError(
      getAttackContentErrorMessage('ATTACK_CONTENT_TOO_LARGE'),
      'ATTACK_CONTENT_TOO_LARGE',
    )
  }

  const formData = new FormData()
  formData.append('file', input.file)

  const response = await fetch(
    apiUrl(`/api/free-beta/rooms/${encodeURIComponent(input.roomCode)}/attack-content`),
    {
      method: 'POST',
      body: formData,
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw await parseErrorResponse(response)
  }

  return assertAttackContentMetadata(await response.json())
}

export async function fetchAttackContentMetadata(
  contentId: string,
): Promise<AttackContentMetadata> {
  const response = await fetch(
    apiUrl(`/api/free-beta/attack-content/${encodeURIComponent(contentId)}/meta`),
    { credentials: 'include' },
  )

  if (!response.ok) {
    throw await parseErrorResponse(response)
  }

  return assertAttackContentMetadata(await response.json())
}

export async function downloadAttackContentBlob(contentId: string): Promise<Blob> {
  const response = await fetch(
    apiUrl(`/api/free-beta/attack-content/${encodeURIComponent(contentId)}`),
    { credentials: 'include' },
  )

  if (!response.ok) {
    throw await parseErrorResponse(response)
  }

  const blob = await response.blob()

  if (!isAllowedAttackContentType(blob.type)) {
    throw new AttackContentError(
      '이미지 파일 형식을 확인하지 못했습니다.',
      'ATTACK_CONTENT_INVALID_BLOB',
    )
  }

  return blob
}

export function getAttackContentErrorMessage(code: string): string {
  switch (code) {
    case 'ATTACK_CONTENT_TOO_LARGE':
      return '이미지는 최대 3MB까지 업로드할 수 있습니다.'
    case 'ATTACK_CONTENT_UNSUPPORTED_TYPE':
      return 'JPEG, PNG, WebP 이미지만 사용할 수 있습니다.'
    case 'ATTACK_UPLOAD_RATE_LIMITED':
      return '이미지 업로드 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
    case 'SESSION_NOT_IN_ROOM':
    case 'ATTACK_CONTENT_FORBIDDEN':
      return '이 방에서 사용할 수 없는 이미지입니다.'
    case 'ROOM_NOT_FOUND':
      return '방이 종료되었거나 만료되었습니다.'
    case 'ATTACK_CONTENT_NOT_FOUND':
      return '공격 이미지를 찾을 수 없습니다.'
    default:
      return '이미지를 처리하지 못했습니다. 다시 시도해주세요.'
  }
}
