# MEET MEET Step 5-C-3 Report

작성일: 2026-07-28

## 원인 조사

전체 CSS에서 `opacity`, `filter`, `backdrop-filter`, `mix-blend-mode`, `background-blend-mode`, `linear-gradient`, `rgba()`, `::before`, `::after`를 검색했다.

실제 tint의 핵심 원인은 `src/App.css`의 Step 5-C game room theme 영역에 있던 아래 selector였다.

```css
.meeting-page .participant-game-card::before,
.meeting-page .game-board::before,
.meeting-page .participant-waiting-slot::before
```

문제 property:

- `position: absolute`
- `z-index: 3`
- `inset: 0`
- `background: linear-gradient(...)`
- `opacity: 0.62`

이 pseudo element가 참가자 카드, GAME BOARD, waiting slot 전체 surface 위에 올라가면서 webcam video, 참가자 이름, HOST badge, mic UI, board content까지 cyan/magenta tint와 낮은 대비를 만들 수 있었다.

추가로 `.meeting-page .participant-card-shade`의 gradient overlay가 participant video 위에 남아 있어 실제 webcam 영상 대비를 낮출 수 있었다.

부모 container에 `opacity: 0.x`를 적용한 구조는 이번 원인의 핵심으로 보이지 않았다. 문제는 부모 opacity가 아니라 surface 위의 absolute pseudo overlay와 video 위 shade였다.

## 변경한 CSS

`src/App.css`에 최소 override를 추가했다.

- game room surface pseudo overlay 제거
- participant video 정상화
- participant video 위 shade 제거
- GAME BOARD surface를 `#080d1a` deep navy로 고정
- waiting slot을 dark transparent surface로 고정

핵심 변경:

```css
.meeting-page .participant-game-card::before,
.meeting-page .game-board::before,
.meeting-page .participant-waiting-slot::before {
  content: none;
  display: none;
}

.meeting-page .participant-game-card,
.meeting-page .participant-game-card .participant-video,
.meeting-page .participant-game-card video {
  opacity: 1;
  filter: none;
  mix-blend-mode: normal;
}

.meeting-page .participant-game-card .participant-card-shade {
  display: none;
}
```

## Webcam 확인

CSS 기준으로 webcam video에는 다음을 보장했다.

- `opacity: 1`
- `filter: none`
- `mix-blend-mode: normal`
- video 위 pseudo gradient overlay 제거
- video 위 `.participant-card-shade` 제거

게임 스타일은 video 자체가 아니라 카드 border, badge, control, board frame 쪽에만 남겼다.

## 변경하지 않은 항목

- LiveKit 로직
- game state synchronization
- participant distribution
- room logic
- Chat logic
- GAME BOARD 기능
- 레이아웃 구조
- 새로운 기능

## 검증 결과

실행 명령:

```bash
npm run lint
npm run build
```

결과:

- `npm run lint`: 통과
- `npm run build`: 통과

빌드 시 기존과 같은 Vite chunk size warning이 표시되지만 실패는 아니다.
