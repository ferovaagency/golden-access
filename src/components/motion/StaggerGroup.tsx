import type { ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';

interface StaggerGroupProps {
  children: ReactNode;
  className?: string;
  /** Retraso entre elementos hijos en segundos. Manual: 60-80ms para Blind Spots. */
  staggerDelay?: number;
}

const container = (staggerDelay: number, reduce: boolean): Variants => ({
  hidden: {},
  show: {
    transition: reduce ? undefined : { staggerChildren: staggerDelay },
  },
});

/**
 * Envuelve una lista de StaggerItem y escalona su entrada. Uso tipico:
 * Blind Spots, Recent Activity, cualquier lista que entra junta.
 * Los hijos deben ser <StaggerItem> para heredar las variantes.
 */
export function StaggerGroup({ children, className, staggerDelay = 0.07 }: StaggerGroupProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={container(staggerDelay, Boolean(reduce))}
    >
      {children}
    </motion.div>
  );
}

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
};

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} variants={reduce ? undefined : item}>
      {children}
    </motion.div>
  );
}
