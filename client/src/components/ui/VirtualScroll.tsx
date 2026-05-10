/**
 * Virtual Scroll Component
 *
 * Renders only visible items for large lists with
 * configurable overscan and smooth scrolling.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export interface VirtualScrollProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  overscan?: number;
  height?: number | string;
  width?: number | string;
  className?: string;
  onEndReached?: () => void;
  threshold?: number;
  keyExtractor?: (item: T, index: number) => string;
}

export function VirtualScroll<T>({
  items,
  renderItem,
  itemHeight,
  overscan = 3,
  height = '100%',
  width = '100%',
  className,
  onEndReached,
  threshold = 200,
  keyExtractor,
}: VirtualScrollProps<T>): React.ReactElement {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleRange = useMemo(() => {
    const totalHeight = items.length * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + (typeof height === 'number' ? height : 500)) / itemHeight) + overscan
    );

    return { startIndex, endIndex, totalHeight };
  }, [scrollTop, itemHeight, overscan, items.length, height]);

  const visibleItems = useMemo(() => {
    const result = [];
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      result.push({ item: items[i], index: i });
    }
    return result;
  }, [items, visibleRange]);

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = event.currentTarget.scrollTop;
      setScrollTop(newScrollTop);

      if (onEndReached && newScrollTop + (typeof height === 'number' ? height : 500) >= visibleRange.totalHeight - threshold) {
        onEndReached();
      }
    },
    [onEndReached, height, threshold, visibleRange.totalHeight]
  );

  const getItemKey = useCallback(
    (index: number) => {
      const item = items[index];
      return keyExtractor ? keyExtractor(item, index) : index.toString();
    },
    [items, keyExtractor]
  );

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        width: typeof width === 'number' ? `${width}px` : width,
        overflowY: 'auto',
        contain: 'strict',
      }}
      className={className}
    >
      <div
        style={{
          height: `${visibleRange.totalHeight}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${visibleRange.startIndex * itemHeight}px)`,
          }}
        >
          {visibleItems.map(({ item, index }) => (
            <div
              key={getItemKey(index)}
              style={{
                height: `${itemHeight}px`,
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${(index - visibleRange.startIndex) * itemHeight}px)`,
              }}
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface FixedSizeVirtualScrollProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  itemWidth?: number;
  overscan?: number;
  columnCount?: number;
  height?: number | string;
  width?: number | string;
  className?: string;
}

export function FixedSizeVirtualScroll<T>({
  items,
  renderItem,
  itemHeight,
  itemWidth = 100,
  overscan = 3,
  columnCount = 1,
  height = '100%',
  width = '100%',
  className,
}: FixedSizeVirtualScrollProps<T>): React.ReactElement {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const rowHeight = itemHeight;
  const columnWidth = itemWidth;
  const totalRowWidth = columnCount * columnWidth;

  const visibleRows = useMemo(() => {
    const totalHeight = Math.ceil(items.length / columnCount) * rowHeight;
    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endRow = Math.min(
      Math.ceil(items.length / columnCount) - 1,
      Math.ceil((scrollTop + (typeof height === 'number' ? height : 500)) / rowHeight) + overscan
    );

    return { startRow, endRow, totalHeight };
  }, [scrollTop, rowHeight, overscan, items.length, columnCount, height]);

  const renderVisibleItems = useMemo(() => {
    const result: Array<{ item: T; index: number }> = [];

    for (let row = visibleRows.startRow; row <= visibleRows.endRow; row++) {
      for (let col = 0; col < columnCount; col++) {
        const index = row * columnCount + col;
        if (index < items.length) {
          result.push({ item: items[index], index });
        }
      }
    }

    return result;
  }, [items, visibleRows, columnCount]);

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(event.currentTarget.scrollTop);
    },
    []
  );

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        width: typeof width === 'number' ? `${width}px` : width,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
      className={className}
    >
      <div
        style={{
          height: `${visibleRows.totalHeight}px`,
          width: `${totalRowWidth}px`,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {renderVisibleItems.map(({ item, index }) => {
            const row = Math.floor(index / columnCount);
            const col = index % columnCount;

            return (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  top: `${row * rowHeight}px`,
                  left: `${col * columnWidth}px`,
                  width: `${columnWidth}px`,
                  height: `${rowHeight}px`,
                }}
              >
                {renderItem(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default VirtualScroll;
