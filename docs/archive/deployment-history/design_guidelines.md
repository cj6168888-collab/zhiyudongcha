# 小智 (Avatar) - AI Digital Life Assistant
## Design Guidelines

### Architecture Decisions

**Authentication: Required**
- Rationale: Multi-user system with expert collaboration features and telemetry data
- Implementation:
  - Apple Sign-In (iOS primary)
  - Google Sign-In (Android/cross-platform)
  - Mock auth flow with local state persistence
  - Login screen: Dark theme, SSO buttons, privacy policy/terms links
  - Profile must include: logout (with confirmation), delete account (nested under Settings > Account > Delete, double confirmation)

**Navigation: Tab Bar (4 tabs + FAB)**
- Root navigation: Bottom tab bar with 4 tabs + floating action button
- Tabs:
  1. **监控** (Monitor) - Security monitoring dashboard
  2. **遥测** (Telemetry) - Metrics and data visualization
  3. **协同** (Collaborate) - Expert collaboration status
  4. **个人** (Profile) - User settings and preferences
- Floating Action Button: AI query/command center (positioned bottom-right, above tab bar)

---

### Screen Specifications

#### 1. Login Screen (Stack-Only)
- **Purpose**: Authenticate user via SSO
- **Layout**:
  - No header
  - Centered content area with:
    - App logo (gold accent on dark background)
    - App name "小智 Avatar"
    - Tagline: "AI数字生命助手"
    - SSO buttons (Apple/Google) with gold outlines
    - Privacy/terms links at bottom
  - Safe area: top inset.top + Spacing.xl, bottom inset.bottom + Spacing.xl
- **Components**: Logo asset, SSO buttons, text links

#### 2. 监控 Dashboard (Tab 1)
- **Purpose**: Real-time security monitoring overview
- **Layout**:
  - Header: Transparent, title "安全监控", no search bar
    - Left: None
    - Right: Alert bell icon (shows unread count badge)
  - Scrollable main content:
    - System status card (health indicator: green/yellow/red with gold accent)
    - Security metrics grid (2 columns: threat level, active shields, scan status, last update)
    - Alert timeline (list of recent events with timestamps)
  - Safe area: top headerHeight + Spacing.xl, bottom tabBarHeight + Spacing.xl
- **Components**: Status cards, metric tiles, timeline list, badge indicator

#### 3. 遥测 Metrics (Tab 2)
- **Purpose**: Visualize AI performance and telemetry data
- **Layout**:
  - Header: Transparent, title "遥测数据"
    - Left: None
    - Right: Time range filter icon
  - Scrollable main content:
    - Performance chart (line graph, deep blue gradient fill)
    - KPI cards (response time, accuracy, uptime)
    - Data table (scrollable list of recent metrics)
  - Safe area: top headerHeight + Spacing.xl, bottom tabBarHeight + Spacing.xl
- **Components**: Chart component, metric cards, data table/list

#### 4. 协同 Collaboration (Tab 3)
- **Purpose**: View and manage expert collaboration status
- **Layout**:
  - Header: Transparent, title "专家协同", search bar enabled
    - Left: None
    - Right: Add expert icon
  - List view (non-scrollable root, list handles scrolling):
    - Expert cards with status indicators (online: gold dot, offline: gray)
    - Each card shows: avatar, name, specialization, active sessions
  - Safe area: top headerHeight + Spacing.xl, bottom tabBarHeight + Spacing.xl
- **Components**: Search bar, expert cards with status dots, avatar images

#### 5. 个人 Profile (Tab 4)
- **Purpose**: User preferences and account management
- **Layout**:
  - Header: Transparent, title "个人中心"
    - Left: None
    - Right: Settings gear icon
  - Scrollable main content:
    - User card (avatar, name, role/tier)
    - Preference sections (theme, notifications, language)
    - Account actions (logout, nested delete)
  - Safe area: top headerHeight + Spacing.xl, bottom tabBarHeight + Spacing.xl
- **Components**: Profile card, settings list, action buttons

#### 6. AI Command Center (Modal)
- **Purpose**: Core AI interaction via FAB
- **Layout**:
  - Native modal screen (slides up from bottom)
  - Header: Custom, title "AI助手", close button left
  - Main content: Chat interface or command input
  - Safe area: top Spacing.xl, bottom inset.bottom + Spacing.xl
- **Components**: Text input, send button, chat bubbles

#### 7. Settings Screen (Stack from Profile)
- **Purpose**: Detailed app configuration
- **Layout**:
  - Header: Default navigation, title "设置", back button left
  - Scrollable form:
    - Grouped settings sections
    - Account section with delete option (nested confirmation)
  - Safe area: top Spacing.xl, bottom inset.bottom + Spacing.xl
- **Components**: Form groups, switches, nested navigation

---

### Design System

**Color Palette (Dark Theme)**
- **Primary**: Deep Blue `#0A1929` (background)
- **Secondary**: Titanium Black `#0D1117` (cards/containers)
- **Accent**: Gold `#FFB300` (highlights, active states, success)
- **Text Primary**: `#E3E8EF` (90% white)
- **Text Secondary**: `#8B949E` (60% white)
- **Border**: `#21262D` (subtle dividers)
- **Error**: `#F85149`
- **Success**: Gold `#FFB300` (reusing accent)

**Typography**
- **Headings**: SF Pro Display (iOS) / Roboto (Android), Bold, 24/20/16pt
- **Body**: SF Pro Text (iOS) / Roboto (Android), Regular, 14pt
- **Caption**: Same as body, 12pt, Text Secondary color
- **Monospace**: SF Mono (iOS) / Roboto Mono (Android) for metrics/data

**Spacing Scale**
- xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32

**Interaction Design**
- Touchable feedback: Opacity reduction to 0.7 on press
- Floating Action Button: Gold background, white icon, shadow specs:
  - shadowOffset: {width: 0, height: 2}
  - shadowOpacity: 0.10
  - shadowRadius: 2
- Cards: Subtle border (#21262D), no shadow, press opacity 0.95
- Status indicators: Pulsing animation for active/online states

**Visual Design**
- Icons: Feather icon set from @expo/vector-icons
- No emojis
- Assets needed:
  1. App logo (gold geometric AI symbol on transparent)
  2. 4 preset user avatars (tech-themed: circuit pattern, neural network, digital hologram, abstract AI)
  3. Default expert avatar (professional silhouette)
- Card corners: 8px border radius
- Minimize shadows; use borders for depth

**Accessibility**
- Minimum touch target: 44x44pt
- Text contrast: AA compliant against dark backgrounds
- Status not conveyed by color alone (use icons + text labels)
- VoiceOver labels for all interactive elements in Chinese