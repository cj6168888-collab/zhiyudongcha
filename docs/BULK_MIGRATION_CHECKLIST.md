# 可访问性批量修复清单

## 📋 执行计划 (Day 3-4)

### 阶段 1: 全局样式导入 (5分钟)

**文件**: `client/src/main.tsx`

添加导入:
```tsx
// 添加在文件顶部
import "./styles/accessibility.css";
import "./styles/accessibility-updated.css";

// 添加 SkipLink
import { SkipLink } from "@/components/ui/skip-link";

// 在 render 中:
<SkipLink targetId="main-content" />
<main id="main-content">
  <App />
</main>
```

---

### 阶段 2: 高影响页面优先修复 (2小时)

按优先级修复以下页面:

#### P0 - 最高优先级 (用户核心流程)
1. **Login/Register** - 登录注册页面
2. **Dashboard** - 首页仪表盘
3. **Chat** - 聊天页面
4. **Settings** - 设置页面

#### P1 - 高优先级 (常用功能)
5. **Project Center** - 项目中心
6. **Relationship Network** - 人脉网络
7. **Vault** - 资源管理
8. **Profile** - 个人资料

#### P2 - 中优先级 (其他功能)
9. 其他 35 个页面

---

### 阶段 3: 组件批量替换 (4小时)

#### Button 组件替换

**替换模式**:
```tsx
// 之前:
<button 
  className="bg-primary text-white px-4 py-2 rounded"
  onClick={handleClick}
>
  点击
</button>

// 之后:
<Button 
  variant="default"
  onClick={handleClick}
>
  点击
</Button>
```

**快速替换命令**:
```bash
# 1. 查找所有 button 标签
find client/src/pages -name "*.tsx" -exec grep -l "<button" {} \;

# 2. 批量替换简单 button
# 注意: 需要人工检查每个替换
```

#### Input + Label 替换

**替换模式**:
```tsx
// 之前:
<div>
  <label>邮箱</label>
  <input 
    type="email" 
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
</div>

// 之后:
<Input
  label="邮箱"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  required
/>
```

---

### 阶段 4: 表单验证增强 (2小时)

为所有表单添加:
1. ✅ 客户端验证
2. ✅ 错误状态显示
3. ✅ ARIA 错误关联
4. ✅ 成功状态反馈

**示例**:
```tsx
const [errors, setErrors] = useState({});

const validate = () => {
  const newErrors = {};
  if (!email) newErrors.email = "请输入邮箱";
  if (!password) newErrors.password = "请输入密码";
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

<Input
  label="邮箱"
  error={errors.email}
  aria-invalid={errors.email ? "true" : "false"}
/>
```

---

## 🛠️ 自动化脚本

### 脚本 1: 检查进度

```bash
#!/bin/bash
# check-progress.sh

echo "=== 可访问性重构进度检查 ==="
echo ""

# 统计 Button 迁移
echo "Button 组件:"
total_buttons=$(grep -r "<button" client/src/pages --include="*.tsx" | wc -l)
migrated_buttons=$(grep -r "import.*Button.*from.*@/components/ui/button" client/src/pages --include="*.tsx" | wc -l)
echo "  待迁移: $total_buttons"
echo "  已完成: $migrated_buttons"

# 统计 Input 迁移
echo ""
echo "Input 组件:"
total_inputs=$(grep -r "<input" client/src/pages --include="*.tsx" | grep -v "import" | wc -l)
migrated_inputs=$(grep -r "import.*Input.*from.*@/components/ui/input" client/src/pages --include="*.tsx" | wc -l)
echo "  待迁移: $total_inputs"
echo "  已完成: $migrated_inputs"

# 统计 label 问题
echo ""
echo "Label 问题:"
label_issues=$(grep -r "<label>" client/src/pages --include="*.tsx" | wc -l)
echo "  无 htmlFor 的 label: $label_issues"

echo ""
echo "=== 建议优先修复的页面 ==="
grep -l "<button\|<input" client/src/pages/*.tsx | head -10
```

### 脚本 2: 快速修复

```bash
#!/bin/bash
# quick-fix.sh
# 自动修复简单问题

PAGE=$1

echo "修复页面: $PAGE"

# 1. 添加 label htmlFor
sed -i 's/<label>\([^<]*\)<\/label>/<label htmlFor="\L\1\">\1<\/label>/g' "$PAGE"

# 2. 添加 input id (基于 placeholder 或 name)
# 注意: 这个需要手动检查

echo "✅ 基础修复完成，请人工检查"
```

---

## 📊 页面修复清单

### P0 - 核心页面

- [ ] **Login Page** (`client/src/pages/login.tsx`)
  - [ ] 替换 Button
  - [ ] 替换 Input
  - [ ] 添加 label 关联
  - [ ] 添加错误处理
  - [ ] 测试键盘导航

- [ ] **Dashboard** (`client/src/pages/dashboard.tsx`)
  - [ ] 替换所有 Button
  - [ ] 添加 SkipLink
  - [ ] 检查 heading 层级
  - [ ] 测试屏幕阅读器

- [ ] **Chat Page** (`client/src/pages/chat.tsx`)
  - [ ] 消息区域 ARIA 标签
  - [ ] 输入框 label
  - [ ] 发送按钮
  - [ ] 焦点管理

- [ ] **Settings** (`client/src/pages/settings.tsx`)
  - [ ] 所有表单元素
  - [ ] Toggle 开关
  - [ ] Select 下拉
  - [ ] 保存按钮

### P1 - 重要页面

- [ ] Project Center
- [ ] Relationship Network
- [ ] Vault Compute
- [ ] Profile
- [ ] Insight Listener
- [ ] Oracle
- [ ] Command Center
- [ ] System Console

### P2 - 其他页面

- [ ] (剩余 35 个页面)

---

## ✅ 验证检查点

每个页面修复后检查:

### 自动化检查
```bash
# 1. axe-core 扫描
npx axe-core $PAGE_URL

# 2. Lighthouse
npx lighthouse $PAGE_URL --view

# 3. TypeScript
npx tsc --noEmit
```

### 手动检查
- [ ] Tab 键可以访问所有交互元素
- [ ] 焦点指示器清晰可见
- [ ] 表单有 label 关联
- [ ] 错误信息不仅用颜色表示
- [ ] 按钮有明确的文字或 aria-label

---

## 📈 进度追踪

| 日期 | 完成页面 | 剩余页面 | 状态 |
|------|----------|----------|------|
| Day 3 | 4 (P0) | 39 | 🟡 进行中 |
| Day 4 | 12 (P0+P1) | 31 | ⏳ 待开始 |
| Day 5 | 24 | 19 | ⏳ 待开始 |
| Day 6 | 36 | 7 | ⏳ 待开始 |
| Day 7 | 43 | 0 | ⏳ 待开始 |

---

## 🎯 今日目标 (Day 3)

**必须完成**:
- [x] 全局样式导入
- [ ] 4 个 P0 页面修复
- [ ] 运行 axe-core 验证
- [ ] 生成进度报告

**预计时间**: 8 小时
**实际时间**: ___ 小时
**完成度**: ___%

---

## 🚨 常见问题

### Q1: 迁移后样式不一致?
**A**: 检查是否导入了 `accessibility-updated.css`，它包含高对比度颜色覆盖。

### Q2: 焦点指示器不显示?
**A**: 检查元素是否有 `focus-visible:outline-none` 覆盖，需要移除。

### Q3: 屏幕阅读器不播报?
**A**: 检查 ARIA 属性是否正确，特别是 `aria-live` 区域。

### Q4: 表单验证不工作?
**A**: 确保使用了新的 `Input` 组件，它有内置的 `aria-invalid` 支持。

---

**下一步**: 开始修复第一个页面 → `client/src/pages/login.tsx`
