// TakeTwo Dedicated Admin Portal Controller
(() => {
  'use strict';

  const E = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function safeData(value, key = '') {
    if (typeof value === 'string') {
      if (['evidence_images', 'seller_evidence', 'attachment_ids'].includes(key)) {
        try { return JSON.stringify(JSON.parse(value).filter(v => /^(\/api\/attachments\/)?[a-zA-Z0-9-]+$/.test(String(v)))); } catch (_) { return '[]'; }
      }
      return E(value);
    }
    if (Array.isArray(value)) return value.map(item => safeData(item));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,safeData(v,k)]));
    return value;
  }
  const fetch = async (...args) => {
    const button = document.activeElement?.tagName === 'BUTTON' && args[1]?.method === 'POST' ? document.activeElement : null;
    if(button) button.disabled = true;
    let response;
    try { response = await window.fetch(...args); } finally { if(button) button.disabled = false; }
    const parse = response.json.bind(response);
    response.json = async () => {
      const data = await parse();
      if (!response.ok) { const error = document.getElementById('adminError'); error.hidden = false; error.textContent = data.error || 'Không tải được dữ liệu. Hãy thử lại.'; }
      return safeData(data);
    };
    return response;
  };
  const periodQuery = () => new URLSearchParams(Object.fromEntries(['from','to'].map(k => [k, document.getElementById('period-' + k)?.value]).filter(([,v]) => v))).toString();
  let currentView = 'kpi';
  let editingVoucherId = null;
  let cachedOrders = [];

  const fmtVND = num => (num || 0).toLocaleString('vi-VN') + ' đ';

  window.switchView = function(viewId) {
    if (!['kpi','orders','shipping','escrow','disputes','users','vouchers'].includes(viewId)) viewId = 'kpi';
    if (location.hash !== '#' + viewId) history.pushState(null, '', '#' + viewId);
    currentView = viewId;
    document.querySelectorAll('.admin-nav .nav-link').forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === '#' + viewId);
    });
    document.querySelectorAll('.admin-content section').forEach(sec => {
      sec.hidden = sec.id !== 'sec-' + viewId;
    });

    const titles = {
      kpi: 'Tổng Quan Kinh Doanh & Vận Hành',
      orders: 'Sổ Đối Soát Dòng Tiền & Đơn Hàng',
      shipping: 'Hàng Đợi Vận Chuyển & Khoản Phải Trả',
      escrow: 'Quản Lý & Đối Soát Két Escrow',
      disputes: 'Hồ Sơ Khiếu Nại & Phán Quyết Bằng Chứng',
      users: 'Quản Trị Người Dùng & Kiểm Duyệt Bài Đăng',
      vouchers: 'Chiến Dịch Voucher Khuyến Mại'
    };
    document.getElementById('pageTitle').textContent = titles[viewId] || 'Quản Trị Hệ Thống';

    if (viewId === 'kpi') loadKpiData();
    else if (viewId === 'orders') loadOrdersReconciliation();
    else if (viewId === 'shipping') loadShippingData();
    else if (viewId === 'escrow') loadEscrowAudit();
    else if (viewId === 'disputes') loadDisputesData();
    else if (viewId === 'users') { loadUsersData(); loadProductsModeration(); loadReportsData(); }
    else if (viewId === 'vouchers') loadVouchersData();
  };

  async function checkAdminAuth() {
    try {
      const res = await fetch('/api/me');
      const data = await res.json();
      if (!data.isLoggedIn || data.user.role !== 'ADMIN') {
        alert('Trang này chỉ dành riêng cho Quản trị viên (ADMIN). Vui lòng đăng nhập!');
        window.location.href = '/';
        return;
      }
      switchView(location.hash.slice(1) || 'kpi');
      updateBadges();
    } catch (e) {
      window.location.href = '/';
    }
  }

  async function updateBadges() {
    try {
      const [sh, esc, disp] = await Promise.all([
        fetch('/api/admin/shipments').then(r => r.json()),
        fetch('/api/admin/escrow-audit').then(r => r.json()),
        fetch('/api/admin/disputes').then(r => r.json())
      ]);
      document.getElementById('badgeShipping').textContent = (sh || []).filter(s => s.status !== 'DELIVERED' && s.status !== 'CANCELLED').length;
      document.getElementById('badgeEscrow').textContent = (esc.held_orders || []).length;
      document.getElementById('badgeDisputes').textContent = (disp || []).filter(d => d.status !== 'RESOLVED').length;
    } catch (_) {}
  }

  window.adminLogout = async function() {
    if (!confirm('Bạn có chắc chắn muốn đăng xuất tài khoản Quản trị viên?')) return;
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  window.closeModal = function(id) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  };

  // 1. KPI DATA
  window.loadKpiData = async function() {
    try {
      const res = await fetch('/api/admin/dashboard-kpis?' + periodQuery());
      const d = await res.json();

      document.getElementById('kpiNetContribution').textContent = fmtVND(d.net_contribution);
      document.getElementById('kpiGmv').textContent = fmtVND(d.gmv);
      document.getElementById('kpiEscrowHolding').textContent = fmtVND(d.total_escrow_holding);
      document.getElementById('kpiCompletedRate').textContent = d.completion_rate + '%';
      document.getElementById('kpiCompletedOrders').textContent = `${d.completed_orders} đơn hoàn tất / ${d.total_orders} tổng đơn`;
      document.getElementById('kpiDisputeRate').textContent = d.dispute_rate + '%';
      document.getElementById('kpiDisputedOrders').textContent = `${d.disputed_orders} vụ khiếu nại`;

      document.getElementById('kpiCounts').textContent = `Hoàn tất: ${d.completed_orders} · Hủy trước xử lý: ${d.cancelled_orders} · Hoàn sau tranh chấp: ${d.refunded_orders} · Đang tranh chấp: ${d.open_disputes}`;
      const tbody = document.getElementById('tblFinancialBreakdown');
      tbody.innerHTML = `
        <tr><td>Phí sàn thu từ đơn hoàn tất (F)</td><td>Doanh thu dịch vụ (3% giá trị đơn thành công)</td><td class="num" style="color:var(--success-text); font-weight:700;">+ ${fmtVND(d.fee_completed)}</td></tr>
        <tr><td>Phí sàn giữ lại khi hoàn tiền (Fr)</td><td>Phí dịch vụ giữ lại từ các đơn khiếu nại được hoàn</td><td class="num" style="color:var(--success-text); font-weight:700;">+ ${fmtVND(d.fee_retained_refund)}</td></tr>
        <tr><td>Doanh thu bán gói đẩy tin VIP</td><td>Thu tiền bán lượt đẩy bài hiển thị ưu tiên</td><td class="num" style="color:var(--success-text); font-weight:700;">+ ${fmtVND(d.boost_revenue)}</td></tr>
        <tr><td>Trợ giá voucher thực tài trợ (D)</td><td>Chi phí marketing/khuyến mại trừ trực tiếp giá hàng</td><td class="num" style="color:var(--danger-text); font-weight:700;">- ${fmtVND(d.voucher_subsidies)}</td></tr>
        <tr><td>Cước vận chuyển bù khi hoàn hàng (K)</td><td>Chi phí vận chuyển phát sinh TakeTwo chịu khi hủy/hoàn</td><td class="num" style="color:var(--danger-text); font-weight:700;">- ${fmtVND(d.shipping_absorbed)}</td></tr>
        <tr style="background:#F1F5F9; font-weight:800; font-size:14px;"><td>ĐÓNG GÓP RÒNG TOÀN SÀN</td><td>F + Fr + Doanh thu Boost − Trợ giá Voucher − Cước bù</td><td class="num" style="color:${d.net_contribution >= 0 ? 'var(--primary)' : 'var(--danger-text)'}; font-size:16px;">${fmtVND(d.net_contribution)}</td></tr>
      `;
    } catch (e) {
      console.error(e);
    }
  };

  // 2. ORDERS RECONCILIATION
  window.loadOrdersReconciliation = async function() {
    try {
      const res = await fetch('/api/admin/orders-reconciliation?' + periodQuery() + '&date_basis=' + document.getElementById('orderDateBasis').value);
      const data = await res.json();
      cachedOrders = data.orders || [];
      filterOrdersTable();
    } catch (e) {
      console.error(e);
    }
  };

  window.filterOrdersTable = function() {
    const term = (document.getElementById('orderSearchInput').value || '').trim().toLowerCase();
    const stFilter = document.getElementById('orderStatusFilter').value;
    const escFilter = document.getElementById('orderEscrowFilter').value;

    const filtered = cachedOrders.filter(o => {
      const matchTerm = !term || (o.order_code || '').toLowerCase().includes(term) ||
        (o.buyer_name || '').toLowerCase().includes(term) ||
        (o.seller_name || '').toLowerCase().includes(term) ||
        (o.product_title || '').toLowerCase().includes(term);
      const matchSt = stFilter === 'all' || o.status === stFilter;
      const matchEsc = escFilter === 'all' || o.escrow_status === escFilter;
      const method = document.getElementById('orderDeliveryFilter').value;
      const loss = document.getElementById('orderLossFilter').checked;
      const voucher = document.getElementById('orderVoucherFilter').value.trim().toUpperCase();
      return matchTerm && matchSt && matchEsc && (method === 'all' || o.delivery_type === method) && (!loss || o.net_contribution < 0) && (!voucher || o.voucher_code === voucher);
    });

    const tbody = document.getElementById('tblReconBody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="14" style="text-align:center; padding:30px; color:var(--text-muted);">Không tìm thấy đơn hàng nào phù hợp bộ lọc.</td></tr>';
      document.getElementById('tblReconFoot').innerHTML = '';
      return;
    }

    let tP = 0, tS = 0, tD = 0, tC = 0, tF = 0, tSeller = 0, tRefund = 0, tCourier = 0, tNet = 0;

    tbody.innerHTML = filtered.map(o => {
      tP += o.amount;
      tS += o.shipping_fee;
      tD += o.discount;
      tC += o.total_paid;
      tF += o.platform_fee;
      tSeller += o.seller_payout;
      tRefund += o.refund_amount;
      if (o.courier_payable) tCourier += o.courier_payable;
      tNet += o.net_contribution;

      const badgeSt = {
        REQUESTED: 'badge-warning',
        ACCEPTED: 'badge-info',
        DELIVERING: 'badge-info',
        COMPLETED: 'badge-success',
        COMPLETED_AUTO: 'badge-success',
        DISPUTED: 'badge-danger',
        CANCELLED: 'badge-neutral'
      }[o.status] || 'badge-neutral';

      return `
        <tr>
          <td><strong>#${o.order_code}</strong><br><small style="color:var(--text-muted);">${(o.created_at || '').slice(0, 16)}</small></td>
          <td>${o.buyer_name}<br><small style="color:var(--text-muted);">${o.buyer_email || ''}</small></td>
          <td>${o.seller_name}</td>
          <td class="num">${fmtVND(o.amount)}</td>
          <td class="num">${fmtVND(o.shipping_fee)}</td>
          <td class="num" style="color:var(--danger-text);">${o.discount > 0 ? '-' + fmtVND(o.discount) : '0 đ'}</td>
          <td class="num" style="font-weight:700;">${fmtVND(o.total_paid)}</td>
          <td class="num" style="color:var(--success-text);">${fmtVND(o.platform_fee)}</td>
          <td class="num" style="color:var(--primary); font-weight:600;">${fmtVND(o.seller_payout)}</td>
          <td class="num" style="color:var(--warning-text);">${fmtVND(o.refund_amount)}</td>
          <td class="num">${fmtVND(o.courier_payable || 0)}</td>
          <td class="num" style="font-weight:700; color:${o.net_contribution >= 0 ? 'var(--primary)' : 'var(--danger-text)'};">${fmtVND(o.net_contribution)}</td>
          <td><span class="status-badge ${badgeSt}">${o.status}</span><br><small>${o.escrow_status}</small></td>
          <td><button class="btn btn-outline btn-sm" onclick="viewOrderDetail(${o.id})">Xem</button></td>
        </tr>
      `;
    }).join('');

    document.getElementById('tblReconFoot').innerHTML = `
      <tr>
        <td colspan="3"><strong>TỔNG CỘNG (${filtered.length} đơn đã lọc)</strong></td>
        <td class="num">${fmtVND(tP)}</td>
        <td class="num">${fmtVND(tS)}</td>
        <td class="num" style="color:var(--danger-text);">${tD > 0 ? '-' + fmtVND(tD) : '0 đ'}</td>
        <td class="num">${fmtVND(tC)}</td>
        <td class="num">${fmtVND(tF)}</td>
        <td class="num">${fmtVND(tSeller)}</td>
        <td class="num">${fmtVND(tRefund)}</td>
        <td class="num">${fmtVND(tCourier)}</td>
        <td class="num" style="color:${tNet >= 0 ? 'var(--primary)' : 'var(--danger-text)'};">${fmtVND(tNet)}</td>
        <td colspan="2"></td>
      </tr>
    `;
  };

  window.viewOrderDetail = function(orderId) {
    const o = cachedOrders.find(item => item.id === orderId);
    if (!o) return;
    alert(`ĐƠN HÀNG #${o.order_code}\n\n- Sản phẩm: ${o.product_title}\n- Tiền hàng (P): ${fmtVND(o.amount)}\n- Phí vận chuyển (S): ${fmtVND(o.shipping_fee)}\n- Voucher giảm (D): -${fmtVND(o.discount)}\n- Buyer đã trả (C): ${fmtVND(o.total_paid)}\n- Phí sàn (F): ${fmtVND(o.platform_fee)}\n- Seller thực nhận: ${fmtVND(o.seller_payout)}\n- Buyer được hoàn: ${fmtVND(o.refund_amount)}\n- Phí giữ lại khi hoàn: ${fmtVND(o.retained_fee)}\n- Cước phát sinh bù: ${fmtVND(o.shipping_cost_incurred)}\n- Sàn ròng: ${fmtVND(o.net_contribution)}\n- Trạng thái đơn: ${o.status}\n- Trạng thái Escrow: ${o.escrow_status}\n- Hình thức: ${o.delivery_type === 'CAMPUS_MEETUP' ? 'Gặp trực tiếp' : 'TakeTwo vận chuyển'}`);
  };

  // 3. SHIPPING & LOGISTICS
  window.loadShippingData = async function() {
    try {
      const res = await fetch('/api/admin/shipments');
      const list = await res.json();
      const tbody = document.getElementById('tblShippingBody');
      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:24px;">Không có lượt giao nhận nào.</td></tr>';
        return;
      }
      tbody.innerHTML = list.map(sh => `
        <tr>
          <td><strong>${sh.tracking_code}</strong></td>
          <td>#${sh.order_code}<br><small>${sh.product_title}</small></td>
          <td>${sh.pickup_address || '<em style="color:#999;">Chờ seller cung cấp</em>'}</td>
          <td>${sh.delivery_address || 'Địa chỉ nhận'}</td>
          <td class="num">${fmtVND(sh.fee_charged)}</td>
          <td class="num" style="font-weight:600;">${fmtVND(sh.fee_payable)}</td>
          <td><span class="status-badge ${sh.status === 'DELIVERED' ? 'badge-success' : 'badge-info'}">${sh.status}</span></td>
          <td>
            ${!sh.picked_up_at ? '<span>Chưa phát sinh cước</span>' : sh.payable_status === 'PAID'
              ? `<span class="status-badge badge-success">ĐÃ THANH TOÁN</span><br><small>${sh.payable_reference || ''}</small>`
              : `<button class="btn btn-outline btn-sm" onclick="payCourierShipment(${sh.id})">Xác nhận thanh toán</button>`}
          </td>
          <td>
            ${sh.status === 'PENDING_PICKUP' && sh.order_status === 'ACCEPTED' && sh.pickup_address ? `<button class="btn btn-primary btn-sm" onclick="updateShipmentStatus(${sh.id}, 'PICKED_UP')">Đã lấy hàng</button>` : ''}
            ${sh.status === 'PICKED_UP' ? `<button class="btn btn-primary btn-sm" onclick="updateShipmentStatus(${sh.id}, 'DELIVERING')">Đang giao</button>` : ''}
            ${sh.status === 'DELIVERING' ? `<button class="btn btn-primary btn-sm" onclick="updateShipmentStatus(${sh.id}, 'DELIVERED')">Đã giao thành công</button>` : ''}
            ${sh.status === 'DELIVERED' ? `<span style="color:var(--success-text); font-weight:600;">✓ Hoàn tất</span>` : ''}
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  };

  window.updateShipmentStatus = async function(id, status) {
    if (!confirm(`Xác nhận cập nhật vận đơn sang trạng thái "${status}"?`)) return;
    const res = await fetch(`/api/admin/shipments/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const d = await res.json();
    if (!res.ok) alert(d.error || 'Lỗi cập nhật');
    else { alert(d.message); loadShippingData(); updateBadges(); }
  };

  window.payCourierShipment = async function(id) {
    const ref = prompt('Nhập mã đối soát / tham chiếu thanh toán cước cho đơn vị vận chuyển:');
    if (!ref) return;
    const res = await fetch(`/api/admin/shipments/${id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: ref })
    });
    const d = await res.json();
    if (!res.ok) alert(d.error || 'Lỗi thanh toán');
    else { alert(d.message); loadShippingData(); }
  };

  // 4. ESCROW AUDIT
  window.loadEscrowAudit = async function() {
    try {
      const res = await fetch('/api/admin/escrow-audit');
      const d = await res.json();

      const notice = document.getElementById('escrowIntegrityNotice');
      if (d.is_balanced) {
        notice.innerHTML = `<div style="background:var(--success-bg); color:var(--success-text); padding:12px; border-radius:6px; font-weight:600;">✓ Két Escrow cân bằng tuyệt đối: Tổng số dư ví tạm giữ (${fmtVND(d.wallet_escrow_sum)}) KHỚP 100% với tổng các đơn đang HELD (${fmtVND(d.order_escrow_sum)}).</div>`;
      } else {
        notice.innerHTML = `<div style="background:var(--danger-bg); color:var(--danger-text); padding:12px; border-radius:6px; font-weight:700;">⚠ CẢNH BÁO LỆCH KÉT: Ví (${fmtVND(d.wallet_escrow_sum)}) khác đơn (${fmtVND(d.order_escrow_sum)}). Độ lệch: ${fmtVND(d.discrepancy)}. Cần kiểm tra audit log!</div>`;
      }

      const tbody = document.getElementById('tblEscrowAuditBody');
      if (d.held_orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px;">Hiện không có đơn nào đang giữ tiền trong két.</td></tr>';
        return;
      }
      tbody.innerHTML = d.held_orders.map(o => `
        <tr>
          <td><strong>#${o.order_code}</strong></td>
          <td>${o.product_title}</td>
          <td>${o.buyer_name}</td>
          <td>${o.seller_name}</td>
          <td class="num" style="font-weight:700; color:var(--primary);">${fmtVND(o.total_paid)}</td>
          <td>
            ${o.hours_remaining !== null ? `${o.hours_remaining} giờ còn lại` : 'Chưa kích hoạt'}
            ${o.is_urgent ? '<span class="status-badge badge-warning">GẤP < 24h</span>' : ''}
            ${o.is_overdue ? '<span class="status-badge badge-danger">QUÁ HẠN</span>' : ''}
          </td>
          <td>
            ${!o.is_balanced ? '<span class="status-badge badge-danger">LỆCH ESCROW</span>' : ''}
            ${o.is_frozen ? '<span class="status-badge badge-danger">ĐÓNG BĂNG BỞI KHIẾU NẠI</span>' : '<span class="status-badge badge-success">Bình thường</span>'}
            ${o.status === 'DELIVERING' && o.is_balanced ? `<button class="btn btn-outline btn-sm" onclick="releaseEscrow(${o.id})">Giải ngân có lý do</button>` : ''}
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  };

  // 5. DISPUTES
  window.loadDisputesData = async function() {
    try {
      const res = await fetch('/api/admin/disputes');
      const list = await res.json();
      const tbody = document.getElementById('tblDisputesBody');
      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px;">Không có vụ khiếu nại nào cần xử lý.</td></tr>';
        return;
      }
      tbody.innerHTML = list.map(d => `
        <tr>
          <td><strong>Hồ sơ #${d.id}</strong><br><small>Đơn #${d.order_code}</small></td>
          <td><strong style="color:var(--danger-text);">${d.issue_type}</strong><br><small>${d.description || ''}</small></td>
          <td>${d.buyer_name}</td>
          <td>${d.seller_name}</td>
          <td class="num" style="font-weight:700;">${fmtVND(d.total_paid)}</td>
          <td><span class="status-badge ${d.status === 'RESOLVED' ? 'badge-success' : 'badge-danger'}">${d.status} · ${d.stage || 'WAITING_SELLER'}</span><small>Hạn seller 48h · Admin 72h; quá hạn ưu tiên xử lý</small></td>
          <td><button class="btn btn-primary btn-sm" onclick="openDisputeDossier(${d.id})">Thẩm định hồ sơ</button></td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  };

  window.openDisputeDossier = async function(disputeId) {
    try {
      const res = await fetch(`/api/admin/disputes/${disputeId}`);
      const data = await res.json();
      const d = data.dispute;
      const prev = data.financial_preview;

      document.getElementById('disputeModalTitle').textContent = `Thẩm Định Hồ Sơ Khiếu Nại #${d.id} (Đơn #${d.order_code})`;

      let evidenceImgs = [];
      try {
        if (d.evidence_images) {
          evidenceImgs = typeof d.evidence_images === 'string' && d.evidence_images.startsWith('[')
            ? JSON.parse(d.evidence_images)
            : [d.evidence_images];
        }
      } catch (_) {}

      document.getElementById('disputeModalBody').innerHTML = `
        <div style="background:#F8FAFC; padding:14px; border-radius:6px; margin-bottom:14px;">
          <div><strong>Sản phẩm:</strong> ${d.product_title} (${fmtVND(d.product_price)})</div>
          <div><strong>Người mua khiếu nại:</strong> ${d.buyer_name} (${d.buyer_email})</div>
          <div><strong>Người bán bị khiếu nại:</strong> ${d.seller_name} (${d.seller_email})</div>
          <div><strong>Hình thức giao nhận:</strong> ${d.delivery_type === 'CAMPUS_MEETUP' ? 'Gặp trực tiếp' : 'TakeTwo vận chuyển'}</div>
          <div><strong>Tổng tiền đang tạm giữ Escrow:</strong> <strong style="color:var(--primary);">${fmtVND(d.total_paid)}</strong></div>
        </div>

        <div style="margin-bottom:14px;">
          <h4 style="font-size:14px; margin-bottom:6px;">Lý Do & Giải Trình Của Người Mua:</h4>
          <div style="background:#FEF3F2; padding:12px; border-radius:6px; border:1px solid #FEE2E2;">
            <div><strong>Loại vấn đề:</strong> ${d.issue_type}</div>
            <div style="margin-top:6px;">${d.description}</div>
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <h4 style="font-size:14px; margin-bottom:6px;">Bằng Chứng Hình Ảnh Từ Người Mua:</h4>
          ${evidenceImgs.length > 0 ? `
            <div class="gallery-grid">
              ${evidenceImgs.map(img => `<a href="${img}" target="_blank"><img src="${img}" class="gallery-thumb" alt="Bằng chứng"></a>`).join('')}
            </div>
          ` : '<p style="color:var(--text-muted); font-size:13px;">Không có tệp ảnh đính kèm (hoặc trường hợp chưa nhận được hàng).</p>'}
        </div>

        <div style="margin-bottom:14px;">
          <h4 style="font-size:14px; margin-bottom:6px;">Phản Hồi & Giải Trình Của Người Bán:</h4>
          <div style="background:#F0FDF4; padding:12px; border-radius:6px; border:1px solid #DCFCE7;">
            ${d.seller_response || '<em style="color:#666;">Người bán chưa gửi phản hồi. Hạn SLA: 48 giờ.</em>'}
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <h4 style="font-size:14px; margin-bottom:6px;">Lịch Sử Trao Đổi (Pre-Purchase Chat):</h4>
          <div style="max-height:140px; overflow-y:auto; background:#F8FAFC; padding:10px; border-radius:6px; border:1px solid #E2E8F0; font-size:12.5px;">
            ${(data.chat_messages && data.chat_messages.length > 0)
              ? data.chat_messages.map(m => `<div><strong>${m.sender_name}:</strong> ${m.content} <small style="color:#999;">(${(m.created_at || '').slice(11, 16)})</small></div>`).join('')
              : '<p style="color:#999; margin:0;">Chưa có tin nhắn nào được trao đổi trước đó.</p>'}
          </div>
        </div>

        <div style="margin-bottom:14px"><h4>Lịch sử giải trình bổ sung</h4>${(data.posts || []).map(p => `<article style="padding:10px;border-bottom:1px solid #ddd"><strong>${p.author_name}</strong><small> ${p.created_at}</small><p>${p.content}</p>${JSON.parse(p.attachment_ids || '[]').map(id => `<a href="/api/attachments/${id}" target="_blank"><img src="/api/attachments/${id}" width="80" alt="Bằng chứng"></a>`).join('')}</article>`).join('') || '<p>Chưa có giải trình bổ sung.</p>'}<button class="btn btn-outline" onclick="requestCaseInfo(${d.id})">Yêu cầu bổ sung thông tin</button></div>
        <div style="background:#EFF6FF; padding:14px; border-radius:6px; border:1px solid #BFDBFE;">
          <h4 style="color:var(--primary); font-size:14px; margin-bottom:8px;">Bảng Dự Tính Tài Chính Trước Quyết Định:</h4>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:13px;">
            <div style="background:white; padding:10px; border-radius:4px; border:1px solid #BFDBFE;">
              <strong style="color:var(--success-text);">Nếu Giải Ngân Cho Seller:</strong>
              <div>- Seller nhận: ${fmtVND(prev.seller_payout)} (P − F)</div>
              <div>- Phí sàn thu: +${fmtVND(prev.commission)}</div>
              <div>- Sàn ròng: ${fmtVND(prev.platform_net_on_release)}</div>
            </div>
            <div style="background:white; padding:10px; border-radius:4px; border:1px solid #BFDBFE;">
              <strong style="color:var(--primary);">Nếu Hoàn Sau Trừ Phí Sàn:</strong>
              <div>- Buyer nhận lại: ${fmtVND(prev.refund_to_buyer)} (C − Fr)</div>
              <div>- Phí sàn giữ lại: +${fmtVND(prev.potential_fee_retained)}</div>
              <div>- TakeTwo bù ship: -${fmtVND(prev.courier_fee_incurred)}</div>
              <div>- Sàn ròng: ${fmtVND(prev.platform_net_on_refund)}</div>
            </div>
          </div>
        </div>
      `;

      const footer = document.getElementById('disputeModalFooter');
      if (d.status === 'RESOLVED') {
        footer.innerHTML = `
          <span style="font-weight:600; color:var(--success-text); margin-right:auto;">✓ Vụ việc đã được giải quyết: ${d.admin_decision} (${d.admin_reason || ''})</span>
          <button class="btn btn-outline" onclick="closeModal('modalDisputeDossier')">Đóng</button>
        `;
      } else {
        footer.innerHTML = `
          <button class="btn btn-outline" onclick="markDisputeReviewed(${d.id})">Đánh dấu đã thẩm định</button>
          <button class="btn btn-primary" ${d.delivery_type !== 'CAMPUS_MEETUP' && !data.shipment?.picked_up_at ? 'disabled title="Chưa ghi nhận lấy hàng"' : ''} onclick="resolveDisputeDecision(${d.id}, 'RELEASE_SELLER')">Giải ngân cho Seller</button>
          <button class="btn btn-danger" onclick="resolveDisputeDecision(${d.id}, 'REFUND_BUYER')">Hoàn tiền (trừ phí sàn)</button>
          <button class="btn btn-outline" onclick="closeModal('modalDisputeDossier')">Đóng</button>
        `;
      }

      document.getElementById('modalDisputeDossier').hidden = false;
    } catch (e) {
      console.error(e);
    }
  };

  window.markDisputeReviewed = async function(id) {
    await fetch(`/api/admin/disputes/${id}/review`, { method: 'POST' });
    alert('Đã đánh dấu hồ sơ là "Đang xem xét (Đã thẩm định)".');
    loadDisputesData();
  };

  window.resolveDisputeDecision = async function(id, decision) {
    const actionName = decision === 'RELEASE_SELLER' ? 'Giải ngân cho Người Bán' : 'Hoàn tiền cho Người Mua sau khi trừ phí sàn';
    const reason = prompt(`Nhập lý do và căn cứ cho quyết định [${actionName}]:`);
    if (!reason) return;

    const res = await fetch(`/api/admin/disputes/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reason })
    });
    const d = await res.json();
    if (!res.ok) alert(d.error || 'Lỗi xử lý');
    else {
      alert(d.message);
      closeModal('modalDisputeDossier');
      loadDisputesData();
      loadKpiData();
      updateBadges();
    }
  };

  // 6. USERS & CONTENT MODERATION
  window.loadUsersData = async function() {
    try {
      const res = await fetch('/api/admin/users');
      const list = await res.json();
      document.getElementById('tblUsersBody').innerHTML = list.map(u => `
        <tr>
          <td>${u.id}</td>
          <td><strong>${u.name}</strong><br><small>${u.email}</small></td>
          <td>${u.role}</td>
          <td>${u.campus || ''}<br><small>${u.verification_status || 'UNVERIFIED'}</small>${u.role !== 'ADMIN' ? `<button class="btn btn-outline btn-sm" onclick="verifyStudent(${u.id})">Kiểm tra email</button>` : ''}</td>
          <td><span class="status-badge ${u.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}">${u.status}</span></td>
          <td>${u.warning_count || 0}</td>
          <td class="num">${fmtVND(u.available_balance)}</td>
          <td class="num">${fmtVND(u.escrow_balance)}</td>
          <td>
            ${u.role !== 'ADMIN' ? `
              ${u.status === 'ACTIVE'
                ? `<button class="btn btn-danger btn-sm" onclick="toggleUserStatus(${u.id}, 'LOCKED')">Khóa</button>`
                : `<button class="btn btn-outline btn-sm" onclick="toggleUserStatus(${u.id}, 'ACTIVE')">Mở khóa</button>`}
              <button class="btn btn-outline btn-sm" onclick="warnUser(${u.id})">Cảnh cáo</button><button class="btn btn-outline btn-sm" onclick="userHistory(${u.id})">Lịch sử</button>
            ` : '<em>Admin</em>'}
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  };

  window.toggleUserStatus = async function(id, status) {
    const reason = prompt(status === 'LOCKED' ? 'Lý do khóa tài khoản:' : 'Lý do mở khóa tài khoản:');
    if (!reason?.trim()) return;
    const res = await fetch(`/api/admin/users/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason })
    });
    const d = await res.json();
    if (!res.ok) alert(d.error || 'Lỗi');
    else { alert(d.message); loadUsersData(); }
  };

  window.warnUser = async function(id) {
    const reason = prompt('Nhập lý do cảnh cáo tài khoản:');
    if (!reason) return;
    const res = await fetch(`/api/admin/users/${id}/warn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const d = await res.json();
    alert(d.message);
    loadUsersData();
  };

  window.loadProductsModeration = async function() {
    try {
      const res = await fetch('/api/admin/products');
      const list = await res.json();
      document.getElementById('tblProductsModBody').innerHTML = list.map(p => `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <img src="${p.image_url}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;" alt="">
              <div><strong>${p.title}</strong><br><small style="color:var(--text-muted);">${p.campus_cluster}</small></div>
            </div>
          </td>
          <td>${p.seller_name}</td>
          <td>${p.category_name}</td>
          <td class="num">${fmtVND(p.price)}</td>
          <td><span class="status-badge ${p.approval_status === 'APPROVED' ? 'badge-success' : (p.approval_status === 'PENDING_APPROVAL' ? 'badge-warning' : 'badge-danger')}">${p.approval_status}</span></td>
          <td>
            ${p.approval_status !== 'APPROVED' || p.status === 'HIDDEN' ? `<button class="btn btn-primary btn-sm" onclick="approveProduct(${p.id})">Duyệt / Hiện tin</button>` : ''}
            <button class="btn btn-danger btn-sm" onclick="hideProduct(${p.id})">Gỡ tin</button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  };

  window.approveProduct = async function(id) {
    const res = await fetch(`/api/admin/products/${id}/approve`, { method: 'POST' });
    const d = await res.json();
    alert(d.message);
    loadProductsModeration();
  };

  window.hideProduct = async function(id) {
    const reason = prompt('Nhập lý do ẩn/gỡ sản phẩm khỏi sàn:');
    if (!reason) return;
    const res = await fetch(`/api/admin/products/${id}/hide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const d = await res.json();
    alert(d.message);
    loadProductsModeration();
  };

  window.loadReportsData = async function() {
    try {
      const res = await fetch('/api/admin/reports');
      const list = await res.json();
      const tbody = document.getElementById('tblReportsBody');
      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px;">Không có báo cáo vi phạm nào.</td></tr>';
        return;
      }
      tbody.innerHTML = list.map(r => `
        <tr>
          <td><strong>${r.product_title}</strong></td>
          <td>${r.reporter_name}</td>
          <td><strong style="color:var(--danger-text);">${r.reason}</strong></td>
          <td>${r.description || ''}</td>
          <td><span class="status-badge ${r.status === 'REVIEWED' ? 'badge-success' : 'badge-warning'}">${r.status}</span></td>
          <td>
            ${r.status === 'PENDING' ? `
              <button class="btn btn-danger btn-sm" onclick="resolveReport(${r.id}, 'HIDE_PRODUCT')">Ẩn tin</button>
              <button class="btn btn-outline btn-sm" onclick="resolveReport(${r.id}, 'DISMISS')">Bỏ qua</button>
            ` : '<em>Đã xử lý</em>'}
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  };

  window.resolveReport = async function(id, action) {
    const res = await fetch(`/api/admin/reports/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const d = await res.json();
    alert(d.message);
    loadReportsData();
    loadProductsModeration();
  };

  // 7. VOUCHERS
  window.loadVouchersData = async function() {
    try {
      const res = await fetch('/api/admin/vouchers');
      const list = await res.json();
      document.getElementById('tblVouchersBody').innerHTML = list.map(v => {
        const remaining = v.budget - v.budget_used - v.budget_held;
        return `
          <tr>
            <td><strong>${v.code}</strong></td>
            <td>${v.title}</td>
            <td>${v.discount_type === 'FIXED' ? fmtVND(v.discount_value) : v.discount_value + '%'}</td>
            <td class="num">${fmtVND(v.min_spend)}</td>
            <td class="num">${fmtVND(v.budget)}</td>
            <td class="num">${fmtVND(v.budget_used)}</td>
            <td class="num">${fmtVND(v.budget_held)}</td>
            <td class="num" style="font-weight:700; color:${remaining > 0 ? 'var(--success-text)' : 'var(--danger-text)'};">${fmtVND(remaining)}</td>
            <td><span class="status-badge ${v.is_active ? 'badge-success' : 'badge-neutral'}">${v.is_active ? 'Đang bật' : 'Đã tắt'}</span></td>
            <td>
              <button class="btn btn-outline btn-sm" onclick="toggleVoucherActive(${v.id})">${v.is_active ? 'Tắt' : 'Bật'}</button><button class="btn btn-outline btn-sm" onclick="voucherReport(${v.id})">Báo cáo</button><button class="btn btn-outline btn-sm" onclick="editVoucherCampaign(${v.id})">Chỉnh sửa</button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.error(e);
    }
  };

  window.toggleVoucherActive = async function(id) {
    const res = await fetch(`/api/admin/vouchers/${id}/toggle`, { method: 'POST' });
    const d = await res.json();
    alert(d.message);
    loadVouchersData();
  };

  window.openNewVoucherModal = function() {
    editingVoucherId = null;
    document.getElementById('vCode').disabled = false;
    for (const id of ['vCode','vTitle','vValue','vMaxDiscount','vMinSpend','vBudget','vTargets','vStart','vEnd']) document.getElementById(id).value = '';
    document.getElementById('vAudience').value = 'ALL';
    document.getElementById('vPerUser').value = '1';
    document.getElementById('vUsageLimit').value = '100';
    document.getElementById('modalNewVoucher').hidden = false;
  };

  window.submitCreateVoucher = async function() {
    const code = document.getElementById('vCode').value.trim();
    const title = document.getElementById('vTitle').value.trim();
    const discount_type = document.getElementById('vType').value;
    const discount_value = Number(document.getElementById('vValue').value);
    const max_discount = Number(document.getElementById('vMaxDiscount').value) || null;
    const min_spend = Number(document.getElementById('vMinSpend').value) || 0;
    const budget = Number(document.getElementById('vBudget').value);
    const usage_limit = Number(document.getElementById('vUsageLimit').value) || 100;

    if (!code || !title || !discount_value || !budget) {
      alert('Vui lòng điền đầy đủ các trường bắt buộc!');
      return;
    }

    const res = await fetch(editingVoucherId ? `/api/admin/vouchers/${editingVoucherId}/update` : '/api/admin/vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, title, discount_type, discount_value, max_discount, min_spend, budget, usage_limit, usage_per_user: Number(document.getElementById('vPerUser').value), target_audience: document.getElementById('vAudience').value, target_user_ids: document.getElementById('vTargets').value.split(',').map(v => v.trim()).filter(Boolean).map(Number), start_date: document.getElementById('vStart').value || null, end_date: document.getElementById('vEnd').value || null })
    });
    const d = await res.json();
    if (!res.ok) alert(d.error || 'Lỗi');
    else {
      alert(d.message);
      closeModal('modalNewVoucher');
      loadVouchersData();
    }
  };

  window.requestCaseInfo = async id => {
    const content = prompt('Thông tin hoặc bằng chứng cần hai bên bổ sung:'); if (!content?.trim()) return;
    const r = await fetch(`/api/disputes/${id}/posts`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({content}) });
    const d = await r.json(); alert(d.message || d.error); if (r.ok) openDisputeDossier(id);
  };
  window.verifyStudent = async id => {
    const status = prompt('Kết quả: LOCAL_VERIFIED, UNVERIFIED hoặc REJECTED (chỉ kiểm tra local):','LOCAL_VERIFIED');
    if (!status) return;
    const reason = prompt('Căn cứ kiểm tra email sinh viên:'); if (!reason?.trim()) return;
    const r = await fetch(`/api/admin/users/${id}/verification`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,reason})});
    const d = await r.json(); alert(d.message || d.error); if(r.ok) loadUsersData();
  };
  window.editVoucherCampaign = async id => {
    const list = await (await fetch('/api/admin/vouchers')).json(); const v = list.find(v=>v.id===id); if(!v) return;
    openNewVoucherModal(); editingVoucherId = id;
    const values = {vCode:v.code,vTitle:v.title,vType:v.discount_type,vValue:v.discount_value,vMaxDiscount:v.max_discount,vMinSpend:v.min_spend,vBudget:v.budget,vUsageLimit:v.usage_limit,vPerUser:v.usage_per_user,vAudience:v.target_audience,vStart:v.start_date?.slice(0,16),vEnd:v.end_date?.slice(0,16),vTargets:JSON.parse(v.target_user_ids || '[]').join(',')};
    for(const [key,value] of Object.entries(values)) { const decoder=document.createElement('textarea');decoder.innerHTML=String(value ?? '');document.getElementById(key).value=decoder.value; }
    document.getElementById('vCode').disabled = true;
  };
  window.userHistory = async id => {
    const d = await (await fetch(`/api/admin/users/${id}/history`)).json();
    alert(`Lịch sử: ${d.orders.length} đơn\n` + d.orders.map(o => `${o.order_code}: ${o.status}`).join('\n') + '\nVi phạm & quyết định:\n' + d.violations.map(v => `${v.created_at}: ${v.reason}`).join('\n'));
  };
  window.voucherReport = async id => {
    const d = await (await fetch(`/api/admin/vouchers/${id}/report`)).json();
    alert(`${d.campaign.code}\nĐơn: ${d.orders}\nGMV hoàn tất: ${fmtVND(d.gmv)}\nTrợ giá: ${fmtVND(d.subsidy)}\nĐóng góp ròng: ${fmtVND(d.net_contribution)}\nNgân sách còn: ${fmtVND(d.remaining_budget)}`);
  };
  window.editVoucherBudget = async id => {
    const budget = prompt('Ngân sách tổng mới (không thấp hơn đã dùng + đang giữ):'); if (!budget) return;
    const r = await fetch(`/api/admin/vouchers/${id}/update`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({budget:Number(budget)})});
    const d = await r.json(); alert(d.message || d.error); if(r.ok) loadVouchersData();
  };
  window.refreshAdminPeriod = () => switchView(currentView);
  window.releaseEscrow = async id => {
    const reason = prompt('Lý do và căn cứ giải ngân thủ công (không thay cho buyer xác nhận nhận hàng):');
    if(!reason?.trim()) return;
    const r = await fetch(`/api/admin/escrow/${id}/release`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason})});
    const d=await r.json();alert(d.message || d.error);if(r.ok){loadEscrowAudit();updateBadges();}
  };
  window.addEventListener('popstate', () => switchView(location.hash.slice(1) || 'kpi'));
  // Initialize
  checkAdminAuth();
})();

