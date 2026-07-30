let activeConfirmation=null;

export function showConfirmationDialog(options,{document:doc=globalThis.document,requestFrame=globalThis.requestAnimationFrame}={}){
  if(activeConfirmation)return activeConfirmation;
  const {title,message,confirmLabel,cancelLabel='Cancelar',tone='warning',trigger=doc.activeElement}=options;
  activeConfirmation=new Promise(resolve=>{
    const dialog=doc.createElement('dialog');
    const id=`confirmation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    dialog.className='confirmation-dialog';dialog.dataset.tone=tone;
    dialog.setAttribute('aria-labelledby',`${id}-title`);dialog.setAttribute('aria-describedby',`${id}-description`);
    dialog.innerHTML=`<form method="dialog"><div class="confirmation-dialog__body"><h2 id="${id}-title"></h2><p id="${id}-description"></p></div><footer class="confirmation-dialog__actions"><button type="button" class="secondary-button confirmation-cancel"></button><button type="button" class="primary-button confirmation-confirm"></button></footer></form>`;
    dialog.querySelector('h2').textContent=title;dialog.querySelector('p').textContent=message;
    const cancel=dialog.querySelector('.confirmation-cancel'),confirm=dialog.querySelector('.confirmation-confirm');
    cancel.textContent=cancelLabel;confirm.textContent=confirmLabel;
    let settled=false;
    const finish=value=>{if(settled)return;settled=true;confirm.disabled=true;cancel.disabled=true;dialog.removeEventListener('cancel',onCancel);cancel.removeEventListener('click',onCancelClick);confirm.removeEventListener('click',onConfirm);if(dialog.open)dialog.close();dialog.remove();activeConfirmation=null;resolve(value);requestFrame?.(()=>trigger?.isConnected&&trigger.focus());};
    const onCancel=event=>{event.preventDefault();finish(false);};
    const onCancelClick=()=>finish(false),onConfirm=()=>finish(true);
    dialog.addEventListener('cancel',onCancel);cancel.addEventListener('click',onCancelClick);confirm.addEventListener('click',onConfirm);
    doc.body.append(dialog);dialog.showModal();requestFrame?.(()=>cancel.focus());
  });
  return activeConfirmation;
}
