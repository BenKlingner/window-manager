// Capture the real plugin UI with fictional data. Never connect to a Paseo daemon.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const fixture = `
import {createElement, useSyncExternalStore} from 'react';
// Lucide geometry; license shipped in assets/lucide-LICENSE.txt.
const shapes = {
 PanelsTopLeft: [['rect',{width:18,height:18,x:3,y:3,rx:2}],['path',{d:'M3 9h18'}],['path',{d:'M9 21V9'}]],
 Layers: [['path',{d:'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z'}],['path',{d:'M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12'}],['path',{d:'M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17'}]],
 Info: [['circle',{cx:12,cy:12,r:10}],['path',{d:'M12 16v-4'}],['path',{d:'M12 8h.01'}]],
};
export const Icon=({name,size,color})=>createElement('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:color,strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},shapes[name].map(([tag,attrs],i)=>createElement(tag,{...attrs,key:i})));
const states={
 sessions:{revision:'1',values:{legacyWindowsImported:true,
  projectGroups:[
   {id:'product',name:'Product development',projectIds:['website','api']},
   {id:'resources',name:'Design & docs',projectIds:['design','docs']}
  ],
  sessions:[{id:'daily',name:'Daily workspace',projectGroupIds:['product','resources']}]
 }},
 windows:{revision:'0',values:{windows:[]}}
};
const listeners=new Set();
export const useSettings=(contract)=>{
 const snapshot=useSyncExternalStore(cb=>{listeners.add(cb);return()=>listeners.delete(cb)},()=>states[contract.id]);
 return {...snapshot,status:'ready',saving:false,saveError:null,reload:async()=>{},save:async(values,revision)=>{
  if(revision!==states[contract.id].revision)return false;
  states[contract.id]={values,revision:String(Number(revision)+1)};
  listeners.forEach(cb=>cb());return true;
 }};
};
const projects=[['website','Website'],['api','API'],['design','Design system'],['docs','Documentation']].map(([id,name])=>({projectId:id,projectKey:id,projectDisplayName:name,projectRootPath:'/demo/'+id,projectKind:'directory'}));
export const usePaseo=()=>({projects:{list:async()=>({projects}),subscribe:()=>()=>{}}});
`;

const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {View,Text} from 'react-native';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {WindowSettings} from './client/settings';
window.paseoDesktop={window:{openNew:async()=>{throw Error('Native launches are disabled in this fixture')}}};
const dark=!location.search.includes('light');
const compact=location.search.includes('compact');
const theme={colors:dark?{surface0:'#111615',surface1:'#191f1c',surface2:'#252f29',border:'#354138',borderAccent:'#536559',foreground:'#f2f4ef',foregroundMuted:'#acb7ad',accent:'#b6d2b1',accentForeground:'#172019',statusDanger:'#ed9c9c'}:{surface0:'#fafbf9',surface1:'#ffffff',surface2:'#edf2eb',border:'#d4ddd2',borderAccent:'#a2b29f',foreground:'#20291f',foregroundMuted:'#5e6d5b',accent:'#426b45',accentForeground:'#ffffff',statusDanger:'#b23e3e'}};
const state={busy:false,message:null,error:null};
const launcher={subscribe:()=>()=>{},getSnapshot:()=>state,run:async()=>{throw Error('Launching is disabled in the screenshot fixture')},dispose:()=>{}};
const props={theme,host:{id:'demo-host',label:'Demo host'},layout:{compact},launcher};
document.body.style.margin='0';document.body.style.background=theme.colors.surface0;
createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><View style={{padding:compact?20:40,gap:28,maxWidth:900,marginHorizontal:'auto'}}><Text style={{color:theme.colors.foreground,fontSize:28,fontWeight:'600'}}>Window Manager</Text><WindowSettings {...props}/></View></QueryClientProvider>);
`;

const bundle = await build({
 stdin:{contents:entry,loader:'tsx',resolveDir:process.cwd()},
 bundle:true,write:false,format:'iife',jsx:'automatic',
 define:{'process.env.NODE_ENV':'"production"'},alias:{'react-native':'react-native-web'},
 plugins:[{name:'isolated-demo',setup(b){
  b.onResolve({filter:/^@getpaseo\/plugin\/client(?:\/ui)?$/},()=>({path:'fixture',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:fixture,loader:'js',resolveDir:process.cwd()}));
 }}],
});
const server=createServer((req,res)=>{
 if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0]!.text);}
 else {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Window Manager demo</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>');}
});
await mkdir('assets',{recursive:true});
await mkdir('test-output',{recursive:true});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address() as {port:number};
let browser;
try {
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
 for(const dark of [true,false]) for(const compact of [false,true]) {
  const page=await browser.newPage({viewport:compact?{width:390,height:844}:{width:900,height:800},deviceScaleFactor:2});
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  // Fail closed if a future fixture change tries to reach a host or external service.
  await page.route('**/*',route=>new URL(route.request().url()).origin===('http://127.0.0.1:'+port)?route.continue():route.abort());
  await page.goto('http://127.0.0.1:'+port+'/?'+(dark?'dark':'light')+(compact?'&compact':''));
  await page.getByText('Projects: Website · API',{exact:true}).waitFor();
  for(const [tab,file] of [['Project groups','project-groups'],['Sessions manager','sessions']]) {
   await page.getByRole('tab',{name:tab,exact:true}).click();
   await page.getByText('Daily workspace',{exact:true}).filter({visible:true}).first().waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Horizontal overflow');
   const path=dark&&!compact?'assets/'+file+'.png':'test-output/demo-'+file+'-'+(dark?'dark':'light')+'-'+(compact?'compact':'wide')+'.png';
   await page.screenshot({path,fullPage:true});
   console.log('Captured '+path);
  }
  assert.deepEqual(errors,[]);
  await page.close();
 }
} finally {await browser?.close();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
