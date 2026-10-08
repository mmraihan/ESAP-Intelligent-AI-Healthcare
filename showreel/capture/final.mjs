import {session} from './cap.mjs';
import fs from 'fs';
const O=process.env.OUT||'../shots2';fs.mkdirSync(O,{recursive:true});const U='http://localhost:5175';
const fix=`(()=>{
const re=/[\\w.+-]+@[\\w.-]+\\.\\w+/g;const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(re.test(n.nodeValue))n.nodeValue=n.nodeValue.replace(re,'••••••@••••••')}
document.querySelectorAll('input').forEach(i=>{if(/@/.test(i.value))i.value='••••••'});
function hsl(r,g,b){r/=255;g/=255;b/=255;const M=Math.max(r,g,b),m=Math.min(r,g,b);let h=0,s=0,l=(M+m)/2;if(M!=m){const d=M-m;s=l>.5?d/(2-M-m):d/(M+m);h=M==r?(g-b)/d+(g<b?6:0):M==g?(b-r)/d+2:(r-g)/d+4;h*=60}return[h,s,l]}
function rgb(h,s,l){h/=360;const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;const f=t=>{if(t<0)t+=1;if(t>1)t-=1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p};return[f(h+1/3),f(h),f(h-1/3)].map(x=>Math.round(x*255))}
function map(c){const m=c.match(/rgba?\\(([^)]+)\\)/);if(!m)return c;const p=m[1].split(/[ ,\\/]+/).map(Number);const[h,s,l]=hsl(p[0],p[1],p[2]);if(s<.2)return c;
 let nh=null;if(h<75||h>335)nh=212;else if(h>=75&&h<=165)nh=190;if(nh===null)return c;const[r,g,b]=rgb(nh,Math.min(s,.75),l);return p.length>3&&p[3]!==undefined&&!isNaN(p[3])?'rgba('+r+','+g+','+b+','+p[3]+')':'rgb('+r+','+g+','+b+')'}
document.querySelectorAll('*').forEach(e=>{const cs=getComputedStyle(e);
 ['color','backgroundColor','borderTopColor','borderRightColor','borderBottomColor','borderLeftColor','outlineColor'].forEach(k=>{const v=cs[k];const nv=map(v);if(nv!==v)e.style.setProperty(k.replace(/[A-Z]/g,x=>'-'+x.toLowerCase()),nv,'important')});
 if(e instanceof SVGElement){['fill','stroke'].forEach(k=>{const v=cs[k];if(v&&v.startsWith('rgb')){const nv=map(v);if(nv!==v)e.style.setProperty(k,nv,'important')}})}
 const bg=cs.backgroundImage;if(bg&&bg!=='none'&&/rgb/.test(bg)){e.style.setProperty('background-image',bg.replace(/rgba?\\([^)]+\\)/g,x=>map(x)),'important')}
});})()`;
const shot=async(p,name,opts={})=>{await p.evaluate(fix);await p.waitForTimeout(250);await p.screenshot({path:`${O}/${name}.png`,...opts});};
const go=async(p,r,w=1900)=>{await p.goto(U+r);await p.waitForTimeout(w);};
let s=await session('doctor');let p=s.p;
await go(p,'/doctor/worklist');await shot(p,'d_worklist');
await go(p,'/doctor/encounters/enc_1010/results',2300);await shot(p,'d_res_top');
await p.mouse.wheel(0,640);await p.waitForTimeout(500);await shot(p,'d_res_mid');
await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(500);await shot(p,'d_res_bottom');
await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(300);
await p.locator('button:has-text("Why?")').first().click();await p.waitForTimeout(1500);await shot(p,'d_why');
await go(p,'/doctor/discharge');await shot(p,'d_discharge');
await go(p,'/doctor/encounters/enc_1010/intake');await shot(p,'d_intake');
await p.mouse.wheel(0,820);await p.waitForTimeout(500);await shot(p,'d_intake2');
await go(p,'/doctor/encounters/enc_1010/timeline');await shot(p,'d_timeline');
await s.b.close();
s=await session('nurse');p=s.p;
await go(p,'/nurse/roster');await shot(p,'n_roster');await go(p,'/nurse/handoff');await shot(p,'n_handoff');await s.b.close();
s=await session('admin');p=s.p;
for(const [r,n] of [['/admin/home','a_home'],['/admin/roster','a_roster'],['/admin/audit','a_audit'],['/admin/roles','a_roles']]){await go(p,r);await shot(p,n);}
await s.b.close();
s=await session('ops');p=s.p;await go(p,'/ops/fleet');await shot(p,'o_fleet_cards');await p.click('text=Table').catch(()=>{});await p.waitForTimeout(700);await shot(p,'o_fleet');await s.b.close();
s=await session('patient');p=s.p;await go(p,'/patient/results');await shot(p,'p_en');await p.click('text=العربية');await p.waitForTimeout(1500);await shot(p,'p_ar');await s.b.close();
for(const [lang,n] of [['en','ph_en'],['ar','ph_ar']]){
 s=await session('patient',{w:412,h:892,dpr:+(process.env.PDPR||3)});p=s.p;await go(p,'/patient/results');
 await p.addStyleTag({content:'html,body{overflow-x:hidden!important}'});
 if(lang==='ar'){await p.click('text=العربية');await p.waitForTimeout(1500);}
 await shot(p,n);await p.mouse.wheel(0,430);await p.waitForTimeout(500);await shot(p,n+'2');await s.b.close();}
console.log('done');
