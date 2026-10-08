import { chromium } from 'playwright-core';
import fs from 'fs';
const BASE='http://localhost:5175';
const ACC={doctor:'amara.okonkwo@styves.example',nurse:'ines.vasquez@styves.example',admin:'mira.novak@styves.example',ops:'rmoravec@esap.health',patient:'delia.salib@example.com'};
export async function session(role,{w=1920,h=1080,dpr=+(process.env.DPR||1),mobile=false}={}){
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr,isMobile:mobile,hasTouch:mobile,reducedMotion:'no-preference'});
  const p=await ctx.newPage();
  await p.goto(BASE+'/login');
  await p.fill('input[type=email]',ACC[role]);
  await p.fill('input[type=password]','esap-demo');
  await p.click('button:has-text("Sign in"):not([disabled])');
  await p.waitForTimeout(2500);
  return {b,ctx,p};
}
