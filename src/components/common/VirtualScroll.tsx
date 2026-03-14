'use client';

import React, { useCallback, useMemo } from 'react';

interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
}

/**
 * 虚拟滚动组件
 * 用于高效渲染大列表（10000+ 项）
 */
export function VirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
}: VirtualScrollProps<T>) {
  const [scrollTop, setScrollTop] = React.useState(0);

  // 计算可见范围
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  // 计算偏移量
  const offsetY = visibleRange.startIndex * itemHeight;

  // 可见项
  const visibleItems = items.slice(visibleRange.startIndex, visibleRange.endIndex);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop);
  }, []);

  return (
    <div
      className={`overflow-y-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      {/* 顶部占位符 */}
      <div style={{ height: offsetY }} />

      {/* 可见项 */}
      <div>
        {visibleItems.map((item, index) => (
          <div key={visibleRange.startIndex + index} style={{ height: itemHeight }}>
            {renderItem(item, visibleRange.startIndex + index)}
          </div>
        ))}
      </div>

      {/* 底部占位符 */}
      <div style={{ height: Math.max(0, (items.length - visibleRange.endIndex) * itemHeight) }} />
    </div>
  );
}

/**
 * 使用虚拟滚动的列表组件
 */
export function VirtualList<T>({
  items,
  itemHeight = 60,
  renderItem,
  className = '',
}: Omit<VirtualScrollProps<T>, 'containerHeight'> & { containerHeight?: number }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = React.useState(600);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      setContainerHeight(container.clientHeight);
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={`w-full h-full ${className}`}>
      <VirtualScroll
        items={items}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={renderItem}
      />
    </div>
  );
}
