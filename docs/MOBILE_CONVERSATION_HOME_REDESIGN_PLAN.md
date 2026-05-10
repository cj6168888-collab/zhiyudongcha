# Mobile Conversation Home Redesign Plan

> Version: r31 draft
> Date: 2026-05-10
> Scope: Mobile frontend information architecture and home experience redesign
> Principle: Open with Xiaozhi. Speak to start. Confirm to execute. Results flow back.
> Implementation stance: Keep the first release shippable. Build the new home as a real product surface, not a speculative full rewrite.

## 1. Why We Are Redesigning

The current mobile home is useful as a feature map, but it does not fully express the product intent described in the foundation documents:

- Xiaozhi is a loyal, intelligent, affectionate digital-life assistant, not only a dashboard.
- The R1 product loop is input -> understanding -> confirmation -> execution -> feedback -> reflection.
- Mobile should be the fastest path to command, context, permission, execution, and review.
- Automation and device control must expose state, authorization, and risk clearly.

The new mobile home should therefore become a conversation-first operational surface. It should still provide access to projects, experts, vault, devices, tasks, and Navigator capabilities, but those modules must support the conversation loop instead of competing with it.

## 2. Product Positioning

### Old Position

Mobile home as a command-center directory:

- HP, compute mode, battle report
- Expert matrix
- Project/contact cards
- Scanner/task/remote/skill/workflow entrances

This is visually coherent, but it makes every module feel equally important.

### New Position

Mobile home as Xiaozhi's daily command conversation:

- Primary input is always available.
- Xiaozhi presents the current state and one or two useful next actions.
- Pending confirmations are visible before deep navigation.
- Execution results return into the conversation.
- Advanced modules live behind capability panels or secondary tabs.

## 3. Design Goals

1. Make conversation the default mobile entry.
2. Make the R1 loop visible in the UI.
3. Make Xiaozhi feel present, not decorative.
4. Show current context before showing feature lists.
5. Treat permissions, zones, and sensitive actions as first-class UI states.
6. Reduce jargon on the home screen.
7. Keep feature access broad but progressively disclosed.
8. Clearly distinguish Available, Experimental, Needs setup, and Needs authorization capabilities.

## 4. Non-Goals

- Do not rebuild every mobile page in this phase.
- Do not remove existing modules such as projects, contacts, experts, vault, tasks, devices, remote control, or workflow.
- Do not make a marketing-style landing page.
- Do not hide safety, audit, or authorization behind settings only.
- Do not make the chat page a plain message list without execution cards.

## 5. New Mobile Information Architecture

### Bottom Navigation

Use five primary tabs:

| Tab | Route | Purpose |
| --- | --- | --- |
| Conversation | `/` | Xiaozhi home, command input, execution loop |
| Tasks | `/tasks` | Todo, automation, recurring jobs, execution history |
| Vault | `/vault` | Memory, files, knowledge, semantic search |
| Devices | `/devices` | Phone/PC binding, remote state, companion setup |
| Navigator | `/navigator-command` | Experts, projects, contacts, security, models, workflows |

Rationale:

- The current Workbench tab becomes Conversation.
- Chat must be first-class because the MVP and R1 loop are conversation-led.
- Devices deserve a primary tab because automation depends on device trust and online state.
- Experts, projects, contacts, remote, skills, workflow, and settings remain accessible through Navigator and capability panels.

Decision for r31:

- `/` becomes the canonical mobile conversation home.
- `/chat` stays available for backward compatibility and should reuse the same conversation engine or redirect after the shared component is stable.
- The old `BusinessHub` must not remain the default home. It can move behind Navigator as a capability overview if still useful.

### Secondary Capability Panel

From Conversation home, expose a compact capability launcher:

- Project
- Person
- Expert
- Scan
- Remote
- Workflow
- Skill
- Security

Each item must show a capability status:

- Available
- Experimental
- Needs setup
- Needs authorization

## 6. Conversation Home Layout

### Screen Structure

```text
Safe header
  Xiaozhi avatar/state
  Current mode: Local/Cloud/Hybrid
  HP
  Security zone
  Device online state

Now strip
  Current project or active context
  Pending confirmations count
  Active automation count

Xiaozhi brief
  One proactive sentence
  One suggested next action

Conversation stream
  User messages
  Xiaozhi responses
  Understanding cards
  Draft cards
  Confirmation cards
  Execution result cards
  Risk cards
  Reflection cards

Composer
  Voice button
  Text input
  Attachment/scan button
  Send button
```

### First Viewport Priority

The first viewport should show:

1. Xiaozhi identity and operational state.
2. A short useful brief.
3. The latest actionable card or recent conversation.
4. The command input.

The first viewport should not be dominated by module cards.

### Empty, Loading, And Offline States

The home must remain useful before all integrations are wired.

Required states:

- Empty conversation: show Xiaozhi brief, suggested starter commands, and capability drawer.
- Loading status: use subdued skeletons, not fake HP/model values.
- Offline backend: show local-only mode and disable execution buttons that need server confirmation.
- Missing device companion: show setup-needed state instead of pretending device control is available.
- Assistant error: keep the user's draft input and offer retry.

## 7. Core UI Components

### `XiaozhiStatusHeader`

Purpose:

- Shows Xiaozhi as the active agent.
- Displays mode and trust state.

Fields:

- Avatar
- Name/state: Online, Thinking, Waiting confirmation, Executing, Resting, Low HP
- Brain mode: LOCAL, CLOUD, HYBRID
- HP
- Zone: BLUE/YELLOW/RED or equivalent project terminology
- Device state: mobile online, PC online, companion missing

### `NowStrip`

Purpose:

- Shows what matters right now.

Fields:

- Current project/context
- Pending confirmations
- Active automations
- Next reminder or deadline
- Latest risk notice if any

Behavior:

- Tap context -> project/contact/detail.
- Tap pending -> pending action list.
- Tap automation -> task center.

### `XiaozhiBrief`

Purpose:

- Gives Xiaozhi a living presence.
- Turns system intelligence into a small daily recommendation.

Examples:

- "I found two tasks waiting for confirmation. The contract review is the highest-risk item."
- "Your PC is online. I can continue the file organization workflow after confirmation."
- "Today's focus should stay on Project A; finance and legal signals conflict."

Rules:

- One primary message only.
- Avoid internal jargon.
- Include one suggested action when possible.

### `ConversationStream`

Purpose:

- Hosts the R1 loop visually.

Message/card types:

| Type | Purpose |
| --- | --- |
| User message | Raw user input |
| Assistant message | Natural language response |
| Understanding card | What Xiaozhi understood |
| Draft card | Objects prepared before write/execution |
| Confirmation card | User approval for execution |
| Execution card | Running, success, failed, partial |
| Risk card | Blocked or requires stronger authorization |
| Reflection card | Learning, summary, morning/dream review |
| Expert card | Condensed specialist advice |

Minimum r31 card set:

- User message
- Assistant message
- Understanding card
- Draft card
- Confirmation card
- Execution card
- Risk card

Reflection and expert cards can follow after the core loop is stable.

### `CommandComposer`

Purpose:

- Keeps command entry always available.

Controls:

- Voice command button
- Text input
- Attach/scan button
- Send button

Expected inputs:

- Natural language command
- Project/task/person/memory creation
- Vault search
- Device or PC control request
- Screenshot/file/photo analysis
- Reminder and automation request

Keyboard and safe-area rules:

- The composer must stay above the mobile bottom navigation and safe area.
- Long Chinese input should wrap without resizing the entire page unexpectedly.
- Voice, attachment, and send controls must remain tappable at 360px width.
- When execution is blocked or loading, text entry should remain available unless the specific action requires a modal confirmation.

### `CapabilityDrawer`

Purpose:

- Replaces the current module-heavy home grid.

Groups:

- Create: project, task, memory, contact
- Analyze: expert, scanner, insight
- Execute: workflow, remote, devices
- Protect: security, audit, vault

Each capability needs:

- Icon
- Human-readable label
- Status badge
- Short consequence-oriented description

## 8. Copywriting Direction

Use Chinese as the default user-facing language for the mobile UI. English protocol names can remain in logs, advanced labels, and developer-facing docs, but the main mobile home should use fewer internal nouns and more user-facing verbs.

Examples:

| Current | Better |
| --- | --- |
| Strategic Core | Projects |
| Human Assets | People |
| Intelligence Nodes | Experts |
| Battle Report | Today's Brief |
| Scanner Lab | Scan |
| Task Orchestration | Tasks |
| Navigator Command | Navigator |

Technical names may still appear inside advanced pages, but the home screen should feel direct and repeatable.

Suggested Chinese labels:

| Concept | Home Label |
| --- | --- |
| Conversation | 对话 |
| Tasks | 任务 |
| Vault | 智库 |
| Devices | 设备 |
| Navigator | 领航 |
| Today's Brief | 今日简报 |
| Pending confirmations | 待确认 |
| Active context | 当前上下文 |
| Capability drawer | 能力 |

## 9. Safety And Authorization UX

Sensitive actions must be explicit in the conversation flow.

Examples:

- Delete file
- Send SMS
- Make call
- External payment
- Account credential access
- Device control
- Remote PC action
- Permanent vault/person deletion

Required UI states:

- Blocked by policy/permission
- Needs MASTER authorization
- Needs zone escalation
- Needs device online
- Needs Android Companion App
- Needs secondary confirmation
- Executed and audited

Confirmation cards should show:

- Action summary
- Target object/device/person
- Risk level
- Permission zone
- Estimated HP/cost when relevant
- Confirm and cancel controls

## 10. Visual Direction

Keep:

- Dark titanium base
- Deep blue/black foundation
- Gold for important intelligence/briefing
- Purple for AI/model state
- Green for safe/online/success
- Red/amber for risk/confirmation

Adjust:

- Reduce decorative command-center density.
- Make cards calmer and more legible.
- Use fewer oversized module cards on the home screen.
- Give the composer and actionable cards stronger hierarchy.
- Let Xiaozhi's state create warmth without becoming childish or decorative.

## 11. Route And File Plan

Suggested frontend route ownership:

| Area | Suggested Change |
| --- | --- |
| `/` | Replace `BusinessHub` with conversation-first home |
| `/chat` | Either redirect to `/` or reuse core conversation components |
| `/navigator-command` | Absorb old command center / capability overview |
| `/devices` | Promote to bottom navigation |
| bottom nav | Change to Conversation, Tasks, Vault, Devices, Navigator |

Suggested component additions:

- `client/src/pages/mobile/ConversationHome.tsx`
- `client/src/components/mobile/conversation/XiaozhiStatusHeader.tsx`
- `client/src/components/mobile/conversation/NowStrip.tsx`
- `client/src/components/mobile/conversation/XiaozhiBrief.tsx`
- `client/src/components/mobile/conversation/ConversationStream.tsx`
- `client/src/components/mobile/conversation/CommandComposer.tsx`
- `client/src/components/mobile/conversation/CapabilityDrawer.tsx`
- `client/src/components/mobile/conversation/cards/*`

Migration approach:

- Keep `BusinessHub.tsx` temporarily as a fallback or move it behind Navigator.
- Reuse existing `/chat` logic where practical.
- Do not break current task, vault, device, and navigator routes.

Recommended r31 route decision:

- Add `ConversationHome.tsx` and mount it at `/`.
- Keep `/chat`, but make it render the same core conversation components once extracted.
- Add an explicit route for the old dashboard only if we still need it, for example `/navigator-overview`.
- Update bottom navigation tests to assert the five-tab model.

## 12. Data Contract And Integration Boundaries

The first implementation should avoid inventing a new backend protocol. It should adapt existing responses into a frontend view model.

### Conversation View Model

```ts
type ConversationItem =
  | { type: "user"; id: string; text: string; createdAt: string }
  | { type: "assistant"; id: string; text: string; createdAt: string }
  | { type: "understanding"; id: string; summary: string; confidence?: number }
  | { type: "draft"; id: string; title: string; items: DraftItem[] }
  | { type: "confirmation"; id: string; action: string; riskLevel: "low" | "medium" | "high"; target?: string }
  | { type: "execution"; id: string; status: "running" | "success" | "failed" | "partial"; summary: string }
  | { type: "risk"; id: string; level: "warning" | "blocked"; reason: string };
```

### Status View Model

```ts
type MobileHomeStatus = {
  hp?: number;
  brainMode?: "LOCAL" | "CLOUD" | "HYBRID";
  zone?: "BLUE" | "YELLOW" | "RED";
  pendingConfirmations?: number;
  activeAutomations?: number;
  mobileOnline?: boolean;
  pcOnline?: boolean;
  companionStatus?: "connected" | "missing" | "setup_required";
};
```

Rules:

- Unknown values must render as unknown/setup-needed, not as fake success.
- Existing APIs may be adapted client-side first.
- A later backend aggregator endpoint can replace the adapter after the UI proves stable.

## 13. Implementation Phases

### Phase 0: Inventory And Extraction

Goal:

- Find the current chat API usage, response shapes, and reusable UI/state pieces before building the new shell.

Tasks:

- Inspect current `/chat` page and assistant hooks.
- Identify existing confirmation/draft UI, if any.
- Identify current status sources for HP, model mode, device state, and pending actions.
- Decide which values are real, derived, unavailable, or placeholder.

Acceptance:

- A short implementation note lists real data sources and temporary fallbacks.
- No hardcoded success values are introduced into the new home.

### Phase 1: Static Conversation Home Shell

Goal:

- Replace the home visual structure without changing backend contracts.

Tasks:

- Create `ConversationHome`.
- Add status header, now strip, brief, sample stream, composer.
- Update bottom navigation to five tabs.
- Keep existing routes available.
- Move old business hub entry into Navigator or keep as hidden fallback.

Acceptance:

- Mobile viewport 360x800 and 390x844 has no overlap.
- Composer is always reachable.
- Bottom nav has five items.
- Home no longer opens as a module directory.

### Phase 2: Wire Real R1 Conversation

Goal:

- Reuse existing chat/assistant API flow.

Tasks:

- Send composer text to assistant endpoint.
- Render assistant response.
- Render draft/confirmation/action result shapes when returned.
- Support loading, error, retry, and cancellation states.

Acceptance:

- Natural language can create project/task/memory drafts.
- Confirmation card can execute or cancel.
- Execution result returns into stream.

### Phase 3: Operational State Integration

Goal:

- Replace placeholders with real state.

Tasks:

- HP and model mode from real API/store.
- Device online/offline state.
- Pending confirmation count.
- Active automation count.
- Latest report/dream review summary.

Acceptance:

- Placeholder values are visibly marked or removed.
- Offline/device/setup states are accurate.
- Experimental capabilities are labeled.

### Phase 4: Safety And Audit Surface

Goal:

- Make trust visible.

Tasks:

- Add sensitive action confirmation card.
- Add authorization/zone display.
- Add audit result copy after execution.
- Add risk blocked state.

Acceptance:

- High-risk actions cannot appear as simple send-and-done UI.
- User can see why an action needs confirmation or was blocked.

### Phase 5: Polish And Regression

Goal:

- Make it feel like a daily product.

Tasks:

- Playwright mobile screenshots.
- Tap-test bottom nav.
- Test long Chinese text, small screens, safe-area insets.
- Verify no hidden input behind keyboard/bottom nav.
- Build and targeted E2E smoke.

Acceptance:

- `npm run build` passes.
- Mobile screenshot review passes for 360x800 and 390x844.
- Navigation test passes.
- Main conversation loop smoke passes or documented as blocked by backend setup.

## 14. Risks And Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Home becomes another decorative mockup | User still cannot act | Composer and actionable cards must ship in Phase 1 |
| Fake telemetry reduces trust | User believes unavailable systems are online | Unknown/setup states instead of hardcoded success values |
| `/chat` and `/` diverge | Duplicate logic and regressions | Extract shared conversation components |
| Bottom nav hides important modules | Users cannot find features | Navigator capability panel keeps module access |
| Too many card types delay delivery | Phase 1 bloats | Ship minimum r31 card set first |
| Device automation appears more ready than it is | Unsafe or confusing UX | Capability status badges and setup-needed states |
| Chinese mobile copy remains too technical | Daily use feels heavy | Home labels use simple Chinese; advanced terms move deeper |

## 15. Open Decisions

1. Should `/chat` redirect to `/`, or should `/` and `/chat` share the same component while keeping both routes?
2. Should the old `BusinessHub` become a Navigator overview page or be retired after migration?
3. What is the canonical API for system status: `/api/system/status`, `/api/health`, `/api/models`, or a new aggregated endpoint?
4. What labels should be used for permission zones in user-facing Chinese?
5. Should bottom nav use `设备` as a primary item now, or wait until Android Companion App UX is ready?

Recommended answers for r31:

1. Keep `/chat` and `/` both available, but share components. Make `/` canonical.
2. Move `BusinessHub` behind Navigator temporarily, then retire it if usage drops.
3. Use a frontend adapter over existing sources first; design a backend aggregator only after UI contracts settle.
4. Use simple labels first: 安全区, 需确认, 高风险, 已审计. Keep BLUE/YELLOW/RED as advanced detail.
5. Keep `设备` in bottom nav now. Device trust is central to automation, even if some companion features are setup-gated.

## 16. Success Criteria

The redesign is successful when a user opening the mobile app can immediately:

- Tell whether Xiaozhi is online and ready.
- Speak or type a command without hunting for a page.
- See the current project/context.
- See what needs confirmation.
- Understand whether an action was executed, blocked, or needs setup.
- Reach tasks, vault, devices, and Navigator without confusion.

The home screen should stop saying "Here are all modules" and start saying "I am here, I understand the current situation, and I can help you act."
