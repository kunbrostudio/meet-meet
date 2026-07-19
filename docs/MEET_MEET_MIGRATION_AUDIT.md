# MEET MEET Migration Audit

작성일: 2026-07-19

이 문서는 현재 `meet-meet` 저장소 내부 코드만 조사한 결과다. Say, Merang 원본 서비스나 외부 저장소는 조사하지 않았다. 이번 단계에서는 기존 코드 수정, 삭제, 파일명 변경, 패키지 변경, 환경변수 변경, 배포 설정 변경, 디자인/게임 구현을 하지 않았다.

## 1. 현재 구조 요약

- 클라이언트: Vite + React 19. 진입점은 `src/main.tsx`, 라우팅/상위 상태는 `src/App.tsx`.
- 회의 화면: `src/pages/MeetingRoomPage.tsx`가 LiveKit 연결, 참가자 표시, 채팅, STT, 번역, 화면 공유, 종료 흐름을 대부분 보유한다.
- LiveKit UI 브리지: `src/components/livekit/LiveKitTestRoom.tsx`.
- 서버: `server/index.ts` 단일 Express 서버. 무료 베타 방 레지스트리, LiveKit 토큰 발급, 강퇴, 방 종료, 번역 API를 함께 제공한다.
- 저장소: 브라우저 `localStorage` 기반. 주요 키는 `src/constants/storageKeys.ts`.
- 배포 설정: 루트에 `netlify.toml`, `render.yaml`, `vercel.json`, `fly.toml` 같은 배포 설정 파일은 없다. README에 Netlify + 외부 API 서버 운영 안내만 존재한다.

## 2. 필수 조사 항목

### 2.1 LiveKit 방 생성, 입장, 퇴장, 재접속 흐름

방 생성:

- 클라이언트 `src/App.tsx`
  - `beginNewRoom()`에서 `createServerRoom()` 호출 후 `currentRoom`, `meetingCreatedAt`, `roomName`, active meeting id 저장, `setup`으로 이동한다.
  - `createServerRoom()` 실패 시 alert 처리.
- 클라이언트 서비스 `src/services/roomService.ts`
  - `createServerRoom(input)`은 `POST /api/free-beta/rooms`를 호출하고 응답의 `room`을 `saveCurrentRoom()`으로 저장한다.
  - 로컬 fallback용 `createRoom()`도 있으나 현재 `beginNewRoom()`은 서버 방 생성을 사용한다.
- 서버 `server/index.ts`
  - `app.post('/api/free-beta/rooms')`가 방 생성 엔드포인트다.
  - `generateRoomCode()`는 `MER-XXXXXX` 형식 코드를 만든다.
  - `createRoomServiceClient()`가 `RoomServiceClient`를 만들고 `roomService.createRoom()`을 호출한다.
  - `FreeBetaRoom`을 메모리 `freeBetaRooms: Map<string, FreeBetaRoom>`에 저장한다.
  - 호스트에게 `meetingRole: 'host'`, `participantIdentity`, `hostControlToken`, `maxParticipants`를 반환한다.

방 입장:

- `src/pages/LandingPage.tsx`
  - `joinMeeting()`이 코드 입력을 받고 `onJoin(code)`를 호출한다.
  - URL의 `?room=`은 `parseRoomCodeFromUrl()`로 초기 입력값에 반영된다.
- `src/App.tsx`
  - `joinWithCode(code)`가 `joinServerRoomByCode()`를 호출한다.
  - 서버 입장 실패 시 `joinRoomByCode()`를 시도하지만, 실제로는 오류 메시지를 반환하고 이동하지 않는다.
- `src/services/roomService.ts`
  - `joinServerRoomByCode(input)`은 `POST /api/free-beta/rooms/join` 호출.
  - `ROOM_CODE_PATTERN`은 현재 `MER-[A-Z0-9]{6}`로 서버 코드와 맞다.
- `server/index.ts`
  - `app.post('/api/free-beta/rooms/join')`가 방 존재/만료/정원/세션 제한을 검사한다.
  - 같은 익명 세션이 재입장하면 기존 `participantIdentity`와 `meetingRole`을 재사용한다.

LiveKit 토큰 및 연결:

- `src/pages/MeetingRoomPage.tsx`
  - `connectLiveKitRoom()`이 `requestLiveKitToken()`을 호출한다.
  - `autoLiveKitConnectRoomRef`, `liveKitConnectingRoomRef`, `liveKitConnectedRoomRef`로 중복 연결을 막는다.
  - 연결 실패 시 `liveKitStatus: 'failed'`로 두고 로컬 모드 안내를 표시한다.
  - `useEffect`에서 로컬 참가자 정보가 준비되면 자동 연결을 시작한다.
- `src/services/livekitConnectionService.ts`
  - `requestLiveKitToken()`은 `POST /api/livekit/token`을 호출하고 `url`, `token`, `roomName`, `participantIdentity`를 검증한다.
- `server/index.ts`
  - `app.post('/api/livekit/token')`가 세션이 방에 등록되어 있는지 확인한다.
  - `AccessToken` metadata에 `name`, `language`, `meetingRole`을 넣는다.
  - grant는 `roomJoin`, `canPublish`, `canSubscribe`, `canPublishData`, `roomAdmin: meetingRole === 'host'`.
- `src/components/livekit/LiveKitTestRoom.tsx`
  - `<LiveKitRoom serverUrl token connect audio={false} video={false}>`로 연결한다.
  - `LiveKitLocalMediaPublisher`가 별도 `MediaStream` 트랙을 `room.localParticipant.publishTrack()`으로 발행한다.

퇴장/종료:

- `src/pages/MeetingRoomPage.tsx`
  - `confirmEndMeeting()`이 호스트면 `endFreeBetaRoom()` 호출 후 `meeting-ended` data message를 발행한다.
  - 일반 참가자는 `liveKitStatus: 'leaving'` 후 `finalizeMeetingAndNavigate()`로 본인만 나간다.
  - `disconnectLiveKitRoom()`은 화면 공유 중이면 `setScreenShareEnabled(false)` 후 `controller.disconnect()`.
  - `finalizeMeetingAndNavigate()`는 세션/채팅/자막 저장, STT/화면공유/LiveKit 종료, 로컬 미디어 stop 후 `onLeave()`로 요약 화면 이동.
- 서버 `server/index.ts`
  - `app.post('/api/free-beta/rooms/end')`는 호스트 검증 후 `room.closedAt`을 설정하고 모든 익명 세션의 `activeRoomCodes`에서 제거한다.

재접속:

- 명시적 “재접속 버튼”보다는 자동 연결 가드와 미디어 재요청이 있다.
- `connectLiveKitRoom({ force?: boolean })`는 force 옵션을 받지만 현재 호출부는 `connectLiveKitRoom()`만 사용한다.
- 미디어 재연결은 `reconnectLocalMedia(localParticipant, kind)`와 `onReconnectMedia`로 설정 화면 이동.
- LiveKit 연결이 끊기면 `LiveKitTestRoom`의 `onDisconnect` 콜백에서 상태를 `connecting`, `local`, `failed`, `ended`, `kicked`, `leaving` 중 하나로 정리한다.

### 2.2 호스트와 게스트 권한 처리

- 타입:
  - `src/types/participant.ts`의 `Participant.meetingRole: 'host' | 'participant'`.
  - `src/types/meeting.ts`의 `Room.meetingRole: 'host' | 'participant'`.
  - `src/services/livekitConnectionService.ts`의 `LiveKitMeetingRole`.
- 서버:
  - 방 생성자는 `server/index.ts`의 `FreeBetaParticipant.meetingRole: 'host'`로 저장된다.
  - 입장자는 `meetingRole: 'participant'`.
  - 강퇴와 방 종료는 `requesterMeetingRole === 'host'`, `requesterParticipantIdentity === room.hostParticipantIdentity`, `validateHostControlToken(room, hostControlToken)` 모두 필요하다.
  - LiveKit grant에서 호스트만 `roomAdmin: true`.
- 클라이언트:
  - `src/App.tsx`는 `SetupPage`의 `canSetParticipantCount`를 `currentRoom.meetingRole === 'host'`로 제한한다.
  - `src/pages/MeetingRoomPage.tsx`는 `isCurrentUserHost`로 종료 모달 문구와 `ControlBar`의 종료/나가기 라벨을 바꾼다.
  - `src/components/meeting/ParticipantsPanel.tsx`는 `currentParticipant?.meetingRole === 'host'`일 때만 원격 참가자 `내보내기` 버튼을 표시한다.

### 2.3 참가자 상태 동기화 방식

- LiveKit 이벤트 기반:
  - `src/components/livekit/LiveKitTestRoom.tsx`의 `LiveKitParticipantObserver`가 `useParticipants({ updateOnlyOn: [...] })`와 `RoomEvent` 리스너를 함께 사용한다.
  - 관찰 이벤트: `ParticipantConnected`, `ParticipantDisconnected`, `TrackPublished`, `TrackUnpublished`, `TrackSubscribed`, `TrackUnsubscribed`, `TrackMuted`, `TrackUnmuted`, `LocalTrackPublished`, `LocalTrackUnpublished`, `ActiveSpeakersChanged`, `ParticipantMetadataChanged`, `ParticipantNameChanged`.
- 타입 변환:
  - `src/services/livekitParticipantAdapter.ts`
    - `mapLiveKitParticipantsToParticipants(localParticipant, remoteParticipants, options)`
    - `mapLiveKitLocalParticipantToParticipant()`
    - `mapLiveKitRemoteParticipantToParticipant()`
    - `parseMetadata()`로 LiveKit metadata의 `name`, `language`, `meetingRole`을 읽는다.
    - `hasActiveTrack()`으로 카메라/마이크 on/off를 계산한다.
    - `createParticipantMediaStream()`으로 카메라 track을 `MediaStream`으로 감싼다.
- 화면 상태:
  - `src/pages/MeetingRoomPage.tsx`의 `liveKitParticipants`가 실제 연결 시 표시 소스다.
  - `updateLiveKitParticipants()`는 참가자 스냅샷 문자열을 비교해 불필요한 state update를 막는다.
  - `displayedParticipants`는 LiveKit 연결 상태, terminal 상태, 로컬 폴백 여부에 따라 `liveKitParticipants`, `roomParticipants`, 빈 배열 중 선택한다.

### 2.4 LiveKit 데이터 메시지 송수신 구조

- 메시지 타입/인코딩:
  - `src/services/livekitChatService.ts`
    - topics: `LIVEKIT_CHAT_TOPIC`, `LIVEKIT_TRANSCRIPT_TOPIC`, `LIVEKIT_TRANSLATION_TOPIC`, `LIVEKIT_MEETING_CONTROL_TOPIC`.
    - 현재 topic 이름은 `say-merang-chat`, `say-merang-transcript`, `say-merang-translation`, `say-merang-meeting-control`.
    - `LiveKitDataMessage` union: `chat-message`, `system-message`, `transcript-created`, `translation`, `meeting-ended`, `participant-kicked`.
    - `encodeLiveKitDataMessage()`, `decodeLiveKitDataMessage()`.
    - 변환 함수: `chatMessageToLiveKitPayload()`, `liveKitPayloadToChatMessage()`, `transcriptToLiveKitPayload()`, `liveKitPayloadToTranscript()`.
- 송신:
  - `src/components/livekit/LiveKitTestRoom.tsx`의 `LiveKitDataBridge`가 `LiveKitDataController`를 만든다.
  - `publishChatMessage()`, `publishTranscriptMessage()`, `publishTranslationMessage()`, `publishMeetingControlMessage()`는 `room.localParticipant.publishData(..., { reliable: true, topic })`를 사용한다.
- 수신:
  - `LiveKitDataBridge`가 `RoomEvent.DataReceived`를 구독한다.
  - topic과 message type이 맞을 때만 `onMessage(message)`로 올린다.
  - `src/pages/MeetingRoomPage.tsx`의 `receiveLiveKitDataMessage()`가 실제 반영 로직을 처리한다.
- MEET MEET 확장 포인트:
  - 게임 동기화는 기존 `LiveKitDataController`에 `publishGameMessage()`와 새 topic 예: `meet-meet-game-state`를 추가하는 방식이 가장 자연스럽다.
  - 기존 채팅/회의 제어 topic과 분리해야 게임 상태 폭주가 채팅/종료 메시지 처리와 섞이지 않는다.

### 2.5 참가자 영상 카드 컴포넌트

- `src/components/meeting/VideoGrid.tsx`
  - `VideoGrid`가 `participants`를 받아 `ParticipantCard`를 렌더링한다.
  - `viewMode: 'grid' | 'focus'` 지원.
  - `compact` 모드에서는 화면 공유 시 strip 레이아웃을 사용한다.
- `src/components/meeting/ParticipantCard.tsx`
  - `ParticipantVideo`는 `video.srcObject = stream`으로 실제 영상을 표시한다.
  - `participant.mediaStream && participant.isCameraOn`일 때 영상 표시.
  - 카메라 꺼짐/미디어 끊김/아바타 fallback 처리.
  - 참가자 이름, 언어, 마이크 상태, 최신 자막 오버레이를 표시한다.
- MEET MEET에서는 `ParticipantCard`의 영상 렌더링은 재사용하고, 언어/자막 표시를 제거하거나 `ParticipantGameStatus` 오버레이로 교체하는 것이 적절하다.

### 2.6 PC, 태블릿, 모바일 반응형 레이아웃

- 주요 CSS는 `src/App.css`.
- 핵심 클래스:
  - `.meeting-layout`: 영상 영역과 Conversation 패널 2-column grid.
  - `.meeting-layout.conversation-closed`: Conversation 패널이 닫혔을 때 1-column.
  - `.video-area`: 영상/화면공유 영역.
  - `.video-grid`: 참가자 수에 따라 grid-template 변경.
  - `.focus-layout`, `.focus-main`, `.focus-thumbnails`: focus mode.
  - `.transcript-panel`: 오른쪽 패널/모바일 sheet.
  - `.meeting-controls-wrap`, `.meeting-controls`: 하단 컨트롤.
- breakpoint:
  - `@media (min-width: 901px) and (max-width: 1180px)`: 태블릿/좁은 데스크톱 보정.
  - `@media (max-width: 900px)`: 모바일/태블릿에서 layout을 단일 column + bottom sheet로 변경.
  - `@media (max-width: 620px)`: 모바일 portrait 상세 조정.
  - `@media (max-width: 900px) and (orientation: landscape)`, `@media (max-width: 960px) and (orientation: landscape)`: 모바일 landscape 전용 최적화.
- MEET MEET 목표의 “좌우 참가자 영상 + 중앙 GAME BOARD”는 기존 `video-grid` 중심 구조와 다르므로, CSS를 그대로 확장하기보다 게임 전용 layout class를 추가하는 편이 좋다.

### 2.7 카메라와 마이크 권한 및 ON/OFF 처리

- 공통 서비스 `src/services/deviceService.ts`
  - `requestMediaStream({ videoDeviceId, audioDeviceId })`: `navigator.mediaDevices.getUserMedia()` 호출. 비디오 1280x720, 30fps ideal.
  - `getVideoInputDevices()`, `getAudioInputDevices()`.
  - `toggleTrack(stream, kind, enabled?)`: audio/video track의 `enabled` 전환.
  - `stopMediaStream(stream)`: 모든 track stop.
- 설정 화면 `src/pages/SetupPage.tsx`
  - `connectMediaDevices()`에서 권한 요청, 장치 목록 로드, 선택 장치 저장, track on/off 적용.
  - `NotAllowedError`는 권한 차단 안내로 표시.
  - `toggleMicrophone()`, `toggleCamera()`가 입장 전 미디어 상태를 바꾼다.
- 회의 화면 `src/pages/MeetingRoomPage.tsx`
  - `toggleLocalMedia(kind)`가 LiveKit 연결 중이면 `LiveKitMediaController.setCameraEnabled()`/`setMicrophoneEnabled()` 사용.
  - LiveKit 미연결이면 로컬 `MediaStreamTrack.enabled`를 직접 변경한다.
  - 마이크를 끄면 STT도 중지한다.
- LiveKit 브리지 `src/components/livekit/LiveKitTestRoom.tsx`
  - `LiveKitMediaControllerBridge`가 `room.localParticipant.setCameraEnabled()`, `setMicrophoneEnabled()`, `setScreenShareEnabled()`, `disconnect()`를 제공한다.

### 2.8 중앙 Conversation, Chat, Transcript 패널 구조

- 현재 Conversation은 중앙이 아니라 우측 패널이다.
- `src/pages/MeetingRoomPage.tsx`
  - `isConversationOpen`, `conversationTab`, `chatUnreadCount`를 상태로 관리한다.
  - `openConversationPanel()`, `closeConversationPanel()`, `toggleConversationPanel()`이 열림/닫힘과 tab 전환을 처리한다.
  - JSX에서 `ConversationPanel`은 `meeting-layout` 내부의 `video-area` 옆에 배치된다.
- `src/components/meeting/ConversationPanel.tsx`
  - `ConversationTab = 'chat' | 'transcript'`.
  - Header: `Conversation`, tabs `Chat`, `Transcript`, 번역 컨트롤.
  - `renderChat()`은 메시지 목록과 composer.
  - `renderTranscriptItems()`는 자막 기록 목록.
  - `canUseTranscriptView`, `canUseManualTranslation`, `canUseAutoTranslation`으로 잠금/표시를 제어한다.
- MEET MEET에서는 대기 중 중앙 채팅 요구가 있으므로 `ConversationPanel` 전체를 재사용하기보다 채팅만 추출한 `GameChatPanel`이 적합하다.

### 2.9 채팅 메시지 송수신과 표시 구조

- 타입/저장:
  - `src/types/chat.ts`의 `ChatMessage`.
  - `src/services/chatService.ts`
    - `createChatMessage()`
    - `createSystemMessage()`
    - `saveChatMessages()`, `loadChatMessages()`, `clearChatMessages()`
  - 현재 system senderName은 `Say, Merang`.
- 송신:
  - `src/pages/MeetingRoomPage.tsx`의 `sendChatMessage(message)`.
  - `createChatMessage()` 후 로컬 state에 먼저 추가.
  - LiveKit 연결 시 `liveKitDataControllerRef.current?.publishChatMessage({ type: 'chat-message', payload })`.
- 수신/표시:
  - `receiveLiveKitDataMessage()`가 `chat-message`와 `system-message`를 `liveKitPayloadToChatMessage()`로 변환하고 dedupe 후 state에 추가한다.
  - 대화 패널이 닫혀 있거나 chat tab이 아니면 `chatUnreadCount` 증가.
  - `ConversationPanel.renderChat()`이 `chat-list`, `chat-message`, `chat-composer`로 표시한다.

### 2.10 방 종료, 호스트 퇴장, 참가자 퇴장 처리

- 호스트 방 종료:
  - `MeetingRoomPage.confirmEndMeeting()`에서 host이면:
    - `terminalPhaseRef.current = 'ended'`.
    - `endFreeBetaRoom()` 호출.
    - system chat 발행.
    - `meeting-ended` data message 발행.
    - `finalizeMeetingAndNavigate()` 실행.
  - 서버 `POST /api/free-beta/rooms/end`는 host role, host identity, hostControlToken을 검증한다.
- 원격 참가자의 종료 수신:
  - `receiveLiveKitDataMessage()`가 `meeting-ended`를 받으면 `isMeetingEndedRemotely`로 표시하고 요약 화면으로 이동한다.
- 호스트가 참가자 강퇴:
  - `MeetingRoomPage.removeParticipant()`가 `participant-kicked` data message를 먼저 발행하고, 150ms 후 `removeLiveKitParticipant()` 호출.
  - 서버 `POST /api/livekit/remove-participant`가 `RoomServiceClient.removeParticipant()` 호출.
  - 제거된 참가자 클라이언트는 `participant-kicked` message 또는 LiveKit disconnect reason `PARTICIPANT_REMOVED`를 통해 `markParticipantKicked()` 실행.
- 일반 참가자 나가기:
  - `confirmEndMeeting()`에서 host가 아니면 `liveKitStatus: 'leaving'`, `finalizeMeetingAndNavigate()`로 본인 세션 저장 및 disconnect.
  - 서버의 `freeBetaRooms.participants`에서 자발 퇴장자를 제거하는 별도 endpoint는 현재 없다.

### 2.11 번역, STT, 자막, Transcript, Summary, 언어 설정 관련 코드

초기 MEET MEET 범위에서 제외할 코드:

- 번역:
  - `src/constants/translationMode.ts`
  - `src/services/translationService.ts`
  - `src/services/translationRecordService.ts`
  - `src/types/translation.ts`
  - `server/index.ts`의 `OpenAI`, `TranslateRequestBody`, `languageNames`, `supportedLanguages`, `translationModel`, `POST /api/translate`.
  - `src/components/meeting/ConversationPanel.tsx`의 번역 버튼/자동 번역/번역 언어 UI.
  - `src/pages/MeetingRoomPage.tsx`의 `translations`, `translateConversationItem()`, 자동 번역 effect, `publishTranslationMessage()` 처리.
- STT/자막/Transcript:
  - `src/services/speechService.ts`
  - `src/services/transcriptStorageService.ts` 중 transcript 관련 함수.
  - `src/types/transcript.ts`
  - `src/components/meeting/ParticipantCard.tsx`의 `participant-subtitle`.
  - `src/components/meeting/ControlBar.tsx`의 caption 버튼/상태.
  - `src/components/meeting/MeetingSettingsPanel.tsx`의 STT 언어/자막 크기/자막 자동 시작/기록 저장 UI.
  - `src/pages/MeetingRoomPage.tsx`의 `sttEnabled`, `isSpeechRecognitionActive`, `liveCaptionText`, `speechRecognitionLanguage`, `captionSize`, `startRecognitionForParticipant()`, `handleToggleSpeechRecognition()`, `publishLiveKitTranscript()`.
- Summary/History/export:
  - `src/pages/MeetingSummaryPage.tsx`
  - `src/pages/MeetingHistoryPage.tsx`
  - `src/services/summaryService.ts`
  - `src/services/exportService.ts`
  - `src/services/meetingSessionStorageService.ts`
  - `src/services/localFirstStoragePolicyService.ts`
- 언어 설정:
  - `src/pages/SetupPage.tsx`의 `sourceLanguage`, `targetLanguage`, 언어 select, 번역 잠금 메시지.
  - `src/pages/MeetingRoomPage.tsx`의 `changeSourceLanguage()`, `changeTargetLanguage()`.
  - `server/index.ts`의 `language` 필드와 LiveKit metadata language.

주의: 현재 `language`는 참가자 metadata에도 들어가므로 한 번에 제거하면 `mapLiveKitParticipant()`와 `Participant` 타입 영향이 크다. Step 4에서는 우선 UI 비활성화/숨김, Step 5 이후 타입 축소가 안전하다.

### 2.12 서버와 클라이언트 환경변수

`.env.example` 기준:

- 서버 전용:
  - `OPENAI_API_KEY`
  - `OPENAI_TRANSLATION_MODEL`
  - `TRANSLATION_SERVER_PORT`
  - `LIVEKIT_URL`
  - `LIVEKIT_API_KEY`
  - `LIVEKIT_API_SECRET`
  - `FREE_BETA_MAX_ACTIVE_ROOMS`
  - `FREE_BETA_MAX_PARTICIPANTS`
  - `FREE_BETA_MAX_ACTIVE_ROOMS_PER_SESSION`
  - `FREE_BETA_ROOM_DURATION_MINUTES`
  - `FREE_BETA_CREATE_RATE_LIMIT`
  - `FREE_BETA_CREATE_RATE_WINDOW_SECONDS`
  - `FREE_BETA_JOIN_RATE_LIMIT`
  - `FREE_BETA_JOIN_RATE_WINDOW_SECONDS`
  - `FREE_BETA_MEETING_CREATION_ENABLED`
- 클라이언트:
  - `VITE_API_BASE_URL`
  - `VITE_ENABLE_MOCK_DATA`
  - `VITE_TRANSLATION_MODE`
  - `VITE_USE_REAL_TRANSLATION_API`
- 실제 `.env` 존재 변수명:
  - `OPENAI_API_KEY`, `OPENAI_TRANSLATION_MODEL`, `TRANSLATION_SERVER_PORT`, `VITE_TRANSLATION_MODE`, `VITE_USE_REAL_TRANSLATION_API`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
  - 값은 조사 문서에 기록하지 않는다.

### 2.13 Netlify 및 LiveKit 배포 설정

- Netlify:
  - 루트에 `netlify.toml`은 없다.
  - README는 정적 프론트엔드만 Netlify에 배포하면 `/api/translate`, `/api/livekit/token`, `/api/livekit/remove-participant`가 동작하지 않는다고 설명한다.
  - README는 `VITE_API_BASE_URL=https://say-merang-api.onrender.com`를 Netlify 환경변수로 추가하라고 안내한다.
- Vite dev proxy:
  - `vite.config.ts`의 `/api` proxy가 `http://localhost:8787`로 향한다.
- LiveKit:
  - 서버 env `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` 필요.
  - 서버 `getLiveKitApiHost()`가 `wss://`를 `https://`, `ws://`를 `http://`로 바꿔 `RoomServiceClient`에 사용한다.
  - 서버 `RoomServiceClient.createRoom()`, `RoomServiceClient.removeParticipant()` 사용.
  - 클라이언트는 서버에서 받은 `url`, `token`으로만 LiveKit에 연결한다.

### 2.14 Say, Merang 이름, 로고, 메타데이터 위치

- `package.json`: `"name": "say-merang"`.
- `README.md`: 제목과 설명 전체가 Say, Merang 기준.
- `index.html`: favicon `/images/say-merang-symbol.png`, title `say-merang`.
- `public/images/say-merang-symbol.png`: 로고 이미지.
- `src/components/common/Logo.tsx`: 이미지 alt `Say, Merang`, 텍스트 `Say, Merang`.
- `src/pages/LandingPage.tsx`: 로고 이미지, alt, 텍스트, “Connect beyond language”, “Real-time translation...” 등 번역 서비스 카피.
- `src/services/livekitChatService.ts`: LiveKit data topic 이름이 `say-merang-*`.
- `src/constants/storageKeys.ts`: `STORAGE_PREFIX = 'say-merang'`.
- `src/services/chatService.ts`: system senderName `Say, Merang`.
- `src/services/meetingSessionStorageService.ts`: fallback title `Say, Merang Meeting`.
- `src/services/roomService.ts`: fallback title `Say, Merang Meeting`.
- `server/index.ts`: `sessionCookieName = 'say_merang_sid'`, console log `Say, Merang API server...`.
- README에는 `say-merang-api.onrender.com`, `say-merang.netlify.app` 예시가 있다.
- 방 코드 prefix:
  - `server/index.ts`와 `src/services/roomService.ts`가 `MER-` prefix 사용.
  - MEET MEET로 바꿀 경우 기존 저장/초대 링크 호환성을 의식해야 한다.

### 2.15 MEET MEET 게임 상태를 추가하기 가장 적절한 위치

권장 위치:

- 타입:
  - `src/types/game.ts` 신설.
  - `GamePhase`, `GameState`, `GameParticipantState`, `AttackContent`, `GameDataMessage` 정의.
- 상태 관리:
  - `src/services/gameStateManager.ts` 또는 `src/game/gameStateManager.ts` 신설.
  - 순수 함수 중심으로 `createInitialGameState()`, `applyGameEvent()`, `serializeGameState()`, `validateGameEvent()` 제공.
- LiveKit data:
  - `src/services/livekitGameService.ts` 신설.
  - 기존 `livekitChatService.ts`와 분리해 `LIVEKIT_GAME_TOPIC`, encode/decode, payload validator 관리.
  - `src/components/livekit/LiveKitTestRoom.tsx`의 `LiveKitDataController`에 `publishGameMessage()` 추가.
- 페이지 통합:
  - 단기: `src/pages/MeetingRoomPage.tsx`에 최소 wiring 추가.
  - 중기 권장: `src/pages/GameRoomPage.tsx`를 새로 만들고 LiveKit 연결/참가자 브리지만 공통 hook으로 추출.
- UI:
  - `src/components/game/GameBoard.tsx`
  - `src/components/game/GameChatPanel.tsx`
  - `src/components/game/ParticipantGameStatus.tsx`

게임 상태 단계는 다음 union으로 시작하는 것이 적절하다:

```ts
type GamePhase =
  | 'LOBBY'
  | 'WAITING_FOR_PLAYERS'
  | 'READY'
  | 'COUNTDOWN'
  | 'ATTACK_PREP'
  | 'ATTACKING'
  | 'JUDGING'
  | 'TURN_RESULT'
  | 'ROUND_RESULT'
  | 'GAME_RESULT'
```

## 3. 재사용/수정/제거 범주

### A. 그대로 재사용 가능한 코드

- LiveKit 연결 기본:
  - `src/services/livekitConnectionService.ts`의 `requestLiveKitToken()`, `removeLiveKitParticipant()`, `endFreeBetaRoom()`.
  - `server/index.ts`의 LiveKit env 처리, `createRoomServiceClient()`, 토큰 발급 기본 구조.
- 미디어 장치:
  - `src/services/deviceService.ts`의 `requestMediaStream()`, `toggleTrack()`, `stopMediaStream()`, 장치 목록 함수.
- LiveKit 참가자 매핑:
  - `src/services/livekitParticipantAdapter.ts`의 `mapLiveKitParticipantsToParticipants()` 계열. 단, language 필드는 나중에 축소 가능.
- 영상 렌더링:
  - `src/components/meeting/ParticipantCard.tsx`의 `ParticipantVideo`.
  - `src/components/meeting/VideoGrid.tsx` 일부. 게임 레이아웃에서는 wrapper는 바꾸고 카드 렌더링만 재사용 권장.
- 채팅 기본 모델:
  - `src/types/chat.ts`, `src/services/chatService.ts`는 `senderName: 'Say, Merang'`만 바꾸면 게임 채팅에도 유용하다.
- 방 생성/입장 기본:
  - `src/services/roomService.ts`의 `createServerRoom()`, `joinServerRoomByCode()`, `createInviteLink()`, `parseRoomCodeFromUrl()`.
- 호스트 제어:
  - `hostControlToken` 기반 강퇴/종료 검증 구조.

### B. 수정해서 재사용할 코드

- `src/pages/MeetingRoomPage.tsx`
  - 현재 너무 많은 책임을 가진다.
  - LiveKit 연결, 참가자 상태, 미디어 제어만 추출해 게임 방에서 재사용.
  - STT/번역/요약/Transcript 상태는 제거 또는 feature flag 뒤로 이동.
- `src/components/livekit/LiveKitTestRoom.tsx`
  - 이름을 `LiveKitRoomBridge` 등으로 변경할 후보지만 이번 단계에서는 변경하지 않는다.
  - `LiveKitDataController`에 게임 topic 송수신 추가 필요.
- `src/services/livekitChatService.ts`
  - 채팅/회의제어와 transcript/translation이 한 파일에 섞여 있다.
  - 게임 개발 전 `livekitDataService` 또는 `livekitGameService`로 분리 권장.
- `src/components/meeting/ConversationPanel.tsx`
  - 채팅 UI 일부만 `GameChatPanel`로 추출.
  - Transcript/번역 UI는 MEET MEET 초기 범위에서 제외.
- `src/components/meeting/ControlBar.tsx`
  - mic/camera/chat/participants/settings/leave는 재사용 가능.
  - captions/translation/screen share/recording 상태 문구는 게임용 컨트롤로 정리 필요.
- `src/pages/SetupPage.tsx`
  - 미디어 프리뷰, 방 코드 공유, 이름 입력은 재사용.
  - 언어/번역/자막 자동 시작 UI 제거.
  - 참가자 수 옵션은 2~4명으로 제한.
- `server/index.ts`
  - 방 레지스트리는 유지하되 `FreeBetaRoom`에 game state snapshot/version을 추가할지 검토.
  - 자발 퇴장 endpoint와 게임 세션 종료/재대결 endpoint가 필요할 수 있다.
- `src/App.tsx`
  - `Page`와 라우팅을 `game` 중심으로 변경.
  - Summary/History 이동 대신 게임 결과/재대결 화면으로 연결.

### C. 제거하거나 MEET MEET에서 비활성화할 코드

- 번역:
  - `src/services/translationService.ts`
  - `src/services/translationRecordService.ts`
  - `src/types/translation.ts`
  - `src/constants/translationMode.ts`
  - `server/index.ts`의 OpenAI 번역 API.
- STT/자막/Transcript:
  - `src/services/speechService.ts`
  - `src/types/transcript.ts`
  - `src/services/transcriptStorageService.ts`의 transcript 중심 저장.
  - `ParticipantCard` 자막 오버레이.
  - `ControlBar` caption 관련 UI.
  - `MeetingSettingsPanel` STT/자막/언어 설정.
- 회의 요약/기록:
  - `src/pages/MeetingSummaryPage.tsx`
  - `src/pages/MeetingHistoryPage.tsx`
  - `src/services/summaryService.ts`
  - `src/services/exportService.ts`
  - `src/services/localFirstStoragePolicyService.ts`
  - `MeetingSessionRecord`의 transcripts/translations/summaryStatus/history 관련 필드.
- 화면 공유:
  - MEET MEET 초기 “카메라 공격/이미지 공격”에 직접 필요하지 않으면 `screenShareService`, `ScreenShareCard`, screen share UI는 비활성화 후보.
- 브랜딩:
  - Say, Merang 텍스트/로고/topic/storage/cookie/package/README.

## 4. 신규 구조 제안

권장 폴더:

```text
src/
├── components/
│   ├── game/
│   │   ├── GameBoard.tsx
│   │   ├── GameChatPanel.tsx
│   │   ├── ParticipantGameStatus.tsx
│   │   ├── AttackStage.tsx
│   │   ├── LifeMeter.tsx
│   │   └── ResultPanel.tsx
│   └── livekit/
│       └── LiveKitRoomBridge.tsx
├── hooks/
│   ├── useLiveKitRoom.ts
│   ├── useLocalMedia.ts
│   └── useGameStateSync.ts
├── services/
│   ├── livekitGameService.ts
│   ├── gameStateManager.ts
│   ├── turnManager.ts
│   ├── lifeManager.ts
│   ├── attackManager.ts
│   └── judgeManager.ts
├── types/
│   └── game.ts
└── pages/
    └── GameRoomPage.tsx
```

기능별 제안:

- `GameBoard`
  - 위치: `src/components/game/GameBoard.tsx`
  - 역할: 중앙 보드. phase별로 lobby/waiting/ready/countdown/attack/judging/result 표시.
  - 입력: `gameState`, `localParticipant`, `participants`, action callbacks.
- `GameStateManager`
  - 위치: `src/services/gameStateManager.ts`
  - 역할: 순수 reducer. `applyGameEvent(state, event)`, `createInitialGameState(roomCode, participants)`.
  - LiveKit 수신 이벤트의 단일 진입점.
- `TurnManager`
  - 위치: `src/services/turnManager.ts`
  - 역할: 공격자 순서, 탈락자 skip, round 전환.
- `LifeManager`
  - 위치: `src/services/lifeManager.ts`
  - 역할: 참가자별 life 증감, 탈락 판정, 관전 전환.
- `AttackManager`
  - 위치: `src/services/attackManager.ts`
  - 역할: 카메라 공격/이미지 공격 payload 관리, 준비/공격 시간, 공격 콘텐츠 상태.
- `JudgeManager`
  - 위치: `src/services/judgeManager.ts`
  - 역할: 웃음 판정 입력, 투표/호스트 판정/셀프 신고 중 선택한 룰 구현.
- `GameChatPanel`
  - 위치: `src/components/game/GameChatPanel.tsx`
  - 역할: 대기 중 중앙 채팅. 기존 `ConversationPanel.renderChat()`에서 번역 의존성을 제거한 버전.
- `ParticipantGameStatus`
  - 위치: `src/components/game/ParticipantGameStatus.tsx`
  - 역할: life, 공격자 badge, 준비 완료, 탈락, 관전 상태를 참가자 영상 위에 표시.
- `Spectator 상태`
  - 타입: `GameParticipantState.status: 'active' | 'eliminated' | 'spectator' | 'disconnected'`.
  - 참가자가 life 0이면 `eliminated`, 재접속/늦은 입장 정책에 따라 `spectator`.
- `게임 상태 동기화`
  - 위치: `src/services/livekitGameService.ts`, `src/hooks/useGameStateSync.ts`.
  - LiveKit topic: `meet-meet-game-state`.
  - 이벤트 예: `game-state-snapshot`, `player-ready`, `countdown-started`, `attack-started`, `judge-submitted`, `life-updated`, `turn-advanced`, `game-ended`, `rematch-requested`.
  - 호스트 authoritative 모델 권장: 호스트가 최종 state snapshot/version 발행, 게스트는 action event 요청.
- `카메라 공격`
  - 기존 participant camera stream을 그대로 사용.
  - `AttackContent`에 `{ kind: 'camera', attackerIdentity }`.
  - UI는 공격자의 `ParticipantCard` 또는 전용 `AttackStage`에서 크게 표시.
- `이미지 공격`
  - 초기 구현은 이미지 URL/data URL을 data message로 직접 보내지 말고, 크기 제한이 있는 metadata만 동기화 권장.
  - 로컬 업로드 이미지는 `AttackContent { kind: 'image', imageId, objectUrl? }`로 시작하고, 멀티 클라이언트 동기화가 필요하면 별도 저장소/업로드 API가 필요하다.

## 5. 게임 상태 단계 검토

- `LOBBY`: 방 생성 직후. 참가자 입장, 닉네임, 카메라 확인.
- `WAITING_FOR_PLAYERS`: 최소 2명 미만이거나 호스트가 시작 전 대기. 중앙 `GameChatPanel` 표시.
- `READY`: 2~4명 충족. 참가자 ready 토글, 호스트 start 가능.
- `COUNTDOWN`: 시작 카운트다운. 모든 클라이언트는 서버/호스트 timestamp 기준으로 표시.
- `ATTACK_PREP`: 공격자에게 카메라/이미지 선택, 준비 시간 제공. 방어자는 대기 UI.
- `ATTACKING`: 공격 콘텐츠 표시. 현재 공격자와 대상/전체 대상 정책 필요.
- `JUDGING`: 웃음 여부 판정. 초기 버전은 수동 판정이 현실적이다.
- `TURN_RESULT`: 공격 성공/실패, life 변화 표시.
- `ROUND_RESULT`: 한 바퀴 종료, 탈락자 정리.
- `GAME_RESULT`: 우승자/순위/재대결.

## 6. Step 4 이후 권장 작업 순서

### Step 4. MEET MEET 브랜딩/범위 플래그 정리

- `MEET MEET` 명칭, favicon, title, README, storage prefix, LiveKit topic prefix 교체 계획 수립.
- STT/번역/요약/History를 바로 삭제하지 말고 `MEET_MEET_INITIAL_SCOPE` 기준으로 UI에서 먼저 숨긴다.
- 참가자 수를 2~4명으로 맞춘다.

### Step 5. LiveKit 공통 브리지 추출

- `LiveKitTestRoom`을 게임에서도 쓰기 쉬운 bridge로 정리한다.
- `useLiveKitRoom`, `useLocalMedia` hook을 만들어 `MeetingRoomPage`의 연결/미디어 책임을 줄인다.
- 기존 채팅/회의제어 data topic은 유지하되 게임 topic 추가 준비.

### Step 6. 게임 타입과 순수 상태 매니저 추가

- `src/types/game.ts`, `src/services/gameStateManager.ts`를 만든다.
- phase, participant status, life, turn, attack, judge, result 타입을 먼저 고정한다.
- unit test를 추가할 첫 후보는 `applyGameEvent()`, `advanceTurn()`, `applyLifeChange()`.

### Step 7. 게임 상태 LiveKit 동기화 추가

- `src/services/livekitGameService.ts`와 `useGameStateSync()` 추가.
- 호스트 authoritative snapshot/version 모델을 적용한다.
- late joiner가 현재 게임 snapshot을 받을 수 있는 흐름을 설계한다.

### Step 8. GameRoomPage와 중앙 GameBoard 구성

- `src/pages/GameRoomPage.tsx`를 추가하거나 `MeetingRoomPage`를 대체한다.
- 좌우 참가자 영상, 중앙 `GameBoard`, 대기 중 중앙 `GameChatPanel`, 하단 최소 컨트롤을 배치한다.
- 기존 `ParticipantCard` 영상 렌더링은 유지하고 게임 상태 overlay를 붙인다.

### Step 9. 웃참 공격전 MVP 구현

- `TurnManager`, `LifeManager`, `AttackManager`, `JudgeManager` 순으로 붙인다.
- 카메라 공격을 먼저 구현하고, 이미지 공격은 파일 크기/동기화 정책 확정 후 구현한다.
- 탈락/관전/결과/재대결까지 한 게임 루프를 완성한다.

### Step 10. 제외 기능 제거 및 저장 구조 재설계

- 번역/STT/자막/Transcript/Summary/History 관련 파일과 타입을 단계적으로 제거한다.
- 게임 결과 저장이 필요하면 `GameSessionRecord`로 새 localStorage 구조를 만든다.
- `server/index.ts`에서 OpenAI 번역 endpoint와 관련 env를 제거한다.

### Step 11. 배포 설정 정리

- Netlify를 쓸 경우 `netlify.toml` 또는 functions/API 서버 분리 전략을 확정한다.
- LiveKit env는 서버 전용으로 유지한다.
- `VITE_API_BASE_URL` 운영값을 MEET MEET API 주소로 교체한다.
