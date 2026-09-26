import { el } from './dom.js';
import { download } from '../stl.js';
import { CALIBRATIONS } from '../calibration.js';
import { captureProject, openProject, loadCalibration, markSavedVersion } from './project.js';
import { exportReady } from './export-state.js';

const dialog=el('library-dialog'), message=el('library-message'), list=el('library-list');
let saving=false, pending=null, cursor=null, refreshing;
const say=text=>{message.textContent=text;};
async function api(path, body, retry=true) {
  const response=await fetch('/api'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',
    headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  if(response.status===401 && retry && !path.startsWith('/auth/')) {
    refreshing ||= fetch('/api/auth/refresh',{method:'POST',credentials:'same-origin'}).finally(()=>{refreshing=null;});
    if((await refreshing).ok) return api(path,body,false);
  }
  let data;
  try { data=await response.json(); } catch { throw new Error('Histórico indisponível neste endereço. Use o site publicado da Dowell.'); }
  if(!response.ok) {
    if(response.status===401) el('library-login').hidden=false;
    throw new Error(data.error || 'Não foi possível acessar a AWS.');
  }
  el('library-login').hidden=true;
  return data;
}
function show() { if(!dialog.open) dialog.showModal(); }
function syncSave() {
  const disabled=saving || (!pending && !exportReady());
  el('save-library').disabled=el('library-save-now').disabled=disabled;
  el('library-save-now').textContent=pending?'Tentar salvar novamente':'Salvar peça aberta';
}
el('library-save-now').addEventListener('click',()=>el('save-library').click());
addEventListener('sf-export-state',syncSave);
el('library-close').addEventListener('click',()=>dialog.close());
el('open-library').addEventListener('click',()=>{show(); refreshList();});
el('library-refresh').addEventListener('click',()=>refreshList());
el('library-more').addEventListener('click',()=>refreshList(true));

const button=(label,action)=>{
  const b=document.createElement('button'); b.type='button'; b.className='btn sm'; b.textContent=label;
  b.addEventListener('click',async()=>{ b.disabled=true;try{await action();}catch(e){say(e.message);}finally{b.disabled=false;} });
  return b;
};
const labels={untested:'Ainda não testada',approved:'Aprovada',adjust:'Precisa de ajuste',failed:'Falhou'};
function renderItem(item, prepend=false) {
  const existing=list.querySelector(`[data-project-id="${item.id}"]`); if(existing)existing.remove();
  const card=document.createElement('article');card.className='library-card';card.dataset.projectId=item.id;
  const title=document.createElement('h3');title.textContent=item.name;
  const info=document.createElement('p');
  info.textContent=`${new Date(item.createdAt).toLocaleString('pt-BR')} · ${item.creatorName || 'Dowell'} · ${item.summary.material.toUpperCase()} · ${item.summary.size.map(v=>v.toFixed(1)).join(' × ')} mm`;
  const settings=document.createElement('p'); settings.textContent=`Bico 1,6 · camadas ${item.summary.firstLayer}/${item.summary.layer} · folga ${item.summary.gap} mm`;
  const notes=document.createElement('p');notes.textContent=item.notes || '';
  const actions=document.createElement('div');actions.className='library-actions';
  actions.append(button('Reabrir para editar',async()=>{
    if(saving)throw new Error('Aguarde o salvamento em andamento.');
    const data=await api(`/support-fins/projects/${item.id}/files`);
    const [state,source]=await Promise.all([fetchFile(data,'project.json','json'),fetchFile(data,'source.stl','arrayBuffer')]);
    openProject(state,source,item.id);el('library-name').value=item.name;el('library-notes').value=item.notes || '';
    pending=null; el('save-library').textContent='Salvar nova versão'; syncSave(); dialog.close();
  }));
  for(const [name,label] of [['generated.stl','Baixar STL'],['generated.3mf','Baixar 3MF']]) actions.append(button(label,async()=>{
    const data=await api(`/support-fins/projects/${item.id}/files`);
    download(await fetchFile(data,name,'blob'),`${item.name.replace(/[^\p{L}\p{N}_-]/gu,'_')}.${name.split('.').pop()}`);
    say('Arquivo salvo na versão selecionada baixado.');
  }));
  const details=document.createElement('details'), summary=document.createElement('summary');
  summary.textContent=`Resultado físico: ${labels[item.result?.verdict] || labels.untested}`;
  const verdict=document.createElement('select');verdict.setAttribute('aria-label',`Resultado de ${item.name}`);
  for(const [value,label] of Object.entries(labels))verdict.add(new Option(label,value));
  verdict.value=item.result?.verdict || 'untested';
  const note=document.createElement('textarea');note.maxLength=2000;note.rows=3;note.value=item.result?.notes || '';
  note.placeholder='Aderência, esforço para remover, marcas, acabamento inferior…';note.setAttribute('aria-label',`Observações de ${item.name}`);
  details.append(summary,verdict,note,button('Registrar resultado',async()=>{
    const data=await api(`/support-fins/projects/${item.id}/result`,{verdict:verdict.value,notes:note.value});
    summary.textContent=`Resultado físico: ${labels[data.result.verdict]}`;say('Resultado registrado.');
  }));
  card.append(title,info,settings,notes,actions,details);
  prepend?list.prepend(card):list.append(card);
}
async function fetchFile(data,name,kind) {
  const response=await fetch(data.files[name].url,{credentials:'omit'});
  if(!response.ok)throw new Error('Não foi possível baixar o arquivo. Atualize o histórico e tente novamente.');
  return response[kind]();
}
async function refreshList(more=false) {
  const b=el('library-refresh');b.disabled=true;
  try {
    say('Carregando histórico…');
    const data=await api('/support-fins/projects'+(more&&cursor?'?cursor='+encodeURIComponent(cursor):''));
    if(!more)list.replaceChildren();
    for(const item of data.items)renderItem(item);
    cursor=data.cursor;el('library-more').hidden=!cursor;
    say(list.children.length?'Histórico privado da equipe Dowell.':'Ainda não há peças salvas.');
  } catch(e){say(e.message);}finally{b.disabled=false;}
}
async function sha256(blob) {
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()));
  return btoa(String.fromCharCode(...bytes));
}
el('save-library').addEventListener('click',async()=>{
  if(saving)return;
  show();saving=true;syncSave();
  try {
    // An uncertain response retries this SAME version and exact blobs.
    pending ||= captureProject(el('library-name').value,el('library-notes').value);
    say('Preparando os arquivos desta versão…');
    const files={};
    for(const [name,blob] of Object.entries(pending.blobs))files[name]={size:blob.size,sha256:await sha256(blob)};
    const {blobs,modelSerial,...metadata}=pending;
    const request=await api('/support-fins/projects',{...metadata,files});
    if(!request.ready) {
      for(const [name,upload] of Object.entries(request.uploads)) {
        say(`Salvando ${name} no S3…`);
        const r=await fetch(upload.url,{method:'PUT',headers:upload.headers,body:blobs[name],credentials:'omit'});
        // A retry of an already uploaded immutable object returns 412. Complete
        // still checks the exact length + checksum before making it visible.
        if(!r.ok && r.status!==412)throw new Error(`Falha ao enviar ${name}. Use Tentar novamente.`);
      }
      await api(`/support-fins/projects/${pending.id}/complete`,{});
    }
    const savedId=pending.id;
    const data=await api(`/support-fins/projects/${savedId}/files`);
    markSavedVersion(savedId,modelSerial);
    pending=null;renderItem(data.item,true);say('Versão salva no S3. Você pode reabrir e registrar o teste físico.');
    el('save-library').textContent='Salvar nova versão';
  } catch(e){say(e.message);el('save-library').textContent=pending?'Tentar salvar novamente':'Salvar no histórico';}
  finally{saving=false;syncSave();}
});
el('library-login-form').addEventListener('submit',async e=>{
  e.preventDefault();const b=el('library-login-submit');b.disabled=true;
  try {
    const r=await api('/auth/login',{username:el('library-user').value,password:el('library-password').value},false);
    el('library-password').value='';
    if(r.challenge)throw new Error('Conclua a atualização de senha no painel Dowell e volte para esta aba.');
    await refreshList();say(pending?'Conectado. Clique em Tentar salvar novamente.':'Conectado ao histórico Dowell.');
  } catch(e){say(e.message);}finally{b.disabled=false;}
});

for(const test of CALIBRATIONS) {
  const card=document.createElement('article');card.className='library-card';
  const h=document.createElement('h3');h.textContent=test.name;
  const p=document.createElement('p');p.textContent=test.description;
  card.append(h,p,button('Gerar este teste',()=>{
    if(saving)throw new Error('Aguarde o salvamento em andamento.');
    loadCalibration(test.id);el('library-name').value=test.name.replace(' · ',' - ');
    el('library-notes').value=test.description;pending=null;el('save-library').textContent='Salvar no histórico';
    syncSave();dialog.close();
  }));
  el('calibration-list').append(card);
}
syncSave();
