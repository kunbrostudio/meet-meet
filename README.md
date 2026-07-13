# Say, Merang

실시간 회의 통역, 자막 기록, 채팅, 화면 공유, 회의 요약을 제공하는 화상회의 MVP입니다.

현재 버전은 LiveKit 기반 1:1/소규모 회의 연결을 지원하며, 회의 기록은 브라우저 `localStorage`에 저장됩니다. 실제 번역 API는 비용/쿼터 관리를 위해 기본 비활성화되어 있고, 앱은 로컬 번역 fallback으로 계속 동작합니다.

## 주요 기능

- 방 생성, roomCode 입장, 방 코드/초대 링크 복사
- LiveKit 자동 연결
- 카메라·마이크 장치 선택 및 on/off 제어
- 참가자 비디오 그리드, focus mode, 모바일 portrait/landscape 레이아웃
- LiveKit 화면 공유 publish/subscribe
- 화면 공유 fullscreen 몰입 모드
- 브라우저 SpeechRecognition 기반 실시간 자막
- LiveKit data packet 기반 채팅 동기화
- LiveKit data packet 기반 transcript 동기화
- Conversation 패널, 모바일 bottom sheet, landscape compact panel
- Chat unread badge
- 방장 참가자 내보내기
- 참가자 나가기 / 방장 회의 종료
- 회의 SummaryPage 이동
- HistoryPage 저장/복원
- Markdown 회의록 내보내기
- localStorage 기반 meeting session persistence

## 로컬 실행 방법

처음 한 번 의존성을 설치합니다.

```bash
npm install
```

프로젝트 루트에 `.env.example`을 참고해 `.env`를 만듭니다.

```bash
OPENAI_API_KEY=
OPENAI_TRANSLATION_MODEL=gpt-5-mini
TRANSLATION_SERVER_PORT=8787
VITE_API_BASE_URL=
VITE_ENABLE_MOCK_DATA=false
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

외부 회의 테스트에는 터미널 2개가 필요합니다.

Terminal 1 — API 서버:

```bash
npm run server
```

Terminal 2 — Vite 개발 서버:

```bash
npm run dev
```

한 터미널에서 둘 다 실행하려면 다음 명령도 사용할 수 있습니다.

```bash
npm run dev:all
```

## API 서버

Express 서버는 기본적으로 `http://localhost:8787`에서 실행됩니다.

주요 endpoint:

- `GET /api/health`
- `POST /api/translate`
- `POST /api/livekit/token`
- `POST /api/livekit/remove-participant`

상태 확인:

```bash
curl http://localhost:8787/api/health
```

`/api/health`는 다음 정보를 반환합니다.

- `openaiConfigured`
- `livekitConfigured`
- `model`
- `serverTime`

`LIVEKIT_API_SECRET`과 `OPENAI_API_KEY`는 서버에서만 사용해야 하며 프론트엔드 환경 변수로 노출하면 안 됩니다.

프론트엔드가 별도 배포된 API 서버를 사용해야 하는 경우 `VITE_API_BASE_URL`을 설정합니다.

```bash
VITE_API_BASE_URL=https://say-merang-api.onrender.com
```

로컬 개발에서 값을 비워두면 기존처럼 `/api/...` 상대경로를 사용하고, Vite proxy를 통해 로컬 Express 서버로 전달됩니다.

샘플 참가자/샘플 transcript 데이터는 기본적으로 꺼져 있습니다. 개발 중 fixture 데이터를 확인해야 할 때만 `.env`에서 다음 값을 켭니다.

```bash
VITE_ENABLE_MOCK_DATA=true
```

이 플래그는 개발 모드에서만 적용됩니다.

## 번역 상태

번역 UI는 `VITE_TRANSLATION_MODE`로 제어합니다.

- `dev`: 개발 중 수동/자동 번역 UI를 테스트할 수 있습니다.
- `free`: 무료 MVP 모드입니다. 번역 버튼은 숨기고 프리미엄 준비 중 안내를 보여줍니다.
- `premium`: 수동/자동 번역 UI를 활성화할 수 있는 구조입니다.

값을 지정하지 않으면 개발 서버에서는 `dev`, 배포 빌드에서는 `free`로 동작합니다.

실제 번역 API 호출은 별도로 `VITE_USE_REAL_TRANSLATION_API`로 제어합니다. 기본값은 실제 API 사용이며, 디버그나 비용 제어가 필요하면 `.env`에 `VITE_USE_REAL_TRANSLATION_API=false`를 지정해 로컬 fallback 번역만 사용할 수 있습니다.

나중에 실제 번역 API를 켜더라도 OpenAI API 쿼터/결제/네트워크 오류가 발생하면 앱은 fallback 번역으로 계속 동작해야 합니다.

## 검사

```bash
npm run build
npm run lint
```

빌드 결과는 `dist/`에 생성됩니다.

## 외부 테스트 체크리스트

- 일반 창에서 방 생성
- 시크릿 창 또는 다른 브라우저에서 roomCode로 입장
- 카메라/마이크 권한 허용 및 거부 안내 확인
- 카메라/마이크 on/off 확인
- 채팅 송수신 확인
- 실시간 자막 생성 및 동기화 확인
- 화면 공유 시작/중지 확인
- 화면 공유 fullscreen 진입/종료 확인
- 참가자 내보내기 확인
- 참가자 나가기 확인
- 방장 회의 종료 확인
- Summary / History / Markdown export 확인
- 모바일 portrait / landscape 레이아웃 확인

## 배포 전 주의사항

프론트엔드만 Netlify 같은 정적 호스팅에 배포하면 UI는 보일 수 있지만, 다음 API는 동작하지 않습니다.

- `/api/translate`
- `/api/livekit/token`
- `/api/livekit/remove-participant`

외부 테스트를 하려면 Express 서버를 별도로 배포하거나 serverless/function 환경으로 옮겨야 합니다. 선택지는 예를 들면 다음과 같습니다.

- Render
- Railway
- Fly.io
- Vercel Serverless Functions
- Netlify Functions

이번 MVP에서는 배포 설정을 자동으로 변경하지 않습니다. 실제 배포 시에는 프론트엔드의 `/api` 요청이 배포된 API 서버 또는 functions endpoint로 연결되도록 설정해야 합니다.

Netlify 프론트엔드와 Render API 서버를 함께 사용할 때는 Netlify 환경변수에 다음 값을 추가합니다.

```bash
VITE_API_BASE_URL=https://say-merang-api.onrender.com
```

이 값이 있어야 브라우저 요청이 `https://say-merang.netlify.app/api/...`가 아니라 `https://say-merang-api.onrender.com/api/...`로 전송됩니다.

## 프로젝트 구조

```text
src/
├── components/
│   ├── common/
│   └── meeting/
├── constants/
├── fixtures/
├── pages/
├── services/
└── types/
```

- `types`: Participant, Transcript, ChatMessage, MeetingMeta, Room 등 공통 모델
- `services`: LiveKit, 미디어, 자막, 번역, 저장, 화면 공유 등 데이터/브라우저 로직
- `fixtures`: API 없이 앱을 계속 사용할 수 있게 하는 샘플 데이터
- `components/meeting`: 미팅룸 카드, 패널, 컨트롤, 모달 UI
- `pages`: 랜딩, 설정, 미팅룸, 요약, 기록 페이지

## 아직 연결하지 않은 것

- Supabase 로그인 및 서버 저장
- 실제 운영 인증/권한 시스템
- 기본 활성화된 외부 번역 API
