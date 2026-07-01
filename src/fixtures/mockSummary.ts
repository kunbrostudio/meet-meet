import type { MeetingSummary } from '../types/meeting'

export const mockSummary: MeetingSummary = {
  meetingTitle: 'Weekly Product Sync',
  meetingDate: '2026년 6월 21일',
  stats: [
    { id: 'duration', icon: 'clock', value: '18분 24초', label: '전체 미팅 시간' },
    { id: 'participants', icon: 'users', value: '4명', label: '참여 인원' },
    { id: 'languages', icon: 'globe', value: '4개', label: '사용된 언어' },
    { id: 'transcripts', icon: 'captions', value: '126줄', label: '번역된 대화' },
  ],
  highlights: [
    '새로운 온보딩 플로우에 대한 초기 사용자 반응이 긍정적이며, 명확하고 단순한 첫 경험을 우선하기로 했어요.',
    '디자인 시스템 업데이트를 이번 주 안에 마무리하고 다음 개발 스프린트부터 적용할 예정이에요.',
    '수정된 프로젝트 일정은 회의 후 공유하고, 다음 주부터 주요 지표를 함께 검토하기로 했어요.',
  ],
  actionItems: [
    { text: '온보딩 첫 화면의 정보 구조 단순화', owner: 'Ken Choi', due: '6월 24일' },
    { text: '업데이트된 디자인 시스템 공유', owner: 'Yuki Tanaka', due: '이번 주' },
    { text: '수정된 프로젝트 일정 팀에 전달', owner: 'Lucas Martin', due: '오늘' },
  ],
}
