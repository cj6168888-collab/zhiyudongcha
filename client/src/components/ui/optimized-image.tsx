/**
 * 优化后的 Image 组件
 * 
 * 特性:
 * - 自动 WebP/AVIF 格式支持
 * - 懒加载
 * - 响应式图片
 * - 加载占位
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  lazy?: boolean;
  placeholder?: string;
}

export function OptimizedImage({
  src,
  alt,
  className,
  width,
  height,
  lazy = true,
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E',
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // 生成响应式图片 srcset
  const generateSrcSet = (imgSrc: string) => {
    if (!imgSrc.startsWith('http') && !imgSrc.startsWith('/')) return undefined;
    
    // 支持的基础宽度
    const widths = [320, 640, 960, 1280, 1920];
    
    return widths
      .map(w => `${imgSrc}?w=${w} ${w}w`)
      .join(', ');
  };

  // 现代格式支持
  const getModernSrc = (imgSrc: string) => {
    const basePath = imgSrc.replace(/\.[^/.]+$/, '');
    return {
      avif: `${basePath}.avif`,
      webp: `${basePath}.webp`,
      original: imgSrc,
    };
  };

  const modernSrc = getModernSrc(src);
  const srcSet = generateSrcSet(src);

  return (
    <picture className={cn('relative block', className)}>
      {/* AVIF 格式 - 最佳压缩 */}
      <source
        srcSet={modernSrc.avif}
        type="image/avif"
        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
      />
      
      {/* WebP 格式 - 广泛支持 */}
      <source
        srcSet={modernSrc.webp}
        type="image/webp"
        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
      />
      
      {/* 原始格式 - 回退 */}
      <img
        src={src}
        srcSet={srcSet}
        alt={alt}
        width={width}
        height={height}
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={cn(
          'transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0',
          error && 'blur-sm'
        )}
        style={{
          backgroundImage: !loaded ? `url(${placeholder})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      {/* 加载状态指示 */}
      {!loaded && !error && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      
      {/* 错误状态 */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-sm">
          加载失败
        </div>
      )}
    </picture>
  );
}

// 懒加载 Hook
export function useLazyImage(src: string) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setImageSrc(src);
      setLoading(false);
    };
    img.onerror = () => {
      setLoading(false);
    };
  }, [src]);

  return { imageSrc, loading };
}

// 预加载图片
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve();
    img.onerror = reject;
  });
}

// 批量预加载
export function preloadImages(srcs: string[]): Promise<void> {
  return Promise.all(srcs.map(preloadImage)).then(() => undefined);
}

export default OptimizedImage;
