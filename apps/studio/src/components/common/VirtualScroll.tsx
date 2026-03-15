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
 * Virtual scroll component
 * Efficiently renders large lists (10,000+ items)
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

  // Compute visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  // Compute offset
  const offsetY = visibleRange.startIndex * itemHeight;

  // Visible items
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
      {/* Top spacer */}
      <div style={{ height: offsetY }} />

      {/* Visible items */}
      <div>
        {visibleItems.map((item, index) => (
          <div key={visibleRange.startIndex + index} style={{ height: itemHeight }}>
            {renderItem(item, visibleRange.startIndex + index)}
          </div>
        ))}
      </div>

      {/* Bottom spacer */}
      <div style={{ height: Math.max(0, (items.length - visibleRange.endIndex) * itemHeight) }} />
    </div>
  );
}

/**
 * List component using virtual scroll
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
