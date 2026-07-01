import {
  createLocalParticipant,
  createMockRemoteParticipants,
} from '../services/participantService'

export const mockParticipants = [
  createLocalParticipant('Ken Choi', 'ko', null),
  ...createMockRemoteParticipants(3),
]
