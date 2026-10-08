import {session} from './cap.mjs';
import fs from 'fs';
const fixsrc=fs.readFileSync('final.mjs','utf8').match(/const fix=`([\s\S]*?)`;\nconst shot/)[1];
const O='../shots2x';fs.mkdirSync(O,{recursive:true});
for(const lang of ['en','ar']){
 const s=await session('patient',{w:412,h:2600,dpr:2});const p=s.p;
 await p.goto('http://localhost:5175/patient/results');await p.waitForTimeout(1800);
 await p.addStyleTag({content:'html,body{overflow-x:hidden!important} header,.appbar,[class*=topbar]{position:static!important}'});
 if(lang==='ar'){await p.click('text=العربية');await p.waitForTimeout(1500);}
 await p.evaluate(fixsrc);await p.waitForTimeout(300);
 await p.screenshot({path:`${O}/phfull_${lang}.png`});
 console.log(lang,await p.evaluate(()=>document.documentElement.scrollHeight));
 await s.b.close();}
