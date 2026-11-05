"""Archive an explicit live-demo allowlist; never collect wallet/browser data."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import subprocess
import zipfile

root = Path(__file__).resolve().parents[2]
output = root / 'docs/portfolio/2026-11-06-sepolia'
stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
archive = output / f'live-source-{stamp}.zip'
fixed = [
    'package.json', 'package-lock.json', 'tsconfig.base.json', 'DESIGN.md',
    'apps/web/package.json', 'apps/api/package.json', 'packages/chain/package.json',
    'packages/protocol/package.json', 'apps/web/tsconfig.json',
    'apps/web/live.html', 'apps/web/vite.live.config.ts',
    'apps/web/public/fonts/PretendardVariable.ttf', 'apps/web/public/fonts/OFL.txt',
    'packages/chain/contracts/DocumentRegistry.sol',
    'packages/chain/src/document-registry.ts', 'packages/chain/hardhat.config.ts',
    'docs/live-sepolia-demo.md', 'docs/design/toss-research.md',
    'docs/design/technical-storyboard.md',
]
trees = ['apps/web/src/live', 'packages/protocol/src', 'scripts/live', 'tests/live']
files = {root / name for name in fixed}
for folder in trees:
    files.update(p for p in (root / folder).rglob('*') if p.is_file())
for file in files:
    assert file.is_file(), f'Missing source: {file}'
    assert root in file.resolve().parents, f'Outside repository: {file}'
    assert not any(part in {'.env', '.demo', 'node_modules', '.git', 'local-design', '__pycache__'} for part in file.parts)
    assert file.suffix in {'.ts', '.tsx', '.css', '.html', '.json', '.md', '.mjs', '.py', '.sol', '.ttf', '.txt'}

manifest = {
    'createdAtUtc': datetime.now(timezone.utc).isoformat(),
    'gitHead': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    'uncommittedSnapshot': True,
    'scope': 'Live demo source subset, not the entire legacy repository; npm run live:dev/live:test/live:build.',
    'omitted': ['wallet secrets', 'browser state', '.demo', '.env', 'node_modules', 'local course materials', 'legacy application code'],
    'files': {},
}
with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED) as bundle:
    for file in sorted(files):
        name = file.relative_to(root).as_posix()
        data = file.read_bytes()
        manifest['files'][name] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
        bundle.writestr(name, data)
    bundle.writestr('SOURCE-MANIFEST.json', json.dumps(manifest, ensure_ascii=False, indent=2))
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    for name, details in manifest['files'].items():
        assert hashlib.sha256(bundle.read(name)).hexdigest() == details['sha256']
manifest['archive'] = {'name': archive.name, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'bytes': archive.stat().st_size}
manifest_path = archive.with_suffix('.manifest.json')
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'archive': str(archive), 'manifest': str(manifest_path), 'files': len(files)}, ensure_ascii=False))
