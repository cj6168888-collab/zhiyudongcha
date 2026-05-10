# 可访问性测试报告

**生成时间**: 2026/2/12 08:13:21
**扫描文件**: 194 个
**发现问题**: 4 个
**问题文件**: 3 个

---

## 📊 问题统计

| 类型 | 数量 | 严重程度 | 优先级 |
|------|------|----------|--------|
| Button (原生) | 2 | 🔴 高 | P0 |
| Input (无label) | 2 | 🔴 高 | P0 |
| Label (无htmlFor) | 0 | 🟡 中 | P1 |
| Image (无alt) | 0 | 🟡 中 | P1 |
| **总计** | **4** | - | - |

---

## 🎯 修复计划

### 立即修复 (P0)
- [ ] 替换 2 个原生 button 为 Button 组件
- [ ] 为 2 个 input 添加 label 关联

### 本周修复 (P1)
- [ ] 修复 0 个 label 的 htmlFor
- [ ] 为 0 个 img 添加 alt

---

## 📁 问题文件列表 (前 20 个)


### client\src\components\ui\sidebar.tsx
- **button** (1处): 发现原生 button 标签，建议使用 <Button> 组件

---

### client\src\pages\command-center.tsx
- **input** (1处): Input 可能缺少 label 或 aria-label

---

### client\src\pages\settings.tsx
- **button** (1处): 发现原生 button 标签，建议使用 <Button> 组件
- **input** (1处): Input 可能缺少 label 或 aria-label




---

## 🛠️ 修复命令

### 批量替换 Button
```bash
# 查找所有原生 button
find client/src -name "*.tsx" -exec grep -l "<button" {} \;

# 使用 IDE 批量替换
# 搜索: <button([^>]*)>
# 替换: <Button$1>
```

### 批量修复 Input
```bash
# 查找所有无 label 的 input
grep -r "<input" client/src --include="*.tsx" | grep -v "aria-label"
```

---

## ✅ 验证检查清单

- [ ] axe-core 扫描 0 错误
- [ ] Lighthouse 可访问性 > 90
- [ ] 键盘导航测试通过
- [ ] 屏幕阅读器测试通过

---

**报告生成**: Day 3 进度检查
