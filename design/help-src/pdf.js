const { chromium } = require('playwright'); const S=process.argv[2];
(async()=>{const b=await chromium.launch();
for(const k of ['kino','knigi']){
  const p=await b.newPage(); await p.goto('file://'+S+'/'+k+'.html'); await p.waitForTimeout(500);
  await p.pdf({path:S+'/'+k+'.pdf',width:'210mm',height:'297mm',printBackground:true,preferCSSPageSize:true,margin:{top:0,right:0,bottom:0,left:0}});
  // превью страниц
  await p.setViewportSize({width:794,height:1123});
  const n=await p.$$eval('.page',x=>x.length);
  for(let i=0;i<n;i++){ const el=(await p.$$('.page'))[i]; await el.screenshot({path:`${S}/${k}-p${i+1}.png`}); }
  // проверка: ничего не вылезает за страницу
  const over=await p.$$eval('.page',ps=>ps.map((pg,i)=>{const r=pg.getBoundingClientRect();const f=pg.querySelector('.foot').getBoundingClientRect();let m=0;pg.querySelectorAll('*').forEach(e=>{if(e.closest('.foot'))return;const b=e.getBoundingClientRect();if(b.height&&b.bottom>m)m=b.bottom;});return [i+1,Math.round(f.top-m)];}));
  console.log(k,'gap above footer (px):',JSON.stringify(over));
}
await b.close();})();
