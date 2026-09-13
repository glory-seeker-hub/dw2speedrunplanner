const fs=require('node:fs'),assert=require('node:assert/strict');
const {load}=require('../tests/helpers/loadTs.cjs');
const {BATTLE_SKILLS}=load('src/data/battleSkills.ts');
const {SKILL_EFFECT_SOURCE}=load('src/data/wazaSource.ts');
const {classifyEffect}=load('src/utils/battle/battleEffectCoverage.ts');
const grouped=new Map();
for(const skill of BATTLE_SKILLS)for(const effect of skill.effects){
 const classification=classifyEffect(effect,skill);
 assert.ok(['authoritative','compatibility-only','deferred-unresolved','ignored-by-project','not-applicable','data-only'].includes(classification.status));
 const key=JSON.stringify({effect,classification});
 if(!grouped.has(key))grouped.set(key,{sourceByte:effect.byte,mask:effect.mask,canonicalLabel:effect.sourceLabel??'Unknown bit',descriptor:effect,...classification,techniques:[]});
 grouped.get(key).techniques.push({id:skill.id,hexId:'0x'+skill.id.toString(16).toUpperCase().padStart(2,'0'),name:skill.name,recordKind:skill.recordKind});
}
const descriptors=[...grouped.values()].sort((a,b)=>a.sourceByte-b.sourceByte||a.mask-b.mask||a.status.localeCompare(b.status));
const unusedSourceRows=SKILL_EFFECT_SOURCE.filter(row=>!descriptors.some(d=>d.descriptor.sourceRow===row.row)).map(row=>({...row,status:'data-only',handler:'none',boundary:'Dictionary row has no decoded record occurrence; not silently executed.'}));
const report={schemaVersion:1,descriptorOccurrences:BATTLE_SKILLS.reduce((n,s)=>n+s.effects.length,0),classifiedOccurrences:descriptors.reduce((n,d)=>n+d.techniques.length,0),descriptorGroups:descriptors.length,descriptors,unusedSourceRows,projectRules:[{rule:'Assist vs Interrupt',status:'deferred-unresolved',boundary:'Existing exclusion preserved; no new scheduling eligibility inferred.'},{rule:'Fixed heal values',status:'authoritative',handler:'battleSupportEffects.FIXED_HEALS',ids:[0xbc,0xb5,0xcb]},{rule:'Custom legacy debuff/drain/chain',status:'compatibility-only',handler:'battleLegacyEffects',boundary:'Only custom unidentified debuffs retain approximate stacks; canonical stages never execute twice.'}]};
assert.equal(report.classifiedOccurrences,report.descriptorOccurrences);
const seen=new Set();for(const row of descriptors)for(const s of row.techniques){const k=JSON.stringify([s.id,row.descriptor]);assert.ok(!seen.has(k),'Duplicate/conflicting descriptor classification');seen.add(k);}
const json=JSON.stringify(report,null,2)+'\n';
const md=['# Phase 2K-H effect coverage','',report.classifiedOccurrences+' decoded occurrences classified in '+descriptors.length+' groups. Groups split only where record context changes execution status. Unused dictionary rows are explicitly data-only.','', '| Byte | Mask | Canonical label | IDs / names | Status | Handler and boundary |','| --- | --- | --- | --- | --- | --- |',...descriptors.map(d=>'| '+[d.sourceByte,'0x'+d.mask.toString(16),d.canonicalLabel,d.techniques.map(s=>s.hexId+' '+(s.name??'(unnamed)')).join('; '),d.status,d.handler+'. '+d.boundary].map(x=>String(x).replaceAll('|','/')).join(' | ')+' |'),'','## Unused dictionary rows','',...unusedSourceRows.map(r=>'- Byte '+r.byte+' mask '+r.mask+': '+r.label+' — data-only.'),'','## Project rules','',...report.projectRules.map(r=>'- '+r.rule+': '+r.status+'. '+(r.boundary??r.handler)), ''].join('\n');
fs.mkdirSync('docs/phase-2k-h',{recursive:true});
for(const [name,content] of [['effect-coverage.json',json],['effect-coverage.md',md]]){
 const path='docs/phase-2k-h/'+name;
 if(process.argv.includes('--write-report'))fs.writeFileSync(path,content);
 else assert.equal(fs.readFileSync(path,'utf8').replaceAll('\r\n','\n'),content,'Effect coverage drift: regenerate and review '+name);
}
console.log('PASS exhaustive effect coverage: '+report.classifiedOccurrences+' occurrences, '+descriptors.length+' groups, '+unusedSourceRows.length+' unused dictionary rows.');
