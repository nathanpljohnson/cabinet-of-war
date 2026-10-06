import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[2]
w=root/'work'
t=(w/'v2/desk.template.html').read_text()
css=(w/'assets/vendor/leaflet.css').read_text()
css=re.sub(r'url\([^)]*images/[^)]*\)','none',css)
js=(w/'assets/vendor/leaflet.js').read_text().replace('</script','<\\/script')
geo=(w/'assets/geo.json').read_text()
state=json.loads((w/'v2/state.json').read_text())
fnd=(root/'outputs/CAMPAIGN-FOUNDATION.md').read_text()
contract=fnd.split('## Durable adjudication contract\n')[1].split('## State and continuity')[0].strip()
contract='\n'.join(l for l in contract.splitlines() if 'one to two weeks' not in l)
contract+='\n- Time is event-driven: advance under standing instructions until developments exceed them or materially change the stakes. Dialogue does not by itself consume a strategic turn.\n- Concealed state must have documented, supported-inference, disputed, or campaign-invention status. Never invent archival quotations.'
rules={'contract':contract,'scene':'Characters speak from pre-existing priorities and only what they could know. Consequences begin immediately: record promises, disclosures, refusals. Do not advance the wider world; that happens at Resolve. End the scene naturally.'}
j=lambda o:json.dumps(o,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
out=t.replace('/*LEAFLET_CSS*/',css).replace('/*LEAFLET_JS*/',js).replace('__RULES__',j(rules)).replace('__STATE__',j(state)).replace('__GEO__',geo.replace('<','\\u003c'))
(root/'outputs/cabinet-of-war.html').write_text(out)
(root/'outputs/opening-state.example.json').write_text(json.dumps(state,ensure_ascii=False,indent=2))
print(len(out))
