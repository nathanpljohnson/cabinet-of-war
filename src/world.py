import json,re
from pathlib import Path
O=Path(__file__).resolve().parents[1]
s=json.loads((O/'src/state.json').read_text());w=s['hidden']['world']
md=['# World engine — verified corrections, 4 October 2026','',w['status'],'','See [verification report](VERIFICATION-REPORT.md) for sources and limits.','','## Principles','']+['- '+x for x in w['how_to_use']]
for x in w['systems']:
 md+=['', '## '+x['name'],'',x['summary'],'']+['- '+r for r in x['rules']]
md+=['','## Plot threads — 47 provisional causal models','']
for p in w['plots']:
 md+=['### '+p['title']+' ('+p['id']+')','',p['claim'],'','Verification: '+p['verification']['scope'],'']
md+=['## Failure remains possible','']+['- '+x['what']+': '+x['consequence'] for x in w['stakes']]
md+=['','## Calendar anchors','']+['- '+c['d']+': '+c['e']+' — '+c['c'] for c in w['calendar']]
(O/'WORLD-ENGINE.md').write_text('\n'.join(md)+'\n')
for path in [O/'cabinet-of-war.html',O/'src/desk.template.html']:
 text=path.read_text();payload=json.dumps(s,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
 if path.name=='cabinet-of-war.html':
  text,n=re.subn(r'(<script type="application/json" id="initial-state">).*?(</script>)',lambda m:m[1]+payload+m[2],text,flags=re.S);assert n==1
  path.write_text(text)
(O/'opening-state.example.json').write_text(json.dumps(s,ensure_ascii=False,indent=2))
(O/'src/world.json').write_text(json.dumps(w,ensure_ascii=False,indent=2))
print('Rebuilt world document, opening state and HTML embedded state; 47 plots retained.')
