#!/bin/bash
# 三大核心工具验证脚本

echo "🔍 =========================================="
echo "   前端监控工具安装验证"
echo "==========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_tool() {
    local name=$1
    local command=$2
    local config=$3
    
    echo -n "检查 $name..."
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 已安装${NC}"
        if [ -f "$config" ]; then
            echo -e "   配置文件: $config ✅"
        else
            echo -e "   ${RED}配置文件缺失${NC}"
        fi
        return 0
    else
        echo -e "${RED}❌ 未安装${NC}"
        return 1
    fi
}

echo "📦 1. 错误监控工具"
echo "--------------------------------"
check_tool "Sentry" "npm list @sentry/react" "client/src/lib/monitoring/sentry.ts"
echo ""

echo "🧪 2. 自动化测试工具"
echo "--------------------------------"
check_tool "Playwright" "npm list @playwright/test" "tests/e2e/voice-interaction.spec.ts"
echo ""

echo "📹 3. 会话回放工具"
echo "--------------------------------"
echo -n "OpenReplay 配置..."
if [ -f "client/src/lib/monitoring/openreplay.ts" ]; then
    echo -e "${GREEN}✅${NC}"
    echo -e "   (需要自托管或使用云服务)"
else
    echo -e "${RED}❌${NC}"
fi
echo ""

echo "🧩 4. 测试依赖库"
echo "--------------------------------"
check_tool "Testing Library" "npm list @testing-library/react" "tests/unit/"
check_tool "Jest DOM" "npm list @testing-library/jest-dom" "tests/setup.ts"
echo ""

echo "📋 5. 配置文件检查"
echo "--------------------------------"
for file in \
    "client/src/lib/monitoring/index.ts" \
    "tests/setup.ts" \
    "tests/unit/RealtimeVoiceWidget.test.tsx" \
    "tests/unit/useAudioAnalyzer.test.ts" \
    "INSTALLATION-GUIDE.md" \
    ".env.example"; do
    if [ -f "$file" ]; then
        echo -e "✅ $file"
    else
        echo -e "❌ $file (缺失)"
    fi
done

echo ""
echo "🚀 =========================================="
echo "   下一步操作"
echo "==========================================="
echo ""
echo "1️⃣  配置环境变量:"
echo "   cp .env.example .env.local"
echo "   # 编辑 .env.local 填入 SENTRY_DSN"
echo ""
echo "2️⃣  安装 Playwright 浏览器:"
echo "   npx playwright install"
echo ""
echo "3️⃣  运行测试:"
echo "   npm run test          # 单元测试"
echo "   npm run test:e2e      # E2E测试"
echo ""
echo "4️⃣  启动应用:"
echo "   npm run dev:client    # 启动前端"
echo ""
echo -e "${YELLOW}📖 详细指南: INSTALLATION-GUIDE.md${NC}"
echo ""