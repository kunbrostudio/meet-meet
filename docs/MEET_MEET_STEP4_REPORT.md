# MEET MEET Step 4 Report

작성일: 2026-07-19

## 1. 작업 목표

현재 저장소를 Say, Merang 복사본 상태에서 MEET MEET 개발용 기본 프로젝트로 전환했다. 이번 단계에서는 게임 엔진, GameBoard, 공격/목숨/판정 기능을 구현하지 않았고, LiveKit 화상방과 채팅 기반 흐름은 유지했다.

## 2. 수정한 파일 목록

- `package.json`
- `package-lock.json`
- `index.html`
- `public/favicon.svg`
- `README.md`
- `server/index.ts`
- `src/App.css`
- `src/App.tsx`
- `src/components/common/AppHeader.tsx`
- `src/components/common/Logo.tsx`
- `src/components/livekit/LiveKitTestRoom.tsx`
- `src/components/meeting/ControlBar.tsx`
- `src/components/meeting/ConversationPanel.tsx`
- `src/components/meeting/EndMeetingModal.tsx`
- `src/components/meeting/MeetingSettingsPanel.tsx`
- `src/components/meeting/ParticipantCard.tsx`
- `src/components/meeting/RemoveParticipantModal.tsx`
- `src/components/meeting/VideoGrid.tsx`
- `src/constants/storageKeys.ts`
- `src/pages/LandingPage.tsx`
- `src/pages/MeetingRoomPage.tsx`
- `src/pages/SetupPage.tsx`
- `src/services/chatService.ts`
- `src/services/deviceService.ts`
- `src/services/exportService.ts`
- `src/services/livekitChatService.ts`
- `src/services/meetingSessionStorageService.ts`
- `src/services/roomService.ts`
- `src/types/meeting.ts`

## 3. 변경한 브랜딩 항목

- `package.json`의 프로젝트 이름을 `meet-meet`으로 변경했다.
- `package-lock.json`의 루트 패키지 이름도 `meet-meet`으로 맞췄다.
- `index.html`의 title을 `MEET MEET`으로 변경하고 favicon 경로를 `/favicon.svg`로 변경했다.
- `public/favicon.svg`를 중립적인 임시 `MM` 텍스트 아이콘으로 교체했다. 기존 로고 파일은 삭제하지 않았다.
- `src/components/common/Logo.tsx`는 기존 이미지 로고 대신 `MM` 임시 텍스트 마크와 `MEET MEET` 텍스트를 표시한다.
- `src/components/common/AppHeader.tsx`의 보조 문구를 `실시간 화상 놀이터`로 변경했다.
- `src/pages/LandingPage.tsx`의 화면 문구를 `밋밋`, `MEET MEET`, `별거 없는 게임, 별일 다 생기는 방`, `친구들과 만나서 바로 노는 실시간 화상 놀이터` 중심으로 변경했다.
- `src/services/chatService.ts`의 system senderName을 `MEET MEET`으로 변경했다.
- `server/index.ts`의 서버 로그를 `MEET MEET API server` 기준으로 변경했다.
- `README.md`를 MEET MEET 기본 프로젝트 설명으로 교체했다.

## 4. UI에서 제외한 기능

초기 사용자 흐름에서 다음 기능을 보이지 않도록 정리했다.

- 번역
- STT
- 실시간 자막
- Transcript
- 언어 선택
- 수동 번역
- 자동 번역
- 회의 요약
- 회의 기록
- 기록 내보내기
- 자막 설정
- 번역 설정

적용 위치:

- `src/App.tsx`: `MeetingSummaryPage`, `MeetingHistoryPage` import와 라우팅을 제거하고 `landing`, `setup`, `meeting` 흐름만 남겼다.
- `src/components/meeting/ConversationPanel.tsx`: `ConversationTab`을 `chat`만 갖도록 단순화하고 Transcript 탭, 번역 버튼, 언어 선택, 자동 번역 컨트롤을 표시하지 않도록 변경했다.
- `src/components/meeting/ControlBar.tsx`: 자막/번역/녹화 상태 버튼과 힌트 표시를 화면에서 제외하고, 마이크/카메라/화면공유/보기/참가자/채팅/설정/나가기 컨트롤만 남겼다.
- `src/components/meeting/MeetingSettingsPanel.tsx`: 표시 이름, 카메라, 마이크, 스피커 설정만 표시한다.
- `src/components/meeting/ParticipantCard.tsx`, `src/components/meeting/VideoGrid.tsx`: 참가자 카드의 자막 오버레이 표시를 제거했다.
- `src/pages/SetupPage.tsx`: 언어 선택, 번역 모드, 자동 자막 설정을 제거했다.

관련 서비스와 타입 파일은 대량 삭제하지 않았다. `translationService`, `summaryService`, `transcriptStorageService`, transcript/translation 타입, Summary/History 페이지 파일은 보존되어 있으나 초기 라우팅과 주요 UI에서 접근되지 않는다.

## 5. 유지한 LiveKit 및 화상 기능

다음 기능은 유지하도록 연결 구조를 보존했다.

- LiveKit 연결과 토큰 발급
- 방 생성
- `MMT-XXXXXX` 코드 입장
- 초대 링크 입장
- 호스트와 참가자 역할 구분
- 참가자 영상 표시
- 카메라 ON/OFF
- 마이크 ON/OFF
- 텍스트 채팅 송수신
- 참가자 입장 및 퇴장 처리
- 호스트의 방 종료
- 호스트의 참가자 내보내기
- 기존 재접속 및 LiveKit 연결 복구 관련 처리

`src/pages/MeetingRoomPage.tsx`의 LiveKit 연결, media controller, data controller, room-control 수신 로직은 전면 재작성하지 않고 유지했다.

## 6. 변경한 식별자

- localStorage prefix: `meet-meet`
  - 위치: `src/constants/storageKeys.ts`
- session cookie 이름: `meet_meet_sid`
  - 위치: `server/index.ts`
- LiveKit 채팅 topic: `meet-meet-chat`
  - 위치: `src/services/livekitChatService.ts`
- LiveKit 방 제어 topic: `meet-meet-room-control`
  - 위치: `src/services/livekitChatService.ts`
- 방 코드 prefix: `MMT-`
  - 클라이언트 생성/검증: `src/services/roomService.ts`
  - 서버 생성: `server/index.ts`
- 방 코드 형식: `MMT-XXXXXX`
  - 클라이언트 정규식: `^MMT-[A-Z0-9]{6}$`
  - Landing placeholder: `src/pages/LandingPage.tsx`

Transcript와 Translation topic은 코드 삭제 없이 각각 `meet-meet-transcript`, `meet-meet-translation`으로 분리했다. 초기 UI에서는 사용하지 않는다.

## 7. 기본 화면 흐름

유지한 흐름:

1. `LANDING`
2. 방 만들기 또는 코드로 입장
3. `SETUP`
4. 화상방
5. 나가기 또는 방 종료 후 `LANDING`

변경 사항:

- `src/App.tsx`에서 초기 페이지를 `landing`, `setup`, `meeting`만 관리하도록 정리했다.
- 화상방 종료 후 요약 페이지로 이동하지 않고 LandingPage로 돌아가도록 변경했다.
- 일반 참가자 나가기와 호스트 방 종료 모두 홈 복귀 흐름을 사용한다.
- `MeetingSummaryPage`와 `MeetingHistoryPage`는 초기 라우팅에서 제외했다.

## 8. SetupPage 범위

`src/pages/SetupPage.tsx`에서 유지한 항목:

- 닉네임 입력
- 카메라 선택
- 카메라 ON/OFF
- 마이크 선택
- 마이크 ON/OFF
- 스피커 선택
- 참가자 수 설정

참가자 수는 2명, 3명, 4명만 선택할 수 있도록 제한했다.

게임 선택, 목숨, 공격, 판정 설정은 구현하지 않았다.

## 9. 빌드 결과

실행 명령:

```bash
npm run build
```

결과:

```text
> meet-meet@0.0.0 build
> tsc -b && vite build

sh: tsc: command not found
```

원인:

- 현재 워크스페이스에 `node_modules` 디렉터리가 없다.
- `node_modules/.bin/tsc`도 존재하지 않는다.
- 이번 단계의 금지 조건에 따라 패키지 설치 또는 업데이트는 수행하지 않았다.

따라서 TypeScript/Vite 빌드 검증은 의존성 설치 후 다시 실행해야 한다.

## 10. 수동 확인이 필요한 항목

현재 의존성이 설치되어 있지 않아 브라우저 기반 수동 확인은 완료하지 못했다. 의존성 설치 후 다음 항목을 확인해야 한다.

- LandingPage 렌더링
- 방 만들기 버튼 동작
- `MMT-XXXXXX` 코드 입장
- SetupPage 이동
- 닉네임 입력
- 카메라/마이크 권한 요청
- 카메라 선택 및 ON/OFF
- 마이크 선택 및 ON/OFF
- 스피커 선택
- 참가자 수 2-4명 제한
- 화상방 진입
- LiveKit 연결
- 텍스트 채팅 송수신
- 참가자 입장 및 퇴장
- 호스트 참가자 내보내기
- 호스트 방 종료 후 LandingPage 복귀
- 일반 참가자 나가기 후 LandingPage 복귀
- Summary/History 화면에 초기 UI에서 접근할 수 없는지 확인

## 11. 다음 Step 5 권장 작업

1. 의존성 설치 후 `npm run build`와 `npm run lint`를 실행하고 TypeScript 오류를 먼저 정리한다.
2. 브라우저에서 Landing, Setup, Meeting 최소 플로우를 수동 검증한다.
3. `MeetingRoomPage.tsx`에 남아 있는 STT/번역/Transcript 내부 상태와 effect를 feature flag 뒤로 더 명확히 격리한다.
4. 게임 상태 전용 LiveKit data topic을 추가한다. 예: `meet-meet-game-state`.
5. `src/features/game/` 또는 `src/components/game/` 아래에 빈 게임 UI/상태 구조만 먼저 만든다.
6. `GameStateManager`, `TurnManager`, `LifeManager`의 타입과 순수 상태 전이 테스트를 먼저 작성한다.
7. 이후 `GameBoard`를 화상방 중앙 영역에 연결하되, 기존 참가자 영상과 채팅 연결을 깨뜨리지 않도록 단계적으로 붙인다.
