// Complete the existing blue dashboard without changing its visual identity.
let chatRetryKey = null;
let caseImages = [];
let quoteRequest = 0;
let chatLoadedMessages = [];
let chatHistoryConvId = null;
let chatHasEarlier = false;
async function loadEarlierChat() {
  if (!activeChatConversationId || !chatLoadedMessages.length) return;
  try {
    const data = await (await apiFetch(`/api/chat/conversations/${activeChatConversationId}?before=${chatLoadedMessages[0].id}`)).json();
    chatHasEarlier = data.has_more;
    renderChatMessages(data.messages, false);
  } catch (error) { showToast(error.message, 'error'); }
}
document.addEventListener('error', event => {
  const img = event.target;
  if (img.tagName === 'IMG' && !img.dataset.fallback) { img.dataset.fallback = '1'; img.src = '/assets/product-placeholder.svg'; }
}, true);
const checkoutFields = ['checkoutRecipientName', 'checkoutRecipientPhone', 'checkoutMeetupInput', 'checkoutDeliveryAddress', 'checkoutVoucherInput'];
const checkoutDraftKey = () => `taketwo:checkout:${currentUser?.id || 'guest'}`;
async function resumePendingCheckout() {
  if (!pendingCheckout || !currentUser || currentUser.role === 'ADMIN') return false;
  const pending = pendingCheckout;
  pendingCheckout = null;
  if (pending.userId === currentUser.id && sessionStorage.getItem(checkoutDraftKey())) await restoreCheckoutDraft();
  else await openCheckoutModal(pending.productId);
  return true;
}
function saveCheckoutDraft() {
  if (!checkoutProduct || !currentUser) return;
  sessionStorage.setItem(checkoutDraftKey(), JSON.stringify({ product_id: checkoutProduct.id, delivery: document.querySelector('input[name="deliveryType"]:checked')?.value, fields: Object.fromEntries(checkoutFields.map(id => [id, $val(id)])) }));
}
async function restoreCheckoutDraft() {
  let draft;
  try { draft = JSON.parse(sessionStorage.getItem(checkoutDraftKey())); } catch (_) {}
  if (!draft?.product_id) { switchNav('marketplace'); return; }
  await openCheckoutModal(draft.product_id);
  if (!checkoutProduct) { switchNav('marketplace'); return; }
  checkoutFields.forEach(id => $setVal(id, draft.fields?.[id] || ''));
  const radio = [...document.querySelectorAll('input[name="deliveryType"]')].find(el => el.value === draft.delivery);
  if (radio) radio.checked = true;
  await fetchCheckoutQuote();
}
const checkoutOpen = openCheckoutModal;
openCheckoutModal = async function(id) {
  if (checkoutProduct?.id !== Number(id)) {
    checkoutFields.forEach(key => $setVal(key, ''));
    $setVal('checkoutRecipientName', currentUser?.name || '');
  }
  await checkoutOpen(id);
  saveCheckoutDraft();
};
// Ignore older quotes when shipping or voucher changes while a request is pending.
const quoteFetch = fetchCheckoutQuote;
fetchCheckoutQuote = async function() {
  const request = ++quoteRequest;
  $id('btnConfirmCheckout').disabled = true;
  await quoteFetch();
  if (request !== quoteRequest) return;
  saveCheckoutDraft();
};
document.addEventListener('input', event => { if (checkoutFields.includes(event.target.id)) saveCheckoutDraft(); });
document.addEventListener('change', event => { if (event.target.name === 'deliveryType') saveCheckoutDraft(); });
const topupSuccess = simulateTopupSuccess;
simulateTopupSuccess = async function() { await topupSuccess(); if (workspaceRoute === 'checkout') await fetchCheckoutQuote(); };

async function orderAction(id, action, body = {}) {
  try {
    const data = await (await apiFetch(`/api/orders/${id}/${action}`, { method: 'POST', body })).json();
    showToast(data.message, 'success'); await loadMe(); await loadOrders();
  } catch (error) { showToast(error.message, 'error'); }
}
function sellerMeetupHandover(id) { if (confirm('Bạn đã bàn giao trực tiếp món đồ cho người mua?')) return orderAction(id, 'ship'); }
function sellerReadyPickup(id) {
  const pickup_address = prompt('Địa chỉ để đơn vị vận chuyển lấy hàng (seller không cần nhập mã vận đơn):');
  if (pickup_address?.trim()) return orderAction(id, 'ready-pickup', { pickup_address });
}
function buyerCancelOrder(id) { if (confirm('Hủy đơn chờ seller chấp nhận? Toàn bộ tiền sẽ được trả về ví.')) return orderAction(id, 'cancel-requested', { reason: 'Người mua hủy trước khi seller chấp nhận' }); }
function sellerRejectOrder(id) { const reason = prompt('Lý do từ chối đơn:'); if (reason?.trim()) return orderAction(id, 'cancel-requested', { reason }); }

const reasons = { NOT_RECEIVED: 'Chưa nhận được hàng', WRONG_ITEM: 'Giao sai hàng', NOT_AS_DESCRIBED: 'Không đúng mô tả', DAMAGED: 'Hàng bị hỏng', SELLER_NO_SHOW: 'Seller không thực hiện bàn giao', OTHER: 'Vấn đề khác' };
async function uploadImages(files) {
  if (files.length > 5) throw new Error('Tối đa 5 ảnh cho mỗi nội dung.');
  const ids = [];
  for (const file of files) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Ảnh phải là JPEG, PNG hoặc WebP, tối đa 5 MB.');
    const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    ids.push((await (await apiFetch('/api/upload', { method: 'POST', body: { data, filename: file.name } })).json()).id);
  }
  return ids;
}
openDisputeModal = function(id) { $setVal('disputeOrderId', id); $setVal('disputeReasonInput',''); $setVal('disputeImages',''); openModal('modalDispute'); };
submitDispute = async function() {
  const id = $val('disputeOrderId'), reason = $val('disputeReasonInput').trim(), issue_type = $val('disputeType');
  if (!reason) return invalidField('disputeReasonInput', 'Mô tả vấn đề và đề nghị xử lý.');
  const button = $id('submitDisputeButton'); if (button.disabled) return; button.disabled = true;
  try {
    const evidence_images = await uploadImages([...$id('disputeImages').files]);
    await apiFetch(`/api/orders/${id}/dispute`, { method: 'POST', body: { reason, issue_type, evidence_images } });
    closeModal('modalDispute'); await loadOrders(); await openOrderCase(id);
  } catch (error) { showToast(error.message, 'error'); } finally { button.disabled = false; }
};
async function openOrderCase(id) {
  try {
    const data = await (await apiFetch(`/api/orders/${id}`)).json();
    if (!data.dispute) throw new Error('Chưa có hồ sơ khiếu nại.');
    switchNav(`case/${data.dispute.id}`);
  } catch (error) { showToast(error.message, 'error'); }
}
function evidenceHTML(input) {
  let ids = [];
  try { ids = typeof input === 'string' ? JSON.parse(input || '[]') : input || []; } catch (_) {}
  return `<div class="case-images">${ids.map(id => String(id).replace('/api/attachments/', '')).filter(id => /^[a-zA-Z0-9-]+$/.test(id)).map(id => `<a href="/api/attachments/${id}" target="_blank" rel="noopener"><img src="/api/attachments/${id}" alt="Ảnh bằng chứng"></a>`).join('')}</div>`;
}
async function loadCase(id) {
  const host = $id('caseContent');
  try {
    const { dispute: d, posts, seller_deadline, admin_deadline } = await (await apiFetch(`/api/disputes/${id}`)).json();
    host.innerHTML = `<a class="back-link" href="#order/${d.order_id}">← Về đơn hàng</a><div class="workspace-panel"><h2>${E(reasons[d.issue_type])}</h2><p>${E(d.description)}</p>${evidenceHTML(d.evidence_images)}<p class="muted">Hạn seller phản hồi: ${E(new Date(seller_deadline).toLocaleString('vi-VN'))}. Hạn admin mục tiêu: ${E(new Date(admin_deadline).toLocaleString('vi-VN'))}.</p><p>Trạng thái: ${E(d.status)}</p>${d.status === 'RESOLVED' ? `<p><strong>${E(d.admin_decision === 'REFUND_BUYER' ? 'Hoàn tiền sau khi trừ phí sàn' : 'Giải ngân cho seller')}</strong>: ${E(d.admin_reason)}</p>` : ''}</div><div class="workspace-panel"><h2>Lịch sử giải trình & bằng chứng</h2>${posts.map(p => `<article class="case-post"><strong>${E(p.author_name)}</strong><small>${E(p.created_at)}</small><p>${E(p.content)}</p>${evidenceHTML(p.attachment_ids)}</article>`).join('') || '<p>Chưa có phản hồi bổ sung.</p>'}</div>${d.status !== 'RESOLVED' ? `<div class="workspace-panel"><label for="caseReply">Nội dung giải trình hoặc bổ sung bằng chứng</label><textarea id="caseReply" rows="4" maxlength="4000"></textarea><input id="caseFiles" type="file" multiple accept="image/jpeg,image/png,image/webp"><button class="btn-fintab btn-fintab-primary" onclick="submitCaseReply(${d.id})">Gửi giải trình</button></div>` : ''}`;
  } catch (error) { blockError('caseContent', error, `loadCase(${Number(id)})`); }
}
async function submitCaseReply(id) {
  const content = $val('caseReply').trim(); if (!content) return invalidField('caseReply', 'Nhập nội dung giải trình.');
  try { const attachment_ids = await uploadImages([...$id('caseFiles').files]); await apiFetch(`/api/disputes/${id}/posts`, { method: 'POST', body: { content, attachment_ids } }); await loadCase(id); }
  catch (error) { showToast(error.message, 'error'); }
}
async function reportProduct(id) {
  if (!currentUser) return openLoginModal();
  const reason = prompt('Lý do báo cáo tin đăng:'); if (!reason?.trim()) return;
  try { await apiFetch(`/api/products/${id}/report`, { method:'POST', body:{ reason, description: reason } }); showToast('Đã gửi báo cáo tới quản trị viên.', 'success'); }
  catch (error) { showToast(error.message, 'error'); }
}
