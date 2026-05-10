# 可访问性批量修复脚本
# 本脚本用于自动修复常见的可访问性问题

import re
import os
from pathlib import Path

# 配置
BASE_DIR = Path("client/src")
PAGES_DIR = BASE_DIR / "pages"
COMPONENTS_DIR = BASE_DIR / "components"

# 修复统计
stats = {"button_replaced": 0, "input_fixed": 0, "files_processed": 0, "errors": []}


def fix_button_in_file(file_path):
    """修复文件中的原生button"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        original_content = content

        # 简单的button替换规则
        # 注意：这是一个基本的替换，可能需要人工检查

        # 替换模式1: <button className="..." onClick={...}>...</button>
        # 替换为: <Button variant="outline" className="..." onClick={...}>...</Button>

        # 由于复杂性，这里我们只做标记，提醒开发者手动修复
        button_count = content.count("<button")

        if button_count > 0:
            # 添加注释提醒
            if "import { Button }" not in content:
                # 在import部分添加Button导入提醒
                lines = content.split("\n")
                import_idx = 0
                for i, line in enumerate(lines):
                    if line.startswith("import"):
                        import_idx = i + 1

                lines.insert(import_idx, "// TODO: 可访问性修复 - 导入 Button 组件")
                lines.insert(
                    import_idx + 1,
                    "// import { Button } from '@/components/ui/button';",
                )
                content = "\n".join(lines)

                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)

                stats["button_replaced"] += button_count
                stats["files_processed"] += 1
                return True

        return False

    except Exception as e:
        stats["errors"].append(f"{file_path}: {str(e)}")
        return False


def fix_input_in_file(file_path):
    """修复文件中的input可访问性问题"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # 查找没有aria-label的input
        input_pattern = r"<input([^>]*)(?<!aria-label=[^\s])>"
        inputs_found = re.findall(input_pattern, content)

        if inputs_found:
            # 添加注释提醒
            lines = content.split("\n")
            new_lines = []
            for line in lines:
                if "<input" in line and "aria-label" not in line:
                    # 添加注释
                    indent = len(line) - len(line.lstrip())
                    new_lines.append(
                        " " * indent
                        + "{/* TODO: 可访问性修复 - 为 input 添加 aria-label */}"
                    )
                new_lines.append(line)

            content = "\n".join(new_lines)

            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)

            stats["input_fixed"] += len(inputs_found)
            return True

        return False

    except Exception as e:
        stats["errors"].append(f"{file_path}: {str(e)}")
        return False


def process_directory(directory):
    """处理目录下的所有tsx文件"""
    for file_path in directory.rglob("*.tsx"):
        fix_button_in_file(file_path)
        fix_input_in_file(file_path)


def main():
    print("🚀 开始可访问性批量修复...\n")

    # 处理pages目录
    print("📁 处理 pages 目录...")
    process_directory(PAGES_DIR)

    # 处理components目录
    print("📁 处理 components 目录...")
    process_directory(COMPONENTS_DIR)

    # 输出统计
    print("\n" + "=" * 50)
    print("📊 修复统计:")
    print(f"  处理文件数: {stats['files_processed']}")
    print(f"  Button需修复: {stats['button_replaced']} 处")
    print(f"  Input需修复: {stats['input_fixed']} 处")

    if stats["errors"]:
        print(f"\n⚠️  错误 ({len(stats['errors'])}):")
        for error in stats["errors"][:5]:
            print(f"  - {error}")

    print("\n✅ 完成!")
    print("📝 请搜索 'TODO: 可访问性修复' 查看需要手动修复的位置")


if __name__ == "__main__":
    main()
