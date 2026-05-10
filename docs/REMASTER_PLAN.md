# 🚀 小智 AI Assistant - 全面升级重构计划

**版本**: v2.0  
**周期**: 6 个月（2026.02 - 2026.08）  
**团队**: 3 名前端 + 2 名设计 + 1 名 QA  
**目标**: 从 v1.0 (72分) 升级至 v2.0 (95分)

---

## 📋 执行摘要

### 当前状况
- **代码规模**: 15万行 (前端 5万 + 后端 8万 + 其他 2万)
- **技术债务**: 严重 (LSP 错误 1000+)
- **可访问性**: WCAG 不合规 (65分)
- **性能**: 首屏 2.5s (需优化至 1.5s)

### 重构目标
| 维度 | 现状 | 目标 | 提升 |
|------|------|------|------|
| 可访问性 | 65/100 | 95/100 | +46% |
| 性能 | 75/100 | 95/100 | +27% |
| 代码质量 | 70/100 | 92/100 | +31% |
| 用户体验 | 70/100 | 95/100 | +36% |
| **总分** | **72/100** | **95/100** | **+32%** |

### 关键成果
- ✅ WCAG 2.2 AA 级合规
- ✅ 首屏加载 < 1.5s
- ✅ 代码测试覆盖 > 80%
- ✅ 零 LSP TypeScript 错误
- ✅ Lighthouse 评分 > 95

---

## 🗓️ 总体时间线

```
2026年
2月   3月    4月    5月    6月    7月    8月
|-----|------|------|------|------|------|
Phase0 Phase1 Phase2 Phase3 Phase4 Phase5 Phase6
(准备) (a11y) (性能) (架构)  (UI)  (升级) (测试)
            |<- 核心重构 ->|
                         |<-- 优化 -->|
                                    |发布|
```

---

## Phase 0: 基础审计与准备 (2月, Week 1-2)

### 目标
- 建立测试基线
- 制定开发规范
- 准备工具链

### 具体任务

#### Week 1: 基线建立
- [ ] **性能基线**
  - Lighthouse 评分记录 (当前: 62)
  - Web Vitals 数据采集
  - 包体积分析 (当前: 2.8MB)

- [ ] **可访问性审计**
  - axe-core 扫描 (记录问题数)
  - 屏幕阅读器测试 (NVDA/VoiceOver)
  - 键盘导航测试

- [ ] **代码质量分析**
  - TypeScript 严格模式检查
  - 代码覆盖率统计 (当前: 35%)
  - 圈复杂度分析

#### Week 2: 规范制定
- [ ] **开发规范文档**
  ```
  docs/standards/
  ├── coding-standards.md      # 代码规范
  ├── accessibility-guide.md   # 可访问性指南
  ├── performance-checklist.md # 性能检查清单
  └── ui-component-guide.md    # 组件开发指南
  ```

- [ ] **工具链配置**
  - ESLint + Prettier 统一配置
  - Husky + lint-staged 提交检查
  - axe-core CI 集成
  - Lighthouse CI 集成

### 交付物
1. `docs/BASELINE_REPORT.md` - 基线报告
2. `docs/DEVELOPMENT_STANDARDS.md` - 开发规范
3. `.github/workflows/quality-check.yml` - CI 流程

---

## Phase 1: 可访问性重构 (2-3月, Week 3-6)

### 目标
- WCAG 2.2 AA 级合规
- 键盘导航完整支持
- 屏幕阅读器兼容

### 核心任务

#### 1.1 色彩系统重构 (Week 3)

**问题**: 当前对比度不足
```
主按钮: 4.2:1 (需 4.5:1)
禁用状态: 2.8:1 (严重不足)
```

**解决方案**:
```css
/* client/src/styles/accessibility-colors.css */
:root {
  /* 高对比度配色 */
  --color-primary: #4f46e5;          /* indigo-700 */
  --color-primary-hover: #3730a3;    /* indigo-800 */
  --color-text-primary: #fafafa;     /* zinc-50 */
  --color-text-secondary: #e4e4e7;   /* zinc-200 */
  --color-text-disabled: #71717a;    /* zinc-500 */
  --color-border: #52525b;           /* zinc-600 */
}
```

**检查点**:
- [ ] 所有文本对比度 >= 4.5:1
- [ ] 大文本对比度 >= 3:1
- [ ] UI 组件对比度 >= 3:1

#### 1.2 组件可访问性改造 (Week 4-5)

**Button 组件**:
```tsx
// 添加焦点管理 + ARIA 属性
<button
  ref={ref}
  disabled={disabled || isLoading}
  aria-busy={isLoading}
  aria-label={isLoading ? loadingText : undefined}
  aria-describedby={helpText ? `${id}-help` : undefined}
  className="focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
  {...props}
>
  {isLoading && <span className="sr-only">{loadingText}</span>}
  {children}
</button>
```

**Dialog 组件**:
```tsx
// ARIA 属性完整支持
<Dialog
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
  onOpenAutoFocus={(e) => firstFocusableRef.current?.focus()}
  onCloseAutoFocus={(e) => triggerRef.current?.focus()}
>
```

**改造清单**:
- [ ] Button (30+ 实例)
- [ ] Dialog/Modal (15+ 实例)
- [ ] Dropdown (20+ 实例)
- [ ] Tabs (10+ 实例)
- [ ] Form Inputs (50+ 实例)
- [ ] Navigation (8+ 实例)

#### 1.3 键盘导航实现 (Week 6)

**焦点管理工具**:
```tsx
// hooks/use-focus-trap.ts
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    
    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };
    
    containerRef.current.addEventListener('keydown', handleTabKey);
    firstElement?.focus();
    
    return () => {
      containerRef.current?.removeEventListener('keydown', handleTabKey);
    };
  }, [isActive]);
  
  return containerRef;
}
```

**快捷键系统**:
```tsx
// hooks/use-keyboard-shortcuts.ts
export function useKeyboardShortcuts(shortcuts: ShortcutConfig) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K = 打开搜索
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        shortcuts.openSearch?.();
      }
      
      // Esc = 关闭模态框
      if (e.key === 'Escape') {
        shortcuts.closeModal?.();
      }
      
      // / = 聚焦搜索
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          shortcuts.focusSearch?.();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
```

### 验收标准
- [ ] axe-core 零错误
- [ ] 键盘导航 100% 功能
- [ ] 屏幕阅读器测试通过
- [ ] WCAG 2.2 AA 合规证书

---

## Phase 2: 性能优化 (3月, Week 7-10)

### 目标
- 首屏加载 < 1.5s (当前 2.5s)
- Lighthouse 性能 > 90
- 包体积 < 1.5MB (当前 2.8MB)

### 核心策略

#### 2.1 代码分割 (Week 7)

**路由级分割**:
```tsx
// router.tsx
const Dashboard = lazy(() => import('./pages/dashboard'));
const Chat = lazy(() => import('./pages/chat'));
const Settings = lazy(() => import('./pages/settings'));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

**组件级分割**:
```tsx
//  heavy-components.tsx
const DataVisualization = lazy(() => 
  import('./components/data-visualization')
);

const RichTextEditor = lazy(() => 
  import('./components/rich-text-editor')
);
```

**分割策略**:
- [ ] 路由分割 (43 个页面)
- [ ] 组件分割 (重型组件)
- [ ] 第三方库分割 (图表/编辑器)

#### 2.2 资源优化 (Week 8)

**图片优化**:
```tsx
// 使用现代格式
<picture>
  <source srcSet="image.avif" type="image/avif" />
  <source srcSet="image.webp" type="image/webp" />
  <img src="image.jpg" loading="lazy" decoding="async" />
</picture>

// 响应式图片
<img
  srcSet="small.jpg 300w, medium.jpg 600w, large.jpg 900w"
  sizes="(max-width: 600px) 300px, (max-width: 900px) 600px, 900px"
/>
```

**字体优化**:
```css
/* 字体子集化 */
@font-face {
  font-family: 'Noto Sans SC';
  src: url('/fonts/noto-sans-sc-v21-latin-regular.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+4E00-9FFF; /* 仅中文字符 */
}
```

**优化清单**:
- [ ] 图片转换为 AVIF/WebP
- [ ] 字体子集化
- [ ] CSS 关键路径提取
- [ ] Tree Shaking 优化

#### 2.3 动画性能 (Week 9)

**GPU 加速**:
```css
/* 仅使用 transform 和 opacity */
.optimized-animation {
  will-change: transform;
  transform: translateZ(0); /* 强制 GPU */
}
```

**减少动画偏好**:
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**懒加载动画库**:
```tsx
import { lazy, Suspense } from 'react';

const MotionComponent = lazy(() => 
  import('framer-motion').then(mod => ({ 
    default: mod.motion.div 
  }))
);
```

#### 2.4 缓存策略 (Week 10)

**Service Worker**:
```typescript
// sw.ts
const CACHE_NAME = 'xiaozhi-v2';

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // 缓存优先
      if (response) return response;
      
      return fetch(event.request).then((fetchResponse) => {
        // 缓存新资源
        if (fetchResponse.status === 200) {
          const clone = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return fetchResponse;
      });
    })
  );
});
```

**状态持久化**:
```tsx
// stores/persistent-store.ts
import { persist } from 'zustand/middleware';

const useStore = create(
  persist(
    (set, get) => ({
      // 状态定义
    }),
    {
      name: 'xiaozhi-storage',
      partialize: (state) => ({
        // 仅持久化必要状态
        user: state.user,
        preferences: state.preferences,
      }),
    }
  )
);
```

### 验收标准
- [ ] FCP < 1.0s
- [ ] LCP < 1.5s
- [ ] TTI < 3.0s
- [ ] CLS < 0.1
- [ ] 包体积 < 1.5MB

---

## Phase 3: 架构重构 (4月, Week 11-14)

### 目标
- 组件拆分 (当前过大文件)
- 类型安全 (零 any)
- 测试覆盖 > 80%

### 重构策略

#### 3.1 巨型文件拆分 (Week 11)

**当前问题**:
```
❌ server/routes.ts        - 24,467 行
❌ server/storage.ts       - 67,239 行
❌ client/src/pages/chat.tsx - 3,500+ 行
```

**拆分方案**:
```
server/
├── routes/
│   ├── index.ts              # 路由聚合 (100 行)
│   ├── auth.routes.ts        # 认证路由 (800 行)
│   ├── user.routes.ts        # 用户路由 (1,200 行)
│   ├── ai.routes.ts          # AI 路由 (2,000 行)
│   └── ...                   # 其他路由
│
└── storage/
    ├── index.ts              # 存储接口 (200 行)
    ├── repositories/         # Repository 模式
    │   ├── user.repository.ts
    │   ├── conversation.repository.ts
    │   └── ...
    └── cache/                # 缓存层
        ├── redis.cache.ts
        └── memory.cache.ts
```

#### 3.2 组件架构升级 (Week 12)

**新架构**: Atomic Design
```
client/src/components/
├── atoms/              # 原子组件
│   ├── Button/
│   ├── Input/
│   └── Icon/
│
├── molecules/          # 分子组件
│   ├── SearchInput/
│   ├── FormField/
│   └── CardHeader/
│
├── organisms/          # 有机体组件
│   ├── ChatMessage/
│   ├── ProjectCard/
│   └── UserProfile/
│
├── templates/          # 模板
│   ├── PageLayout/
│   └── DashboardLayout/
│
└── pages/              # 页面
    ├── DashboardPage/
    └── ChatPage/
```

**组件示例**:
```tsx
// components/atoms/Button/Button.tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, isLoading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          buttonVariants({ variant, size }),
          isLoading && 'cursor-not-allowed opacity-70'
        )}
        disabled={isLoading}
        {...props}
      >
        {isLoading ? <Spinner /> : children}
      </button>
    );
  }
);

// 导出类型和测试
export type { ButtonProps };
export { Button };
```

#### 3.3 类型安全增强 (Week 13)

**严格 TypeScript 配置**:
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**API 类型生成**:
```typescript
// types/api.types.ts
// 从 OpenAPI/Swagger 自动生成
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export type CreateConversationRequest = Omit<
  Conversation, 
  'id' | 'createdAt' | 'updatedAt'
>;
```

**运行时类型检查**:
```typescript
// utils/type-guards.ts
import { z } from 'zod';

const ConversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  messages: z.array(MessageSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export function validateConversation(data: unknown): Conversation {
  return ConversationSchema.parse(data);
}
```

#### 3.4 状态管理重构 (Week 14)

**从分散到集中**:
```typescript
// stores/index.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// 分领域状态
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  modalStack: Modal[];
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
}

// 组合状态
export const useStore = create<
  AuthState & UIState
>()(
  devtools(
    persist(
      immer((set, get) => ({
        // 初始状态和方法
      })),
      {
        name: 'xiaozhi-store',
        partialize: (state) => ({
          user: state.user,
          theme: state.theme,
        }),
      }
    )
  )
);
```

### 验收标准
- [ ] 无 > 500 行的文件
- [ ] TypeScript 严格模式零错误
- [ ] 测试覆盖 > 80%
- [ ] 组件文档完整

---

## Phase 4: UI/UX 升级 (5月, Week 15-18)

### 目标
- 设计系统 v2
- 交互体验优化
- 响应式完善

### 设计系统 v2

#### 4.1 视觉升级 (Week 15)

**新设计语言**:
```css
/* 智能渐变主题 */
:root {
  /* 主品牌色 - 蓝紫渐变 */
  --gradient-primary: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%);
  --gradient-surface: linear-gradient(180deg, #13131f 0%, #0a0a0f 100%);
  
  /* 玻璃态效果 */
  --glass-background: rgba(19, 19, 31, 0.8);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-blur: 12px;
  
  /* 发光效果 */
  --glow-primary: 0 0 20px rgba(99, 102, 241, 0.5);
  --glow-success: 0 0 20px rgba(16, 185, 129, 0.4);
}
```

**组件升级**:
- [ ] Button - 渐变 + 发光变体
- [ ] Card - 悬浮 + 玻璃态
- [ ] Input - 聚焦发光
- [ ] Dialog - 毛玻璃背景

#### 4.2 交互优化 (Week 16)

**微交互设计**:
```tsx
// 按钮点击波纹
function RippleButton({ children, ...props }) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  
  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setRipples([...ripples, { x, y, id: Date.now() }]);
    
    setTimeout(() => {
      setRipples((prev) => prev.slice(1));
    }, 600);
  };
  
  return (
    <button onClick={handleClick} {...props}>
      {children}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute animate-ripple rounded-full bg-white/30"
          style={{
            left: ripple.x,
            top: ripple.y,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </button>
  );
}
```

**页面过渡**:
```tsx
// 使用 Framer Motion
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

<AnimatePresence mode="wait">
  <motion.div
    key={pathname}
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
</AnimatePresence>
```

#### 4.3 响应式完善 (Week 17-18)

**断点系统**:
```css
/* Tailwind 断点 */
sm: 640px   /* 手机横屏 */
md: 768px   /* 平板竖屏 */
lg: 1024px  /* 平板横屏/小笔记本 */
xl: 1280px  /* 桌面 */
2xl: 1536px /* 大屏 */
```

**移动端优化**:
```tsx
// 触摸优化
const TouchCard = () => {
  const [isPressed, setIsPressed] = useState(false);
  
  return (
    <div
      className={cn(
        'transition-transform duration-100',
        isPressed && 'scale-95'
      )}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      style={{ touchAction: 'manipulation' }}
    >
      {/* 内容 */}
    </div>
  );
};
```

### 验收标准
- [ ] 设计系统文档完整
- [ ] 所有页面响应式适配
- [ ] 交互流畅 60fps
- [ ] 移动端体验优秀

---

## Phase 5: 技术栈升级 (6月, Week 19-22)

### 目标
- React 19 新特性
- Vite 6 构建优化
- 现代化工具链

### 升级清单

#### 5.1 React 19 (Week 19)

**新特性应用**:
```tsx
// Server Components (如适用)
// 'use server';

// Actions
function UpdateName() {
  const [error, submitAction, isPending] = useActionState(
    async (previousState, formData) => {
      const name = formData.get("name");
      const error = await updateName(name);
      if (error) return error;
      redirect("/path");
    },
    null
  );

  return (
    <form action={submitAction}>
      <input type="text" name="name" />
      <button disabled={isPending}>Update</button>
      {error && <p>{error}</p>}
    </form>
  );
}

// use hook
function Comments({ commentsPromise }) {
  const comments = use(commentsPromise);
  return comments.map((comment) => <p>{comment}</p>);
}
```

#### 5.2 Vite 6 (Week 20)

**配置升级**:
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true }),
  ],
  build: {
    target: 'esnext',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'animation': ['framer-motion'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});
```

#### 5.3 新工具链 (Week 21-22)

**Biome 替代 ESLint/Prettier**:
```json
// biome.json
{
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error"
      }
    }
  }
}
```

**Turborepo 优化构建**:
```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
```

---

## Phase 6: 测试与验证 (7月, Week 23-26)

### 目标
- 可访问性 100% 合规
- 性能达标
- 零回归错误

### 测试策略

#### 6.1 可访问性测试 (Week 23)

**自动化测试**:
```typescript
// tests/accessibility.test.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('homepage should not have accessibility violations', async ({ page }) => {
  await page.goto('/');
  
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  
  expect(accessibilityScanResults.violations).toEqual([]);
});
```

**手动测试清单**:
- [ ] 键盘导航测试 (Tab/Enter/Space/Esc)
- [ ] 屏幕阅读器测试 (NVDA/JAWS/VoiceOver)
- [ ] 色盲模拟测试
- [ ] 放大 200% 测试
- [ ] 高对比度模式测试

#### 6.2 性能测试 (Week 24)

**Lighthouse CI**:
```yaml
# .github/workflows/lighthouse.yml
- name: Run Lighthouse CI
  run: |
    npm install -g @lhci/cli@0.14.x
    lhci autorun
  env:
    LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

**性能预算**:
```json
// budgets.json
[
  {
    "path": "/*",
    "resourceSizes": [
      { "resourceType": "document", "budget": 50 },
      { "resourceType": "script", "budget": 500 },
      { "resourceType": "image", "budget": 1000 }
    ],
    "timings": [
      { "metric": "first-contentful-paint", "budget": 1500 },
      { "metric": "largest-contentful-paint", "budget": 2500 }
    ]
  }
]
```

#### 6.3 E2E 测试 (Week 25-26)

**关键流程测试**:
```typescript
// tests/critical-flows.spec.ts
test('完整对话流程', async ({ page }) => {
  // 1. 登录
  await page.goto('/login');
  await page.fill('[name="email"]', 'user@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');
  
  // 2. 创建对话
  await page.click('[data-testid="new-chat"]');
  await page.fill('[data-testid="message-input"]', '你好，小智');
  await page.click('[data-testid="send-button"]');
  
  // 3. 验证回复
  await expect(page.locator('[data-testid="ai-message"]')).toBeVisible();
  
  // 4. 离线测试
  await page.context().setOffline(true);
  await page.fill('[data-testid="message-input"]', '离线消息');
  await page.click('[data-testid="send-button"]');
  await expect(page.locator('[data-testid="pending-message"]')).toBeVisible();
});
```

### 验收标准
- [ ] axe-core 零错误
- [ ] Lighthouse 性能 > 90
- [ ] E2E 测试通过率 100%
- [ ] 无回归 Bug

---

## Phase 7: 发布与监控 (8月, Week 27-28)

### 发布策略

#### 7.1 灰度发布

```
Week 27:
Day 1-2: 5% 用户
Day 3-4: 20% 用户
Day 5-6: 50% 用户
Week 28:
Day 1-2: 100% 用户
```

#### 7.2 监控指标

**性能监控**:
```typescript
// monitoring/web-vitals.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  const body = JSON.stringify(metric);
  
  // 发送到监控服务
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/analytics', body);
  } else {
    fetch('/analytics', { body, method: 'POST', keepalive: true });
  }
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

**错误监控**:
```typescript
// monitoring/error-tracking.ts
window.addEventListener('error', (event) => {
  // 发送到 Sentry
  Sentry.captureException(event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(event.reason);
});
```

### 回滚策略

**自动化回滚条件**:
- 错误率 > 1%
- 性能下降 > 20%
- 用户投诉 > 50/小时

```bash
# 一键回滚脚本
./scripts/rollback.sh v1.0
```

---

## 📊 成功指标

### 技术指标
| 指标 | 当前 | 目标 | 测量工具 |
|------|------|------|----------|
| Lighthouse | 62 | 95 | Lighthouse CI |
| 可访问性 | 65 | 95 | axe-core |
| 测试覆盖 | 35% | 85% | Jest |
| 代码质量 | 70 | 92 | SonarQube |
| 包体积 | 2.8MB | 1.2MB | Bundle Analyzer |

### 业务指标
| 指标 | 预期提升 |
|------|----------|
| 用户留存率 | +30% |
| NPS 评分 | +20 分 |
| 页面转化率 | +15% |
| 客户支持工单 | -40% |

---

## 🛠️ 工具与资源

### 开发工具
- **IDE**: VS Code + Biome 插件
- **调试**: React DevTools + Redux DevTools
- **测试**: Playwright + Vitest
- **文档**: Storybook

### 监控工具
- **性能**: Lighthouse CI + Web Vitals
- **错误**: Sentry
- **可访问性**: axe DevTools
- **分析**: Google Analytics 4

### 协作工具
- **设计**: Figma
- **文档**: Notion
- **沟通**: Slack
- **项目管理**: Linear

---

## 📚 文档清单

### 开发文档
- [ ] `docs/ARCHITECTURE.md` - 架构设计
- [ ] `docs/COMPONENT_GUIDE.md` - 组件开发指南
- [ ] `docs/API_REFERENCE.md` - API 文档
- [ ] `docs/TESTING_GUIDE.md` - 测试指南

### 用户文档
- [ ] `docs/USER_GUIDE.md` - 用户手册
- [ ] `docs/ACCESSIBILITY.md` - 可访问性说明
- [ ] `docs/CHANGELOG.md` - 更新日志

### 运维文档
- [ ] `docs/DEPLOYMENT.md` - 部署文档
- [ ] `docs/MONITORING.md` - 监控指南
- [ ] `docs/INCIDENT_RESPONSE.md` - 应急响应

---

## ✅ 检查清单

### 发布前检查
- [ ] 所有 P0/P1 问题已修复
- [ ] 测试覆盖率 > 80%
- [ ] 性能预算达标
- [ ] 可访问性审计通过
- [ ] 安全扫描通过
- [ ] 文档已更新
- [ ] 回滚方案已准备
- [ ] 监控已配置

### 发布后检查
- [ ] 错误率 < 0.1%
- [ ] 性能指标正常
- [ ] 用户反馈良好
- [ ] 业务指标达成

---

## 📞 团队分工

| 角色 | 人员 | 职责 |
|------|------|------|
| 项目负责人 | 1人 | 整体协调、进度把控 |
| 前端开发 | 3人 | 组件开发、架构重构 |
| UI/UX 设计 | 2人 | 设计系统、交互优化 |
| QA 测试 | 1人 | 测试策略、质量把控 |
| DevOps | 0.5人 | CI/CD、部署支持 |

---

## 🎯 风险管理

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 重构延期 | 中 | 高 | 分阶段交付，MVP 优先 |
| 性能退化 | 低 | 高 | 持续监控，自动回滚 |
| 回归 Bug | 中 | 中 | 完整测试覆盖 |
| 团队变动 | 低 | 中 | 文档完善，知识共享 |

---

**计划制定**: 2026-02-11  
**下次评审**: 每周五 14:00  
**文档版本**: v1.0
