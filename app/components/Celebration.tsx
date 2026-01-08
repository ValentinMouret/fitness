import { useEffect, useState } from "react";
import "./Celebration.css";

interface CelebrationProps {
  readonly trigger: boolean;
  readonly onComplete?: () => void;
}

const CONFETTI_COLORS = ["#ff6b6b", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"];

export function Celebration({ trigger, onComplete }: CelebrationProps) {
  const [particles, setParticles] = useState<
    Array<{ id: number; style: React.CSSProperties }>
  >([]);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (trigger && !isActive) {
      setIsActive(true);

      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        style: {
          left: `${Math.random() * 100}%`,
          backgroundColor:
            CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          animationDelay: `${Math.random() * 0.3}s`,
          animationDuration: `${1 + Math.random() * 0.5}s`,
          transform: `rotate(${Math.random() * 360}deg)`,
        } as React.CSSProperties,
      }));

      setParticles(newParticles);

      const timer = setTimeout(() => {
        setParticles([]);
        setIsActive(false);
        onComplete?.();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [trigger, isActive, onComplete]);

  if (particles.length === 0) return null;

  return (
    <div className="celebration-container">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="confetti-particle"
          style={particle.style}
        />
      ))}
    </div>
  );
}

interface SuccessPulseProps {
  readonly trigger: boolean;
  readonly children: React.ReactNode;
}

export function SuccessPulse({ trigger, children }: SuccessPulseProps) {
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    if (trigger) {
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 600);
      return () => clearTimeout(timer);
    }
  }, [trigger]);

  return <div className={isPulsing ? "success-pulse" : ""}>{children}</div>;
}
