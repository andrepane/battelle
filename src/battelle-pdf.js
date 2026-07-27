import { displayValue, NOT_APPLICABLE } from './battelle-result-table.js';

export function safePdfFilename(name,date){ const safe=String(name||'Evaluacion').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60)||'Evaluacion'; const d=/^\d{4}-\d{2}-\d{2}$/.test(date||'')?date:'sin-fecha'; return `Battelle_${safe}_${d}.pdf`; }
const latin=s=>String(s).replace(/[\u20ac]/g,'EUR').replace(/[^\x20-\x7e\xA0-\xFF]/g,c=>c===NOT_APPLICABLE?'-':'?').replace(/([\\()])/g,'\\$1');
function pdfDocument(pages){
  const objects=['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',''];
  const pageIds=[];
  for(const lines of pages){const contentId=objects.length+1;objects.push(`<< /Length ${lines.length} >>\nstream\n${lines}\nendstream`);const pageId=objects.length+1;pageIds.push(pageId);objects.push(`<< /Type /Page /Parent 3 0 R /MediaBox [0 0 841.89 595.28] /Resources << /Font << /F1 1 0 R /F2 2 0 R >> >> /Contents ${contentId} 0 R >>`);}
  objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;const catalog=objects.length+1;objects.push('<< /Type /Catalog /Pages 3 0 R >>');
  let out='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=out.length;out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer << /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;return new Uint8Array([...out].map(c=>c.charCodeAt(0)&255));
}
function t(x,y,text,size=8,bold=false){ return `BT /F${bold?2:1} ${size} Tf ${x} ${y} Td (${latin(text)}) Tj ET`; }
export function generateBattellePdf(model){
  if(!model?.rows?.length) throw new TypeError('Modelo de resultados vacío.'); const pages=[]; let commands=[],y=555;
  const header=()=>{ commands.push(t(32,y,'Neurointegra',11,true),t(32,y-18,'Resumen de resultados Battelle',17,true)); y-=42; const m=model.metadata; commands.push(t(32,y,`Paciente: ${m.name||'Sin identificar'}    Nacimiento: ${m.birthDate||'-'}    Evaluación: ${m.assessmentDate||'-'}`,9),t(32,y-14,`Edad cronológica: ${Math.floor((m.ageMonths||0)/12)} años, ${(m.ageMonths||0)%12} meses (${m.ageMonths??'-'} meses)    Corrección: ${m.correctedAt||'-'}    Profesional: ${m.professional||'-'}`,8)); y-=34; row(model.columns,true); };
  const widths=[236,48,48,48,48,48,48,100], xs=widths.reduce((a,w)=>[...a,a.at(-1)+w],[32]);
  const row=(cells,bold=false)=>{ const h=17; commands.push(`0.85 G 32 ${y-h+4} ${widths.reduce((a,b)=>a+b,0)} ${h} re S`); cells.forEach((v,i)=>commands.push(t(xs[i]+3,y,String(v),i?7.5:8,bold))); y-=h; };
  header(); for(const r of model.rows){ if(y<65){ pages.push(commands.join('\n'));commands=[];y=555;header(); } row([r.label,displayValue(r.pd),displayValue(r.pc),displayValue(r.z),displayValue(r.T),displayValue(r.CI),displayValue(r.ECN),displayValue(r.equivalentAge)],r.type!=='subarea'); }
  if(model.warnings.length){ y-=8;commands.push(t(32,y,'Advertencias clínicas',10,true));y-=15; for(const w of model.warnings){commands.push(t(38,y,`${w.item}: ${w.message}`,8));y-=13;} }
  if(y<45){pages.push(commands.join('\n'));commands=[];y=555;} commands.push(t(32,30,'Resultados obtenidos mediante la corrección del Inventario de Desarrollo Battelle. La interpretación corresponde al profesional responsable.',7)); pages.push(commands.join('\n')); return pdfDocument(pages);
}
export function downloadBattellePdf(model,env=globalThis){ const bytes=generateBattellePdf(model); const filename=safePdfFilename(model.metadata.name,model.metadata.assessmentDate); const url=env.URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})); const a=env.document.createElement('a');a.href=url;a.download=filename;a.click();env.URL.revokeObjectURL(url);return {filename,bytes}; }
