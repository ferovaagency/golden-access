"""Live authenticated regression: own-email companies, persistence and tenant isolation.
Run with python3 tests/managedCompanies.test.py and managed preview auth variables.
"""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    session = json.loads(os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON'])
    uid = session['user']['id']
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 1800})
        page = await context.new_page()
        await page.goto('http://localhost:8080')
        await page.evaluate('([k,v])=>localStorage.setItem(k,v)', [os.environ['LOVABLE_BROWSER_SUPABASE_STORAGE_KEY'], os.environ['LOVABLE_BROWSER_SUPABASE_SESSION_JSON']])
        await page.goto('http://localhost:8080/app')
        await page.wait_for_timeout(5000)
        async def api(code, args=None):
            return await page.evaluate('''async ([code,args]) => {
                const {supabase} = await import('/src/lib/supabase.ts');
                return await new Function('supabase','args', 'return (async()=>{'+code+'})()')(supabase,args);
            }''', [code,args])
        orgs = await api("const r=await supabase.from('organizations').select('*'); if(r.error) throw r.error; return r.data;")
        holding = next(o for o in orgs if o['nombre']=='Natan Holding')
        olivia = next(o for o in orgs if o['nombre']=='Oliviaˋs Craft')
        assert olivia['data_user_id'] != uid and olivia['data_user_id'] is not None
        # UI creation requires only a name; no new email or login.
        await page.get_by_role('button', name='Configuración', exact=True).click()
        await page.get_by_label('Nombre de la nueva empresa').fill('Verificación holding sin correo')
        await page.get_by_role('button', name='Añadir empresa', exact=True).click()
        await page.wait_for_timeout(1500)
        await page.get_by_title('Cambiar de empresa').click()
        await page.get_by_role('option',name='Verificación holding sin correo').wait_for()
        await page.keyboard.press('Escape')
        result = await api("return await supabase.rpc('create_organization',{p_nombre:'Verificación holding mismo correo',p_parent_org_id:args.parent,p_invite_email:args.email});", {'parent':holding['id'],'email':session['user']['email']})
        assert result['error'] is None, result['error']
        created = await api("return (await supabase.from('organizations').select('*').eq('id',args).single()).data;", result['data'])
        assert created['data_user_id'] != uid and created['data_user_id'] != olivia['data_user_id']
        assert created['managed_account_id'] == created['data_user_id']
        # A child cannot be created under an inaccessible holding.
        denied = await api("return await supabase.rpc('create_organization',{p_nombre:'Forbidden',p_parent_org_id:'00000000-0000-0000-0000-000000000001'});")
        assert denied['error'] is not None
        await page.get_by_title('Cambiar de empresa').click()
        await page.get_by_role('option',name='Oliviaˋs Craft').click()
        await page.wait_for_timeout(3000)
        await page.screenshot(path='/tmp/browser/holding/olivia.png')
        active = await api("return (await supabase.rpc('current_account_id')).data;")
        assert active == olivia['data_user_id']
        foreign = await api("return await supabase.from('finance_clientes').select('id').eq('user_id',args);",uid)
        assert foreign['error'] is None and foreign['data'] == []
        saved = await api("return await supabase.from('finance_clientes').insert({id:crypto.randomUUID(),user_id:args,nombre:'Verificación aislamiento'}).select('id').single();",active)
        assert saved['error'] is None, saved['error']
        await page.reload(); await page.wait_for_timeout(4000)
        assert await api("return (await supabase.rpc('current_account_id')).data;") == active
        read = await api("return (await supabase.from('finance_clientes').select('id,nombre').eq('id',args)).data;",saved['data']['id'])
        assert read[0]['nombre']=='Verificación aislamiento'
        await api("return await supabase.from('finance_clientes').delete().eq('id',args);", saved['data']['id'])
        await page.get_by_title('Cambiar de empresa').click()
        await page.get_by_role('option',name='Ferova Tu negocio',exact=True).click()
        await page.wait_for_timeout(3000)
        assert await api("return (await supabase.rpc('current_account_id')).data;") == uid
        foreign = await api("return (await supabase.from('finance_clientes').select('id').eq('user_id',args)).data;",active)
        assert foreign == []
        print('PASS: name-only UI creation, own-email creation, distinct identities, denied parent, switch, save/read, reload persistence and RLS isolation.')
        await browser.close()

asyncio.run(main())
