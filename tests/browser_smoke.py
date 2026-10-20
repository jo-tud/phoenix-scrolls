"""Optional local UI checks: pip install playwright; set CHROMIUM if needed."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/'
shots = ROOT.parent / 'phoenix-preview'
shots.mkdir(exist_ok=True)
checks = []
def ok(name):
    checks.append(name)
    print('PASS', name)
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM', '/usr/bin/chromium'), args=['--no-sandbox'])
        context = browser.new_context(viewport={'width':1440,'height':1050})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(url)
        page.wait_for_selector('.phrase')
        assert page.locator('.panel').count() == 2
        assert page.locator('[data-layer=modern]').get_attribute('aria-pressed') == 'false'
        ok('Greek and English default; Modern Reading off')
        assert page.locator('.phrase[lang=grc]').count() == 2
        page.locator('[data-kind=greek] .phrase').first.click()
        assert page.locator('.phrase[aria-pressed=true]').count() == 2
        ok('phrase alignment across both languages')
        page.screenshot(path=str(shots/'desktop.png'), full_page=True)
        page.locator('[data-layer=modern]').click()
        assert page.locator('.panel').count() == 3
        assert page.locator('.phrase[aria-pressed=true]').count() == 3
        ok('optional third column retains selected phrase')
        page.screenshot(path=str(shots/'three-columns.png'), full_page=True)
        page.locator('#larger').click()
        page.locator('#theme').click()
        page.reload()
        page.wait_for_selector('.phrase')
        assert page.locator('.panel').count() == 3
        assert page.locator('html').get_attribute('data-theme') == 'dark'
        assert page.locator('#size-label').inner_text() == '110%'
        ok('theme, size and layer preferences survive reload')
        page.screenshot(path=str(shots/'dark.png'), full_page=True)
        page.locator('[data-layer=greek]').click()
        page.locator('[data-layer=english]').click()
        assert page.locator('[data-layer=modern]').is_disabled()
        ok('at least one layer must remain visible')
        page.goto(url + '?edition=missing#reader')
        page.wait_for_selector('#error:not([hidden])')
        assert 'No different edition' in page.locator('#error-message').inner_text()
        ok('unknown edition does not silently fall back')
        assert not errors, errors
        ok('no browser JavaScript errors')
        mobile = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, device_scale_factor=1)
        m = mobile.new_page()
        m.goto(url + '#reader')
        m.wait_for_selector('.phrase')
        assert m.locator('.panel:visible').count() == 1
        assert m.locator('.panel:visible').get_attribute('data-kind') == 'english'
        m.locator('#mobile-layer').select_option('greek')
        assert m.locator('.panel:visible').get_attribute('data-kind') == 'greek'
        m.locator('[data-layer=modern]').click()
        assert m.locator('.panel:visible').get_attribute('data-kind') == 'modern'
        assert m.evaluate('document.documentElement.scrollWidth <= innerWidth')
        ok('mobile switches language at same passage without overflow')
        m.screenshot(path=str(shots/'mobile.png'), full_page=True)
        m.set_viewport_size({'width':320,'height':700})
        assert m.evaluate('document.documentElement.scrollWidth <= innerWidth')
        ok('320px viewport has no horizontal overflow')
        fail = browser.new_context()
        fail.route('**/data/scrolls.json', lambda route: route.abort())
        f = fail.new_page(); f.goto(url)
        f.wait_for_selector('#error:not([hidden])')
        ok('failed data load gives actionable error')
        blocked = browser.new_context()
        blocked.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('Blocked')}})")
        b = blocked.new_page(); b.goto(url); b.wait_for_selector('.phrase')
        b.locator('[data-layer=modern]').click()
        assert b.locator('.panel').count() == 3
        assert 'did not allow' in b.locator('#notice').inner_text()
        ok('reader works when local storage is blocked')
        nojs = browser.new_context(java_script_enabled=False)
        j = nojs.new_page(); j.goto(url)
        assert j.locator('noscript a').is_visible()
        ok('no-JavaScript source fallback')
        browser.close()
finally:
    server.shutdown()
print(f'{len(checks)} browser checks passed.')
