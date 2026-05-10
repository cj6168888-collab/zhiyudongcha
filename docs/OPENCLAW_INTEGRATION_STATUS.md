# OpenClaw Integration Status

## Active Runtime Entry Points

OpenClaw remote control and task orchestration are now integrated into the main application instead of being kept as a sidecar feature drop.

Server routes:
- `server/routes/remote-control.ts` is mounted at `/api/remote`.
- `server/routes/tasks.ts` is mounted at `/api/tasks`.
- `server/routes.ts` initializes `remoteControlService` on `/ws/remote-control` and starts `taskOrchestrator`.

Server services:
- `server/services/remote-control/RemoteControlService.ts` manages PC device sessions, screenshots, commands, and database-backed device state.
- `server/services/task-orchestrator/TaskOrchestrator.ts` manages task CRUD, execution history, cron triggers, follow-up tasks, and persistence.
- `server/services/unified-executor/UnifiedExecutor.ts` and `server/services/result-notifier/ResultNotifier.ts` remain available through their service indexes.

Client routes:
- Mobile remote control: `/remote-pc` via `client/src/pages/mobile/RemotePCConsole.tsx`.
- Mobile task center: `/tasks` via `client/src/pages/mobile/TaskCenter.tsx`.
- Desktop remote control: `/desktop/control`.
- Desktop task center: `/desktop/tasks`.

## Cleanup Decision

The temporary `openclaw-features/` package was removed after integration because the active code already lives in the main server and client trees. Keeping a duplicate package would allow drift, and one packaged file contained generation transcript text that should not be treated as source.

Unused root-level duplicate pages were also removed:
- `client/src/pages/remote-pc-console.tsx`
- `client/src/pages/task-center.tsx`

## Verification Coverage

Current route coverage:
- `tests/routes/remote-control.test.ts`
- `tests/routes/tasks.test.ts`
- `tests/routes/openclaw.test.ts`

Current service coverage:
- `server/tests/unit/services/task-orchestrator.test.ts`

Recommended next checks after related changes:
- `npm run test:api`
- `npm run test:unit`
- `npm run build`
