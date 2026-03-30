import { useRef, useEffect, useCallback } from "react";

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;

export default function ScrollPicker({ value, onChange, min = 0, max = 120, suffix = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const padding = Math.floor(VISIBLE_ITEMS / 2);

  // Scroll to value on mount and when value changes externally
  useEffect(() => {
    const container = containerRef.current;
    if (!container || isScrolling.current) return;
    const idx = value - min;
    container.scrollTop = idx * ITEM_HEIGHT;
  }, [value, min]);

  const handleScroll = useCallback(() => {
    isScrolling.current = true;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const idx = Math.round(container.scrollTop / ITEM_HEIGHT);
      const snappedValue = Math.min(Math.max(min + idx, min), max);
      container.scrollTop = (snappedValue - min) * ITEM_HEIGHT;
      if (snappedValue !== value) onChange(snappedValue);
      isScrolling.current = false;
    }, 80);
  }, [value, onChange, min, max]);

  return (
    <div className="relative" style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}>
      {/* Selection highlight */}
      <div
        className="absolute left-0 right-0 bg-muted/60 rounded-xl pointer-events-none z-0"
        style={{ top: ITEM_HEIGHT * padding, height: ITEM_HEIGHT }}
      />
      {/* Gradient masks */}
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
      {/* Scroll container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll scroll-smooth scroll-picker-hide"
        style={{
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
        onScroll={handleScroll}
      >
        {/* Top padding */}
        {Array.from({ length: padding }).map((_, i) => (
          <div key={`pad-top-${i}`} style={{ height: ITEM_HEIGHT }} />
        ))}
        {items.map((item) => (
          <div
            key={item}
            className="flex items-center justify-center font-mono tabular-nums select-none"
            style={{
              height: ITEM_HEIGHT,
              scrollSnapAlign: "start",
              fontSize: item === value ? "2rem" : "1.25rem",
              opacity: item === value ? 1 : 0.3,
              fontWeight: item === value ? 700 : 400,
              transition: "font-size 0.15s, opacity 0.15s",
            }}
          >
            {item}{suffix}
          </div>
        ))}
        {/* Bottom padding */}
        {Array.from({ length: padding }).map((_, i) => (
          <div key={`pad-bot-${i}`} style={{ height: ITEM_HEIGHT }} />
        ))}
      </div>
    </div>
  );
}
