# MEET MEET

밋밋 / MEET MEET은 친구들과 만나서 바로 노는 실시간 화상 놀이터입니다.

임시 메인 카피: 별거 없는 게임, 별일 다 생기는 방

현재 단계는 기존 안정 버전에서 분리한 MEET MEET 개발용 기본 프로젝트입니다. LiveKit 기반 화상방, 방 생성/코드 입장, 카메라/마이크 제어, 텍스트 채팅, 호스트 권한 처리를 유지하고, 번역/STT/자막/Transcript/요약/회의 기록 UI는 초기 사용자 흐름에서 제외했습니다.

## 현재 유지 기능

- 방 만들기, 코드 입장, 초대 링크 복사
- LiveKit 자동 연결
- 카메라/마이크 장치 선택 및 on/off 제어
- 스피커 장치 선택 구조
- 참가자 비디오 그리드와 focus mode
- 텍스트 채팅 동기화
- 참가자 목록
- 호스트 참가자 내보내기
- 호스트 방 종료
- 참가자 나가기
- 화면 공유 기능

## 초기 범위에서 제외한 기능

- 번역
- STT
- 실시간 자막
- Transcript
- 언어 선택
- 수동/자동 번역
- 회의 요약
- 회의 기록
- 기록 내보내기
- 자막/번역 설정

관련 서비스 파일과 타입은 아직 남아 있지만 초기 화면과 라우팅에서는 접근하지 않습니다.

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
VITE_TRANSLATION_MODE=free
VITE_USE_REAL_TRANSLATION_API=true
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
FREE_BETA_MAX_ACTIVE_ROOMS=3
FREE_BETA_MAX_PARTICIPANTS=4
FREE_BETA_MAX_ACTIVE_ROOMS_PER_SESSION=1
FREE_BETA_ROOM_DURATION_MINUTES=60
FREE_BETA_CREATE_RATE_LIMIT=3
FREE_BETA_CREATE_RATE_WINDOW_SECONDS=600
FREE_BETA_JOIN_RATE_LIMIT=10
FREE_BETA_JOIN_RATE_WINDOW_SECONDS=60
FREE_BETA_MEETING_CREATION_ENABLED=true
```

외부 화상방 테스트에는 터미널 2개가 필요합니다.

```bash
npm run server
```

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
- `POST /api/free-beta/rooms`
- `POST /api/free-beta/rooms/join`
- `POST /api/free-beta/rooms/end`
- `POST /api/livekit/token`
- `POST /api/livekit/remove-participant`

아직 남아 있는 `/api/translate`는 초기 MEET MEET 화면에서 사용하지 않습니다.

`LIVEKIT_API_SECRET`과 `OPENAI_API_KEY`는 서버에서만 사용해야 하며 프론트엔드 환경 변수로 노출하면 안 됩니다.

프론트엔드가 별도 배포된 API 서버를 사용해야 하는 경우 `VITE_API_BASE_URL`을 설정합니다.

```bash
VITE_API_BASE_URL=https://meet-meet-api.example.com
```

로컬 개발에서 값을 비워두면 `/api/...` 상대경로를 사용하고, Vite proxy를 통해 로컬 Express 서버로 전달됩니다.

## 검사

```bash
npm run build
npm run lint
```

빌드 결과는 `dist/`에 생성됩니다.

## 외부 테스트 체크리스트

- 일반 창에서 방 생성
- 시크릿 창 또는 다른 브라우저에서 `MMT-XXXXXX` 코드로 입장
- 카메라/마이크 권한 허용 및 거부 안내 확인
- 카메라/마이크 on/off 확인
- 채팅 송수신 확인
- 참가자 내보내기 확인
- 참가자 나가기 확인
- 방장 방 종료 확인
- 모바일 portrait / landscape 레이아웃 확인

## 배포 전 주의사항

프론트엔드만 Netlify 같은 정적 호스팅에 배포하면 UI는 보일 수 있지만, 다음 API는 동작하지 않습니다.

- `/api/livekit/token`
- `/api/livekit/remove-participant`

외부 테스트를 하려면 Express 서버를 별도로 배포하거나 serverless/function 환경으로 옮겨야 합니다.

Netlify 프론트엔드와 별도 API 서버를 함께 사용할 때는 Netlify 환경변수에 API 서버 주소를 추가합니다.

```bash
VITE_API_BASE_URL=https://meet-meet-api.example.com
```

## 프로젝트 구조

```text
src/
├── components/
│   ├── common/
│   ├── livekit/
│   └── meeting/
├── constants/
├── fixtures/
├── pages/
├── services/
└── types/
```

- `types`: Participant, ChatMessage, MeetingMeta, Room 등 공통 모델
- `services`: LiveKit, 미디어, 채팅, 저장, 화면 공유 등 데이터/브라우저 로직
- `components/meeting`: 화상방 카드, 패널, 컨트롤, 모달 UI
- `pages`: 랜딩, 설정, 화상방 페이지

## 다음 개발 방향

- LiveKit 공통 브리지 추출
- `src/types/game.ts`와 게임 상태 manager 추가
- 게임 상태 LiveKit topic 추가
- 중앙 GameBoard와 게임 채팅 패널 추가
- 웃참 공격전 MVP 구현
