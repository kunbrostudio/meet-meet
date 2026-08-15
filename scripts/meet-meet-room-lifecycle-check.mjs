function createRoom() {
  return {
    roomCode: 'MMT-TEST01',
    hostParticipantIdentity: 'A',
    matchState: {
      phase: 'post-game',
      matchId: 'match-1',
      revision: 0,
    },
    participants: new Map([
      ['A', { identity: 'A', meetingRole: 'host', joinedAt: 1 }],
      ['B', { identity: 'B', meetingRole: 'participant', joinedAt: 2 }],
    ]),
  }
}

function getHostSuccessor(room, removedParticipantIdentity) {
  return [...room.participants.values()]
    .filter((participant) => participant.identity !== removedParticipantIdentity)
    .sort((left, right) => left.joinedAt - right.joinedAt)[0]
}

function transferRoomHost(room, removedParticipantIdentity) {
  const removedParticipant = room.participants.get(removedParticipantIdentity)

  if (removedParticipant?.meetingRole !== 'host' || room.participants.size <= 1) {
    return null
  }

  const successor = getHostSuccessor(room, removedParticipantIdentity)

  if (!successor) {
    return null
  }

  removedParticipant.meetingRole = 'participant'
  successor.meetingRole = 'host'
  room.hostParticipantIdentity = successor.identity

  return {
    previousHostParticipantIdentity: removedParticipantIdentity,
    newHostParticipantIdentity: successor.identity,
  }
}

function startServerGameOver(room, winnerParticipantIdentity) {
  room.matchState = {
    phase: 'post-game',
    matchId: 'match-2',
    revision: room.matchState.revision + 1,
    winnerParticipantIdentity,
  }
}

function createFairPlayStatus(participantIdentity, passed = false) {
  return {
    participantIdentity,
    fairPlayRequired: true,
    fairPlayPassed: passed,
    ready: false,
  }
}

function bootstrapNextMatch(room) {
  const roster = [...room.participants.keys()]
  const previousFairPlay = room.matchState.fairPlay ?? {}
  const fairPlay = Object.fromEntries(
    roster.map((participantIdentity) => {
      const previousStatus = previousFairPlay[participantIdentity]

      return [
        participantIdentity,
        previousStatus?.fairPlayPassed
          ? { ...previousStatus, ready: false }
          : createFairPlayStatus(participantIdentity),
      ]
    }),
  )

  room.matchState = {
    phase: 'waiting',
    matchId: 'match-3',
    revision: room.matchState.revision + 1,
    nextMatchRoster: roster,
    fairPlay,
    readyParticipantIdentities: [],
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const room = createRoom()
const hostChanged = transferRoomHost(room, 'A')

assert(hostChanged, 'host transfer should occur before old host removal')
assert(room.hostParticipantIdentity === 'B', 'successor must be persisted as room host')

room.participants.delete('A')
startServerGameOver(room, 'B')

assert(room.matchState.phase === 'post-game', 'server should normalize match end to POST_GAME immediately')
assert(room.matchState.winnerParticipantIdentity === 'B', 'POST_GAME should keep the winner for timeline rendering')
assert(room.hostParticipantIdentity === 'B', 'POST_GAME must preserve successor host')
assert(room.participants.size === 1, 'POST_GAME must preserve remaining participant')

room.matchState.fairPlay = {
  B: createFairPlayStatus('B', true),
}
room.participants.set('C', { identity: 'C', meetingRole: 'participant', joinedAt: 3 })
bootstrapNextMatch(room)

assert(
  room.hostParticipantIdentity === 'B',
  'new participant join must not replace the remaining host',
)
assert(
  room.matchState.nextMatchRoster.join(',') === 'B,C',
  'next match roster must use current connected participants only',
)
assert(
  room.matchState.fairPlay.B.fairPlayPassed === true,
  'same-session winner should keep fair play pass',
)
assert(
  room.matchState.fairPlay.B.ready === false,
  'ready state must reset for the next match',
)
assert(
  room.matchState.fairPlay.C.fairPlayRequired === true
    && room.matchState.fairPlay.C.fairPlayPassed === false,
  'new participant should require local fair play before ready',
)

room.matchState.fairPlay.C = createFairPlayStatus('C', true)
room.matchState.readyParticipantIdentities = ['B', 'C']

assert(
  room.matchState.readyParticipantIdentities.length === room.participants.size,
  'all current participants should be ready for the next match',
)

const currentHost = [...room.participants.values()].find(
  (participant) => participant.meetingRole === 'host',
)

assert(currentHost?.identity === 'B', 'successor should keep host role for match 2')
assert(
  room.hostParticipantIdentity === currentHost.identity,
  'server host identity should match the visible host role',
)

room.matchState = {
  phase: 'countdown',
  matchId: room.matchState.matchId,
  revision: room.matchState.revision + 1,
  activePlayerIdentities: room.matchState.nextMatchRoster,
  readyParticipantIdentities: room.matchState.readyParticipantIdentities,
}

assert(
  room.matchState.activePlayerIdentities.join(',') === 'B,C',
  'match 2 should start from the fresh connected roster',
)

console.info('[meet-meet-room-lifecycle-check] passed')
