import { useEffect, useRef, type ReactNode } from "react";

interface PageTransitionProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function PageTransition({
  children,
  className = "",
}: PageTransitionProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.classList.add("animate-fade-slide-up");
    }
  }, []);

  return (
    <div ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}

interface AnimatedListProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function AnimatedList({ children, className = "" }: AnimatedListProps) {
  return (
    <div
      className={`animate-fade-slide-up ${className}`}
      style={{ opacity: 0 }}
    >
      {children}
    </div>
  );
}

interface StaggeredItemProps {
  readonly children: ReactNode;
  readonly index: number;
  readonly className?: string;
}

export function StaggeredItem({
  children,
  index,
  className = "",
}: StaggeredItemProps) {
  const staggerClass = `stagger-${Math.min(index + 1, 8)}`;

  return (
    <div
      className={`animate-fade-slide-up ${staggerClass} ${className}`}
      style={{ opacity: 0 }}
    >
      {children}
    </div>
  );
}
