### Overview
小智 (Avatar) is an AI-powered "digital life" system designed as a loyal, intelligent, and affectionate personal assistant. Its primary goal is to offer relationship intelligence, efficient resource management, multi-expert decision-making, and self-evolution. The project is shifting towards a multi-agent collaborative system with a domain-driven architecture, utilizing a modular Z-Series protocol for managing core functionalities like authority, compute resources, relationship networks, real-time synchronization, multi-expert AI coordination, user interfaces, and self-evolution. The long-term vision includes multi-modal, multi-agent capabilities, autonomous execution, and physical AI integration.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
The system utilizes a modular architecture structured into `core` (persona, reasoning, memory), `domain` (contacts, projects, contracts, insight, action, guardian), `infra` (AI abstraction, communication, security, storage), `agents`, and `orchestration` layers.

**UI/UX Decisions**:
The frontend uses React 18, TypeScript, Wouter, Zustand, and TanStack React Query. UI components are built with shadcn/ui on Radix UI primitives, styled with Tailwind CSS v4, featuring a dark theme with deep blue/titanium black and gold accents. It supports internationalization in English and Chinese. A unique desktop fairy system provides a visual representation of the avatar with multi-state sprites, migration animations, gaze following, and physics-based movement, depicting a 7-8 year old Asian girl in Pixar 3D style.

**Technical Implementations**:
- **Frontend**: React 18 with TypeScript, Vite, Wouter, Zustand, TanStack React Query, shadcn/ui, Radix UI, Tailwind CSS v4, i18next, and skeletal animation.
- **Backend**: Node.js with Express.js, esbuild, RESTful endpoints with role-based middleware, API versioning, request rate limiting, WebSocket for real-time communication (Z3 Spirit Core), header-based authentication, and hybrid AI integration using Ollama (local) and DashScope (cloud). It includes real-time voice processing (WebRTC, VAD), streaming TTS, and an interrupt handling system.
- **Core Services**: Features Pino-based structured logging, centralized error handling, a multi-provider AI failover chain (DashScope → DeepSeek → DouBao), and health check endpoints.
- **Hybrid AI Architecture**: Intelligent model routing for LOCAL/CLOUD/HYBRID inference and an inference queue.
- **Reasoning Engine**: Implements Chain-of-Thought (CoT) with confidence scoring, deep thinking mode, a hallucination detector, and a working memory stack.
- **Key Features**:
    - **Desktop Fairy System**: Manages cross-device avatar presence and physics-based interactions.
    - **Project Guardian Angel**: Provides health and life management, including data collection and intelligent scheduling.
    - **Project Action Power**: An autonomous execution system with three-level execution (AUTO, CONFIRM, SHADOW).
    - **Project Unbound**: Enables OS-level autonomous operations with human-like simulation.
    - **Long-Term Memory Layer**: An emotional vector database for relationship memory and proactive care.
    - **Unified Persona Configuration**: Centralized management for consistent character behavior.
    - **Zero Hallucination Circuit**: Ensures accuracy for professional personas using a knowledge base and CoT constraints.
    - **Project Lifecycle Engine**: AI-powered project management.
    - **Smart Reminder Scheduler**: Intelligent reminder system with TIME, EVENT, and SMART triggers.
    - **Contract Pipeline**: AI-assisted contract drafting.
    - **智语洞察 (Insight Listener)**: Real-time conversation analysis.
    - **RAG Knowledge Base**: Uses DashScope text-embedding-v3 for vector embeddings and hybrid retrieval.
    - **Function Calling Service**: OpenAI Tools protocol compatible, with built-in and extensible tools.
    - **MCP Protocol Integration**: Model Context Protocol bridge.
    - **MCTS Game Theory Engine**: Monte Carlo Tree Search for strategic decision-making.
    - **Tech Hunter System**: Automated technology discovery and plugin management.
    - **Swarm Management Protocol**: Clone entity generation and access control.
    - **Screen Piercer Service**: OCR-based semantic anchoring for UI automation.
    - **Data Lineage Tracking**: Cross-application data association.
    - **Battle Report Generator**: Daily strategic briefings.
    - **Smart Conversation API**: Unified voice/text interface with intent recognition.
    - **Voice Commander System**: Dual-engine natural language command system.
    - **Whisper Assistant System**: Real-time intelligent whisper service.

**System Design Choices**:
- **HP Economy**: Compute resources tracked as "health points."
- **Role-Based Access**: MASTER vs GUEST roles.
- **Expert System**: Six specialized AI modules for reasoning.
- **Zone-Based Permissions**: Three-tier access control.
- **Evolution Loop**: Dream simulations drive academic progression.
- **Audit Logging**: Logs critical operations.
- **Health Check Endpoints**: For comprehensive system monitoring.

**Data Storage & Repository Architecture**:
- **Database**: PostgreSQL with Drizzle ORM, 148 database tables.
- **Pattern**: Repository pattern for data access with complete separation of concerns.
- **Repository Layer**: 20 specialized repository files in `server/repositories/`:
  - `base.repository.ts`: Abstract base with CRUD operations
  - Domain repositories: person, vault, memory, device, project, user, insight, audit, strategy, job, intel, integration, email, finance, chat, team, report, file
- **Dependency Graph**: `db.ts` → repositories → `storage.ts` (facade)
- **Key Metrics**: Zero direct db operations in storage.ts, pure facade pattern

### External Dependencies
- **AI Services**: DashScope API (Alibaba Cloud), Ollama (local models), DeepSeek API, DouBao / Volcengine API.
- **Database**: PostgreSQL, Drizzle ORM.
- **Frontend Libraries**: Radix UI, Framer Motion, i18next, TanStack React Query, Wouter, Zustand.
- **Build Tools**: Vite, esbuild.

### Recent Changes (Sprint 13.2.17 COMPLETED)

**Date**: 2026-01-28

**Documentation Consolidation** - Streamlined replit.md for maintainability:

Changes:
- Reduced replit.md from 250→154 lines (38% reduction)
- Consolidated 8 sprint histories (13.2.9-16) into focused documentation
- Enhanced Data Storage section with repository architecture details
- Maintained all critical architecture information

---

### Previous Changes (Sprint 13.2.16 COMPLETED)

**Date**: 2026-01-28

**Circular Dependency Resolution** - Extracted database connection to dedicated module:

Changes:
- Leveraged existing `server/db.ts` as single source of database connection
- Updated 8 repository files to import `db` from `../db` instead of `../storage`
- Updated `storage.ts` to re-export `db` for backward compatibility
- Eliminated circular dependency: repositories → storage → repositories

**Quality Metrics**:
- Zero LSP errors
- storage.ts reduced from 2070→1470 lines (600 lines, 29.0% cumulative reduction)
- Clean dependency graph: db.ts → repositories → storage.ts (facade)
- All services running normally

---

### Previous Changes (Sprint 13.2.15 COMPLETED)

**Date**: 2026-01-28

**Import Cleanup & Type-Only Imports** - Removed all unused table imports from storage.ts:

Changes:
- Removed 50+ unused table imports (users, persons, vaultItems, etc.)
- Converted all schema imports to type-only imports (`import type { ... }`)
- Retained only necessary runtime imports (drizzle, pg Pool)
- Clean separation: types for interface contracts, repositories for operations

**Quality Metrics**:
- Zero LSP errors
- storage.ts reduced from 2070→1476 lines (594 lines, 28.7% cumulative reduction)
- Pure facade pattern: zero table imports, zero direct db operations
- All services running normally

---

### Previous Changes (Sprint 13.2.14 COMPLETED)

**Date**: 2026-01-28

**Zero Direct DB Operations Achievement** - Complete repository pattern adoption:

Enhanced repository files:
- `server/repositories/strategy.repository.ts`: Added `updateWithTimestamp` to OpportunityRepository and StrategyProposalRepository

Delegated methods in `server/storage.ts`:
- `getUser`, `getUserByUsername`, `createUser` → `userRepository`
- `permanentShred` vault/person deletion → `vaultRepository.delete`, `personRepository.delete`
- `updateOpportunity` → `opportunityRepository.updateWithTimestamp`
- `updateStrategyProposal` → `strategyProposalRepository.updateWithTimestamp`

**Quality Metrics**:
- **Zero direct `db.` operations in storage.ts** - Complete repository pattern adoption
- Zero LSP errors
- storage.ts reduced from 2070→1574 lines (496 lines, 24.0% cumulative reduction)
- 20 repository files total covering all major domains
- All services running normally

---

### Repository Pattern Refactoring Summary (Sprint 13.2.9 - 13.2.13)

**Completed**: 2026-01-28

A comprehensive refactoring initiative that transformed the monolithic `storage.ts` into a clean facade pattern with 20 specialized repository files:

**Repository Files Created**:
- `job.repository.ts`: DownloadTask, ComputeJob
- `intel.repository.ts`: IntelItem, SkillCapsule, EvolutionState
- `integration.repository.ts`: IntegrationProvider, IntegrationAccount, IntegrationSyncJob
- `email.repository.ts`: EmailAccount, Email, EmailAttachment
- `finance.repository.ts`: Invoice, ExpenseReport
- `chat.repository.ts`: AvatarChatHistory, AvatarUserPreferences
- `team.repository.ts`: TeamMember
- `report.repository.ts`: DailyReport
- `file.repository.ts`: GeneratedFile

**Achievements**:
- Zero direct database operations in storage.ts
- Zero unused table imports
- Pure facade pattern with clean dependency graph
- All encryption/decryption logic properly encapsulated in repositories
- Special methods like `createWithCredentials`, `getWithPassword`, `createWithLastSeen` for security
