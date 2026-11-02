"""One-time extraction of supplied document markup into editable React JSX."""
import json, re
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString
screens=json.loads(Path('scripts/proof/reference.json').read_text())
def jsx(n):
    if isinstance(n,NavigableString):
        text=str(n)
        if not text.strip(): return ' ' if '\n' not in text else '\n'
        return text.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('{','&#123;').replace('}','&#125;')
    if not n.name:return ''.join(jsx(x) for x in n.children)
    attrs=[]
    for key,v in n.attrs.items():
        key={'class':'className','colspan':'colSpan'}.get(key,key)
        if isinstance(v,list):v=' '.join(v)
        if key=='style':
            style={re.sub(r'-([a-z])',lambda m:m[1].upper(),k.strip()):v.strip() for k,v in (pair.split(':',1) for pair in v.split(';') if ':' in pair)}
            attrs.append('style={'+json.dumps(style,ensure_ascii=False)+'}')
        else:attrs.append(key+'='+json.dumps(v,ensure_ascii=False))
    tag='<'+n.name+(' '+' '.join(attrs) if attrs else '')
    if n.name in ['br','input','hr']:return tag+' />'
    content=''.join(jsx(x) for x in n.children)
    if n.name=='table':content='<tbody>'+content+'</tbody>'
    return tag+'>'+content+'</'+n.name+'>'
def select(i,selector):return BeautifulSoup(screens[i]['html'],'html.parser').select_one(selector)
out='import { useState } from "react";\nimport { defineControls } from "tempo-sdk/assets";\n\n'
for name,i,sel in [('FullCertificate',1,'.doc'),('MaskedCertificate',3,'.doc'),('AuditorCertificate',4,'.doc'),('ChangedCertificate',6,'.doc'),('MaskingMatrix',8,'.main')]:
    el=select(i,sel)
    for pin in el.select('.ipin'):pin.decompose()
    if name=='AuditorCertificate':
        tr=el.select('table')[-1].select('tr')[-1]
        tr.clear();td=BeautifulSoup('<td colspan="4"><button class="text-action" type="button">외 8건 펼치기</button></td>','html.parser').td;tr.append(td)
        generated=jsx(el)
        generated=generated.replace('<button className="text-action" type="button">외 8건 펼치기</button>', '<button className="text-action" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "거래 내역 접기" : "외 8건 펼치기"}</button>')
        generated=generated.replace('<tr><td colSpan="4">','{expanded && extraTransactions.map((t, i) => <tr key={i}>{t.map((v, j) => <td key={j}>{v}</td>)}</tr>)}<tr><td colSpan="4">')
        out+='const extraTransactions = '+json.dumps([[d,c,q,h] for d,c,q,h in [('07-03','A사','+1.0000 BTC','2ab1…a001'),('07-21','B사','+50.00 ETH','0x41…0012'),('08-05','A사','−0.5000 BTC','bc21…a003'),('08-14','B사','+200,000 USDC','0x51…0014'),('08-20','A사','+0.2500 BTC','cd31…a005'),('09-02','B사','+40.20 ETH','0x61…0016'),('09-11','A사','−100,000 USDC','0x71…0017'),('09-28','B사','+0.2500 BTC','ef41…a008')]],ensure_ascii=False)+';\n'
        out+='export function '+name+'() { const [expanded, setExpanded] = useState(false); return ('+generated+'); }\n'
    else:out+='export function '+name+'() { return ('+jsx(el)+'); }\n'
    out+='defineControls('+name+', {});\n\n'
Path('apps/web/src/proof/Certificates.tsx').write_text(out.replace('colSpan="4"', 'colSpan={4}'))
