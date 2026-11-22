import argparse
import base64
import hashlib
import json
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--web', action='store_true', help='Build the lightweight hosted site into _site')
args = parser.parse_args()
template = (root / 'src/template.html').read_text()
css = (root / 'src/styles.css').read_text()
theme = (root / 'src/theme.js').read_text().replace('</script', '<\\/script')
notices = (root / 'THIRD_PARTY_NOTICES.md').read_text() + '\n\n' + '\n\n'.join((root / name).read_text() for name in ['vendor/SheetJS-LICENSE.txt', 'vendor/pdf-lib-LICENSE.txt', 'vendor/fontkit-LICENSE.txt', 'vendor/NotoSansSC-LICENSE.txt'])
modules = ['src/asset-loader.js', 'src/roll-call-pdf.js', 'src/core.js', 'src/playback.js', 'src/demo.js', 'src/button-feedback.js', 'src/swap-animation.js', 'src/app.js', 'src/verification.js', 'src/verification-suggestions.js', 'src/verification-ui.js']
vendors = ['vendor/xlsx.full.min.js', 'vendor/pdf-lib.min.js', 'vendor/fontkit.umd.min.js']

def source(name):
    code = (root / name).read_text()
    if name == 'src/app.js':
        assert code.endswith('boot();\n'), 'App startup changed; update the build entry point'
        code = code.removesuffix('boot();\n')
    return code

if args.web:
    out = root / '_site'
    if out.exists():
        shutil.rmtree(out)
    assets = out / 'assets'
    assets.mkdir(parents=True)

    def asset(stem, suffix, data):
        name = f'{stem}.{hashlib.sha256(data).hexdigest()[:16]}{suffix}'
        (assets / name).write_bytes(data)
        return 'assets/' + name

    manifest = {key: asset(stem, suffix, (root / path).read_bytes()) for key, stem, suffix, path in [
        ('xlsx', 'xlsx', '.js', vendors[0]),
        ('pdfLib', 'pdf-lib', '.js', vendors[1]),
        ('fontkit', 'fontkit', '.js', vendors[2]),
        ('font', 'NotoSansSC-Regular', '.ttf', 'vendor/NotoSansSC-Regular.ttf'),
    ]}
    app = '"use strict";\n' + 'globalThis.VolunteerAssets=' + json.dumps(manifest) + ';\n' + '\n;\n'.join(source(name) for name in modules) + '\n;boot();\n'
    app_url = asset('app', '.js', app.encode())
    css_url = asset('app', '.css', css.encode())
    html = template.replace('{{THEME}}', theme).replace('<style>{{STYLES}}</style>', f'<link rel="stylesheet" href="{css_url}">').replace('{{SCRIPTS}}', f'<script defer src="{app_url}" onerror="document.getElementById(\'mainContent\').textContent=\'程序加载失败，请刷新页面重试。原本地名单仍保留。\'"></script>')
    (out / 'index.html').write_text(html)
    (out / '.nojekyll').touch()
    (out / 'THIRD_PARTY_NOTICES.txt').write_text(notices)
    initial = len(html.encode()) + len(css.encode()) + len(app.encode())
    print(f'Built: _site/index.html (initial HTML + CSS + JS: {initial:,} bytes; Excel/PDF/font loaded on demand)')
else:
    scripts = ['<script id="thirdPartyLicenses" type="text/plain">' + notices.replace('</script', '<\\/script') + '</script>']
    scripts += ['<script>\n' + source(name).replace('</script', '<\\/script') + '\n</script>' for name in vendors + modules]
    scripts.append('<script>boot();</script>')
    font = base64.b64encode((root / 'vendor/NotoSansSC-Regular.ttf').read_bytes()).decode('ascii')
    scripts.append('<script id="rollCallFont" type="application/octet-stream">' + font + '</script>')
    html = template.replace('{{THEME}}', theme).replace('{{STYLES}}', css).replace('{{SCRIPTS}}', '\n'.join(scripts))
    out = root / 'dist/志愿者分组-完整测试版.html'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    print('Built:', out.name)
