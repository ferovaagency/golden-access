import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SubscriptionManagement, type BillingServices } from '../../../src/components/billing/SubscriptionManagement';
import { ProfileMenu } from '../../../src/components/layout/ProfileMenu';
import type { BillingStatus, PortalIntent } from '../../../src/lib/billingModel';
import type { User } from '@supabase/supabase-js';
import '@fontsource/figtree/400.css';import '@fontsource/figtree/600.css';
import '../../../src/index.css';import '../../../src/styles/product-blue.css';
const base:BillingStatus={status:'active',next_billed_at:'2026-11-09T12:00:00Z',current_period_ends_at:'2026-11-09T12:00:00Z',cancel_at:null,canceled_at:null,can_manage:true};
const states:Record<string,BillingStatus>={active:base,scheduled:{...base,cancel_at:base.next_billed_at},canceled:{...base,status:'canceled'},trialing:{...base,status:'trialing'},past_due:{...base,status:'past_due'},none:{...base,status:'none',can_manage:false}};
const user={id:'test',app_metadata:{},aud:'authenticated',created_at:'2026-10-09T00:00:00Z',email:'demo@ferova.example',user_metadata:{full_name:'Cuenta de ejemplo'}} as User;
function Harness(){const [scenario,setScenario]=useState('active');const [fail,setFail]=useState(false);const [last,setLast]=useState('');const [navigation,setNavigation]=useState('');
const api=useMemo<BillingServices>(()=>({status:async()=>{if(scenario==='error')throw new Error('Paddle no está disponible. Intenta de nuevo.');return states[scenario]},open:async(intent:PortalIntent)=>{if(fail)throw new Error('No se pudo abrir el portal. Intenta de nuevo.');setLast(intent)}}),[scenario,fail]);
return <main className="billing-page"><div><header style={{display:'flex',justifyContent:'space-between',gap:20,alignItems:'center',marginBottom:24}}><div><h1 style={{fontSize:24,fontWeight:600}}>Ferova One</h1><p>Prueba local del flujo · No realiza cobros ni cancelaciones reales</p></div><ProfileMenu user={user} onNavigate={setNavigation}/></header><section aria-label="Controles de prueba" style={{display:'flex',gap:15,flexWrap:'wrap',marginBottom:20}}><label>Escenario <select aria-label="Escenario" value={scenario} onChange={e=>setScenario(e.target.value)}>{['active','scheduled','canceled','trialing','past_due','none','error'].map(s=><option key={s}>{s}</option>)}</select></label><label><input type="checkbox" checked={fail} onChange={e=>setFail(e.target.checked)}/> Simular error al abrir</label><output data-testid="navigation">{navigation}</output><output data-testid="intent">{last}</output></section><SubscriptionManagement api={api}/></div></main>}
createRoot(document.getElementById('root')!).render(<Harness/>);

