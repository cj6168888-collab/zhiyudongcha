# Route Lazy Load Smoke

Date: 2026-05-10

## Scope

This smoke pass verifies the route-level lazy loading change in `client/src/App.tsx`.

The app was served from the production build through `vite preview` on a temporary local port. Service workers were blocked during the browser run so stale cached assets could not hide missing chunks.

## Routes Checked

Each route was opened in both a desktop viewport (`1440x900`) and a mobile viewport (`390x844`):

- `/`
- `/awakening`
- `/experts`
- `/projects`
- `/chat`
- `/desktop`
- `/desktop/chat`
- `/desktop/tasks`
- `/remote-pc`

## Result

All 18 route checks passed.

Verified:

- `#root` rendered non-empty content for every route.
- Dynamic JavaScript route chunks were requested and loaded.
- No document, script, or stylesheet requests failed.
- No dynamic import, module script, or chunk loading errors were observed.

Known local-preview noise:

- Static `vite preview` does not provide backend API or WebSocket handlers.
- Some pages log expected API/WS fallback errors in this isolated mode, but those were not asset or chunk failures.

## Related Verification

The lazy-loading commit was also verified with:

- `npm run build`
- `npm test`
- `npm run test:api:health`
- `android/.\\gradlew.bat :app:assembleDebug`
