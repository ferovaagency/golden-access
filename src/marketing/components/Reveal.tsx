import type { ReactNode } from 'react';
import { motion } from 'motion/react';

/** Reveal por scroll compartido entre paginas publicas -- una sola vez, respeta reduced-motion via motion/react. */
export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
