const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true,channel:'msedge'});
 const page = await browser.newPage({viewport:{width:1440,height:960}});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 const results=[]; const record=(name)=>{results.push({name,passed:true});console.log('PASS',name)};
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
 for(const name of ['Mi dinero','Mis proyectos','Mi día']) { const button=page.getByRole('button',{name,exact:true});await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true'); }
 await page.getByRole('button',{name:/Enviar propuesta/}).click(); assert.equal(await page.locator('button.fo-task').getAttribute('aria-pressed'),'true');record('Demo: three views and task completion');
 await page.getByRole('button',{name:/Anual/}).click();
 for(const plan of ['basico','intermedio','full']) assert.equal(await page.locator(`a[href="/app?plan=${plan}&periodo=anual"]`).count(),1);
 await page.getByRole('link',{name:'Probar Básico'}).click();await page.waitForURL(/\/app\/?\?plan=basico&periodo=anual/);await page.waitForTimeout(700);record('Annual plan intention reaches access route');
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await page.locator('summary').first().click();assert.equal(await page.locator('details').first().getAttribute('open'),'');record('FAQ disclosure');
 await page.setViewportSize({width:375,height:900}); await page.getByRole('button',{name:'Abrir menú'}).click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Abrir menú'}).getAttribute('aria-expanded'),'false');
 await page.getByRole('button',{name:'Abrir menú'}).click();await page.getByRole('navigation',{name:'Navegación móvil'}).getByRole('link',{name:'Planes y precios'}).click();assert.equal(await page.getByRole('button',{name:'Abrir menú'}).getAttribute('aria-expanded'),'false');record('Mobile navigation closes on Escape and section link');
 const nojs=await browser.newContext({javaScriptEnabled:false});const np=await nojs.newPage();await np.goto('http://127.0.0.1:4173/');assert.ok(await np.getByRole('heading',{level:1}).isVisible());assert.ok(await np.getByRole('link',{name:'Probar Básico'}).isVisible());await nojs.close();record('Content and plan links available without JavaScript');
 const urls=[...fs.readFileSync('public/sitemap.xml','utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).pathname);
 for(const url of urls){const response=await page.request.get('http://127.0.0.1:4173'+url);assert.ok((await response.text()).includes(`data-prerendered="${url}"`),'Static HTTP content '+url);await page.goto('http://127.0.0.1:4173'+url,{waitUntil:'networkidle'});await page.locator('h1').waitFor();assert.equal(await page.locator('h1').count(),1,url);}
 assert.deepEqual(errors,[]);record('33 public routes hydrate without page errors');
 await page.goto('file:///'+path.resolve('docs/redesign-2026-10-08/propuesta-interfaz.html').replaceAll('\\','/'));await page.setViewportSize({width:1440,height:960});
 for(const view of ['clientes','proyectos','agenda','finanzas','inicio']){await page.locator(`.nav [data-view="${view}"]`).click();assert.ok(await page.locator('#'+view+'-view').isVisible());}record('Proposal: five navigable sections');
 await page.keyboard.press('Control+k');await page.locator('#search-input').fill('agenda');await page.locator('.search-results [data-view="agenda"]').click();assert.ok(await page.locator('#agenda-view').isVisible());record('Proposal: keyboard search');
 await page.locator('#new-sale').click();await page.locator('[name=client]').selectOption({label:'Estudio Norte'});await page.locator('[name=concept]').fill('Diseño de identidad');await page.locator('[name=amount]').fill('0');await page.locator('#sale-form button[type=submit]').click();assert.ok(await page.locator('#sale-dialog').isVisible());await page.locator('[name=amount]').fill('100000');await page.locator('#sale-form button[type=submit]').click();assert.ok(!(await page.locator('#sale-dialog').isVisible()));assert.match(await page.locator('#toast').innerText(),/No se guardó/);record('Proposal: rejects zero amount; demo submits without saving');
 await page.locator('#ai-open').click();await page.locator('[data-question=cobros]').click();assert.match(await page.locator('#ai-response').innerText(),/Casa Oliva/);await page.keyboard.press('Escape');assert.ok(!(await page.locator('#ai-dialog').isVisible()));record('Proposal: assistant opens on demand and closes');
 await page.locator('.nav [data-view=inicio]').click();
 for(const width of [1440,375,320]){await page.setViewportSize({width,height:960});await page.addScriptTag({path:path.join(require('node:os').tmpdir(),'ferova-axe.min.js')});const issues=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});results.push({name:'Proposal accessibility '+width,issues});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.getByRole('button',{name:'Abrir menú'}).click();assert.equal(await page.locator('#sidebar').evaluate(e=>e.inert),false);await page.getByRole('button',{name:'Cerrar navegación'}).click();assert.equal(await page.locator('#sidebar').evaluate(e=>e.inert),true);record('Proposal mobile navigation closes and removes hidden links from keyboard focus');
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await page.setViewportSize({width:1440,height:1050});await page.screenshot({path:'docs/redesign-2026-10-08/landing-hero.png'});
 fs.writeFileSync('docs/redesign-2026-10-08/interaction-qa.json',JSON.stringify({results,errors},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

