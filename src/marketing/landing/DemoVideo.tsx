import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { trackEvent } from "../../lib/analytics";

// Demostración real de Ferova One: una grabación de pantalla de 24 s
// (public/demo/ferova-one-demo.mp4) con tres escenas. Los botones saltan al
// segundo de cada escena; el video no se descarga hasta que se pulsa (preload
// none + poster) para no cargar 3 MB en la primera pintura de la landing.

const ESCENAS = [
  { t: 0, titulo: "Costos del negocio", texto: "El precio de un servicio también tiene que cubrir la operación. Costos fijos y prorrateo por servicio en una sola pantalla." },
  { t: 8, titulo: "Precio recomendado", texto: "Un precio calculado desde los costos: estructura por servicio, punto de equilibrio y el margen que fijaste." },
  { t: 17, titulo: "Cómo cerró el mes", texto: "Facturado, costo directo, margen bruto, pagos reales y caja neta, con un diagnóstico escrito de lo que pasó." },
];

export function DemoVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [activa, setActiva] = useState(0);
  const [iniciado, setIniciado] = useState(false);

  const ir = (i: number) => {
    const v = ref.current;
    if (!v) return;
    setActiva(i);
    v.currentTime = ESCENAS[i].t;
    void v.play();
    if (!iniciado) { setIniciado(true); trackEvent("demo_play", { path: "/", escena: i }); }
  };

  const onTime = () => {
    const v = ref.current;
    if (!v) return;
    const i = ESCENAS.reduce((acc, e, idx) => (v.currentTime >= e.t ? idx : acc), 0);
    if (i !== activa) setActiva(i);
  };

  return (
    <div className="fo-demo-layout">
      <div className="fo-demo-video">
        <video
          ref={ref}
          src="/demo/ferova-one-demo.mp4"
          poster="/demo/ferova-one-demo-poster.jpg"
          preload="none"
          controls={iniciado}
          playsInline
          muted
          onTimeUpdate={onTime}
          onPlay={() => { if (!iniciado) { setIniciado(true); trackEvent("demo_play", { path: "/", escena: activa }); } }}
          aria-label="Demostración de Ferova One: costos, precio recomendado y resumen financiero"
        />
        {!iniciado && (
          <button type="button" className="fo-demo-play" onClick={() => ir(0)} aria-label="Reproducir la demostración">
            <Play size={22} aria-hidden="true" /> Ver la demo · 24 s
          </button>
        )}
      </div>
      <ol className="fo-demo-scenes" aria-label="Escenas de la demo">
        {ESCENAS.map((e, i) => (
          <li key={e.titulo}>
            <button type="button" onClick={() => ir(i)} aria-pressed={activa === i} className={activa === i ? "active" : undefined}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{e.titulo}</strong>
              <p>{e.texto}</p>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
