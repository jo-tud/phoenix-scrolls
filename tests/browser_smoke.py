"""Offline Chromium UI checks: pip install playwright; set CHROMIUM if needed.

No network or server required. The checked-in modules are concatenated in dependency
order into one async scope; import/export syntax only is removed. The HTML and CSS
are unchanged. about:blank has no origin storage or WebCrypto, so small test adapters
provide those services. Native DOM, layout, scrolling, dialogs and touch events run
in Chromium. Real URL resolution and WebCrypto are separately tested in Node.
Synthetic long passages exist only in this test and are never staged for publication.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import copy
import hashlib
import json
import os
import re

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT.parent / 'phoenix-ux-preview'
SHOTS.mkdir(exist_ok=True)
DATA = json.loads((ROOT / 'data/scrolls.json').read_text())
NOTES = json.loads((ROOT / 'data/reading-notes.json').read_text())
HTML = re.sub(r'<script type="module"[^>]*></script>', '', (ROOT / 'index.html').read_text())
HTML = re.sub(r'<link rel="stylesheet"[^>]*>', '', HTML)
CSS = '\n'.join((ROOT / f).read_text() for f in ['assets/style.css', 'assets/experience.css'])
HTML = HTML.replace('</head>', '<style>' + CSS + '</style></head>')
JS = '\n'.join(re.sub(r'^import .*;\n', '', (ROOT / f).read_text(), flags=re.M).replace('export ', '') for f in
    ['assets/model.mjs', 'assets/reading.mjs', 'assets/experience.mjs', 'assets/app.mjs'])
checks = []
errors = []

def ok(name):
    checks.append(name)
    print('PASS', name, flush=True)

def load(page, data=None, storage=None, extra='', expect_text=True):
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(HTML)
    page.expose_function('testSha', lambda b: list(hashlib.sha256(bytes(b)).digest()))
    page.evaluate('''({data,notes,storage}) => {
      const cache={...storage}; window.testStorage=cache;
      Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>cache[k]??null,setItem:(k,v)=>cache[k]=v,removeItem:k=>delete cache[k]}});
      Object.defineProperty(crypto,'subtle',{value:{digest:async(_,b)=>new Uint8Array(await window.testSha(Array.from(new Uint8Array(b)))).buffer}});
      window.fetch=async url=>new Response(JSON.stringify(String(url).includes('reading-notes')?notes:data),{status:200});
      history.pushState=(_,__,url)=>{window.testLastURL=url};
    }''', {'data': data or DATA, 'notes': NOTES, 'storage': storage or {}})
    if extra:
        page.evaluate('() => {' + extra + ';}')
    page.add_script_tag(content='(async()=>{' + JS + '\nwindow.testBootDone=true;})().catch(e=>{window.testBootError=String(e)})')
    page.wait_for_function('window.testBootDone || window.testBootError')
    assert page.evaluate('window.testBootError') is None, page.evaluate('window.testBootError')
    if expect_text:
        page.wait_for_selector('.phrase')
    page.wait_for_timeout(180)

def active(page):
    return page.locator('.panel:not([inert])').get_attribute('data-kind')

def wait_active(page, layer):
    page.wait_for_function('(k)=>document.querySelector(`.panel[data-kind="${k}"]`)?.inert===false', arg=layer)
    page.wait_for_timeout(200)

def swipe(context, page, dx, dy=0):
    client = context.new_cdp_session(page)
    x, y = (270 if dx < 0 else 100), 380
    client.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for n in range(1, 13):
        client.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x+dx*n/12,'y':y+dy*n/12}]})
        page.wait_for_timeout(22)
    client.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    page.wait_for_timeout(650)
    client.detach()

def long_fixture():
    d=copy.deepcopy(DATA)
    units=d['scrolls'][0]['editions'][0]['passages'][0]['units']
    for i in range(18):
        greek=(f'TEST FIXTURE {i}. ' * 4).strip()
        fp=hashlib.sha256(greek.encode()).hexdigest()
        units.append({'id':f'test-{i}','reference':f'TEST ONLY {i}',
            'greek':{'text':greek,'status':'test-fixture'},
            'english':{'text':(f'Test paragraph {i} for layout and reading position. ' * 3).strip(),'status':'test-fixture','basedOnGreek':fp},
            'modern':{'text':(f'Longer test paragraph {i} for matching unequal versions. ' * 9).strip(),'status':'test-fixture','basedOnGreek':fp}})
    return d

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
    desktop=browser.new_context(viewport={'width':1440,'height':1000})
    page=desktop.new_page(); load(page)
    assert page.locator('.panel').count()==2
    assert page.locator('[data-layer=modern]').get_attribute('aria-pressed')=='false'
    assert 'A thought from' in page.locator('h1').inner_text()
    ok('restored headline; Greek and English default; Modern Reading optional')
    assert page.locator('button.phrase').count()==0
    selected=page.locator('.phrase[lang=en]').first.evaluate('el=>{let r=document.createRange();r.selectNodeContents(el);let s=getSelection();s.removeAllRanges();s.addRange(r);return s.toString()}')
    assert 'seek something' in selected
    page.evaluate('getSelection().removeAllRanges()')
    ok('reading text supports native selection')
    page.locator('[data-kind=english] .compare-unit').first.click()
    assert page.locator('.unit.is-selected').count()==2
    page.locator('[data-layer=modern]').click();page.wait_for_timeout(250)
    assert page.locator('.unit.is-selected').count()==3
    ok('comparison stays aligned when a third version is added')
    page.screenshot(path=str(SHOTS/'desktop.png'),full_page=True)
    page.locator('#copy-text').click()
    assert 'edition=2026-10-20-pilot-1' in page.locator('#share-url').input_value()
    assert 'not expert-reviewed' in page.locator('#share-url').input_value()
    ok('clipboard fallback includes selection, status and edition citation')
    page.locator('#reflection-open').click()
    assert 'present-day prompt' in page.locator('#sheet-body').inner_text()
    assert 'does not define' in page.locator('#sheet-body').inner_text()
    assert page.locator('#note-sheet a').get_attribute('href')==DATA['sources'][0]['url']
    page.keyboard.press('Escape')
    ok('reflection identifies evidence, interpretation and limits')
    page.locator('#coverage summary').click()
    assert page.locator('#column-map button').count()==22
    assert page.locator('#column-map [data-state=available]').count()==1
    assert page.locator('#column-map [data-state=traces]').count()==3
    page.locator('#column-map [data-state=pending]').first.click()
    assert 'not yet been added' in page.locator('#sheet-body').inner_text()
    page.locator('#sheet-close').click()
    ok('coverage distinguishes website omissions from source transcription status')
    page.locator('#theme').click();page.locator('#larger').click()
    store=page.evaluate('window.testStorage')
    restored=desktop.new_page();load(restored,storage=store)
    assert restored.locator('html').get_attribute('data-theme')=='dark'
    assert restored.locator('#size-label').inner_text()=='110%'
    assert restored.locator('.panel').count()==3
    restored.screenshot(path=str(SHOTS/'dark.png'),full_page=True)
    ok('theme, size and enabled versions survive reopening')

    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
    m=mobile.new_page();load(m)
    assert active(m)=='english'
    m.locator('#mobile-modern').click();wait_active(m,'modern')
    m.locator('#tab-english').click();wait_active(m,'english')
    m.locator('#focus-toggle').click();m.wait_for_timeout(200)
    # Put the text under the sticky controls so the actual native gesture hits it.
    m.locator('#panels').evaluate('el=>window.scrollBy({top:el.getBoundingClientRect().top-230,behavior:"instant"})')
    m.wait_for_timeout(150)
    rects=m.locator('#panels').evaluate('e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,panels:[...e.children].map(p=>({left:p.getBoundingClientRect().left,right:p.getBoundingClientRect().right}))})')
    assert rects['panels'][0]['right']>rects['left']
    assert rects['panels'][2]['left']<rects['right']
    ok('both neighbouring versions visibly peek beside English')
    m.screenshot(path=str(SHOTS/'mobile.png'))
    swipe(mobile,m,-180);assert active(m)=='modern'
    swipe(mobile,m,180);assert active(m)=='english'
    swipe(mobile,m,180);assert active(m)=='greek'
    ok('native touch swipes change versions in fixed order')
    swipe(mobile,m,160);assert active(m)=='greek'
    ok('first version does not wrap around')
    m.locator('#tab-english').click();wait_active(m,'english')
    before=m.evaluate('scrollY');swipe(mobile,m,0,-120)
    assert active(m)=='english';assert m.evaluate('scrollY')>before
    ok('vertical touch scroll reads onward without changing version')
    m.locator('#tab-english').focus();m.keyboard.press('ArrowRight');wait_active(m,'modern')
    assert m.locator('#tab-modern').get_attribute('aria-selected')=='true'
    m.keyboard.press('Home');wait_active(m,'greek')
    ok('version tabs support arrow keys and Home')
    m.locator('#tab-english').click();wait_active(m,'english')
    m.locator('.panel:not([inert]) .unit-note').first.click()
    assert m.locator('#note-sheet').evaluate('e=>e.open')
    for _ in range(8):
        m.keyboard.press('Tab')
        assert m.evaluate('document.querySelector("#note-sheet").contains(document.activeElement)')
    m.screenshot(path=str(SHOTS/'notes.png'))
    m.keyboard.press('Escape')
    assert m.evaluate('document.activeElement.classList.contains("unit-note")')
    ok('notes sheet traps focus, closes with Escape and returns focus')
    m.locator('#show-peeks').uncheck()
    assert m.locator('#panels').evaluate('e=>parseFloat(getComputedStyle(e).getPropertyValue("--peek"))')==0
    ok('readers can reclaim the preview width')
    m.locator('#focus-toggle').click()
    assert not m.locator('body').evaluate('e=>e.classList.contains("reading-view")')
    ok('reading view has a working exit')

    for width in [320,360,390,768,1440]:
        c=browser.new_context(viewport={'width':width,'height':900})
        q=c.new_page();load(q)
        for _ in range(5):q.locator('#larger').click()
        assert not q.evaluate('document.documentElement.scrollWidth>innerWidth'),width
        q.screenshot(path=str(SHOTS/f'width-{width}.png'),full_page=True)
        c.close()
    ok('320–1440px viewports and 150% reading text have no page overflow')

    long_context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
    l=long_context.new_page();fixture=long_fixture();load(l,data=fixture)
    l.locator('#mobile-modern').click();wait_active(l,'modern')
    l.locator('#tab-english').click();wait_active(l,'english')
    l.locator('#focus-toggle').click()
    l.locator('[data-kind=english] [data-unit=test-9]').evaluate('e=>window.scrollBy({top:e.getBoundingClientRect().top-180,behavior:"instant"})')
    l.wait_for_timeout(200)
    y=l.locator('[data-kind=english] [data-unit=test-9]').evaluate('e=>e.getBoundingClientRect().top')
    l.locator('#tab-modern').click();wait_active(l,'modern')
    after=l.locator('[data-kind=modern] [data-unit=test-9]').evaluate('e=>e.getBoundingClientRect().top')
    assert abs(y-after)<4,(y,after)
    ok('unequal long versions retain the matching unit at the same screen height')
    l.locator('#tab-english').click();wait_active(l,'english')
    before=l.locator('[data-kind=english] [data-unit=test-9]').evaluate('e=>e.getBoundingClientRect().top')
    assert abs(before-y)<4,(before,y)
    ok('round trip does not accumulate reading-position drift')
    l.wait_for_timeout(300)
    saved=l.evaluate('window.testStorage')
    pos=json.loads(saved['phoenix-scrolls.position.v1']);assert pos['unit']=='test-9',pos
    again=long_context.new_page();load(again,data=fixture,storage=saved)
    assert again.locator('#resume').is_visible()
    again.locator('#resume-go').click();again.wait_for_timeout(250)
    visible=again.locator('.panel:not([inert]) [data-unit=test-9]').evaluate('e=>e.getBoundingClientRect().top')
    assert 0<=visible<400,visible
    ok('continue reading restores the saved edition and unit')
    bad=copy.deepcopy(saved);badpos=json.loads(bad['phoenix-scrolls.position.v1']);badpos['edition']='missing';bad['phoenix-scrolls.position.v1']=json.dumps(badpos)
    gone=long_context.new_page();load(gone,data=fixture,storage=bad)
    assert gone.locator('#resume-go').is_hidden()
    assert 'unavailable' in gone.locator('#resume-label').inner_text()
    ok('missing saved edition is reported instead of silently replaced')
    blocked=desktop.new_page();load(blocked,extra="Object.defineProperty(window,'localStorage',{get(){throw Error('Blocked')}})")
    blocked.locator('[data-layer=modern]').click()
    assert blocked.locator('.panel').count()==3
    assert 'did not allow' in blocked.locator('#notice').inner_text()
    ok('reader remains usable without local storage')
    no_notes=desktop.new_page();load(no_notes,extra="{let original=fetch;window.fetch=url=>String(url).includes('reading-notes')?Promise.reject(Error('offline')):original(url)}")
    assert no_notes.locator('#reflection').is_hidden()
    assert no_notes.locator('.phrase').count()==4
    ok('optional notes failure leaves original reading available')
    failure=desktop.new_page();load(failure,extra="window.fetch=()=>Promise.reject(Error('offline'))",expect_text=False)
    assert failure.locator('#error').is_visible()
    ok('text loading failure shows an actionable error')
    nojs=browser.new_context(java_script_enabled=False).new_page();nojs.set_content(HTML)
    assert nojs.locator('noscript a').is_visible()
    ok('no-JavaScript source link remains available')
    animated=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    a=animated.new_page();load(a)
    a.locator('#mobile-modern').click();wait_active(a,'modern')
    a.locator('#tab-english').click();wait_active(a,'english')
    a.locator('#tab-greek').click();wait_active(a,'greek')
    assert a.locator('[role=tab][tabindex="0"]').count()==1
    assert a.locator('[role=tabpanel]:not([aria-hidden])').count()==1
    ok('animated switching settles correctly and exposes one active mobile panel')
    assert not errors,errors
    ok('no uncaught browser errors')
    browser.close()
print(f'{len(checks)} browser checks passed.')
