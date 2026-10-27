// Real React Native Web components with a deterministic SDK fixture; native launches are tested in Paseo.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const mock = `
import { createElement, useSyncExternalStore } from 'react';
import { Text } from 'react-native';
// Host icons are represented at their actual size here; verify Lucide artwork in Paseo.
export const Icon=({size,color})=>createElement(Text,{style:{fontSize:size,width:size,height:size,lineHeight:size,color},'aria-hidden':true},'◇');
const states = {sessions:{values:{sessions:[],projectGroups:[],legacyWindowsImported:false},revision:'0'},windows:{values:{windows:[]},revision:'0'}};
const listeners = new Set();
export const usePaseo = () => api;
export const useWorkspace = (_,select) => select({projectId:'plugins',projectDisplayName:'Plugins'});
export const useSettings = (contract) => {
 const id=contract.id;
 const snapshot = useSyncExternalStore(cb=>{listeners.add(cb);return()=>listeners.delete(cb)},()=>states[id]);
 return {...snapshot,status:'ready',saving:false,saveError:null,reload:async()=>{},
 save:async(values,revision)=>{if(revision!==states[id].revision)return false;
 states[id]={values,revision:String(Number(states[id].revision)+1)};window.fixtureValues=states;listeners.forEach(f=>f());return true;}};
};
const projects = [ ['plugins','Plugins'],['website','Website'],['design','Design'] ].map(([id,name])=>({projectId:id,projectKey:id,projectDisplayName:name,projectRootPath:'/projects/'+id,projectKind:'directory'}));
const api = {projects:{list:async()=>({projects}),subscribe:()=>()=>{}},workspaces:{list:async({filter})=>({entries:[{id:'workspace-'+filter.projectId}]}),open:async()=>{throw Error('Unexpected creation')}}};
`;
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {View} from 'react-native';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {WindowSettings} from './client/settings';
import {WindowMenu} from './client/menu';
window.paseoDesktop={window:{openNew:async()=>{}}};
const dark=location.search.includes('dark');
const compact=location.search.includes('compact');
const theme={colors:dark?{surface0:'#12141c',surface1:'#1e202c',surface2:'#292c3a',border:'#383d4d',borderAccent:'#4a5062',foreground:'#f5f5fb',foregroundMuted:'#aaaebe',accent:'#356bd5',accentForeground:'#fff',statusDanger:'#f19494'}:{surface0:'#fff',surface1:'#f6f7fa',surface2:'#e8ebf1',border:'#cbd0db',borderAccent:'#aeb6c5',foreground:'#19202d',foregroundMuted:'#576174',accent:'#285cc0',accentForeground:'#fff',statusDanger:'#ad2929'}};
const state={busy:false,message:null,error:null};
const launcher={subscribe:()=>()=>{},getSnapshot:()=>state,run:async(prepare)=>{window.launched=await prepare();},dispose:()=>{}};
const props={theme,host:{id:'test-host',label:'Test host'},layout:{compact},launcher,workspaceId:'workspace-plugins',openSetup:()=>{}};
document.body.style.margin='0';document.body.style.background=theme.colors.surface0;
createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><View style={{padding:compact?16:32,maxWidth:900,marginHorizontal:'auto',gap:32}}><WindowSettings {...props}/><WindowMenu {...props}/></View></QueryClientProvider>);
`;
await mkdir('test-output',{recursive:true});
const result=await build({stdin:{contents:entry,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},alias:{'react-native':'react-native-web'},plugins:[{name:'fixture',setup(b){b.onResolve({filter:/^@getpaseo\/plugin\/client(?:\/ui)?$/},()=>({path:'fixture',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:mock,loader:'js',resolveDir:process.cwd()}));}}]});
const js=result.outputFiles[0]!.text;
const server=createServer((req,res)=>{if(req.url?.startsWith('/app.js')){res.setHeader('Content-Type','text/javascript');res.end(js);}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script src="/app.js"></script>');}});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address() as {port:number};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
try {
 for(const dark of [false,true]) for(const compact of [false,true]) {
  const page=await browser.newPage({viewport:compact?{width:390,height:844}:{width:1280,height:900}});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+address.port+'/?'+(dark?'dark':'light')+(compact?'&compact':''));
  const tab = (name:string) => page.getByRole('tab',{name,exact:true}).click();
  const button = (name:string) => page.getByRole('button',{name,exact:true});
  const mode=(dark?'dark':'light')+'-'+(compact?'compact':'wide');
  await tab('Project groups');
  await button('New project group').click({timeout:5000});
  await button('Save project group').click();
  await page.getByRole('alert').getByText('Enter a name.',{exact:true}).waitFor();
  await page.getByRole('textbox',{name:'Project group name',exact:true}).fill('My tools');
  await page.getByRole('checkbox',{name:'Plugins',exact:true}).click();
  await page.getByRole('checkbox',{name:'Design',exact:true}).click();
  await tab('About');
  await tab('Project groups');
  assert.equal(await page.getByRole('textbox',{name:'Project group name',exact:true}).inputValue(),'My tools');
  await button('Save project group').click();
  await button('My tools').click();
  await page.waitForFunction(()=> (window as any).launched?.length===1);
  assert.deepEqual(await page.evaluate(()=> (window as any).launched[0].projectKeys),['plugins','design']);
  await tab('Sessions manager');
  await button('New session').click();
  await page.getByLabel('Session name',{exact:true}).fill('Main');
  await button('Save session').click();
  await page.getByRole('alert').getByText('Add at least one project group.',{exact:true}).waitFor();
  await button('Add existing project group').click();
  await button('Add My tools').click();
  await button('Add new project group').click();
  await page.getByRole('textbox',{name:'Project group name',exact:true}).nth(1).fill('Website');
  await page.getByRole('checkbox',{name:'Website',exact:true}).nth(1).click();
  await page.screenshot({path:'test-output/editor-'+mode+'.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow: '+mode);
  await button('Save session').click();
  await button('Main').click();
  await page.waitForFunction(()=> (window as any).launched?.length===2);
  assert.deepEqual(await page.evaluate(()=> (window as any).launched.map((w:any)=>w.projectKeys)),[['plugins','design'],['website']]);
  assert.equal(await page.evaluate(()=> (window as any).fixtureValues.sessions.values.projectGroups.length),2);
  // A second session references the same group, rather than making a copy.
  await button('New session').click();
  await page.getByLabel('Session name',{exact:true}).fill('Secondary');
  await button('Add existing project group').click();
  await button('Add My tools').click();
  await page.getByRole('textbox',{name:'Project group name',exact:true}).fill('Shared tools');
  await button('Save session').click();
  await tab('Project groups');
  await page.getByRole('link',{name:'Secondary',exact:true}).waitFor();
  await button('Edit project group').first().click();
  await page.getByRole('checkbox',{name:'Design',exact:true}).click();
  await button('Save project group').click();
  await button('Main').click();
  await page.waitForFunction(()=> (window as any).launched?.length===2);
  assert.deepEqual(await page.evaluate(()=> (window as any).launched.map((w:any)=>w.projectKeys)),[['plugins'],['website']]);
  await button('Secondary').click();
  await page.waitForFunction(()=> (window as any).launched?.length===1);
  assert.deepEqual(await page.evaluate(()=> (window as any).launched[0].projectKeys),['plugins']);
  await page.screenshot({path:'test-output/project-groups-'+mode+'.png',fullPage:true});
  // Membership links navigate to the matching session editor.
  await page.getByRole('link',{name:'Secondary',exact:true}).click();
  assert.equal(await page.getByLabel('Session name',{exact:true}).inputValue(),'Secondary');
  // An edit in another tab preserves the draft and blocks stale writes.
  await tab('Project groups');
  await button('Edit project group').first().click();
  await page.getByRole('textbox',{name:'Project group name',exact:true}).fill('Shared renamed');
  await button('Save project group').click();
  await tab('Sessions manager');
  assert.equal(await button('Save session').isDisabled(),true);
  await button('Cancel').click();
  await button('Edit session').first().click();
  await button('Remove project group 1').click();
  await button('Save session').click();
  assert.equal(await page.evaluate(()=> (window as any).fixtureValues.sessions.values.projectGroups.length),2,'Removal preserves library group');
  await page.screenshot({path:'test-output/sessions-'+mode+'.png',fullPage:true});
  // Session deletion keeps its groups; group deletion unlinks it from all sessions.
  await button('Delete').first().click();
  await button('Delete session').click();
  assert.equal(await page.evaluate(()=> (window as any).fixtureValues.sessions.values.projectGroups.length),2);
  await tab('Project groups');
  await button('Delete project group').first().click();
  await button('Delete project group').first().click();
  assert.deepEqual(await page.evaluate(()=> (window as any).fixtureValues.sessions.values.sessions[0].projectGroupIds),[]);
  assert.equal(await button('Secondary').isDisabled(),true);
  await tab('Sessions manager');
  assert.equal(await button('Open all windows').isDisabled(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS '+mode+': shared groups, new/existing membership, editing from both tabs, launch resolution, conflicts, deletion, layout');
  await page.close();
 }
} finally {await browser.close();server.close();}
