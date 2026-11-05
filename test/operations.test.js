const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
process.env.TAKETWO_DB_PATH = ':memory:';
const app = require('../server');
const {db} = require('../db');
const market = app.locals.marketplace;
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const user = id => db.prepare('SELECT * FROM users WHERE id=?').get(id);
let server,base;const cookies={};
before(async()=>{
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;
  for(const id of [1,2,3,4]){const r=await fetch(base+'/api/auth/demo-switch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:id})});cookies[id]=r.headers.get('set-cookie').split(';')[0];}
  db.exec('UPDATE wallets SET available_balance=10000000 WHERE user_id=1');
});
after(async()=>{await new Promise(r=>server.close(r));db.close();});
async function request(url,id=1,body,method='POST'){
  const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(id?{cookie:cookies[id]}:{})},...(method==='GET'?{}:{body:JSON.stringify(body||{})})});
  return {status:r.status,body:await r.json()};
}
function product(){return db.prepare("INSERT INTO products(seller_id,category_id,title,price,condition_level,campus_cluster,meetup_location,image_url,created_at) VALUES(2,'books','Operations test',150000,'Tốt','Hòa Lạc','','',datetime('now'))").run().lastInsertRowid;}
function order(id){return db.prepare('SELECT * FROM orders WHERE id=?').get(id);}
async function checkout(voucher_code,delivery_type='COURIER_ROOM'){
  const r=await request('/api/orders/checkout',1,{product_id:product(),delivery_type,delivery_address:'KTX A',voucher_code});assert.equal(r.status,200,JSON.stringify(r.body));return r.body.order_id;
}
async function picked(id){
  assert.equal((await request(`/api/orders/${id}/accept`,2)).status,200);
  assert.equal((await request(`/api/orders/${id}/ready-pickup`,2,{pickup_address:'KTX B'})).status,200);
  const sh=db.prepare('SELECT * FROM shipments WHERE order_id=?').get(id);
  assert.equal((await request(`/api/admin/shipments/${sh.id}/status`,4,{status:'PICKED_UP'})).status,200);return sh;
}
test('listing without meetup requires moderation; detail and boost use returned ID',async()=>{
  const r=await request('/api/products',2,{title:'Đăng không điểm hẹn',price:5000,category_id:'books',condition_level:'Tốt',campus_cluster:'Hòa Lạc'});
  assert.equal(r.status,200);const id=r.body.product_id;
  assert.equal(r.body.approval_status,'PENDING_APPROVAL');
  assert.equal((await request(`/api/products/${id}`,2,null,'GET')).status,200);
  assert.equal((await request(`/api/products/${id}`,1,null,'GET')).status,404);
  assert.equal((await request(`/api/products/${id}/bump`,2)).status,409);
  assert.equal((await request(`/api/admin/products/${id}/approve`,4)).status,200);
  assert.equal((await request(`/api/products/${id}/bump`,2)).status,200);
});
test('voucher reserves budget and global/per-user limits; quote and checkout agree',async()=>{
  const campaign=await request('/api/admin/vouchers',4,{code:'ONEONLY',title:'One',discount_type:'FIXED',discount_value:5000,budget:5000,usage_limit:1,usage_per_user:1});assert.equal(campaign.status,200);
  const body={product_id:product(),delivery_type:'CAMPUS_MEETUP',delivery_address:'Cổng trường',voucher_code:'ONEONLY'};
  const quote=await request('/api/checkout/quote',1,body);assert.equal(quote.body.discount,5000);
  const id=(await request('/api/orders/checkout',1,body)).body.order_id;
  const q2=await request('/api/checkout/quote',1,{...body,product_id:product()});assert.ok(q2.body.voucher_error);
  assert.equal((await request('/api/orders/checkout',1,{...body,product_id:product()})).status,400);
  assert.equal((await request(`/api/admin/vouchers/${campaign.body.id}/update`,4,{budget:4000})).status,409);
  await request(`/api/orders/${id}/cancel-requested`,1);
  assert.equal(db.prepare('SELECT budget_held FROM voucher_campaigns WHERE id=?').get(campaign.body.id).budget_held,0);
  assert.equal((await request('/api/checkout/quote',1,{...body,product_id:product()})).body.discount,5000);
});
test('voucher dates, audience and stale expected totals are enforced server-side',async()=>{
  await request('/api/admin/vouchers',4,{code:'PRIVATE',title:'Private',discount_type:'PERCENTAGE',discount_value:10,max_discount:10000,budget:50000,target_audience:'SPECIFIC_USERS',target_user_ids:[3]});
  const body={product_id:product(),delivery_type:'CAMPUS_MEETUP',delivery_address:'Cổng',voucher_code:'PRIVATE'};
  assert.match((await request('/api/checkout/quote',1,body)).body.voucher_error,/đối tượng/);
  assert.equal((await request('/api/orders/checkout',1,body)).status,400);
  assert.equal((await request('/api/orders/checkout',1,{...body,voucher_code:null,expected_total:1})).status,409);
  assert.equal((await request('/api/admin/vouchers',4,{code:'BAD',title:'Bad',discount_type:'PERCENTAGE',discount_value:101,budget:50000})).status,400);
});
test('only admin pickup starts courier escrow; cannot repeat or bypass state; payable only once',async()=>{
  const id=await checkout();const sh=db.prepare('SELECT * FROM shipments WHERE order_id=?').get(id);
  assert.equal((await request(`/api/admin/shipments/${sh.id}/pay`,4,{reference:'early'})).status,409);
  assert.equal((await request(`/api/orders/${id}/accept`,2)).status,200);
  assert.equal((await request(`/api/orders/${id}/ship`,2)).status,409);
  assert.equal((await request(`/api/admin/shipments/${sh.id}/status`,4,{status:'PICKED_UP'})).status,409);
  await request(`/api/orders/${id}/ready-pickup`,2,{pickup_address:'KTX B'});
  assert.equal(order(id).auto_confirm_deadline,null);
  assert.equal((await request(`/api/admin/shipments/${sh.id}/status`,2,{status:'PICKED_UP'})).status,403);
  assert.equal((await request(`/api/admin/shipments/${sh.id}/status`,4,{status:'PICKED_UP'})).status,200);
  const deadline=order(id).auto_confirm_deadline;
  assert.equal((await request(`/api/admin/shipments/${sh.id}/status`,4,{status:'PICKED_UP'})).status,409);assert.equal(order(id).auto_confirm_deadline,deadline);
  assert.equal((await request(`/api/admin/shipments/${sh.id}/pay`,4,{reference:'PAY1'})).status,200);
  assert.equal((await request(`/api/admin/shipments/${sh.id}/pay`,4,{reference:'PAY2'})).status,409);
  assert.equal((await request(`/api/orders/${id}/confirm`,1)).status,200);
});
test('dispute evidence ownership, review gate, responses after suspension and refund net of fee',async()=>{
  const id=await checkout();await picked(id);
  const proof=await request('/api/upload',1,{data:png,filename:'proof.png'});
  assert.equal((await request(`/api/orders/${id}/dispute`,1,{issue_type:'DAMAGED',reason:'Hỏng',evidence_images:[]})).status,400);
  const foreign=await request('/api/upload',3,{data:png,filename:'foreign.png'});
  assert.equal((await request(`/api/orders/${id}/dispute`,1,{issue_type:'DAMAGED',reason:'Hỏng',evidence_images:[foreign.body.id]})).status,403);
  assert.equal((await request(`/api/orders/${id}/dispute`,1,{issue_type:'DAMAGED',reason:'Hỏng',evidence_images:[proof.body.id]})).status,200);
  const d=db.prepare('SELECT * FROM disputes WHERE order_id=?').get(id);
  assert.ok(d.original_deadline);
  assert.equal((await request(`/api/admin/disputes/${d.id}/resolve`,4,{decision:'REFUND_BUYER',reason:'Kiểm tra'})).status,409);
  await request(`/api/admin/users/2/status`,4,{status:'LOCKED',reason:'Kiểm tra seller'});
  assert.equal((await request(`/api/disputes/${d.id}/posts`,2,{content:'Tôi bổ sung giải trình'})).status,200);
  assert.equal((await request(`/api/disputes/${d.id}`,3,null,'GET')).status,403);
  await request(`/api/admin/disputes/${d.id}/review`,4);
  assert.equal((await request(`/api/admin/disputes/${d.id}/resolve`,4,{decision:'PARTIAL',reason:'Bad'})).status,400);
  const refund=await request(`/api/admin/disputes/${d.id}/resolve`,4,{decision:'REFUND_BUYER',reason:'Dựa vào ảnh và giải trình'});
  assert.equal(refund.status,200);assert.equal(refund.body.refund_amount,160500);assert.equal(refund.body.shipping_absorbed,15000);
  assert.equal((await request(`/api/admin/disputes/${d.id}/resolve`,4,{decision:'RELEASE_SELLER',reason:'Again'})).status,409);
  await request(`/api/admin/users/2/status`,4,{status:'ACTIVE',reason:'Đã xử lý'});
});
test('private images reject anonymous/outsiders; signature validation; chat retries do not duplicate',async()=>{
  const image=await request('/api/upload',1,{data:png,filename:'chat.png'});assert.equal(image.status,200);
  assert.equal((await fetch(base+image.body.url)).status,401);
  assert.equal((await fetch(base+image.body.url,{headers:{cookie:cookies[3]}})).status,403);
  assert.equal((await request('/api/upload',1,{data:'data:image/png;base64,YmFk',filename:'bad.png'})).status,400);
  const c=await request('/api/chat/conversations',1,{product_id:product()});const cid=c.body.id;
  const msg={content:'Hello',attachment_id:image.body.id,client_id:'retry-one'};
  assert.equal((await request(`/api/chat/conversations/${cid}/messages`,1,msg)).status,200);
  assert.equal((await request(`/api/chat/conversations/${cid}/messages`,1,msg)).status,200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM chat_messages WHERE conversation_id=?').get(cid).n,1);
  assert.equal((await fetch(base+image.body.url,{headers:{cookie:cookies[2]}})).status,200);
  assert.equal((await request(`/api/chat/conversations/${cid}`,4,null,'GET')).status,403);
});
test('escrow imbalance blocks payout and all financial journals balance',async()=>{
  const id=await checkout(null,'CAMPUS_MEETUP');market.transition(user(2),id,'accept');market.transition(user(2),id,'ship');
  db.exec('UPDATE wallets SET escrow_balance=escrow_balance+1 WHERE user_id=1');
  assert.equal((await request(`/api/orders/${id}/confirm`,1)).status,409);
  db.exec('UPDATE wallets SET escrow_balance=escrow_balance-1 WHERE user_id=1');
  assert.equal((await request(`/api/orders/${id}/confirm`,1)).status,200);
  assert.deepEqual(db.prepare('SELECT journal_id FROM journal_lines GROUP BY journal_id HAVING SUM(amount) != 0').all(),[]);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM journals WHERE event_key=?').get(`settle:${id}`).n,1);
});
test('financial request retry uses the same response without crediting twice',async()=>{
  const before=db.prepare('SELECT available_balance n FROM wallets WHERE user_id=1').get().n;
  const options={method:'POST',headers:{'Content-Type':'application/json',cookie:cookies[1],'Idempotency-Key':'topup-retry'},body:JSON.stringify({amount:10000})};
  const first=await (await fetch(base+'/api/wallet/topup',options)).json();
  const second=await (await fetch(base+'/api/wallet/topup',options)).json();
  assert.equal(first.voucher_code,second.voucher_code);
  assert.equal(db.prepare('SELECT available_balance n FROM wallets WHERE user_id=1').get().n,before+10000);
  assert.equal((await fetch(base+'/api/wallet/topup',{...options,body:JSON.stringify({amount:20000})})).status,409);
});
test('last voucher use is reserved once across concurrent different listings; complete consumes budget',async()=>{
  const v=await request('/api/admin/vouchers',4,{code:'LASTONE',title:'Last one',discount_type:'FIXED',discount_value:5000,budget:5000,usage_limit:1});
  const attempts=await Promise.all([product(),product()].map(product_id=>request('/api/orders/checkout',1,{product_id,delivery_type:'CAMPUS_MEETUP',delivery_address:'Cổng',voucher_code:'LASTONE'})));
  assert.deepEqual(attempts.map(r=>r.status).sort(),[200,400]);
  const id=attempts.find(r=>r.status===200).body.order_id;
  market.transition(user(2),id,'accept');market.transition(user(2),id,'ship');market.transition(user(1),id,'confirm');
  const campaign=db.prepare('SELECT * FROM voucher_campaigns WHERE id=?').get(v.body.id);
  assert.equal(campaign.budget_held,0);assert.equal(campaign.budget_used,5000);assert.equal(campaign.usage_count,1);
});
test('retained fee cannot exceed money actually paid; no partial refund input accepted',async()=>{
  await request('/api/admin/vouchers',4,{code:'ALMOSTFREE',title:'Cap fee',discount_type:'FIXED',discount_value:149900,budget:149900});
  const id=await checkout('ALMOSTFREE','CAMPUS_MEETUP');market.transition(user(2),id,'accept');
  assert.equal((await request(`/api/orders/${id}/dispute`,1,{reason:'Seller chưa bàn giao',issue_type:'SELLER_NO_SHOW'})).status,200);
  const d=db.prepare('SELECT id FROM disputes WHERE order_id=?').get(id);
  await request(`/api/admin/disputes/${d.id}/review`,4);
  const refund=await request(`/api/admin/disputes/${d.id}/resolve`,4,{decision:'REFUND_BUYER',reason:'Xác nhận seller không bàn giao'});
  assert.equal(refund.status,200);assert.equal(refund.body.retained_fee,100);assert.equal(refund.body.refund_amount,0);
  assert.equal(order(id).seller_payout,0);
});
test('manual admin release requires a reason and does not claim buyer confirmation',async()=>{
  const id=await checkout(null,'CAMPUS_MEETUP');market.transition(user(2),id,'accept');market.transition(user(2),id,'ship');
  assert.equal((await request(`/api/admin/escrow/${id}/release`,4)).status,400);
  assert.equal((await request(`/api/admin/escrow/${id}/release`,4,{reason:'Đối chiếu bằng chứng bàn giao và hết yêu cầu bổ sung'})).status,200);
  assert.equal(order(id).buyer_confirmed,0);
  assert.equal((await request(`/api/admin/escrow/${id}/release`,4,{reason:'Gửi lặp'})).status,409);
});
