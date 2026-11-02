"""Cache the reference's fonts so the demo and PNG backup work offline."""
import urllib.request, urllib.parse, re
from pathlib import Path
text=Path('docs/reference/koda-v03.html').read_text()+''.join(p.read_text() for p in Path('apps/web/src/proof').glob('*.tsx'))
characters=''.join(sorted(set(re.findall(r'[가-힣]', text))))+''.join(chr(i) for i in range(32,127))+'㈜·→₩○●◐…'
css=[]
for family,weights,filename in [('Noto Serif KR','700;900','koda-serif'),('IBM Plex Mono','400;500;600','koda-mono')]:
    params={'family':family+':wght@'+weights,'display':'swap'}
    if 'Serif' in family: params['text']=characters
    url='https://fonts.googleapis.com/css2?'+urllib.parse.urlencode(params)
    request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
    source=urllib.request.urlopen(request).read().decode()
    for i,asset in enumerate(dict.fromkeys(re.findall(r'url\((https://[^)]+)\)',source))):
        font=urllib.request.urlopen(asset).read();name=f'{filename}-{i}.ttf'
        Path('apps/web/public/fonts/'+name).write_bytes(font)
        source=source.replace(asset,'/fonts/'+name)
    css.append(source)
Path('apps/web/src/proof/fonts.css').write_text('\n'.join(css))
print('Cached reference fonts locally')
