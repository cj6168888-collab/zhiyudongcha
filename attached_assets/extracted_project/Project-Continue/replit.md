## Overview

小智 (Avatar) is an AI-powered "digital life" system designed as a personal assistant, focusing on relationship intelligence, resource management, multi-expert decision-making, and self-evolution. Its core purpose is to provide a loyal, intelligent, and affectionate digital companion. The system operates on a modular Z-Series protocol architecture:

- **Z1 (God Protocol)**: Manages authority, compute resources, and academic evolution.
- **Z2 (Bedrock Matrix)**: Stores relationship networks, indexes resources, and maintains shadow memory.
- **Z3 (Spirit Core)**: Handles cross-device presence and real-time synchronization.
- **Z4 (Strategy Orchestrator)**: Coordinates multi-expert AI collaboration (Legal, Finance, Strategy, Secretary, Psychology, Planning).
- **Z5 (Tactical Interface)**: Provides mobile/desktop UI with distinct business and anime modes.
- **Z6 (Code Genesis)**: Facilitates self-evolution, compute job execution, and dream simulations.

## User Preferences

Preferred communication style: Simple, everyday language.

### Core Check Rules (核心排查规则)

**Chinese Encoding (中文编码) - CRITICAL**
1. All source files MUST be saved with UTF-8 encoding
2. HTML must include `<meta charset="UTF-8" />` and `lang="zh-CN"`
3. Use Chinese fonts: Noto Sans SC, PingFang SC, Microsoft YaHei as fallbacks
4. Verify all Chinese text displays correctly before completing tasks
5. Never use escaped Unicode sequences for Chinese characters in source code
6. Test page titles, form labels, and button text for proper rendering

## System Architecture

### UI/UX Decisions
The frontend uses React 18 with TypeScript, Wouter for routing, Zustand for state management, and TanStack React Query for data fetching. UI components are built with shadcn/ui on Radix UI primitives, styled with Tailwind CSS v4, featuring a dark theme with deep blue/titanium black and gold accents. Internationalization is supported via i18next for English and Chinese. A desktop fairy system provides a unique physical presence for the avatar with multi-state sprites, migration animations, gaze following, and physics-based movement. Character assets depict a 7-8 year old Asian girl in Pixar 3D style.

### Technical Implementations

#### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query
- **UI Components**: shadcn/ui on Radix UI
- **Styling**: Tailwind CSS v4 (dark theme with gold accents)
- **Internationalization**: i18next (English, Chinese)
- **Build Tool**: Vite

#### Backend
- **Runtime**: Node.js with Express.js
- **API Pattern**: RESTful endpoints with role-based middleware
- **Real-time**: WebSocket server (ws) for Z3 Spirit Core
- **Authentication**: Header-based role system (MASTER vs GUEST)
- **AI Integration**: Hybrid architecture (Local Ollama + Cloud DashScope)
- **Build**: esbuild

#### Hybrid AI Architecture
Intelligent model routing (LOCAL/CLOUD/HYBRID) using Ollama for local models and DashScope for cloud services, featuring an inference queue and device registry.

#### Visual Interaction Layer
Skeletal animation with 14 bones, IK constraints, spring-damper physics, and keyframe animations for lifelike avatar movement. Includes real-time bone rendering, gaze tracking, breathing state machine, and physics for pigtails/skirt.

#### Desktop Fairy System
Manages the avatar's cross-device physical presence, ensuring a single active avatar, with multi-state sprites, migration animations, gaze following, and idle behaviors.

#### Project Guardian Angel
Provides health and life management services including health data collection, emergency support, stress intervention, contact reminders, nutrition tracking, intelligent scheduling, call emotion analysis, and location pattern learning.

#### Project Action Power
An autonomous execution system with three-level execution (AUTO, CONFIRM, SHADOW) based on risk scoring, using haptic codes for covert communication and a Perception-Decision-Execution loop.

#### Project Unbound
Enables OS-level autonomous operation with human-like simulation, including device command dispatch, anti-detection behaviors for mouse/typing, visual verification via screenshot comparison, and V-LLM grounding for visual element location.

#### Long-Term Memory Layer
An emotional vector database for deep relationship memory, extracting entities (PREFERENCE, HEALTH, WORK_PAIN, HABIT, RELATIONSHIP, EVENT, MOOD) from conversations, generating embeddings for semantic search, and triggering proactive care based on health events and stress detection.

#### Unified Persona Configuration
Centralized persona management via `server/config/persona.ts` ensures consistent character behavior. It defines addressing rules (e.g., "爸爸" for MASTER, "主人" for GUEST), persona modes (DAUGHTER, SECRETARY, LEGAL, etc.), medium modes (PRIVATE, SOCIAL, PRESENTATION), and response templates.

#### Zero Hallucination Circuit
Ensures accuracy for professional personas (LEGAL, FINANCE) by leveraging a knowledge base with vector embeddings, calculating confidence scores, and enforcing Chain-of-Thought (CoT) constraints: DATA_RETRIEVAL, CONFIDENCE_CHECK, and SOURCE_CITATION. Outputs include confidence declarations, data sources, analysis with citations, and risk warnings.

#### Project Lifecycle Engine
AI-powered project management that intelligently decomposes projects, manages milestone/task hierarchies, tracks progress with delay detection, identifies and mitigates risks, and maintains an audit log.

#### Smart Reminder Scheduler
An intelligent reminder system supporting TIME, EVENT, and SMART triggers (e.g., contact follow-up, opportunity detection). It provides push notifications, recurrence, snooze/dismiss functionality, and integrates with calendar and project deadlines.

#### Contract Pipeline (Phase 2.3)
AI-assisted contract drafting with template matching and risk analysis. Supports SOFTWARE_DEVELOPMENT, CONSULTING, NDA, EMPLOYMENT, LEASE, SALES, SERVICE, PARTNERSHIP categories. Features template matching, auto-fill, risk clause analysis with severity levels (LOW/MEDIUM/HIGH), negotiation points generation, and draft versioning. Default templates: 软件开发外包合同, 保密协议(NDA), 咨询服务合同.

### System Design Choices
- **HP Economy**: Compute resources are tracked as "health points."
- **Role-Based Access**: MASTER vs GUEST roles with secret validation.
- **Expert System**: Six specialized AI modules for chain-of-thought reasoning.
- **Zone-Based Permissions**: Three-tier access control.
- **Evolution Loop**: Dream simulations drive academic progression.
- **Audit Logging**: Critical operations are logged for security.

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM.
- **Schema**: Tables for `persons`, `vault_items`, `shadow_memories`, `projects`, `intel_items`, `evolution_state`, `audit_logs`, `daily_reports`, `meal_logs`, `nutrition_goals`, `calendar_events`, `schedule_settings`, `call_emotion_logs`, `location_patterns`, `location_visits`, `project_milestones`, `project_tasks`, `project_risks`, `project_logs`, `reminder_rules`, `reminder_logs`, `contract_templates`, `contract_drafts`.

## External Dependencies

### AI Services
- **DashScope API**: Alibaba Cloud's AI service for conversational AI and advanced features.
- **Ollama**: Local AI model integration.

### Database
- **PostgreSQL**: Primary data store.
- **Drizzle ORM**: Type-safe database access.

### Frontend Libraries
- **Radix UI**: Accessible component primitives.
- **Framer Motion**: Animation library.
- **i18next**: Internationalization framework.
- **TanStack React Query**: Server state management.

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal**
- **@replit/vite-plugin-cartographer**
- **@replit/vite-plugin-dev-banner**

### Environment Variables Required
- `DATABASE_URL`
- `DASHSCOPE_API_KEY`
- `AVATAR_MASTER_SECRET`