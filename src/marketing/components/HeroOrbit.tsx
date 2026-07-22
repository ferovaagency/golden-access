import { motion, useReducedMotion, type TargetAndTransition } from 'motion/react';
import { BarChart3, BrainCircuit, CalendarDays, Sparkles } from 'lucide-react';

/**
 * Escena decorativa con profundidad CSS. No usa WebGL: conserva un coste bajo,
 * se puede renderizar de forma estática y respeta la preferencia de movimiento.
 */
export function HeroOrbit() {
  const reduceMotion = useReducedMotion();
  const loop = (value: Record<string, number[]>, duration: number): TargetAndTransition | undefined => reduceMotion
    ? undefined
    : { ...value, transition: { duration, repeat: Infinity, ease: 'easeInOut' as const } };

  return (
    <div
      className="relative mx-auto h-[310px] w-full max-w-[520px] select-none [perspective:1000px] sm:h-[360px]"
      aria-hidden="true"
    >
      <motion.div
        className="absolute inset-[8%] rounded-full border border-white/15"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute inset-[20%] rounded-full border border-[#f3caca]/25"
        animate={reduceMotion ? undefined : { rotate: -360 }}
        transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute left-[12%] top-[34%] h-3 w-3 rounded-full bg-[#f4c46b] shadow-[0_0_26px_7px_rgba(244,196,107,.38)]"
        animate={loop({ x: [0, 210, 0], y: [0, -88, 0] }, 11)}
      />
      <motion.div
        className="absolute right-[14%] top-[20%] h-2.5 w-2.5 rounded-full bg-[#eeb3ca] shadow-[0_0_24px_7px_rgba(238,179,202,.35)]"
        animate={loop({ x: [0, -160, 0], y: [0, 122, 0] }, 13)}
      />

      <motion.div
        className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 [transform-style:preserve-3d]"
        animate={reduceMotion ? undefined : { rotateX: [58, 66, 58], rotateY: [-18, 18, -18] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="absolute inset-0 rounded-[40%] border border-[#f6d6ab]/30 bg-[radial-gradient(circle_at_34%_28%,rgba(255,255,255,.48),rgba(152,23,55,.48)_44%,rgba(8,18,43,.95)_76%)] shadow-[0_26px_80px_rgba(3,9,27,.6)] [transform:translateZ(18px)]" />
        <div className="absolute inset-5 rounded-[34%] border border-white/15 [transform:translateZ(42px)]" />
        <Sparkles className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-[#ffe3ad] drop-shadow-[0_0_18px_rgba(255,226,170,.9)] [transform:translateZ(70px)]" />
      </motion.div>

      <FloatingCard
        className="left-0 top-[12%]"
        icon={<BrainCircuit className="h-4 w-4" />}
        label="IA aprende tu ritmo"
        animation={loop({ y: [0, -12, 0], rotate: [-3, 1, -3] }, 6)}
      />
      <FloatingCard
        className="right-0 top-[39%]"
        icon={<CalendarDays className="h-4 w-4" />}
        label="Agenda protegida"
        animation={loop({ y: [0, 12, 0], rotate: [3, -1, 3] }, 7)}
      />
      <FloatingCard
        className="bottom-[2%] left-[20%]"
        icon={<BarChart3 className="h-4 w-4" />}
        label="Finanzas al día"
        animation={loop({ y: [0, -9, 0], rotate: [-2, 2, -2] }, 6.5)}
      />
    </div>
  );
}

function FloatingCard({
  className, icon, label, animation,
}: {
  className: string;
  icon: React.ReactNode;
  label: string;
  animation: TargetAndTransition | undefined;
}) {
  return (
    <motion.div
      className={`absolute flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white shadow-[0_18px_36px_rgba(0,0,0,.26)] backdrop-blur-md ${className}`}
      animate={animation}
    >
      <span className="text-[#f4c46b]">{icon}</span>
      {label}
    </motion.div>
  );
}
