# MEET MEET Step 6-M Report

## Scope

Step 6-M replaces the bright card-style Landing page with a dark retro arcade lobby. This step does not add public matchmaking backend, real global presence, or any game-room logic.

## Changed Files

- `src/pages/LandingPage.tsx`
- `src/App.css`
- `docs/MEET_MEET_STEP6M_REPORT.md`

The existing game room, Fair Play, LiveKit, Life, attack content, and state sync files were not intentionally changed in this step.

## Desktop Structure

Desktop lobby uses:

- top arcade HUD header
- left static demo player column with 2 cards
- center arcade board
- right static demo player column with 2 cards
- bottom arcade control bar

The content is constrained by `.landing-shell` so very wide screens do not spread the UI too far.

## Mobile Structure

Mobile uses:

- compact one-line header
- full-width main arcade board
- horizontal demo player carousel below the board
- sticky bottom control bar

Desktop side columns are hidden below tablet width and replaced by `.landing-mobile-carousel`.

## Intro / Games Tabs

`LandingGameBoard` has two tab buttons:

- `Intro`
- `Games`

`Intro` shows:

- `MEET MEET` game title
- arcade hero image using `src/assets/landing/meeting-collaboration.jpg`
- short slogan: `DON'T JUST CHAT. PLAY.`

`Games` shows a scrollable static demo list labeled as demo/coming soon.

## Demo Player Cards

`demoPlayers` is static Landing-only data in `LandingPage.tsx`.

These cards are not connected to:

- LiveKit participants
- current room roster
- camera streams
- real user profiles
- game Life state

Demo Life values such as `♥♥♡` are decorative only.

## Bottom Controls

The bottom bar includes:

- `CAMERA`
- `AUDIO`
- `BROWSE GAMES`
- `JOIN CODE`
- `CREATE ROOM`

Connections:

- `CAMERA` and `AUDIO` call existing `onStart`, sending the user to the existing prejoin setup flow.
- `BROWSE GAMES` switches the center board to the Games tab.
- `JOIN CODE` opens the arcade room-code dialog.
- `CREATE ROOM` calls existing `onStart`.

## Existing Create / Join Flow

The redesign keeps the GR1B prejoin policy:

- `CREATE ROOM` or `CAMERA` or `AUDIO`
- Setup page
- camera/microphone setup
- Pre-Join Face Check
- PASS
- server room creation
- meeting entry

Join code:

- `JOIN CODE`
- MMT room code dialog
- existing `onJoin(code)`
- Setup page
- Pre-Join Face Check
- PASS
- server join
- meeting entry

The Landing page does not bypass Face Check.

## Mock Public Games

The Games tab uses static `demoGames` data only.

Rows show disabled `JOIN` buttons. They do not call fake room joins or create nonexistent public rooms.

No public room discovery backend was added.

## Online Count

The header uses a neutral `LOBBY / FRIENDS READY` HUD. It does not hardcode a fake production online count such as `126`.

No global presence backend was added.

## Responsive Breakpoints

Implemented CSS behavior:

- desktop: `>= 1024px`, side demo columns visible
- tablet: `< 1024px`, demo carousel below board
- mobile: `< 768px`, compact header, mobile board sizing, sticky control bar

The mobile carousel uses horizontal scroll and snap-style card sizing.

## Asset Structure

No new raster character assets were added.

The hero area reuses:

- `src/assets/landing/meeting-collaboration.jpg`

Demo characters are CSS-built arcade placeholders and remain separate from real participant/video components.

## Say, Merang Style Separation

The active Landing UI no longer uses the previous bright SaaS-like visible structure:

- no white card grid as the visible main composition
- no corporate blue hero card
- no photo 2x2 landing layout

The visible first screen now uses:

- dark space background
- subtle star/grid layers
- angular neon HUD frames
- cyan/magenta arcade accents
- static demo player cards
- arcade bottom controls

## Accessibility

Implemented:

- real `button` elements for controls and tabs
- `role="tab"` and `aria-selected`
- join code dialog uses `role="dialog"` and `aria-modal`
- decorative background layers use `aria-hidden`
- hero image has descriptive alt text
- disabled demo `JOIN` buttons cannot trigger fake actions

## Validation

Executed:

- `npm run lint`: passed
- `npm run build`: passed

Existing lint warning remains:

- `src/pages/MeetingRoomPage.tsx` has one existing `react-hooks/exhaustive-deps` warning.

Build shows existing Vite chunk-size warnings only.

## Manual Checks Needed

Recommended browser checks:

- Desktop 1440x900: header, side demo cards, center board, bottom controls
- Tablet 768-1023px: board not too narrow, carousel visible
- Mobile 375x812, 390x844, 430x932: no horizontal page overflow, sticky controls usable
- Create Room reaches Setup and Face Check before server room creation
- Join Code accepts `MMT-XXXXXX` and preserves existing join flow
- Games tab scrolls inside the board and disabled demo joins do nothing

## Known Limits

- No real online player count.
- No public room discovery.
- Demo player visuals are CSS placeholders, not final mascot art.
- Camera/Audio buttons currently route into the existing prejoin setup flow rather than opening separate device-only panels.

## Step 6-H Continuation

Step 6-H can continue with game-end flow while keeping this lobby as the entry point:

- game result screen
- rematch flow
- return-to-lobby flow
- reconnect from lobby to existing room if needed
