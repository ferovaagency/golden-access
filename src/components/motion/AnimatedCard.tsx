import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  /** Deshabilita el hover lift (para tarjetas que no representan una accion). */
  hoverable?: boolean;
}

/**
 * Card base del sistema de movimiento Ferova One v2: entrada opacity+y,
 * layout animado en reorder, y hover lift de 2-3px. Respeta
 * prefers-reduced-motion via useReducedMotion (sin entrada ni hover).
 */
export function AnimatedCard({ children, className, hoverable = true }: AnimatedCardProps) {
  const reduce = useReducedMotion();
  return (
    <motion.article
      layout
      className={className}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={!reduce && hoverable ? { y: -3 } : undefined}
      transition={{ duration: 0.24, ease: 'easeOut' }}
    >
      {children}
    </motion.article>
  );
}
