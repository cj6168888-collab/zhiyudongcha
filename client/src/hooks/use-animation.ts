import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * 动画系统 Hook
 * 
 * 提供可访问的动画控制
 * 自动检测 prefers-reduced-motion
 * 
 * @example
 * const { isVisible, ref } = useFadeIn();
 * return <div ref={ref} className={isVisible ? 'motion-fade-in' : 'opacity-0'}>内容</div>
 */

/**
 * 检测用户是否偏好减少动画
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

/**
 * 淡入动画 Hook
 */
export function useFadeIn(options: { delay?: number; duration?: number } = {}) {
  const { delay = 0, duration = 250 } = options;
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            setIsVisible(true);
          }, delay);
          observer.unobserve(element);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [delay, prefersReducedMotion]);

  return { ref, isVisible, prefersReducedMotion };
}

/**
 * 交错动画 Hook（用于列表）
 */
export function useStaggerAnimation(itemCount: number, options: { baseDelay?: number; staggerDelay?: number } = {}) {
  const { baseDelay = 0, staggerDelay = 50 } = options;
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      setVisibleItems(new Set(Array.from({ length: itemCount }, (_, i) => i)));
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // 交错显示
          for (let i = 0; i < itemCount; i++) {
            setTimeout(() => {
              setVisibleItems(prev => new Set([...prev, i]));
            }, baseDelay + i * staggerDelay);
          }
          observer.unobserve(container);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, [itemCount, baseDelay, staggerDelay, prefersReducedMotion]);

  return { containerRef, visibleItems, prefersReducedMotion };
}

/**
 * 滚动动画 Hook
 */
export function useScrollAnimation() {
  const [scrollY, setScrollY] = useState(0);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('down');
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollY(currentScrollY);
      setScrollDirection(currentScrollY > lastScrollY.current ? 'down' : 'up');
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return { scrollY, scrollDirection };
}

/**
 * 模态框动画 Hook
 */
export function useModalAnimation(isOpen: boolean) {
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setShouldRender(true);
    } else {
      if (prefersReducedMotion) {
        setShouldRender(false);
      } else {
        setIsClosing(true);
        const timer = setTimeout(() => {
          setShouldRender(false);
          setIsClosing(false);
        }, 250); // 匹配 CSS 动画时长
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, prefersReducedMotion]);

  const animationClasses = {
    backdrop: isClosing ? 'motion-modal-backdrop-out' : 'motion-modal-backdrop-in',
    content: isClosing ? 'motion-modal-content-out' : 'motion-modal-content-in',
  };

  return { shouldRender, animationClasses, prefersReducedMotion };
}

/**
 * Toast 动画 Hook
 */
export function useToastAnimation(isVisible: boolean) {
  const [isExiting, setIsExiting] = useState(false);
  const [shouldRender, setShouldRender] = useState(isVisible);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (isVisible) {
      setIsExiting(false);
      setShouldRender(true);
    } else {
      if (prefersReducedMotion) {
        setShouldRender(false);
      } else {
        setIsExiting(true);
        const timer = setTimeout(() => {
          setShouldRender(false);
          setIsExiting(false);
        }, 250);
        return () => clearTimeout(timer);
      }
    }
  }, [isVisible, prefersReducedMotion]);

  const animationClass = isExiting ? 'motion-toast-out' : 'motion-toast-in';

  return { shouldRender, animationClass, prefersReducedMotion };
}

/**
 * 页面过渡动画 Hook
 */
export function usePageTransition() {
  const [isEntering, setIsEntering] = useState(true);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsEntering(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsEntering(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [prefersReducedMotion]);

  return { isEntering, animationClass: 'motion-page-in', prefersReducedMotion };
}

/**
 * 手势动画 Hook（移动端滑动）
 */
export function useSwipeAnimation(onSwipeLeft?: () => void, onSwipeRight?: () => void) {
  const [isDragging, setIsDragging] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const startX = useRef(0);
  const prefersReducedMotion = usePrefersReducedMotion();

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientX - startX.current;
    setTranslateX(diff);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    
    if (translateX > 100 && onSwipeRight) {
      onSwipeRight();
    } else if (translateX < -100 && onSwipeLeft) {
      onSwipeLeft();
    }
    
    setTranslateX(0);
  }, [translateX, onSwipeLeft, onSwipeRight]);

  const style = prefersReducedMotion ? {} : {
    transform: `translateX(${translateX}px)`,
    transition: isDragging ? 'none' : 'transform 0.3s ease-out',
  };

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    style,
    isDragging,
  };
}
