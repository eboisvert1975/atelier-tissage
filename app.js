'use strict';
const $ = id => document.getElementById(id);
const palette = [
  {name:'Écru',hex:'#E9DFC9'},{name:'Rouge brique',hex:'#A94B3D'},
  {name:'Ocre',hex:'#C99A36'},{name:'Bleu',hex:'#416A8A'},
  {name:'Vert',hex:'#58745A'},{name:'Noir',hex:'#303030'}
];
const STORAGE_KEY='atelier-tissage-draft-v2';
function freshDraft(){return {version:2,name:'Mon premier patron',shafts:4,pedals:6,mode:'sinking',threading:Array.from({length:16},(_,i)=>i%4),tieUp:Array.from({length:4},(_,s)=>Array.from({length:6},(_,p)=>p===s%2)),treadling:Array.from({length:8},(_,i)=>Array.from({length:6},(_,p)=>p===i%2)),warpColors:Array.from({length:16},(_,i)=>i%4+1),weftColors:Array(8).fill(0)}}
let draft=freshDraft();
function notify(message){$('message').textContent=message}
function normalizeDraft(raw){
  const shafts=Number(raw.shafts),pedals=Number(raw.pedals);
  if(![4,8].includes(shafts)||![4,6,8,10,12].includes(pedals))throw Error('Configuration du métier invalide.');
  if(!Array.isArray(raw.threading)||!raw.threading.length||!Array.isArray(raw.tieUp)||!Array.isArray(raw.treadling)||!raw.treadling.length)throw Error('Le patron ne contient pas toutes les matrices nécessaires.');
  const threading=raw.threading.map(Number);
  if(!threading.every(x=>Number.isInteger(x)&&x>=0&&x<shafts))throw Error('Le passage en lisses contient un numéro de cadre invalide.');
  const tieUp=raw.tieUp.map(row=>Array.from({length:pedals},(_,p)=>Boolean(row?.[p])));
  if(tieUp.length!==shafts)throw Error('Le nombre de lignes de l’attachage ne correspond pas aux cadres.');
  const treadling=raw.treadling.map(row=>{if(!Array.isArray(row))throw Error('Une ligne de marchure est invalide.');return Array.from({length:pedals},(_,p)=>Boolean(row[p]));});
  const warpColors=threading.map((_,i)=>validColorIndex(raw.warpColors?.[i]));
  const weftColors=treadling.map((_,i)=>validColorIndex(raw.weftColors?.[i]));
  return {version:2,name:String(raw.name||'Patron importé').slice(0,80),shafts,pedals,mode:raw.mode==='rising'?'rising':'sinking',threading,tieUp,treadling,warpColors,weftColors};
}
function validColorIndex(value){const n=Number(value);return Number.isInteger(n)&&n>=0&&n<palette.length?n:0}
function saveLocal(showMessage=false){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(draft));if(showMessage)notify('Patron enregistré sur cet appareil.')}catch(e){notify('Impossible de sauvegarder : espace de stockage indisponible.')}}
function changed(message='Modifications enregistrées automatiquement.'){render();saveLocal();notify(message)}
function warpUp(shaft,pick){const connected=draft.treadling[pick].some((pressed,p)=>pressed&&draft.tieUp[shaft][p]);return draft.mode==='rising'?connected:!connected}
function renderDrawdown(){const box=$('drawdownGrid');box.replaceChildren();draft.treadling.forEach((_,pick)=>{const row=document.createElement('div');row.className='weave-row';draft.threading.forEach((shaft,end)=>{const cell=document.createElement('div');cell.className='weave-cell';const up=warpUp(shaft,pick);const ci=up?draft.warpColors[end]:draft.weftColors[pick];cell.style.background=palette[ci].hex;cell.title=`Duite ${pick+1} · Fil ${end+1} · ${up?'Chaîne au-dessus':'Trame au-dessus'}`;row.appendChild(cell)});box.appendChild(row)})}
function renderThreading(){const box=$('threadingEditor');box.replaceChildren();draft.threading.forEach((shaft,i)=>{const row=document.createElement('div');row.className='editor-row';const label=document.createElement('span');label.className='row-label';label.textContent=`Fil ${i+1}`;const select=document.createElement('select');for(let s=0;s<draft.shafts;s++){const option=new Option(`Cadre ${s+1}`,String(s));option.selected=s===shaft;select.add(option)}select.addEventListener('change',()=>{draft.threading[i]=Number(select.value);changed()});row.append(label,select);box.append(row)})}
function renderMatrix(targetId,matrix,rowLabel,columnPrefix,onToggle){const box=$(targetId);box.replaceChildren();const grid=document.createElement('div');grid.className='matrix';grid.style.gridTemplateColumns=`75px repeat(${draft.pedals},38px)`;const corner=document.createElement('div');grid.append(corner);for(let p=0;p<draft.pedals;p++){const h=document.createElement('div');h.className='head';h.textContent=`${columnPrefix}${p+1}`;grid.append(h)}matrix.forEach((row,r)=>{const h=document.createElement('div');h.className='rowhead';h.textContent=`${rowLabel} ${r+1}`;grid.append(h);row.forEach((active,c)=>{const b=document.createElement('button');b.type='button';b.className=active?'selected':'';b.textContent=active?'●':'○';b.setAttribute('aria-label',`${rowLabel} ${r+1}, ${columnPrefix}${c+1}, ${active?'actif':'inactif'}`);b.addEventListener('click',()=>onToggle(r,c));grid.append(b)})});box.append(grid)}
function renderColors(targetId,items,prefix,onChange){const box=$(targetId);box.replaceChildren();items.forEach((color,i)=>{const row=document.createElement('div');row.className='color-row';const label=document.createElement('label');label.textContent=`${prefix} ${i+1}`;const select=document.createElement('select');palette.forEach((c,index)=>select.add(new Option(c.name,String(index))));select.value=String(color);select.addEventListener('change',()=>onChange(i,Number(select.value)));const chip=document.createElement('span');chip.className='color-chip';chip.style.background=palette[color].hex;row.append(label,select,chip);box.append(row)})}
function render(){ $('draftName').textContent=draft.name;$('nameInput').value=draft.name;$('shafts').value=String(draft.shafts);$('pedals').value=String(draft.pedals);$('mode').value=draft.mode;$('dimensions').textContent=`${draft.threading.length} fils × ${draft.treadling.length} duites`;
 renderDrawdown();renderThreading();renderMatrix('tieupEditor',draft.tieUp,'Cadre','P',(r,c)=>{draft.tieUp[r][c]=!draft.tieUp[r][c];changed()});renderMatrix('treadlingEditor',draft.treadling,'Duite','P',(r,c)=>{draft.treadling[r][c]=!draft.treadling[r][c];changed()});renderColors('warpColorsEditor',draft.warpColors,'Fil',(i,v)=>{draft.warpColors[i]=v;changed()});renderColors('weftColorsEditor',draft.weftColors,'Duite',(i,v)=>{draft.weftColors[i]=v;changed()});$('removeEnd').disabled=draft.threading.length<=1;$('removePick').disabled=draft.treadling.length<=1;}
$('addEnd').addEventListener('click',()=>{draft.threading.push(((draft.threading.at(-1)+1)%draft.shafts));draft.warpColors.push(draft.warpColors.at(-1)??0);changed('Fil ajouté.')});
$('removeEnd').addEventListener('click',()=>{if(draft.threading.length<=1)return;draft.threading.pop();draft.warpColors.pop();changed('Dernier fil supprimé.')});
$('addPick').addEventListener('click',()=>{draft.treadling.push([...draft.treadling.at(-1)]);draft.weftColors.push(draft.weftColors.at(-1)??0);changed('Duite ajoutée.')});
$('removePick').addEventListener('click',()=>{if(draft.treadling.length<=1)return;draft.treadling.pop();draft.weftColors.pop();changed('Dernière duite supprimée.')});
$('shafts').addEventListener('change',e=>{const n=Number(e.target.value);draft.shafts=n;draft.threading=draft.threading.map(s=>s%n);draft.tieUp=Array.from({length:n},(_,s)=>Array.from({length:draft.pedals},(_,p)=>Boolean(draft.tieUp[s]?.[p])));changed('Nombre de cadres modifié. Vérifie le passage et l’attachage.')});
$('pedals').addEventListener('change',e=>{const n=Number(e.target.value);draft.pedals=n;draft.tieUp=draft.tieUp.map(row=>Array.from({length:n},(_,p)=>Boolean(row[p])));draft.treadling=draft.treadling.map(row=>Array.from({length:n},(_,p)=>Boolean(row[p])));changed('Nombre de pédales modifié. Vérifie la marchure.')});
$('mode').addEventListener('change',e=>{draft.mode=e.target.value;changed('Mécanisme modifié; dessin recalculé.')});
$('nameInput').addEventListener('change',e=>{draft.name=e.target.value.trim()||'Nouveau patron';changed('Nom du patron mis à jour.')});
document.querySelectorAll('.tab').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===button));document.querySelectorAll('.editor').forEach(s=>s.classList.toggle('hidden',s.id!==button.dataset.tab))}));
$('saveButton').addEventListener('click',()=>saveLocal(true));
$('exportJSON').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(draft,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=(draft.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'patron')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Fichier JSON exporté.')});
$('importButton').addEventListener('click',()=>$('importFile').click());
$('importFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{draft=normalizeDraft(JSON.parse(await file.text()));changed('Patron importé et sauvegardé.')}catch(error){notify('Importation impossible : '+error.message)}finally{e.target.value=''}});
try{const saved=localStorage.getItem(STORAGE_KEY);if(saved)draft=normalizeDraft(JSON.parse(saved))}catch(e){notify('Sauvegarde précédente invalide; un nouveau patron est chargé.')}
render();
