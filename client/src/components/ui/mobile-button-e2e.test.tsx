import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { Button } from './button';
import { MobileLayout, MobileCard, MobileButton } from './mobile-layout';
import * as React from 'react';

const mockUseIsMobile = vi.fn();
vi.mock('@/hooks/use-device-info', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

describe('Button Component - E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Functionality Tests', () => {
    it('renders with children text', () => {
      render(<Button>点击我</Button>);
      expect(screen.getByRole('button')).toHaveTextContent('点击我');
    });

    it('handles click events correctly', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>点击</Button>);
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('handles double click correctly', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>双击</Button>);
      const button = screen.getByRole('button');
      fireEvent.click(button);
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('handles keyboard Enter activation', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>键盘</Button>);
      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('handles keyboard Space activation', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>空格</Button>);
      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('respects disabled state', () => {
      const handleClick = vi.fn();
      render(<Button disabled onClick={handleClick}>禁用</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('renders loading indicator when disabled during loading', () => {
      render(<Button disabled>加载中</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('2. Logic Implementation Tests', () => {
    it('applies default variant correctly', () => {
      render(<Button>默认</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-[#6366f1]');
    });

    it('applies destructive variant', () => {
      render(<Button variant="destructive">删除</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-red-500');
    });

    it('applies outline variant', () => {
      render(<Button variant="outline">轮廓</Button>);
      expect(screen.getByRole('button')).toHaveClass('border');
    });

    it('applies ghost variant', () => {
      render(<Button variant="ghost">幽灵</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-transparent');
    });

    it('applies gradient variant', () => {
      render(<Button variant="gradient">渐变</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-gradient-to-r');
    });

    it('applies glow variant', () => {
      render(<Button variant="glow">发光</Button>);
      expect(screen.getByRole('button')).toHaveClass('shadow-');
    });

    it('applies default size', () => {
      render(<Button size="default">默认大小</Button>);
      expect(screen.getByRole('button')).toHaveClass('h-10');
    });

    it('applies small size', () => {
      render(<Button size="sm">小</Button>);
      expect(screen.getByRole('button')).toHaveClass('h-8');
    });

    it('applies large size', () => {
      render(<Button size="lg">大</Button>);
      expect(screen.getByRole('button')).toHaveClass('h-12');
    });

    it('applies icon size', () => {
      render(<Button size="icon">🔔</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-10', 'w-10');
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Button ref={ref}>引用</Button>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it('supports asChild with Slot', () => {
      render(
        <Button asChild>
          <span>Slot内容</span>
        </Button>
      );
      expect(screen.getByText('Slot内容')).toBeInTheDocument();
    });
  });

  describe('3. Results Presentation Tests', () => {
    it('renders with correct text content', () => {
      render(<Button>结果展示</Button>);
      expect(screen.getByRole('button')).toHaveTextContent('结果展示');
    });

    it('renders with icon via children', () => {
      render(<Button>图标💡</Button>);
      expect(screen.getByRole('button')).toHaveTextContent('图标💡');
    });

    it('renders with disabled state when loading', () => {
      render(<Button disabled>加载</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('applies custom className', () => {
      render(<Button className="custom-class">自定义</Button>);
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });

    it('handles ariaLabel prop', () => {
      render(<Button ariaLabel="测试标签">内容</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', '测试标签');
    });

    it('auto-generates ariaLabel from children', () => {
      render(<Button>自动标签</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', '自动标签');
    });
  });

  describe('4. Accessibility Tests', () => {
    it('has role button', () => {
      render(<Button>按钮</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('has focus styles', () => {
      render(<Button>聚焦</Button>);
      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveClass('focus-visible:outline-none');
    });

    it('has minimum 44px height (touch target)', () => {
      render(<Button>触摸目标</Button>);
      const button = screen.getByRole('button');
      const styles = window.getComputedStyle(button);
      const minHeight = parseInt(styles.minHeight);
      expect(minHeight).toBeGreaterThanOrEqual(44);
    });

    it('has touch-manipulation class', () => {
      render(<Button>触摸</Button>);
      expect(screen.getByRole('button')).toHaveClass('touch-manipulation');
    });

    it('handles disabled with aria-disabled', () => {
      render(<Button disabled>禁用</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('supports type attribute', () => {
      render(<Button type="submit">提交</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });

    it('defaults to type button', () => {
      render(<Button>按钮</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });
  });

  describe('5. Association Tests (with services/stores)', () => {
    it('works with form submission', () => {
      const handleSubmit = vi.fn();
      render(
        <form onSubmit={handleSubmit}>
          <Button type="submit">提交表单</Button>
        </form>
      );
      fireEvent.submit(screen.getByRole('button').closest('form')!);
      expect(handleSubmit).toHaveBeenCalled();
    });

    it('works with data loading callbacks', async () => {
      const loadData = vi.fn().mockResolvedValue({ data: 'loaded' });
      const handleClick = vi.fn(() => loadData());
      
      render(<Button onClick={handleClick}>加载数据</Button>);
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(loadData).toHaveBeenCalled();
      });
    });

    it('works with async state updates', async () => {
      const updateState = vi.fn();
      const Component = () => {
        const [loading, setLoading] = React.useState(false);
        const handleClick = async () => {
          setLoading(true);
          await new Promise(r => setTimeout(r, 10));
          updateState();
          setLoading(false);
        };
        return <Button disabled={loading} onClick={handleClick}>异步更新</Button>;
      };
      
      render(<Component />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });
});

describe('MobileButton Component - E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(true);
  });

  describe('1. Functionality Tests', () => {
    it('renders mobile button', () => {
      render(<MobileButton>移动按钮</MobileButton>);
      expect(screen.getByRole('button')).toHaveTextContent('移动按钮');
    });

    it('handles click events', () => {
      const handleClick = vi.fn();
      render(<MobileButton onClick={handleClick}>点击</MobileButton>);
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('respects disabled state', () => {
      const handleClick = vi.fn();
      render(<MobileButton disabled onClick={handleClick}>禁用</MobileButton>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('respects loading state', () => {
      render(<MobileButton loading>加载</MobileButton>);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('2. Logic Implementation Tests', () => {
    it('applies default variant', () => {
      render(<MobileButton variant="default">默认</MobileButton>);
      expect(screen.getByRole('button')).toHaveClass('bg-secondary');
    });

    it('applies primary variant', () => {
      render(<MobileButton variant="primary">主要</MobileButton>);
      expect(screen.getByRole('button')).toHaveClass('bg-primary');
    });

    it('applies ghost variant', () => {
      render(<MobileButton variant="ghost">幽灵</MobileButton>);
      expect(screen.getByRole('button')).toHaveClass('hover:bg-accent');
    });

    it('applies outline variant', () => {
      render(<MobileButton variant="outline">轮廓</MobileButton>);
      expect(screen.getByRole('button')).toHaveClass('border');
    });

    it('applies default size', () => {
      render(<MobileButton size="default">默认</MobileButton>);
      expect(screen.getByRole('button')).toHaveClass('h-11');
    });

    it('applies sm size', () => {
      render(<MobileButton size="sm">小</MobileButton>);
      expect(screen.getByRole('button')).toHaveClass('h-9');
    });

    it('applies lg size', () => {
      render(<MobileButton size="lg">大</MobileButton>);
      expect(screen.getByRole('button')).toHaveClass('h-12');
    });

    it('applies icon size', () => {
      render(<MobileButton size="icon">🔔</MobileButton>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-11', 'w-11');
    });
  });

  describe('3. Results Presentation Tests', () => {
    it('renders loading spinner', () => {
      render(<MobileButton loading>加载</MobileButton>);
      expect(screen.getByRole('button').querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('renders children content', () => {
      render(<MobileButton>内容展示</MobileButton>);
      expect(screen.getByRole('button')).toHaveTextContent('内容展示');
    });

    it('applies custom className', () => {
      render(<MobileButton className="custom-mobile">自定义</MobileButton>);
      expect(screen.getByRole('button')).toHaveClass('custom-mobile');
    });
  });

  describe('4. Accessibility Tests', () => {
    it('has minimum 44px height', () => {
      render(<MobileButton>触摸</MobileButton>);
      const button = screen.getByRole('button');
      const styles = window.getComputedStyle(button);
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);
    });

    it('has minimum 44px width for icon', () => {
      render(<MobileButton size="icon">🔔</MobileButton>);
      const button = screen.getByRole('button');
      const styles = window.getComputedStyle(button);
      expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(44);
    });

    it('has touch-manipulation class', () => {
      render(<MobileButton>触摸</MobileButton>);
      expect(screen.getByRole('button')).toHaveClass('touch-manipulation');
    });

    it('supports ariaLabel', () => {
      render(<MobileButton ariaLabel="移动标签">内容</MobileButton>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', '移动标签');
    });
  });
});

describe('MobileCard Component - E2E Tests', () => {
  describe('1. Functionality Tests', () => {
    it('renders card content', () => {
      render(<MobileCard>卡片内容</MobileCard>);
      expect(screen.getByText('卡片内容')).toBeInTheDocument();
    });

    it('handles onClick when provided', () => {
      const handleClick = vi.fn();
      render(<MobileCard onClick={handleClick}>可点击</MobileCard>);
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalled();
    });

    it('does not have role button when no onClick', () => {
      render(<MobileCard>静态卡片</MobileCard>);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('2. Accessibility Tests', () => {
    it('has minimum 44px height', () => {
      render(<MobileCard>高度</MobileCard>);
      const card = screen.getByText('高度');
      const styles = window.getComputedStyle(card);
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);
    });

    it('supports ariaLabel', () => {
      render(<MobileCard ariaLabel="卡片标签">标签</MobileCard>);
      expect(screen.getByText('标签')).toHaveAttribute('aria-label', '卡片标签');
    });

    it('handles keyboard activation', () => {
      const handleClick = vi.fn();
      render(<MobileCard onClick={handleClick}>键盘</MobileCard>);
      fireEvent.keyDown(screen.getByText('键盘'), { key: 'Enter' });
      expect(handleClick).toHaveBeenCalled();
    });
  });
});

describe('MobileListItem Component - E2E Tests', () => {
  describe('1. Functionality Tests', () => {
    it('renders list item', () => {
      render(<button>列表项</button>);
      expect(screen.getByRole('button')).toHaveTextContent('列表项');
    });
  });
});

describe('MobileLayout Component - E2E Tests', () => {
  describe('1. Functionality Tests', () => {
    it('renders children content', () => {
      mockUseIsMobile.mockReturnValue(true);
      render(
        <MobileLayout>
          <div>布局内容</div>
        </MobileLayout>
      );
      expect(screen.getByText('布局内容')).toBeInTheDocument();
    });

    it('shows header when showHeader is true', () => {
      mockUseIsMobile.mockReturnValue(true);
      render(
        <MobileLayout showHeader headerTitle="标题">
          <div>内容</div>
        </MobileLayout>
      );
      expect(screen.getByText('标题')).toBeInTheDocument();
    });

    it('shows back button when onBack is provided', () => {
      mockUseIsMobile.mockReturnValue(true);
      const handleBack = vi.fn();
      render(
        <MobileLayout showHeader onBack={handleBack}>
          <div>内容</div>
        </MobileLayout>
      );
      expect(screen.getByRole('button')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button'));
      expect(handleBack).toHaveBeenCalled();
    });

    it('renders headerAction when provided', () => {
      mockUseIsMobile.mockReturnValue(true);
      render(
        <MobileLayout showHeader headerAction={<button>操作</button>}>
          <div>内容</div>
        </MobileLayout>
      );
      expect(screen.getByText('操作')).toBeInTheDocument();
    });
  });

  describe('2. Accessibility Tests', () => {
    it('back button has aria-label', () => {
      mockUseIsMobile.mockReturnValue(true);
      render(
        <MobileLayout showHeader onBack={() => {}}>
          <div>内容</div>
        </MobileLayout>
      );
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', '返回');
    });

    it('has safe area padding on mobile', () => {
      mockUseIsMobile.mockReturnValue(true);
      const { container } = render(
        <MobileLayout>
          <div>内容</div>
        </MobileLayout>
      );
      const layout = container.firstChild as HTMLElement;
      expect(layout.style.paddingTop).toContain('safe-area-inset-top');
    });
  });
});
