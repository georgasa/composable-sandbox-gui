# Πες Βρες

Voice-based word game: the app asks a category ("Πες ένα ζώο που πετάει"), the
player says a word out loud, speech-to-text turns it into text, and an AI
evaluator decides — semantically, not from a hardcoded answer list — whether
the answer fits the category.

```
pes-vres-game/
  backend/   Node.js + TypeScript REST API, AI evaluator (mock + OpenAI)
  mobile/    Flutter app (Android-first), speech recognition + game UI
```

## How answer evaluation works

There is no `correctAnswers = [...]` list anywhere. `POST /api/evaluate`
sends the question and the spoken answer to an evaluator and gets back a
structured verdict:

```json
{ "answer": "παπαγάλος", "correct": true, "confidence": 0.96, "points": 100, "reason": "..." }
```

Two evaluators implement the same interface (`AiEvaluator`):

- **Mock** (`AI_MODE=mock`, the default) — deterministic, no network calls,
  free. It doesn't judge meaning; it exists so you can play-test the whole
  app (recording, scoring, UI, edge cases) without spending API credits.
- **Real** (`AI_MODE=real`) — calls the OpenAI API with a prompt that asks it
  to judge whether the answer semantically belongs to the category, and to
  return strict JSON (`correct`, `confidence`, `reason`). The backend then
  computes `points` from `correct` + `confidence` (100 / 75 / 50 / 0) so the
  scoring rule lives in one place (`src/services/scoring.ts`), not in the AI
  prompt.

The mobile app can also ask per-request for `mode: "mock" | "real"` (that's
the AI MODE switch on the home screen) — it never talks to OpenAI directly
and never contains an API key. The key only ever lives in the backend's
environment.

## Backend

```
cd backend
cp .env.example .env      # fill in OPENAI_API_KEY if you want AI_MODE=real
npm install
npm run dev                # http://localhost:3000, hot reload
```

Other useful commands:

```
npm run typecheck   # tsc --noEmit
npm run build        # compile to dist/
npm start             # run compiled dist/index.js
npm test               # vitest — 13 tests covering scoring, mock evaluator,
                        # the /api/evaluate route (missing fields, empty
                        # answer, Greek natural phrasing, mode override,
                        # graceful failure when real mode has no API key)
```

Verified in this environment: `npm install`, `tsc --noEmit`, `npm run build`,
and `npm test` all pass (13/13), and a manual smoke run of the built server
against `/api/health`, `/api/questions`, and `/api/evaluate` returned the
expected responses.

Endpoints:

- `GET /api/health` → `{ status, aiMode }`
- `GET /api/questions` → the 20 static Greek questions
- `POST /api/evaluate` → `{ question, answer, mode? }` → `EvaluationResult`

Edge cases handled server-side: missing fields (400), empty/whitespace
answer (short-circuits to `correct:false, points:0` without calling the AI),
AI timeout (`OPENAI_TIMEOUT_MS`, default 8s, aborts the request), OpenAI API
errors and network failures (503 with a Greek user-facing message), and
`real` mode requested without an `OPENAI_API_KEY` configured (400 with a
clear message) — none of these crash the process (see
`src/middleware/error_handler.ts` and the `process.on('uncaughtException'/
'unhandledRejection')` guards in `src/index.ts`).

Data shapes for a future multiplayer mode (`Player`, `Room`, `Round`,
`Answer`, `Score`) already exist in `src/models/multiplayer.ts`, unused for
now, so a WebSocket layer can be added later without reshaping anything.

## Mobile app (Flutter)

All the Dart source is committed under `mobile/lib/`:

```
mobile/lib/
  main.dart
  models/       Question, EvaluationResult, GameState/GamePhase/AiMode,
                multiplayer placeholders, bundled fallback question list
  services/
    speech_recognition_service.dart   abstraction over the STT engine
    api_service.dart                  talks to the backend, maps failures
                                       to Greek error messages
    game_service.dart                 orchestrates questions/speech/API
  state/
    game_provider.dart                ChangeNotifier: countdown timer,
                                       game phase, score
  screens/       home_screen.dart, game_screen.dart, result_screen.dart
  widgets/       mic_button.dart, timer_ring.dart, score_badge.dart
```

Speech recognition uses the `speech_to_text` plugin, which drives the
**native** Android/iOS speech recognizer with locale `el_GR` — there is no
fake button that types a canned string. `SpeechRecognitionService` is an
interface so a different STT backend (e.g. calling OpenAI's speech-to-text
instead of the on-device recognizer) can be swapped in later without
touching the UI or game logic.

### ⚠️ What was and wasn't verified

This session's environment has Node.js but **no Flutter/Dart SDK installed**,
so `flutter pub get` / `flutter analyze` / `flutter build` could not be run
here. The backend (which the game logic and scoring genuinely depend on) was
fully installed, built, and tested (see above). The Dart code was written
and reviewed carefully but not compiled — **you must run `flutter pub get`
and try the app yourself** before trusting it fully; see below for the exact
steps and the one manifest edit it needs.

### Setting up the Android project files

This repo intentionally does **not** commit `mobile/android/`. That folder
needs a `gradle-wrapper.jar` binary matched to your installed Flutter/Gradle
version, which `flutter create` generates correctly for you — hand-writing
it here risked shipping an Android project that fails to build for reasons
unrelated to this game. One command fixes that:

```
cd mobile
flutter create --platforms=android --org com.pesvres --project-name pes_vres .
```

`flutter create .` on a directory that already has a `pubspec.yaml` only
**adds the missing platform folder** — it will not overwrite `lib/` or your
`pubspec.yaml` dependencies.

Then add the microphone permission and the Android 11+ speech-recognizer
query to the generated `android/app/src/main/AndroidManifest.xml` (inside
the top-level `<manifest>` tag, as siblings of the existing
`<uses-permission android:name="android.permission.INTERNET"/>` if present):

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />

<queries>
    <intent>
        <action android:name="android.speech.RecognitionService" />
    </intent>
</queries>
```

If you'll test against a backend running as plain `http://` on your own
computer (not `https://`), also add `android:usesCleartextTraffic="true"` to
the `<application ...>` tag — Android blocks plaintext HTTP by default from
API level 28 onward, and this is a prototype without a TLS cert.

### Running it on your Android phone

1. Start the backend on your computer (`npm run dev` in `backend/`, default
   `AI_MODE=mock` so you don't need an API key yet).
2. Plug your phone in via USB with **USB debugging** enabled (Developer
   options), and confirm `flutter devices` sees it.
3. Let the phone reach your computer's `localhost:3000`:
   ```
   adb reverse tcp:3000 tcp:3000
   ```
   (Redo this after replugging the phone. If you'd rather use Wi-Fi, skip
   `adb reverse` and instead pass your computer's LAN IP in step 4, e.g.
   `http://192.168.1.23:3000` — find it with `ipconfig`/`ifconfig`; the
   phone and computer must be on the same network.)
4. From `mobile/`:
   ```
   flutter pub get
   flutter run --dart-define=API_BASE_URL=http://127.0.0.1:3000
   ```
5. Grant the microphone permission when prompted, tap **ΠΑΙΞΕ**, then tap
   the mic and say a word in Greek out loud.

To build a standalone APK instead of running via USB:

```
flutter build apk --dart-define=API_BASE_URL=http://<your-computer-LAN-IP>:3000
```

(`adb reverse` only works for a USB-tethered `flutter run` session, so an
installed APK needs the real LAN IP, or a backend deployed somewhere
reachable from the phone.) The APK lands at
`build/app/outputs/flutter-apk/app-release.apk` — copy it to the phone and
install it (allow "install from unknown sources" if asked).

To try the real semantic AI instead of the mock evaluator: put a real key in
`backend/.env` (`AI_MODE=real`, `OPENAI_API_KEY=sk-...`), restart the
backend, and switch the **AI MODE** toggle on the home screen to **Real**.

## The 20 questions

Static and local for this prototype (`backend/src/services/questions_data.ts`,
mirrored in `mobile/lib/models/local_questions.dart` as an offline fallback
used only if the app can't reach `/api/questions`). Swapping these for
AI-generated questions later just means changing what populates that array —
nothing else in the game depends on them being static.

## Edge cases covered

| Case | Handling |
|---|---|
| Empty / silent answer | Backend short-circuits to `correct:false, points:0` without calling the AI; timer hitting 0 with no speech does the same. |
| Speech recognition failure / no mic permission | `SpeechRecognitionService` reports an error → game screen shows a Greek error message with a retry button that keeps your score and re-opens the same question. |
| 10s timer expires mid-recording | Whatever was transcribed so far is submitted for evaluation. |
| Irrelevant or very unsure answer | The AI (mock or real) returns `correct:false` or a low `confidence`, which the shared `computePoints()` turns into 0 points either way. |
| Backend / network / OpenAI unreachable or slow | 8s AI timeout, request timeout on the client, and a friendly "Δεν κατάφερα να σε ακούσω. Ξαναπροσπάθησε." style message — the app never crashes, it shows a retry screen. |
| `real` mode requested without an API key | Backend returns 400 with a clear message instead of trying and failing silently. |
| Natural Greek phrasing ("η Κρήτη", "Κρήτη νομίζω") | The real evaluator's prompt explicitly tells it to ignore articles/filler words; the mock evaluator's tests assert this phrasing is still accepted. |
