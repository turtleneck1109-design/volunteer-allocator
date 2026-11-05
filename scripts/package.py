from pathlib import Path
import subprocess
import sys
import zipfile
import json
root = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, str(root / 'scripts/build.py')], check=True)
folder = root / 'releases'
folder.mkdir(exist_ok=True)
version = json.loads((root / 'package.json').read_text())['version']
filename = f'volunteer-allocator-v{version}.zip'
with zipfile.ZipFile(folder / filename, 'w', zipfile.ZIP_DEFLATED) as z:
    for source, target in [
        ('dist/志愿者分组-完整测试版.html', '志愿者分组-完整测试版.html'),
        ('dist/启动本地版.command', '启动本地版.command'),
        ('docs/USER_GUIDE.md', '使用说明.md'),
        ('docs/SPECIFICATION.md', '项目说明书.md'),
        ('THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'),
        ('vendor/SheetJS-LICENSE.txt', 'SheetJS-LICENSE.txt'),
    ]:
        z.write(root / source, '志愿者分组/' + target)
print('Packaged: releases/' + filename)
