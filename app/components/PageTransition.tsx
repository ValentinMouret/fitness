import { type ReactNode, useEffect, useRef } from "react";
import "./PageTransition.css";

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
    <div ref={ref} className={`page-transition ${className}`}>
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
    <div className={`page-transition animate-fade-slide-up ${className}`}>
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
      className={`page-transition animate-fade-slide-up ${staggerClass} ${className}`}
    >
      {children}
    </div>
  );
}
