import { useState, useEffect, type RefObject } from "react";

// นับจำนวนวันที่พอดีกับความกว้างที่มีอยู่จริงของ container (สำหรับ Gantt timeline ต่างๆ)
// แทนการล็อคจำนวนวันไว้คงที่ — จอกว้างขึ้นก็เห็นวันมากขึ้น ไม่เหลือพื้นที่ว่างด้านขวา
export function useResponsiveDayCount(
  containerRef: RefObject<HTMLElement>,
  dayWidth:     number,
  labelWidth:   number,
  minDays:      number,
  fallbackDays: number,
): number {
  const [days, setDays] = useState(fallbackDays);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const compute = () => {
      const available = el.clientWidth - labelWidth;
      const fit = Math.floor(available / dayWidth);
      setDays(Math.max(minDays, fit));
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, dayWidth, labelWidth, minDays]);

  return days;
}
