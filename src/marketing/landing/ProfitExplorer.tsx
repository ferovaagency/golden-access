import { useState } from 'react';
import { ArrowDown, ArrowUpRight, Clock3 } from 'lucide-react';

const money = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

/** A local, illustrative scenario: never reads or writes customer finances. */
export function ProfitExplorer() {
  const [hours, setHours] = useState(30);
  const income = 2400000;
  const directCosts = 600000;
  const hourlyCost = 40000;
  const timeCost = hours * hourlyCost;
  const remaining = income - directCosts - timeCost;
  return (
    <div className="fo-profit-lab">
      <div className="fo-lab-input">
        <span className="fo-lab-kicker">PRUÉBALO CON UN EJEMPLO</span>
        <h3>El mismo proyecto.<br />¿La misma ganancia?</h3>
        <p>Cobras $2.400.000. Pero cada hora extra también cuesta. Mueve el control y mira qué pasa con tu margen.</p>
        <label htmlFor="project-hours"><span><Clock3 size={17} aria-hidden="true" /> Horas dedicadas</span><strong>{hours} h</strong></label>
        <input id="project-hours" type="range" min="10" max="60" step="1" value={hours} onChange={(event) => setHours(Number(event.target.value))} aria-valuetext={`${hours} horas`} />
        <div className="fo-range-ends"><span>10 horas</span><span>60 horas</span></div>
        <small>Ejemplo en COP: $40.000 de costo por hora y $600.000 de costos directos. No incluye impuestos ni otros gastos.</small>
      </div>
      <div className={`fo-lab-result ${remaining < 0 ? 'is-negative' : ''}`}>
        <div className="fo-lab-result-top"><span>PROYECTO DE IDENTIDAD</span><span>Simulación</span></div>
        <div className="fo-cost-row"><span>Precio del proyecto</span><b>{money(income)}</b></div>
        <div className="fo-cost-row"><span>Costos directos</span><b>− {money(directCosts)}</b></div>
        <div className="fo-cost-row"><span>Tu tiempo · {hours} h</span><b>− {money(timeCost)}</b></div>
        <div className="fo-lab-balance" role="status" aria-atomic="true">
          <span>{remaining < 0 ? 'Este proyecto supera su presupuesto' : 'Margen antes de impuestos y otros gastos'}</span>
          <strong>{money(remaining)}</strong>
          <p>{Math.round(remaining / income * 100)}% del precio del proyecto</p>
        </div>
        <div className="fo-cost-track" aria-hidden="true"><i style={{ width: '25%' }} /><i style={{ width: `${Math.min(timeCost / income * 100, 75)}%` }} /></div>
        <p className="fo-lab-insight"><ArrowDown size={16} aria-hidden="true" /> {remaining > 0 ? 'Más horas al mismo precio reducen tu margen.' : 'El precio ya no cubre los costos de este ejemplo.'}</p>
        <a href="#precios">Ahora hazlo con tus propios números <ArrowUpRight size={16} aria-hidden="true" /></a>
      </div>
    </div>
  );
}
