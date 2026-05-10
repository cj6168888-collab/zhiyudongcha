#!/bin/bash
# 可访问性重构 - 批量迁移脚本
# 用途: 自动修复 Button 和 Input 组件的可访问性问题

echo "🚀 开始可访问性批量迁移..."
echo "================================"

# 统计当前问题
echo "📊 统计当前问题..."

# 统计 Button 使用
echo "Button 组件使用情况:"
grep -r "<button" client/src --include="*.tsx" | wc -l
echo "  - 原生 button 标签"

grep -r "import.*Button.*from.*ui/button" client/src --include="*.tsx" | wc -l  
echo "  - 已使用 Button 组件"

# 统计 Input 使用
echo ""
echo "Input 组件使用情况:"
grep -r "<input" client/src --include="*.tsx" | wc -l
echo "  - 原生 input 标签"

grep -r "import.*Input.*from.*ui/input" client/src --include="*.tsx" | wc -l
echo "  - 已使用 Input 组件"

# 统计 label 问题
echo ""
echo "Label 关联问题:"
grep -r "<label>" client/src --include="*.tsx" | wc -l
echo "  - 无 htmlFor 的 label"

echo ""
echo "================================"
echo "⚠️  请手动运行以下命令查看详细列表:"
echo ""
echo "# 查看所有原生 button 使用:"
echo "grep -rn '<button[^>]*>' client/src --include='*.tsx' | head -20"
echo ""
echo "# 查看所有无 label 的 input:"
echo "grep -rn '<input[^>]*>' client/src --include='*.tsx' | grep -v 'label' | head -20"
echo ""
echo "================================"
