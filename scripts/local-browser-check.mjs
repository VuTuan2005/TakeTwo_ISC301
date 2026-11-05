// Native Chrome DevTools smoke check. No design tooling or third-party driver.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const folder = path.resolve('scratch', `qa-${Date.now()}`); mkdirSync(folder,{recursive:true});
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
const server = spawn(process.execPath,['server.js'], { env:{...process.env,PORT:'3107',TAKETWO_DB_PATH:path.join(folder,'qa.db')},windowsHide:true,stdio:['ignore','pipe','pipe'] });
let log=''; server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--remote-debugging-port=9337',`--user-data-dir=${path.join(folder,'chrome')}`],{windowsHide:true,stdio:['ignore','ignore','pipe']});
chrome.stderr.on('data',d=>log+=d);
let ws;
const errors=[];
try {
  for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:3107/api/config');await fetch('http://127.0.0.1:9337/json/version');break;}catch{await sleep(100);}}
  const tabs=await (await fetch('http://127.0.0.1:9337/json')).json();
  const target=tabs.find(t=>t.type==='page'); ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let next=0;const pending=new Map();
  ws.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const p=pending.get(data.id);pending.delete(data.id);data.error?p?.reject(new Error(JSON.stringify(data.error))):p?.resolve(data.result);}if(data.method==='Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text);});
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  ws.addEventListener('message', event => { const d = JSON.parse(event.data); if(d.method === 'Page.javascriptDialogOpening') cdp('Page.handleJavaScriptDialog',{accept:true,promptText:'C?n c? ki?m tra QA'}); });
  const run=async(expression)=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));return r.result?.value;};
  const wait=async(expression)=>{for(let i=0;i<100;i++){try{if(await run(expression))return;}catch(error){if(!/ReferenceError|context|Cannot find/i.test(error.message))throw error;}await sleep(100);}throw new Error('Timed out: '+expression);};
  const snap=async(name,width=1440)=>{await cdp('Emulation.setDeviceMetricsOverride',{width,height:width<700?844:1000,deviceScaleFactor:1,mobile:false});await sleep(350);const size=await run('({w:innerWidth,scroll:document.documentElement.scrollWidth})');assert.ok(size.scroll<=size.w+1,`${name} overflow ${JSON.stringify(size)}`);const shot=await cdp('Page.captureScreenshot',{format:'png'});writeFileSync(path.join(folder,name+'.png'),Buffer.from(shot.data,'base64'));};
  await cdp('Runtime.enable');await cdp('Page.enable');
  await cdp('Page.navigate',{url:'http://127.0.0.1:3107'});
  await wait("typeof workspaceConfig !== 'undefined' && workspaceConfig && document.querySelector('#overviewTasks')?.innerText.length > 0");
  await run("onUserSwitch('2')");
  await run("openCreateListingModal(); $setVal('newPostTitle','QA sản phẩm mới'); $setVal('newPostPrice','500000'); $setVal('newPostMeetupLocation',''); submitCreateListing()");
  await wait("location.hash.startsWith('#product/') && document.querySelector('#productDetail').innerText.includes('QA sản phẩm mới')");
  const pid=await run("Number(location.hash.split('/')[1])");
  await snap('seller-pending');
  const approve=await run(`(async()=>{await fetch('/api/auth/demo-switch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:4})});const r=await fetch('/api/products/${pid}/bump',{method:'POST'});const banned=r.status;const a=await fetch('/api/admin/products/${pid}/approve',{method:'POST'});await fetch('/api/auth/demo-switch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:2})});await loadMe();await loadProductDetail(${pid});return {banned,approve:a.status}})()`);assert.equal(approve.banned,403);assert.equal(approve.approve,200);
  await run(`quickBumpProduct(${pid})`);
  await run("onUserSwitch('1')");await run(`loadProductDetail(${pid})`);
  await run(`openChatWithSeller(${pid})`);await wait("location.hash.startsWith('#chat/') && document.querySelector('#chatActiveContent').style.display === 'flex'");
  await run("$setVal('chatTextInput','Chat kiểm tra trước khi mua'); submitChatMessage()");
  await wait("document.querySelector('#chatMessagesScroll').innerText.includes('Chat kiểm tra trước khi mua')");
  await snap('chat-desktop');await snap('chat-mobile',390);
  await run(`openCheckoutModal(${pid})`);await wait("location.hash === '#checkout' && currentCheckoutQuote?.missing_amount > 0");
  await run("$setVal('checkoutRecipientPhone','0912345678'); $setVal('checkoutMeetupInput','Cổng trường'); $setVal('checkoutVoucherInput','SV5K'); applyCheckoutVoucher()");
  await wait("currentCheckoutQuote?.discount === 5000");
  assert.equal(await run("document.querySelector('#checkoutBalanceAlert').style.display"),'block');
  await snap('checkout-shortfall',1440);
  await run('openTopupFromCheckout(); simulateTopupSuccess()');await wait('currentCheckoutQuote?.missing_amount === 0');
  await snap('checkout-ready-mobile',390);
  await cdp('Page.reload');await wait("location.hash === '#checkout' && currentCheckoutQuote?.discount === 5000");
  assert.equal(await run("$val('checkoutMeetupInput')"),'Cổng trường');
  await run('submitCheckout()');await wait("location.hash.startsWith('#order/') && document.querySelector('#orderDetail').innerText.includes('QA sản phẩm mới')");
  const oid=await run("Number(location.hash.split('/')[1])");
  await run("onUserSwitch('2')");await run(`sellerAcceptOrder(${oid})`);await wait("workspaceOrders.find(o=>o.id==="+oid+")?.status==='ACCEPTED'");
  await run(`orderAction(${oid},'ship')`);await run("onUserSwitch('1')");await run(`buyerConfirmOrder(${oid})`); // Handle native confirm through CDP below if blocked.
  await snap('order-mobile',390);
  for(const width of [1440,768,390]){await run("switchNav('marketplace')");await wait("location.hash==='#marketplace'");await snap('market-'+width,width);}
  await run("$setVal('topupCustomAmount',300000); simulateTopupSuccess()");
  const courierPid = await run("(async()=>{const products=await (await apiFetch('/api/products?seller_id=2&status=AVAILABLE')).json();return products.find(p=>p.price<200000).id})()");
  await run(`openCheckoutModal(${courierPid})`);
  await run("document.querySelector('input[value=COURIER_ROOM]').checked=true; $setVal('checkoutRecipientPhone','0912345678'); $setVal('checkoutDeliveryAddress','Phòng 302 KTX A'); fetchCheckoutQuote()");
  await run('submitCheckout()');await wait("location.hash.startsWith('#order/')");
  const courierOrder = await run("Number(location.hash.split('/')[1])");
  await run("onUserSwitch('2')");await run(`sellerAcceptOrder(${courierOrder})`);await run(`orderAction(${courierOrder},'ready-pickup',{pickup_address:'Cổng KTX B'})`);
  const shipResult = await run(`(async()=>{await fetch('/api/auth/demo-switch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:4})});const list=await (await fetch('/api/admin/shipments')).json();const sh=list.find(s=>s.order_id===${courierOrder});const r=await fetch('/api/admin/shipments/'+sh.id+'/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'PICKED_UP'})});await fetch('/api/auth/demo-switch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:1})});return r.status})()`);assert.equal(shipResult,200);
  await run("onUserSwitch('1')");await run(`openDisputeModal(${courierOrder});$setVal('disputeType','NOT_RECEIVED');$setVal('disputeReasonInput','Chưa nhận được hàng và cần kiểm tra với đơn vị vận chuyển');submitDispute()`);
  await wait("location.hash.startsWith('#case/') && document.querySelector('#caseReply')");
  const dossierId = await run("Number(location.hash.split('/')[1])");
  await run("$setVal('caseReply','Người mua bổ sung thông tin liên lạc và thời gian chờ');submitCaseReply("+dossierId+")");
  await snap('case-mobile',390);
  await run("onUserSwitch('4')");await wait("location.pathname==='/admin.html' && document.querySelector('#kpiGmv')?.innerText !== '0 đ'");
  for(const screen of ['kpi','orders','shipping','escrow','disputes','users','vouchers']){
    await run(`switchView('${screen}')`);await sleep(150);assert.equal(await run("document.querySelectorAll('.admin-content section:not([hidden])').length"),1);
    for(const width of [1440,768,390])await snap('admin-'+screen+'-'+width,width);
  }
  await run(`openDisputeDossier(${dossierId})`);await sleep(200);await snap('admin-case',1440);
  await run(`markDisputeReviewed(${dossierId})`);await run(`resolveDisputeDecision(${dossierId},'REFUND_BUYER')`);
  await run("switchView('orders')");await sleep(200);await snap('admin-refund',1440);
  assert.deepEqual(errors,[]);
  writeFileSync(path.join(folder,'result.json'),JSON.stringify({passed:true,pid,oid,errors},null,2));
  console.log(JSON.stringify({passed:true,folder,pid,oid,errors}));
} catch(error){console.error(error);console.error(log);process.exitCode=1;}finally{ws?.close();chrome.kill();server.kill();}
