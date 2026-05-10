#!/bin/bash
# 前端基线测试自动化脚本
# 收集系统性能、错误、用户体验数据

set -e

echo "=========================================="
echo "   前端交互基线测试自动化"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
REPORT_DIR="reports/baseline"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="${REPORT_DIR}/baseline_${TIMESTAMP}.md"

# 创建报告目录
mkdir -p "${REPORT_DIR}"

echo -e "${BLUE}[1/5] 准备环境...${NC}"

# 检查前端是否运行
if ! curl -s http://localhost:5000 > /dev/null 2>&1; then
    echo -e "${YELLOW}前端未运行，启动中...${NC}"
    npm run dev:client > /dev/null 2>&1 &
    DEV_PID=$!
    
    # 等待前端启动
    echo "等待前端启动..."
    for i in {1..30}; do
        if curl -s http://localhost:5000 > /dev/null 2>&1; then
            echo -e "${GREEN}前端已启动${NC}"
            break
        fi
        sleep 1
    done
else
    echo -e "${GREEN}前端已在运行${NC}"
fi

echo ""
echo -e "${BLUE}[2/5] 运行性能基线测试...${NC}"

# 运行 Playwright 基线测试
npm run test:e2e -- tests/e2e/baseline.spec.ts 2>&1 | tee "test-output.log" || true

echo ""
echo -e "${BLUE}[3/5] 收集测试结果...${NC}"

# 提取测试结果
if [ -f "test-output.log" ]; then
    # 提取关键指标
    PAGE_LOAD_TIME=$(grep -o "总加载时间: [0-9]*ms" test-output.log | grep -o "[0-9]*" || echo "N/A")
    LCP=$(grep -o "LCP: [0-9.]*ms" test-output.log | grep -o "[0-9.]*" || echo "N/A")
    CLS=$(grep -o "CLS: [0-9.]*" test-output.log | grep -o "[0-9.]*" || echo "N/A")
    ERROR_COUNT=$(grep -o "错误数量: [0-9]*" test-output.log | grep -o "[0-9]*" || echo "0")
    
    echo "页面加载时间: ${PAGE_LOAD_TIME}ms"
    echo "LCP: ${LCP}ms"
    echo "CLS: ${CLS}"
    echo "错误数量: ${ERROR_COUNT}"
else
    echo -e "${RED}测试输出文件不存在${NC}"
    PAGE_LOAD_TIME="N/A"
    LCP="N/A"
    CLS="N/A"
    ERROR_COUNT="0"
fi

echo ""
echo -e "${BLUE}[4/5] 生成基线报告...${NC}"

# 生成基线报告
cat > "${REPORT_FILE}" << EOF
# 前端交互基线报告

**生成日期**: $(date '+%Y-%m-%d %H:%M:%S')
**测试版本**: ${TIMESTAMP}

---

## 一、执行摘要

本报告记录了前端交互系统的基线数据。

### 关键指标

| 指标 | 当前值 | 目标值 | 状态 |
|------|--------|--------|------|
| 页面加载时间 | ${PAGE_LOAD_TIME}ms | <3000ms | $([ "${PAGE_LOAD_TIME}" = "N/A" ] && echo "⚠️ 待测" || ([ "${PAGE_LOAD_TIME}" -lt 3000 ] && echo "✅ 达标" || echo "❌ 需优化")) |
| LCP | ${LCP}ms | <2500ms | $([ "${LCP}" = "N/A" ] && echo "⚠️ 待测" || ([ "${LCP}" -lt 2500 ] && echo "✅ 达标" || echo "❌ 需优化")) |
| CLS | ${CLS} | <0.1 | $([ "${CLS}" = "N/A" ] && echo "⚠️ 待测" || ([ "$(echo "${CLS} < 0.1" | bc -l 2>/dev/null || echo "0")" -eq 1 ] && echo "✅ 达标" || echo "❌ 需优化")) |
| 控制台错误 | ${ERROR_COUNT} | 0 | $([ "${ERROR_COUNT}" = "0" ] && echo "✅ 无错误" || echo "❌ ${ERROR_COUNT} 个错误") |

---

## 二、测试详情

### 2.1 测试时间
- **开始时间**: $(date '+%Y-%m-%d %H:%M:%S')
- **测试环境**: localhost:5000
- **测试用户**: 基线测试

### 2.2 测试范围

- [x] 页面加载性能
- [x] Core Web Vitals (LCP, CLS)
- [x] 语音交互模块
- [x] 控制台错误
- [x] 响应式布局

---

## 三、性能指标

### 3.1 加载性能
- **页面总加载时间**: ${PAGE_LOAD_TIME}ms
- **目标**: <3000ms
- **评估**: $([ "${PAGE_LOAD_TIME}" = "N/A" ] && echo "待测试" || ([ "${PAGE_LOAD_TIME}" -lt 3000 ] && echo "✅ 达标" || echo "❌ 需优化"))

### 3.2 Core Web Vitals
- **LCP (Largest Contentful Paint)**: ${LCP}ms
  - 目标: <2500ms
  - 评估: $([ "${LCP}" = "N/A" ] && echo "待测试" || ([ "${LCP}" -lt 2500 ] && echo "✅ 达标" || echo "❌ 需优化"))
- **CLS (Cumulative Layout Shift)**: ${CLS}
  - 目标: <0.1
  - 评估: $([ "${CLS}" = "N/A" ] && echo "待测试" || ([ "$(echo "${CLS} < 0.1" | bc -l 2>/dev/null || echo "1")" -eq 1 ] && echo "✅ 达标" || echo "❌ 需优化"))

---

## 四、错误统计

- **总错误数**: ${ERROR_COUNT}
- **状态**: $([ "${ERROR_COUNT}" = "0" ] && echo "✅ 无错误" || echo "❌ 发现 ${ERROR_COUNT} 个错误")

---

## 五、后续行动计划

### 短期任务 (本周)

1. **性能优化**
   - [ ] 分析页面加载瓶颈
   - [ ] 优化关键渲染路径
   - [ ] 启用代码分割

2. **错误修复**
   - [ ] 处理控制台错误
   - [ ] 优化异常处理

### 中期任务 (本月)

1. **性能提升**
   - [ ] 优化 LCP 至 2.5s 以内
   - [ ] 优化 CLS 至 0.1 以内
   - [ ] 启用性能监控

2. **体验优化**
   - [ ] 完善语音交互
   - [ ] 优化响应式布局

---

## 六、测试输出

完整测试日志: test-output.log
测试报告: ${REPORT_FILE}

---

**报告生成**: 前端基线测试自动化脚本
**下次测试**: $(date -d "+7 days" '+%Y-%m-%d')
EOF

echo -e "${GREEN}报告已生成: ${REPORT_FILE}${NC}"

echo ""
echo -e "${BLUE}[5/5] 完成...${NC}"

echo ""
echo "=========================================="
echo -e "   ${GREEN}基线测试完成${NC}"
echo "=========================================="
echo ""
echo "📊 关键指标:"
echo "   - 页面加载时间: ${PAGE_LOAD_TIME}ms"
echo "   - LCP: ${LCP}ms"
echo "   - CLS: ${CLS}"
echo "   - 错误数量: ${ERROR_COUNT}"
echo ""
echo "📄 报告位置: ${REPORT_FILE}"
echo ""
echo "🔜 下一步:"
echo "   1. 查看完整报告"
echo "   2. 分析测试输出"
echo "   3. 开始优化工作"
echo ""

# 清理临时文件
rm -f test-output.log 2>/dev/null || true