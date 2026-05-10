# 前端Hooks和组件库使用指南

本文档概述了项目中已创建的所有自定义Hooks和React组件，提供使用示例和最佳实践。

---

## 目录

1. [状态管理](#状态管理)
2. [性能优化](#性能优化)
3. [错误处理](#错误处理)
4. [用户界面](#用户界面)
5. [工具Hooks](#工具hooks)
6. [快速开始](#快速开始)

---

## 状态管理

### useStatePersistence

状态持久化到localStorage/sessionStorage。

```typescript
import { useStatePersistence } from '@/hooks/use-state-persistence';

const { state, setState, isHydrated } = useStatePersistence({
  storage: 'localStorage',
  key: 'user-settings',
  defaultValue: { theme: 'light' },
});

setState({ theme: 'dark' });
```

### useDataCache

API响应缓存（LRU策略）。

```typescript
import { useDataCache } from '@/hooks/use-data-cache';

const cache = useDataCache<ApiResponse>({
  maxSize: 100,
  defaultTTL: 5 * 60 * 1000, // 5分钟
});

cache.set('user-data', response);
const cached = cache.get('user-data');
```

### useDarkMode

深色模式管理。

```typescript
import { useDarkMode } from '@/hooks/use-dark-mode';

const { theme, resolvedTheme, setTheme, toggle, isDark } = useDarkMode({
  defaultTheme: 'system',
});

return <div className={isDark ? 'dark' : 'light'}>...</div>;
```

---

## 性能优化

### usePerformance

Core Web Vitals监控。

```typescript
import { usePerformance } from '@/hooks/use-performance';

const { webVitals, metrics, getScore, reportToSentry } = usePerformance();

if (getScore() === 'poor') {
  console.log('Performance needs improvement');
}

useEffect(() => {
  if (webVitals.lcp && webVitals.lcp > 2500) {
    // LCP优化建议
  }
}, [webVitals]);
```

### useRoutePreload

路由预加载。

```typescript
import { useRoutePreload } from '@/hooks/use-route-preload';

const { preload, preloadOnHover } = useRoutePreload();

<a href="/dashboard" onMouseEnter={preloadOnHover}>Dashboard</a>
```

### useDebounce / useThrottle

防抖和节流。

```typescript
import { useDebounce, useThrottle } from '@/hooks/use-debounce-throttle';

const debouncedSearch = useDebounce(searchTerm, 300);
const throttledScroll = useThrottle(onScroll, 100);
```

### VirtualScroll

虚拟滚动组件。

```typescript
import { VirtualScroll } from '@/components/ui/VirtualScroll';

<VirtualScroll
  items={largeList}
  renderItem={(item) => <ListItem item={item} />}
  itemHeight={60}
  height={400}
/>
```

---

## 错误处理

### useApiErrors

API错误处理和重试。

```typescript
import { useApiErrors } from '@/hooks/use-api-errors';

const { errors, addError, removeError, retry } = useApiErrors({
  maxAttempts: 3,
  retryOn: ['network', 'server'],
});

try {
  await fetchData();
} catch (error) {
  addError({
    message: 'Failed to fetch data',
    category: 'network',
    severity: 'high',
  });
}
```

### ErrorBoundary

错误边界组件。

```typescript
import { ErrorBoundary } from '@/components/error/ErrorBoundary';

<ErrorBoundary
  fallback={(error, reset) => (
    <button onClick={reset}>重试</button>
  )}
>
  <Component />
</ErrorBoundary>
```

### GlobalErrorHandler

全局错误处理。

```typescript
import { setupGlobalErrorHandler } from '@/lib/error/global-error-handler';

setupGlobalErrorHandler({
  showErrorDialog: true,
  reportToSentry: true,
});
```

---

## 用户界面

### ToastProvider

Toast通知系统。

```typescript
import { ToastProvider, useToast } from '@/components/toast/ToastProvider';

function MyComponent() {
  const { success, error, warning, info } = useToast();

  success('操作成功', '数据已保存');
  error('保存失败', '请重试');
}
```

### LoadingStates

加载状态组件。

```typescript
import { Skeleton, LoadingSpinner, ProgressBar, LoadingOverlay } from '@/components/loading/LoadingStates';

// Skeleton
<Skeleton width={200} height={40} />

// Spinner
<LoadingSpinner size="lg" label="加载中..." />

// Progress
<ProgressBar value={60} showLabel />

// Overlay
<LoadingOverlay isLoading={isLoading}>
  <Content />
</LoadingOverlay>
```

### MicrophonePermissionGuide

麦克风权限引导。

```typescript
import { MicrophonePermissionGuide } from '@/components/permission/MicrophonePermissionGuide';

{permissionError === 'denied' && (
  <MicrophonePermissionGuide
    onRetry={() => setPermissionError(null)}
    onOpenSettings={() => window.open('chrome://settings', '_blank')}
  />
)}
```

### ReconnectionStatus

重连状态组件。

```typescript
import { ReconnectionStatus } from '@/components/connection/ReconnectionStatus';

<ReconnectionStatus
  state={state}
  reconnectProgress={progress}
  reconnectState={reconnectState}
  lastError={error}
  onRetry={connect}
/>
```

---

## 工具Hooks

### useClipboard

剪贴板操作。

```typescript
import { useClipboard } from '@/hooks/use-clipboard';

const { copy, copied, reset } = useClipboard();

await copy('Hello World');
await copyHtml('<p>Rich text</p>', 'Rich text');
```

### useKeyboardShortcuts

键盘快捷键。

```typescript
import { useKeyboardShortcuts, createShortcut } from '@/hooks/use-keyboard-shortcuts';

useKeyboardShortcuts([
  createShortcut('ctrl+s', save, { description: '保存' }),
  createShortcut('escape', close),
  { key: 'ctrl+z', action: undo, modifiers: ['shift'] },
]);
```

### useFormValidation

表单验证。

```typescript
import { useFormValidation } from '@/hooks/use-form-validation';

const { values, errors, handleChange, handleSubmit } = useFormValidation({
  email: '',
  password: '',
}, {
  email: { required: true, email: true },
  password: { required: true, minLength: { value: 6, message: '至少6个字符' } },
});

<form onSubmit={handleSubmit(onSubmit)}>
  <input value={values.email} onChange={handleChange('email')} />
  {errors.email && <span>{errors.email}</span>}
  <button type="submit">提交</button>
</form>
```

### useStreamingAsr

流式语音识别。

```typescript
import { useStreamingAsR } from '@/hooks/use-streaming-asr';

const { isConnected, isListening, transcript, connect, disconnect, sendAudio } = useStreamingAsR({
  endpoint: '/ws/asr',
});
```

### useOptimizedTTS

优化TTS播放。

```typescript
import { useOptimizedTTS } from '@/hooks/use-optimized-tts';

const { state, speak, stop, pause, resume, preload, clearCache } = useOptimizedTTS({
  endpoint: '/ws/tts',
  preloadEnabled: true,
  cacheSize: 10,
});

await speak({ text: 'Hello!' });
preload('Next response text');
```

### useRealtimeWebSocket

WebSocket连接管理。

```typescript
import { useRealtimeWebSocket } from '@/hooks/use-realtime-websocket';

const { state, isConnected, reconnectProgress, connect, disconnect, send } = useRealtimeWebSocket({
  url: '/ws/voice',
  reconnectConfig: {
    maxAttempts: 5,
    initialDelay: 1000,
  },
});
```

---

## 快速开始

### 1. 安装依赖

所有Hooks都是内置的，无需额外安装。

### 2. 导入需要的Hook

```typescript
import { useStatePersistence } from '@/hooks/use-state-persistence';
import { useToast } from '@/components/toast/ToastProvider';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
```

### 3. 在App中使用Provider

```typescript
import { ToastProvider } from '@/components/toast/ToastProvider';
import { setupGlobalErrorHandler } from '@/lib/error/global-error-handler';

function App() {
  setupGlobalErrorHandler({ reportToSentry: true });

  return (
    <ToastProvider>
      <ErrorBoundary>
        <MainContent />
      </ErrorBoundary>
    </ToastProvider>
  );
}
```

### 4. 在组件中使用Hooks

```typescript
function MyComponent() {
  const { toast } = useToast();
  const { copy, copied } = useClipboard();
  const { theme, toggle } = useDarkMode();

  return (
    <div>
      <button onClick={() => toast.success('Saved!')}>Save</button>
      <button onClick={() => copy('text')}>{copied ? 'Copied!' : 'Copy'}</button>
    </div>
  );
}
```

---

## 最佳实践

1. **错误边界**: 在顶层使用`<ErrorBoundary>`包裹应用
2. **Toast**: 使用ToastProvider包裹应用，提供一致的反馈体验
3. **性能**: 对频繁调用使用debounce/throttle
4. **缓存**: 对API响应使用useDataCache减少网络请求
5. **持久化**: 使用useStatePersistence保存用户偏好设置
6. **无障碍**: 确保所有交互都有适当的ARIA属性

---

## 文件结构

```
client/src/
├── components/
│   ├── error/ErrorBoundary.tsx
│   ├── loading/LoadingStates.tsx
│   ├── permission/MicrophonePermissionGuide.tsx
│   ├── connection/ReconnectionStatus.tsx
│   ├── toast/ToastProvider.tsx
│   └── ui/VirtualScroll.tsx
├── hooks/
│   ├── use-api-errors.ts
│   ├── use-performance.ts
│   ├── use-data-cache.ts
│   ├── use-state-persistence.ts
│   ├── use-route-preload.ts
│   ├── use-dark-mode.ts
│   ├── use-streaming-asr.ts
│   ├── use-optimized-tts.ts
│   ├── use-realtime-websocket.ts
│   ├── use-clipboard.ts
│   ├── use-debounce-throttle.ts
│   ├── use-keyboard-shortcuts.ts
│   └── use-form-validation.ts
├── lib/
│   └── error/global-error-handler.ts
└── styles/
    ├── accessibility.css
    └── responsive-voice.css
```

---

## 贡献指南

添加新Hooks时请遵循：

1. 使用TypeScript编写完整类型定义
2. 包含详细JSDoc注释
3. 提供使用示例
4. 添加单元测试
5. 更新本文档

---

## 许可证

MIT
