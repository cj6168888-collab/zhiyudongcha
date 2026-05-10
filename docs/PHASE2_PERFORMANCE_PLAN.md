# Phase 2: 性能优化计划

**阶段**: Phase 2 (Day 5-7)  
**目标**: 性能评分 62 → 95, 首屏 < 1.5s, 包体积 < 1.5MB

---

## 📊 性能基线 (重构前)

### Lighthouse 评分
```
Performance:        62/100 ⚠️
├── FCP: 1.8s (目标: <1.0s)
├── LCP: 2.5s (目标: <1.5s)
├── TTI: 4.2s (目标: <3.0s)
├── CLS: 0.15 (目标: <0.1)
└── Speed Index: 2.8s
```

### 包体积分析
```
总体积: 2.8 MB
├── JS: 2.1 MB (75%)
│   ├── vendor: 1.2 MB
│   ├── app: 0.6 MB
│   └── async: 0.3 MB
├── CSS: 0.4 MB (14%)
├── Images: 0.3 MB (11%)
└── Fonts: 0.1 MB (4%)
```

### 目标
```
Performance:        95/100 🎯
├── FCP: <1.0s
├── LCP: <1.5s
├── TTI: <3.0s
├── CLS: <0.1
└── 包体积: <1.5MB
```

---

## 🗓️ 执行计划

### Day 5: 代码分割与路由懒加载

**目标**: 减少首屏加载 JS 50%

**任务清单**:
- [ ] 1. 路由级代码分割 (React.lazy + Suspense)
- [ ] 2. 组件级懒加载 (重型组件)
- [ ] 3. 第三方库按需加载
- [ ] 4. 预加载关键路由

**预期效果**:
- 首屏 JS: 2.1MB → 1.0MB (-52%)
- FCP: 1.8s → 1.2s

---

### Day 6: 资源优化与包体积压缩

**目标**: 包体积压缩 46%

**任务清单**:
- [ ] 1. 图片优化 (WebP/AVIF 格式)
- [ ] 2. 字体子集化
- [ ] 3. Tree Shaking 优化
- [ ] 4. Gzip/Brotli 压缩

**预期效果**:
- 包体积: 2.8MB → 1.5MB (-46%)
- LCP: 2.5s → 1.5s

---

### Day 7: 动画性能与缓存策略

**目标**: 流畅度 60fps, 缓存命中率 >80%

**任务清单**:
- [ ] 1. 动画性能优化 (will-change, GPU加速)
- [ ] 2. Service Worker 缓存
- [ ] 3. 状态持久化优化
- [ ] 4. 减少重排重绘

**预期效果**:
- TTI: 4.2s → 2.5s
- 动画流畅度: 60fps
- CLS: 0.15 → 0.05

---

## 🛠️ 优化策略

### 1. 代码分割

```tsx
// 路由级分割
const Dashboard = lazy(() => import('./pages/dashboard'));
const Chat = lazy(() => import('./pages/chat'));

// 组件级分割
const HeavyChart = lazy(() => import('./components/heavy-chart'));
```

### 2. 资源优化

```yaml
图片优化:
  - 格式: WebP/AVIF
  - 懒加载: loading="lazy"
  - 响应式: srcset

字体优化:
  - 子集化: 仅加载使用字符
  - 预加载: <link rel="preload">
  - 字体显示: font-display: swap
```

### 3. 缓存策略

```yaml
Service Worker:
  - 静态资源: Cache First
  - API 数据: Network First
  - 图片: Stale While Revalidate

状态管理:
  - 持久化: localStorage/IndexedDB
  - 选择性: 仅必要状态
```

---

## 📈 成功指标

| 指标 | 当前 | 目标 | Day 5 | Day 6 | Day 7 |
|------|------|------|-------|-------|-------|
| **Lighthouse** | 62 | 95 | 75 | 85 | 95 |
| **FCP** | 1.8s | <1.0s | 1.2s | 1.1s | 1.0s |
| **LCP** | 2.5s | <1.5s | 2.2s | 1.8s | 1.5s |
| **TTI** | 4.2s | <3.0s | 3.5s | 3.0s | 2.5s |
| **CLS** | 0.15 | <0.1 | 0.12 | 0.08 | 0.05 |
| **包体积** | 2.8MB | <1.5MB | 2.2MB | 1.8MB | 1.5MB |

---

## ✅ 检查清单

### Day 5 完成标准
- [ ] 所有路由实现懒加载
- [ ] 重型组件按需加载
- [ ] 首屏 JS < 1.2MB
- [ ] Lighthouse > 75

### Day 6 完成标准
- [ ] 图片转换为 WebP/AVIF
- [ ] 字体子集化完成
- [ ] Tree Shaking 优化
- [ ] 包体积 < 1.8MB

### Day 7 完成标准
- [ ] 动画 60fps
- [ ] Service Worker 启用
- [ ] 缓存策略生效
- [ ] Lighthouse > 95

---

**开始时间**: 2026-02-11  
**预计完成**: 2026-02-14  
**状态**: 🚀 进行中
