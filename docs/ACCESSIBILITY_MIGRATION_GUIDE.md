# 🚀 可访问性重构 - 迁移指南

**文档版本**: v2.0  
**更新日期**: 2026-02-11  
**适用阶段**: Phase 1 (可访问性重构)

---

## 📋 快速开始

### 1. 导入新的可访问性样式

更新 `main.tsx`:

```tsx
// 在现有导入后添加
import "./styles/accessibility.css";
import "./styles/accessibility-updated.css";
```

### 2. 添加 SkipLink 组件

```tsx
import { SkipLink } from "@/components/ui/skip-link";

function App() {
  return (
    <>
      <SkipLink targetId="main-content" />
      <main id="main-content">
        {/* 应用内容 */}
      </main>
    </>
  );
}
```

### 3. 测试可访问性

```bash
# 启动应用
npm run dev

# 访问测试页面
open http://localhost:5173/accessibility-test
```

---

## 🔄 组件迁移对照表

### Button 组件

**旧代码 (❌)**:
```tsx
<button 
  onClick={handleClick}
  className="bg-blue-500 text-white px-4 py-2"
>
  点击
</button>
```

**新代码 (✅)**:
```tsx
import { Button } from "@/components/ui/button";

<Button 
  onClick={handleClick}
  variant="default"
>
  点击
</Button>
```

**改进点**:
- ✅ 焦点指示器 (2px ring + offset)
- ✅ 键盘支持 (Enter/Space)
- ✅ 禁用状态样式
- ✅ 高对比度颜色

---

### Input + Label

**旧代码 (❌)**:
```tsx
<label>邮箱</label>
<input 
  type="email" 
  placeholder="输入邮箱"
  className="border p-2"
/>
```

**新代码 (✅)**:
```tsx
import { Input } from "@/components/ui/input-accessible";

<Input
  label="邮箱"
  type="email"
  placeholder="输入邮箱"
  required
  helperText="我们将通过邮箱联系您"
  error={errors.email}
/>
```

**改进点**:
- ✅ label + input 关联 (htmlFor + id)
- ✅ 必填标识 (*)
- ✅ 错误状态处理 (aria-invalid)
- ✅ 帮助文本 (aria-describedby)
- ✅ 图标支持

---

### Dialog/Modal

**旧代码 (❌)**:
```tsx
{isOpen && (
  <div className="modal">
    <div className="modal-content">
      <h2>标题</h2>
      <button onClick={onClose}>关闭</button>
    </div>
  </div>
)}
```

**新代码 (✅)**:
```tsx
import { Dialog } from "@/components/ui/dialog-accessible";

<Dialog
  isOpen={isOpen}
  onClose={onClose}
  title="对话框标题"
  description="对话框描述"
  size="md"
>
  <p>对话框内容</p>
  <Button onClick={onClose}>关闭</Button>
</Dialog>
```

**改进点**:
- ✅ 焦点陷阱 (Tab 循环)
- ✅ ESC 关闭
- ✅ ARIA 属性 (role, aria-modal)
- ✅ 焦点恢复
- ✅ 背景滚动锁定

---

## 🛠️ 常用可访问性工具

### 1. 焦点陷阱 Hook

```tsx
import { useFocusTrap } from "@/lib/accessibility";

function MyModal({ isOpen }) {
  const containerRef = useFocusTrap(isOpen);
  
  return (
    <div ref={containerRef}>
      {/* 内容 */}
    </div>
  );
}
```

### 2. 键盘快捷键

```tsx
import { useKeyboardShortcuts } from "@/lib/accessibility";

useKeyboardShortcuts({
  "Cmd+k": () => openSearch(),
  "Escape": () => closeModal(),
  "/": () => focusSearch(),
});
```

### 3. 屏幕阅读器通知

```tsx
import { announceToScreenReader } from "@/lib/accessibility";

//  polite: 等待当前任务完成后播报
announceToScreenReader("操作成功完成", "polite");

// assertive: 立即打断并播报
announceToScreenReader("发生错误！", "assertive");
```

### 4. 唯一 ID

```tsx
import { useUniqueId } from "@/lib/accessibility";

const id = useUniqueId("input"); // input-1-x9k2m
```

---

## 📝 ARIA 属性速查表

### 常用属性

| 属性 | 用途 | 示例 |
|------|------|------|
| `aria-label` | 元素标签 | `<button aria-label="关闭">×</button>` |
| `aria-labelledby` | 关联标签 | `<input aria-labelledby="name-label">` |
| `aria-describedby` | 帮助文本 | `<input aria-describedby="name-help">` |
| `aria-invalid` | 验证状态 | `<input aria-invalid="true">` |
| `aria-required` | 必填 | `<input aria-required="true">` |
| `aria-disabled` | 禁用 | `<button aria-disabled="true">` |
| `aria-busy` | 加载中 | `<button aria-busy="true">` |
| `aria-expanded` | 展开状态 | `<button aria-expanded="false">` |
| `aria-hidden` | 隐藏 | `<span aria-hidden="true">✓</span>` |
| `role` | 角色 | `<div role="alert">错误</div>` |

### 角色 (Role)

```tsx
// 按钮
<button role="button">点击</button>

// 链接
<a role="link">跳转</a>

// 标题
<h1 role="heading" aria-level="1">标题</h1>

// 列表
<ul role="list">
  <li role="listitem">项目</li>
</ul>

// 对话框
<div role="dialog" aria-modal="true">...</div>

// 警告
<div role="alert">错误信息</div>

// 状态
<div role="status">成功信息</div>
```

---

## 🎨 颜色对比度指南

### WCAG 2.2 标准

| 级别 | 正常文字 | 大文字 (18pt+) | 粗体 (14pt+) |
|------|----------|----------------|--------------|
| AA | 4.5:1 | 3:1 | 3:1 |
| AAA | 7:1 | 4.5:1 | 4.5:1 |

### 当前配色 (已修复)

| 用途 | 颜色 | 对比度 | 状态 |
|------|------|--------|------|
| 主背景 | #0a0a0f | - | ✅ |
| 主要文字 | #fafafa | 18.5:1 | ✅ AA |
| 次要文字 | #e4e4e7 | 14.2:1 | ✅ AA |
| 辅助文字 | #a1a1aa | 7.8:1 | ✅ AA |
| 禁用文字 | #71717a | 4.8:1 | ✅ AA |
| 主按钮 | #4338ca | 7.2:1 | ✅ AA |
| 错误 | #dc2626 | 5.4:1 | ✅ AA |
| 成功 | #16a34a | 5.8:1 | ✅ AA |

---

## ⌨️ 键盘导航规范

### Tab 顺序

```tsx
// 正确的 Tab 顺序
<form>
  <Input label="姓名" tabIndex={0} />  {/* 默认 */}
  <Input label="邮箱" tabIndex={0} />  {/* 默认 */}
  <Button tabIndex={0}>提交</Button>    {/* 默认 */}
</form>

// 错误的 Tab 顺序
<button tabIndex={3}>第三</button>
<button tabIndex={1}>第一</button>
<button tabIndex={2}>第二</button>
```

### 快捷键

| 快捷键 | 功能 | 实现 |
|--------|------|------|
| Tab | 下一个元素 | 默认 |
| Shift+Tab | 上一个元素 | 默认 |
| Enter | 激活按钮/链接 | 默认 |
| Space | 激活按钮/复选框 | 默认 |
| Escape | 关闭 Modal | 自定义 |
| Cmd+K | 打开搜索 | 自定义 |
| / | 聚焦搜索框 | 自定义 |

---

## 🔍 测试清单

### 自动化测试

```bash
# 1. axe-core 扫描
npm run test:a11y

# 2. Lighthouse 可访问性评分
npm run lighthouse

# 3. TypeScript 检查
npm run type-check

# 4. ESLint (包含 jsx-a11y)
npm run lint
```

### 手动测试

```markdown
□ 键盘导航 - Tab/Shift+Tab 访问所有交互元素
□ 焦点指示器 - 焦点清晰可见
□ 跳过链接 - Tab 首个元素显示"跳转到内容"
□ ESC 关闭 - Modal/Dialog 按 ESC 关闭
□ 焦点陷阱 - Modal 中 Tab 循环
□ 焦点恢复 - Modal 关闭后焦点回到触发按钮
□ 表单标签 - label 与 input 关联正确
□ 必填标识 - 必填字段有 * 标识
□ 错误处理 - 不仅用颜色表示错误
□ 屏幕阅读器 - 开启 NVDA/VoiceOver 测试
□ 高对比度 - Windows/Mac 高对比度模式
□ 放大测试 - 页面放大 200%
□ 减少动画 - 开启"减少动态效果"偏好
```

---

## 🚨 常见错误修复

### 错误 1: 点击事件在非按钮元素上

**❌ 错误**:
```tsx
<div onClick={handleClick}>点击我</div>
```

**✅ 修复**:
```tsx
<button onClick={handleClick}>点击我</button>
// 或
<div 
  role="button" 
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
  点击我
</div>
```

### 错误 2: 图片缺少 alt 属性

**❌ 错误**:
```tsx
<img src="photo.jpg" />
```

**✅ 修复**:
```tsx
// 有内容的图片
<img src="photo.jpg" alt="美丽的风景照片" />

// 装饰性图片
<img src="decoration.jpg" alt="" />
```

### 错误 3: 仅通过颜色表示状态

**❌ 错误**:
```tsx
<span className="text-red-500">错误</span>
```

**✅ 修复**:
```tsx
<span className="text-red-500 flex items-center gap-1">
  <ErrorIcon aria-hidden="true" />
  错误: 请输入有效的邮箱
</span>
```

---

## 📚 参考资源

### 官方文档
- [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

### 工具
- [axe DevTools](https://www.deque.com/axe/devtools/) - 浏览器插件
- [WAVE](https://wave.webaim.org/) - 在线检查
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - 内置工具

### 组件库
- [Radix UI](https://www.radix-ui.com/) - 无样式可访问性组件
- [React Aria](https://react-spectrum.adobe.com/react-aria/) - Adobe 可访问性库
- [Reach UI](https://reach.tech/) - 可访问性组件

---

## ✅ 完成检查清单

迁移完成后检查:

- [x] 所有页面导入 `accessibility-updated.css`
- [x] SkipLink 组件添加到应用入口
- [ ] Button 组件已升级
- [ ] Input 组件已升级
- [ ] Dialog 组件已升级
- [ ] axe-core 扫描 0 错误
- [ ] Lighthouse 可访问性 > 90
- [ ] 键盘导航测试通过
- [ ] 屏幕阅读器测试通过

---

**下一步**: 运行测试页面验证所有改进 → `npm run dev` → `/accessibility-test`
