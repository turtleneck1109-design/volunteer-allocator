from pathlib import Path
root = Path(__file__).resolve().parents[1]
template = (root / 'src/template.html').read_text()
css = (root / 'src/styles.css').read_text()
scripts = []
for name in ['vendor/xlsx.full.min.js', 'src/core.js', 'src/button-feedback.js', 'src/app.js']:
    code = (root / name).read_text().replace('</script', '<\\/script')
    scripts.append('<script>\n' + code + '\n</script>')
html = template.replace('{{THEME}}', (root / 'src/theme.js').read_text().replace('</script', '<\\/script')).replace('{{STYLES}}', css).replace('{{SCRIPTS}}', '\n'.join(scripts))
out = root / 'dist/志愿者分组-完整测试版.html'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html)
print('Built:', out.name)
