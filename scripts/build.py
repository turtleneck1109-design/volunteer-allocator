import base64
from pathlib import Path
root = Path(__file__).resolve().parents[1]
template = (root / 'src/template.html').read_text()
css = (root / 'src/styles.css').read_text()
font = base64.b64encode((root / 'vendor/NotoSansSC-Regular.ttf').read_bytes()).decode('ascii')
scripts = []
notices = (root / 'THIRD_PARTY_NOTICES.md').read_text() + '\n\n' + '\n\n'.join((root / name).read_text() for name in ['vendor/SheetJS-LICENSE.txt', 'vendor/pdf-lib-LICENSE.txt', 'vendor/fontkit-LICENSE.txt', 'vendor/NotoSansSC-LICENSE.txt'])
scripts.append('<script id="thirdPartyLicenses" type="text/plain">' + notices.replace('</script', '<\\/script') + '</script>')
for name in ['vendor/xlsx.full.min.js', 'vendor/pdf-lib.min.js', 'vendor/fontkit.umd.min.js', 'src/roll-call-pdf.js', 'src/core.js', 'src/playback.js', 'src/demo.js', 'src/button-feedback.js', 'src/swap-animation.js', 'src/app.js', 'src/verification.js', 'src/verification-suggestions.js', 'src/verification-ui.js']:
    code = (root / name).read_text().replace('</script', '<\\/script')
    if name == 'src/app.js':
        code = code.removesuffix('boot();\n')
    scripts.append('<script>\n' + code + '\n</script>')
scripts.append('<script>boot();</script>')
scripts.append('<script id="rollCallFont" type="application/octet-stream">' + font + '</script>')
html = template.replace('{{THEME}}', (root / 'src/theme.js').read_text().replace('</script', '<\\/script')).replace('{{STYLES}}', css).replace('{{SCRIPTS}}', '\n'.join(scripts))
out = root / 'dist/志愿者分组-完整测试版.html'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html)
print('Built:', out.name)
