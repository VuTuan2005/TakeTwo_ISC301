import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import date

wb = openpyxl.Workbook()
# remove default sheet
wb.remove(wb.active)

# Color Palette (Corporate Blue & Crisp Modern)
NAVY_HEADER = "1B365D"
BLUE_ACCENT = "2B6CB0"
ICE_BLUE = "EBF4FF"
ZEBRA_ROW = "F7FAFC"
WHITE = "FFFFFF"
GRAY_BORDER = "CBD5E1"
DARK_TEXT = "1E293B"

# Status colors
DONE_FILL = "D1FAE5"      # Green soft
DONE_TEXT = "065F46"
IN_PROG_FILL = "FEF3C7"   # Amber soft
IN_PROG_TEXT = "92400E"
PENDING_FILL = "F3F4F6"   # Gray soft
PENDING_TEXT = "4B5563"

font_title = Font(name="Segoe UI", size=16, bold=True, color=WHITE)
font_subtitle = Font(name="Segoe UI", size=10, italic=True, color="E2E8F0")
font_section = Font(name="Segoe UI", size=12, bold=True, color="1E3A8A")
font_tbl_header = Font(name="Segoe UI", size=10, bold=True, color=WHITE)
font_tbl_header_dark = Font(name="Segoe UI", size=10, bold=True, color=DARK_TEXT)
font_data = Font(name="Segoe UI", size=10, color=DARK_TEXT)
font_data_bold = Font(name="Segoe UI", size=10, bold=True, color=DARK_TEXT)
font_data_center = Font(name="Segoe UI", size=10, color=DARK_TEXT)

thin_border = Border(
    left=Side(style='thin', color=GRAY_BORDER),
    right=Side(style='thin', color=GRAY_BORDER),
    top=Side(style='thin', color=GRAY_BORDER),
    bottom=Side(style='thin', color=GRAY_BORDER)
)

fill_navy = PatternFill(start_color=NAVY_HEADER, end_color=NAVY_HEADER, fill_type="solid")
fill_blue = PatternFill(start_color=BLUE_ACCENT, end_color=BLUE_ACCENT, fill_type="solid")
fill_ice = PatternFill(start_color=ICE_BLUE, end_color=ICE_BLUE, fill_type="solid")
fill_zebra = PatternFill(start_color=ZEBRA_ROW, end_color=ZEBRA_ROW, fill_type="solid")
fill_white = PatternFill(start_color=WHITE, end_color=WHITE, fill_type="solid")

align_center = Alignment(horizontal="center", vertical="center")
align_left = Alignment(horizontal="left", vertical="center")
align_right = Alignment(horizontal="right", vertical="center")

align_header = Alignment(horizontal="center", vertical="center", wrap_text=True)

# -------------------------------------------------------------
# SHEET 1: DASHBOARD & TONG QUAN
# -------------------------------------------------------------
ws1 = wb.create_sheet(title="Tong_Quan_Tien_Do")
ws1.views.sheetView[0].showGridLines = True

# Title Banner
ws1.merge_cells("A1:H2")
title_cell = ws1["A1"]
title_cell.value = "BÁO CÁO TIẾN ĐỘ DỰ ÁN TAKETWO - C2C SECONDHAND MARKETPLACE (ISC301)"
title_cell.font = font_title
title_cell.fill = fill_navy
title_cell.alignment = align_center

ws1.merge_cells("A3:H3")
sub_cell = ws1["A3"]
sub_cell.value = "Thời gian theo dõi: 20/10/2026 - 04/11/2026 | Nhóm sinh viên: Phạm Quang Huy, Nguyễn Tuấn Hùng, Phan Thanh Bình, Vũ Hán Tuấn, Đào Thiên Phú"
sub_cell.font = Font(name="Segoe UI", size=9, italic=True, color="334155")
sub_cell.fill = fill_ice
sub_cell.alignment = align_center

# Summary KPI Cards
# Card 1: Tổng số Tasks
ws1.merge_cells("B5:C5")
ws1["B5"] = "TỔNG SỐ ĐẦU VIỆC (TASKS)"
ws1["B5"].font = Font(name="Segoe UI", size=9, bold=True, color="475569")
ws1["B5"].alignment = align_center
ws1["B5"].fill = fill_ice

ws1.merge_cells("B6:C6")
ws1["B6"] = "=COUNTA(Chi_Tiet_WBS_Tasks!A4:A48)"
ws1["B6"].font = Font(name="Segoe UI", size=18, bold=True, color="1E3A8A")
ws1["B6"].alignment = align_center
ws1["B6"].fill = fill_white

# Card 2: Tasks Hoàn thành
ws1.merge_cells("D5:E5")
ws1["D5"] = "TASKS ĐÃ HOÀN THÀNH"
ws1["D5"].font = Font(name="Segoe UI", size=9, bold=True, color="065F46")
ws1["D5"].alignment = align_center
ws1["D5"].fill = PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid")

ws1.merge_cells("D6:E6")
ws1["D6"] = '=COUNTIF(Chi_Tiet_WBS_Tasks!I4:I48, "Đã hoàn thành")'
ws1["D6"].font = Font(name="Segoe UI", size=18, bold=True, color="065F46")
ws1["D6"].alignment = align_center
ws1["D6"].fill = fill_white

# Card 3: Tasks Chưa hoàn thành (Chủ yếu là Testing)
ws1.merge_cells("F5:G5")
ws1["F5"] = "TASKS KIỂM THỬ / ĐANG XỬ LÝ"
ws1["F5"].font = Font(name="Segoe UI", size=9, bold=True, color="92400E")
ws1["F5"].alignment = align_center
ws1["F5"].fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")

ws1.merge_cells("F6:G6")
ws1["F6"] = '=COUNTIF(Chi_Tiet_WBS_Tasks!I4:I48, "Đang thực hiện") + COUNTIF(Chi_Tiet_WBS_Tasks!I4:I48, "Chưa bắt đầu")'
ws1["F6"].font = Font(name="Segoe UI", size=18, bold=True, color="92400E")
ws1["F6"].alignment = align_center
ws1["F6"].fill = fill_white

for r in range(5, 7):
    for c in range(2, 8):
        ws1.cell(row=r, column=c).border = thin_border

# Bảng phân bổ tiến độ theo thành viên
ws1["B9"] = "BẢNG TIẾN ĐỘ THỰC HIỆN THEO THÀNH VIÊN"
ws1["B9"].font = font_section

headers_mem = ["STT", "Họ và Tên", "Vai trò chính", "Số task phụ trách", "Đã xong", "Đang test/chờ", "Tỷ lệ hoàn thành"]
for i, h in enumerate(headers_mem, start=2):
    c = ws1.cell(row=10, column=i, value=h)
    c.font = font_tbl_header
    c.fill = fill_blue
    c.alignment = align_header
    c.border = thin_border
ws1.row_dimensions[10].height = 25

members_data = [
    (1, "Phạm Quang Huy", "Team Lead, Core Backend & Escrow Wallet", '=COUNTIF(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Huy*")', '=COUNTIFS(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Huy*", Chi_Tiet_WBS_Tasks!$I$4:$I$48, "Đã hoàn thành")', '=COUNTIFS(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Huy*", Chi_Tiet_WBS_Tasks!$I$4:$I$48, "<>Đã hoàn thành")', '=F11/E11'),
    (2, "Nguyễn Tuấn Hùng", "Backend Developer, Marketplace & Bump Listing", '=COUNTIF(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Hùng*")', '=COUNTIFS(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Hùng*", Chi_Tiet_WBS_Tasks!$I$4:$I$48, "Đã hoàn thành")', '=COUNTIFS(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Hùng*", Chi_Tiet_WBS_Tasks!$I$4:$I$48, "<>Đã hoàn thành")', '=F12/E12'),
    (3, "Phan Thanh Bình", "Backend Developer, Orders & Dispute Resolution", '=COUNTIF(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Bình*")', '=COUNTIFS(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Bình*", Chi_Tiet_WBS_Tasks!$I$4:$I$48, "Đã hoàn thành")', '=COUNTIFS(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Bình*", Chi_Tiet_WBS_Tasks!$I$4:$I$48, "<>Đã hoàn thành")', '=F13/E13'),
    (4, "Vũ Hán Tuấn", "Frontend Lead, Dashboard Xanh & Responsive UI", '=COUNTIF(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Tuấn*")', '=COUNTIFS(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Tuấn*", Chi_Tiet_WBS_Tasks!$I$4:$I$48, "Đã hoàn thành")', '=COUNTIFS(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Tuấn*", Chi_Tiet_WBS_Tasks!$I$4:$I$48, "<>Đã hoàn thành")', '=F14/E14'),
    (5, "Đào Thiên Phú", "Frontend/Fullstack, Chat P2P & Admin Operations", '=COUNTIF(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Phú*")', '=COUNTIFS(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Phú*", Chi_Tiet_WBS_Tasks!$I$4:$I$48, "Đã hoàn thành")', '=COUNTIFS(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Phú*", Chi_Tiet_WBS_Tasks!$I$4:$I$48, "<>Đã hoàn thành")', '=F15/E15'),
]

for row_idx, row_val in enumerate(members_data, start=11):
    ws1.row_dimensions[row_idx].height = 22
    for col_idx, val in enumerate(row_val, start=2):
        cell = ws1.cell(row=row_idx, column=col_idx, value=val)
        cell.font = font_data
        cell.border = thin_border
        cell.fill = fill_zebra if row_idx % 2 == 0 else fill_white
        if col_idx in [2, 5, 6, 7]:
            cell.alignment = align_center
        elif col_idx == 8:
            cell.alignment = align_right
            cell.number_format = "0.0%"
            cell.font = font_data_bold
        else:
            cell.alignment = align_left

# Total row
tot_row = 16
ws1.cell(row=tot_row, column=2, value="").border = thin_border
ws1.merge_cells("B16:D16")
tot_label = ws1.cell(row=tot_row, column=2, value="TỔNG CỘNG / TRUNG BÌNH")
tot_label.font = font_data_bold
tot_label.alignment = align_center
tot_label.fill = fill_ice
for c in range(2, 5):
    ws1.cell(row=tot_row, column=c).border = thin_border
    ws1.cell(row=tot_row, column=c).fill = fill_ice

c_e = ws1.cell(row=tot_row, column=5, value="=SUM(E11:E15)")
c_e.font = font_data_bold
c_e.alignment = align_center
c_e.fill = fill_ice
c_e.border = thin_border

c_f = ws1.cell(row=tot_row, column=6, value="=SUM(F11:F15)")
c_f.font = font_data_bold
c_f.alignment = align_center
c_f.fill = fill_ice
c_f.border = thin_border

c_g = ws1.cell(row=tot_row, column=7, value="=SUM(G11:G15)")
c_g.font = font_data_bold
c_g.alignment = align_center
c_g.fill = fill_ice
c_g.border = thin_border

c_h = ws1.cell(row=tot_row, column=8, value="=F16/E16")
c_h.font = font_data_bold
c_h.alignment = align_right
c_h.number_format = "0.0%"
c_h.fill = fill_ice
c_h.border = thin_border

# Bảng phân bổ tiến độ theo Giai đoạn
ws1["B19"] = "TIẾN ĐỘ THEO CÁC GIAI ĐOẠN DỰ ÁN (20/10 - 04/11/2026)"
ws1["B19"].font = font_section

headers_stage = ["Giai đoạn", "Thời gian", "Nội dung trọng tâm", "Đầu ra bàn giao", "Tình trạng"]
for i, h in enumerate(headers_stage, start=2):
    c = ws1.cell(row=20, column=i, value=h)
    c.font = font_tbl_header
    c.fill = fill_blue
    c.alignment = align_header
    c.border = thin_border
ws1.row_dimensions[20].height = 25

stages_data = [
    ("Phase 1: Requirements & DB Design", "20/10 - 22/10", "Khảo sát yêu cầu, thống nhất quy tắc Escrow, thiết kế DB SQLite & Use Case", "PLAN.md, db.js, DB Schema, Wireframe UI", "Đã hoàn thành (100%)"),
    ("Phase 2: Core API & Marketplace", "23/10 - 26/10", "Xây dựng Auth, Quản lý tài khoản, Đăng bán sản phẩm, Đẩy top (Bump 49k/79k)", "REST APIs, services/marketplace.js, Upload ảnh", "Đã hoàn thành (100%)"),
    ("Phase 3: Order, Escrow & Frontend", "27/10 - 30/10", "Checkout, Tính phí sàn F=3%, Giữ tiền Escrow, Khôi phục Dashboard xanh & Chat", "flow-mua-ban.html, index.html, services/ledger.js", "Đã hoàn thành (100%)"),
    ("Phase 4: Dispute, Voucher & Admin", "31/10 - 02/11", "Tranh chấp, Hoàn tiền trừ phí sàn, Chiến dịch voucher, Portal Admin quản trị", "admin.html, admin.js, services/operations.js", "Đã hoàn thành (100%)"),
    ("Phase 5: Refactoring, UI Polish & Tests", "03/11 - 04/11", "Tối ưu hóa UI desktop/mobile, viền thẻ, popup nạp tiền, viết bộ test kiểm thử", "marketplace.test.js, operations.test.js (đang test)", "Đang kiểm thử (35%)"),
]

for row_idx, row_val in enumerate(stages_data, start=21):
    ws1.row_dimensions[row_idx].height = 22
    for col_idx, val in enumerate(row_val, start=2):
        cell = ws1.cell(row=row_idx, column=col_idx, value=val)
        cell.font = font_data
        cell.border = thin_border
        cell.fill = fill_zebra if row_idx % 2 == 0 else fill_white
        if col_idx in [2, 3]:
            cell.alignment = align_center
        elif col_idx == 6:
            cell.alignment = align_center
            if "100%" in val:
                cell.fill = PatternFill(start_color=DONE_FILL, end_color=DONE_FILL, fill_type="solid")
                cell.font = Font(name="Segoe UI", size=10, bold=True, color=DONE_TEXT)
            else:
                cell.fill = PatternFill(start_color=IN_PROG_FILL, end_color=IN_PROG_FILL, fill_type="solid")
                cell.font = Font(name="Segoe UI", size=10, bold=True, color=IN_PROG_TEXT)
        else:
            cell.alignment = align_left


# -------------------------------------------------------------
# SHEET 2: DANH MỤC USE CASE HỆ THỐNG
# -------------------------------------------------------------
ws2 = wb.create_sheet(title="Danh_Muc_Use_Case")
ws2.views.sheetView[0].showGridLines = True

ws2.merge_cells("A1:H2")
title_uc = ws2["A1"]
title_uc.value = "DANH MỤC USE CASE HỆ THỐNG TAKETWO C2C MARKETPLACE"
title_uc.font = font_title
title_uc.fill = fill_navy
title_uc.alignment = align_center

ws2.merge_cells("A3:H3")
sub_uc = ws2["A3"]
sub_uc.value = "Ma trận ánh xạ Use Case hệ thống, phân công thành viên phụ trách và trạng thái hoàn thành chức năng"
sub_uc.font = Font(name="Segoe UI", size=9, italic=True, color="334155")
sub_uc.fill = fill_ice
sub_uc.alignment = align_center

headers_uc = ["Mã UC", "Phân hệ (Module)", "Tên Use Case", "Actor chính", "Mô tả nghiệp vụ tóm tắt", "Phụ trách chính", "Độ phức tạp", "Trạng thái chức năng"]
for i, h in enumerate(headers_uc, start=1):
    c = ws2.cell(row=5, column=i, value=h)
    c.font = font_tbl_header
    c.fill = fill_blue
    c.alignment = align_header
    c.border = thin_border
ws2.row_dimensions[5].height = 25

use_cases_data = [
    # Module 1: Auth & User
    ("UC-01", "Tài khoản & Xác thực", "Đăng ký & Đăng nhập sinh viên", "Sinh viên", "Xác thực danh tính sinh viên trường (email/mã SV), cấp JWT & phiên làm việc", "Phạm Quang Huy", "Vừa", "Đã hoàn thành"),
    ("UC-02", "Tài khoản & Xác thực", "Quản lý hồ sơ & Địa chỉ Campus", "Người dùng", "Cập nhật số điện thoại, chọn Campus (Hòa Lạc/Hà Nội), khu vực Dom/Ký túc xá", "Vũ Hán Tuấn", "Dễ", "Đã hoàn thành"),
    ("UC-03", "Tài khoản & Xác thực", "Chuyển đổi tài khoản demo", "Tester / Admin", "Chuyển nhanh giữa 4 tài khoản mẫu (Buyer 1, Seller 2, Shipper, Admin)", "Phạm Quang Huy", "Dễ", "Đã hoàn thành"),
    
    # Module 2: Sản phẩm & Đăng bán
    ("UC-04", "Sản phẩm & Gian hàng", "Đăng bán đồ cũ (Listing)", "Người bán (Seller)", "Nhập tiêu đề, danh mục, giá, tình trạng đồ, tải ảnh và chọn điểm hẹn gợi ý", "Nguyễn Tuấn Hùng", "Vừa", "Đã hoàn thành"),
    ("UC-05", "Sản phẩm & Gian hàng", "Tìm kiếm & Lọc sản phẩm", "Người mua (Buyer)", "Lọc theo danh mục (Sách, Đồ điện tử, Đồ gia dụng), khoảng giá, cụm Campus", "Nguyễn Tuấn Hùng", "Vừa", "Đã hoàn thành"),
    ("UC-06", "Sản phẩm & Gian hàng", "Xem chi tiết bài đăng", "Người dùng", "Xem đầy đủ mô tả, hình ảnh, thông tin người bán, nút Mua/Chat/Lưu tin", "Vũ Hán Tuấn", "Dễ", "Đã hoàn thành"),
    ("UC-07", "Sản phẩm & Gian hàng", "Đẩy tin lên đầu trang (Bump Top)", "Người bán (Seller)", "Dùng lượt đẩy miễn phí hoặc mua gói 49k (5 lượt), 79k (10 lượt), ưu tiên 7 ngày", "Nguyễn Tuấn Hùng", "Khó", "Đã hoàn thành"),
    ("UC-08", "Sản phẩm & Gian hàng", "Quản lý gian hàng cá nhân", "Người bán (Seller)", "Theo dõi danh sách bài đang bán, đã bán, tạm ẩn hoặc xóa sản phẩm", "Nguyễn Tuấn Hùng", "Vừa", "Đã hoàn thành"),

    # Module 3: Trao đổi & Nhắn tin
    ("UC-09", "Tin nhắn P2P", "Chat Buyer - Seller trước khi mua", "Buyer & Seller", "Nhắn tin hỏi thông tin đồ dùng trực tiếp từ trang sản phẩm mà không cần cọc tiền", "Đào Thiên Phú", "Vừa", "Đã hoàn thành"),
    ("UC-10", "Tin nhắn P2P", "Gửi ảnh tình trạng thực tế qua chat", "Buyer & Seller", "Đính kèm ảnh chi tiết lỗi vết xước, hình chụp thực tế của sản phẩm", "Đào Thiên Phú", "Vừa", "Đã hoàn thành"),
    ("UC-11", "Tin nhắn P2P", "Hộp thư hội thoại theo sản phẩm", "Buyer & Seller", "Danh sách cuộc hội thoại nhóm theo từng listing, hiển thị tin chưa đọc, polling", "Đào Thiên Phú", "Vừa", "Đã hoàn thành"),

    # Module 4: Đặt mua & Ký quỹ Escrow
    ("UC-12", "Thanh toán & Escrow", "Báo giá Checkout chính xác", "Người mua (Buyer)", "Hệ thống tính toán minh bạch: Tiền hàng P, Ship S, Giảm giá D, Phí sàn F=3%P", "Phạm Quang Huy", "Khó", "Đã hoàn thành"),
    ("UC-13", "Thanh toán & Escrow", "Áp dụng Voucher giảm giá", "Người mua (Buyer)", "Kiểm tra điều kiện đơn tối thiểu, số lượt dùng còn lại, trừ ngân sách khuyến mãi", "Đào Thiên Phú", "Khó", "Đã hoàn thành"),
    ("UC-14", "Thanh toán & Escrow", "Giữ tiền ký quỹ an toàn (Escrow)", "Hệ thống TakeTwo", "Khóa số tiền C vào tài khoản ký quỹ trung gian, đảm bảo an toàn giao dịch", "Phạm Quang Huy", "Khó", "Đã hoàn thành"),
    ("UC-15", "Thanh toán & Escrow", "Nạp tiền ví tức thì khi thiếu số dư", "Người mua (Buyer)", "Mở popup nạp tiền ngay trên checkout, gợi ý làm tròn 10.000đ, không làm mất giỏ hàng", "Vũ Hán Tuấn", "Vừa", "Đã hoàn thành"),
    ("UC-16", "Thanh toán & Escrow", "Quản lý ví & Sổ cái giao dịch", "Người dùng", "Xem số dư khả dụng, số dư ký quỹ Escrow, lịch sử nạp/rút/hoàn tiền chi tiết", "Phạm Quang Huy", "Khó", "Đã hoàn thành"),

    # Module 5: Giao nhận & Vận chuyển
    ("UC-17", "Giao nhận & Vận chuyển", "Giao nhận gặp trực tiếp (Meetup)", "Buyer & Seller", "Phí 0đ, thỏa thuận điểm hẹn tại canteen/cổng trường, Seller xem trước khi nhận đơn", "Phan Thanh Bình", "Dễ", "Đã hoàn thành"),
    ("UC-18", "Giao nhận & Vận chuyển", "TakeTwo hỗ trợ vận chuyển nội khu", "Buyer & Shipper", "Cước 15k/25k, Seller cung cấp địa chỉ lấy đồ, Shipper cập nhật trạng thái lấy/giao", "Phan Thanh Bình", "Vừa", "Đã hoàn thành"),
    ("UC-19", "Giao nhận & Vận chuyển", "Seller tiếp nhận & Chuẩn bị đơn", "Người bán (Seller)", "Seller duyệt đơn hàng, xác nhận chuẩn bị hàng hoặc từ chối đơn trả tiền buyer", "Phan Thanh Bình", "Vừa", "Đã hoàn thành"),

    # Module 6: Hậu mãi & Tranh chấp
    ("UC-20", "Khiếu nại & Tranh chấp", "Xác nhận nhận hàng & Giải ngân", "Người mua (Buyer)", "Buyer kiểm tra đồ ưng ý, bấm xác nhận để sàn chuyển tiền (P - F) vào ví Seller", "Phan Thanh Bình", "Vừa", "Đã hoàn thành"),
    ("UC-21", "Khiếu nại & Tranh chấp", "Tự động hoàn tất đơn (Auto-complete)", "Hệ thống TakeTwo", "Hết thời hạn kiểm tra (48h) nếu không khiếu nại thì hệ thống tự động giải ngân", "Phạm Quang Huy", "Vừa", "Đã hoàn thành"),
    ("UC-22", "Khiếu nại & Tranh chấp", "Gửi yêu cầu khiếu nại / trả hàng", "Người mua (Buyer)", "Gửi form khiếu nại kèm ảnh chụp bằng chứng đồ bị lỗi/khác mô tả để tạm đóng băng tiền", "Phan Thanh Bình", "Khó", "Đã hoàn thành"),
    ("UC-23", "Khiếu nại & Tranh chấp", "Hoàn tiền sau khi trừ phí sàn", "Admin / Hệ thống", "Quy tắc: Buyer nhận lại (C - Fr), Seller nhận 0, phí sàn giữ lại Fr = min(F, C)", "Phạm Quang Huy", "Khó", "Đã hoàn thành"),

    # Module 7: Quản trị & Vận hành
    ("UC-24", "Quản trị hệ thống", "Dashboard quản trị số liệu kinh doanh", "Quản trị viên (Admin)", "Theo dõi GMV, tổng số đơn hàng, tổng phí sàn thu được, số dư Escrow toàn sàn", "Vũ Hán Tuấn", "Khó", "Đã hoàn thành"),
    ("UC-25", "Quản trị hệ thống", "Xử lý tranh chấp & Ra quyết định", "Quản trị viên (Admin)", "Duyệt bằng chứng 2 bên, chọn Giải ngân cho Seller hoặc Hoàn tiền trừ phí cho Buyer", "Phan Thanh Bình", "Khó", "Đã hoàn thành"),
    ("UC-26", "Quản trị hệ thống", "Quản lý chiến dịch & Ngân sách Voucher", "Quản trị viên (Admin)", "Tạo mới voucher, giới hạn lượt dùng theo user, theo dõi ngân sách đã giữ/đã dùng", "Đào Thiên Phú", "Vừa", "Đã hoàn thành"),
    ("UC-27", "Quản trị hệ thống", "Kiểm tra cân bằng sổ quỹ (Reconciliation)", "Admin / Kế toán", "Đối soát sổ nhật ký bút toán kép, đảm bảo không có ví âm và khớp số dư ký quỹ", "Phạm Quang Huy", "Khó", "Đã hoàn thành"),

    # Module 8: Kiểm thử & Đảm bảo chất lượng (Quality Assurance)
    ("UC-28", "Kiểm thử hệ thống", "Kiểm thử tự động hồi quy (Regression Test)", "QA / Cả nhóm", "Chạy node --test test/*.test.js kiểm tra toàn diện API Escrow, Đơn hàng, Voucher", "Cả nhóm (Huy lead)", "Khó", "Đang thực hiện (35%)"),
    ("UC-29", "Kiểm thử hệ thống", "Kiểm thử tích hợp giao diện & API (E2E)", "QA / Cả nhóm", "Kiểm thử luồng mua bán từ đầu đến cuối trên trình duyệt và mobile responsive", "Cả nhóm (Tuấn lead)", "Khó", "Chưa bắt đầu (0%)"),
    ("UC-30", "Kiểm thử hệ thống", "Kiểm thử khả năng chịu lỗi & Dữ liệu nhất quán", "QA / Cả nhóm", "Kiểm thử concurrency: 2 buyer cùng checkout 1 món, nạp tiền khi đứt mạng", "Cả nhóm (Huy lead)", "Khó", "Chưa bắt đầu (0%)"),
]

for row_idx, row_val in enumerate(use_cases_data, start=6):
    ws2.row_dimensions[row_idx].height = 22
    for col_idx, val in enumerate(row_val, start=1):
        cell = ws2.cell(row=row_idx, column=col_idx, value=val)
        cell.font = font_data
        cell.border = thin_border
        cell.fill = fill_zebra if row_idx % 2 == 0 else fill_white
        if col_idx in [1, 4, 7]:
            cell.alignment = align_center
        elif col_idx == 8:
            cell.alignment = align_center
            if "Đã hoàn thành" in val:
                cell.fill = PatternFill(start_color=DONE_FILL, end_color=DONE_FILL, fill_type="solid")
                cell.font = Font(name="Segoe UI", size=10, bold=True, color=DONE_TEXT)
            elif "Đang thực hiện" in val:
                cell.fill = PatternFill(start_color=IN_PROG_FILL, end_color=IN_PROG_FILL, fill_type="solid")
                cell.font = Font(name="Segoe UI", size=10, bold=True, color=IN_PROG_TEXT)
            else:
                cell.fill = PatternFill(start_color=PENDING_FILL, end_color=PENDING_FILL, fill_type="solid")
                cell.font = Font(name="Segoe UI", size=10, bold=True, color=PENDING_TEXT)
        else:
            cell.alignment = align_left


# -------------------------------------------------------------
# SHEET 3: CHI TIẾT CÔNG VIỆC WBS (WORK BREAKDOWN STRUCTURE)
# -------------------------------------------------------------
ws3 = wb.create_sheet(title="Chi_Tiet_WBS_Tasks")
ws3.views.sheetView[0].showGridLines = True

ws3.merge_cells("A1:J2")
title_wbs = ws3["A1"]
title_wbs.value = "BẢNG KÊ CHI TIẾT CÔNG VIỆC PHÂN RÃ THEO NGÀY (20/10/2026 - 04/11/2026)"
title_wbs.font = font_title
title_wbs.fill = fill_navy
title_wbs.alignment = align_center

headers_wbs = ["Mã Task", "Module / Hạng mục", "Tên công việc chi tiết", "Mô tả kỹ thuật & Kết quả", "Người thực hiện", "Bắt đầu", "Kết thúc", "Số giờ (h)", "Trạng thái", "Tiến độ %"]
for i, h in enumerate(headers_wbs, start=1):
    c = ws3.cell(row=3, column=i, value=h)
    c.font = font_tbl_header
    c.fill = fill_blue
    c.alignment = align_header
    c.border = thin_border
ws3.row_dimensions[3].height = 25

# 45 granular tasks spanning Oct 20 to Nov 04
tasks_data = [
    # Giai đoạn 1: 20/10 - 22/10 (Khảo sát, Kiến trúc & DB)
    ("TSK-01", "Phân tích & Thiết kế", "Họp nhóm khởi động & Lập kế hoạch phân công WBS", "Thống nhất phạm vi MVP chợ C2C sinh viên và công nghệ (Express + SQLite)", "Phạm Quang Huy", "2026-10-20", "2026-10-20", 4, "Đã hoàn thành", 1.0),
    ("TSK-02", "Phân tích & Thiết kế", "Đặc tả các quy tắc nghiệp vụ cốt lõi (Business Rules)", "Xây dựng công thức tiền P, S, D, C, F và cơ chế hoàn tiền sau khi trừ phí sàn", "Phạm Quang Huy", "2026-10-20", "2026-10-21", 6, "Đã hoàn thành", 1.0),
    ("TSK-03", "Phân tích & Thiết kế", "Xây dựng tài liệu danh mục Use Case hệ thống", "Viết chi tiết 30 Use Case bao phủ các luồng mua bán, chat, tranh chấp, admin", "Phan Thanh Bình", "2026-10-20", "2026-10-21", 6, "Đã hoàn thành", 1.0),
    ("TSK-04", "Cơ sở dữ liệu", "Thiết kế Entity-Relationship Diagram (ERD)", "Thiết kế các thực thể: users, wallets, products, orders, shipments, disputes, vouchers", "Nguyễn Tuấn Hùng", "2026-10-21", "2026-10-22", 8, "Đã hoàn thành", 1.0),
    ("TSK-05", "Cơ sở dữ liệu", "Viết mã khởi tạo DDL SQLite và dữ liệu mẫu", "Khởi tạo bảng trong db.js kèm các index và tài khoản demo, sản phẩm ban đầu", "Phạm Quang Huy", "2026-10-21", "2026-10-22", 6, "Đã hoàn thành", 1.0),
    ("TSK-06", "UI/UX & Wireframe", "Phác thảo Wireframe các màn hình chính", "Thiết kế layout màn Tổng quan, Gian hàng, Chi tiết tin đăng, Màn đặt mua checkout", "Vũ Hán Tuấn", "2026-10-21", "2026-10-22", 8, "Đã hoàn thành", 1.0),
    ("TSK-07", "UI/UX & Wireframe", "Thiết kế hệ thống Design System & Bảng màu", "Quy định font Segoe UI, mã màu chủ đạo xanh thương hiệu #1677FF, badge trạng thái", "Vũ Hán Tuấn", "2026-10-22", "2026-10-22", 4, "Đã hoàn thành", 1.0),

    # Giai đoạn 2: 23/10 - 26/10 (Auth, Marketplace, Bump)
    ("TSK-08", "Tài khoản & Auth", "Xây dựng API xác thực & Chuyển đổi tài khoản demo", "Endpoint /api/auth/demo-switch và middleware bảo vệ route bằng cookie JWT", "Phạm Quang Huy", "2026-10-23", "2026-10-23", 5, "Đã hoàn thành", 1.0),
    ("TSK-09", "Tài khoản & Auth", "Thiết kế giao diện đăng nhập & Thanh chuyển vai trò", "Header bar cho phép chọn nhanh Buyer 1, Seller 2, Shipper 3, Admin 4 để test", "Đào Thiên Phú", "2026-10-23", "2026-10-24", 5, "Đã hoàn thành", 1.0),
    ("TSK-10", "Sản phẩm & Gian hàng", "Xây dựng API đăng bán đồ cũ (Product Create)", "Xử lý form: tên, danh mục, giá bán, tình trạng %, địa điểm hẹn campus gợi ý", "Nguyễn Tuấn Hùng", "2026-10-23", "2026-10-24", 7, "Đã hoàn thành", 1.0),
    ("TSK-11", "Sản phẩm & Gian hàng", "Xây dựng API tìm kiếm, lọc & phân trang sản phẩm", "Query SQLite theo campus, danh mục sách/điện tử/đồ dùng, sắp xếp mới nhất", "Nguyễn Tuấn Hùng", "2026-10-24", "2026-10-25", 6, "Đã hoàn thành", 1.0),
    ("TSK-12", "Sản phẩm & Gian hàng", "Giao diện lưới sản phẩm & Thanh tìm kiếm / bộ lọc", "Thiết kế card sản phẩm đồng đều kích thước, hiển thị giá tiền căn phải rõ ràng", "Vũ Hán Tuấn", "2026-10-24", "2026-10-25", 8, "Đã hoàn thành", 1.0),
    ("TSK-13", "Sản phẩm & Gian hàng", "Giao diện màn hình chi tiết sản phẩm", "Bấm card mở đúng sản phẩm theo ID database, hiển thị chi tiết người bán và nút mua", "Vũ Hán Tuấn", "2026-10-25", "2026-10-26", 7, "Đã hoàn thành", 1.0),
    ("TSK-14", "Sản phẩm & Gian hàng", "Xây dựng logic đẩy tin lên đầu trang (Bump Listing)", "Thu 15.000đ khi hết lượt, gói 49k (+5 lượt), 79k (+10 lượt), ưu tiên hiển thị 7 ngày", "Nguyễn Tuấn Hùng", "2026-10-25", "2026-10-26", 8, "Đã hoàn thành", 1.0),
    ("TSK-15", "Sản phẩm & Gian hàng", "Giao diện Quản lý gian hàng của tôi", "Hiển thị danh sách tin đã đăng của người dùng kèm nút Đẩy tin, Gỡ tin, Xem chi tiết", "Nguyễn Tuấn Hùng", "2026-10-26", "2026-10-26", 5, "Đã hoàn thành", 1.0),

    # Giai đoạn 3: 27/10 - 30/10 (Checkout, Escrow, Chat P2P, Dashboard)
    ("TSK-16", "Tin nhắn P2P", "Xây dựng Database & API hội thoại theo sản phẩm", "Endpoint tạo conversation, gửi text/ảnh, đánh dấu đã đọc giữa buyer và seller", "Đào Thiên Phú", "2026-10-27", "2026-10-27", 6, "Đã hoàn thành", 1.0),
    ("TSK-17", "Tin nhắn P2P", "Giao diện Chat Box tích hợp trong chi tiết sản phẩm", "Popup/Tab tin nhắn có preview card sản phẩm, polling cập nhật tin nhắn mới", "Đào Thiên Phú", "2026-10-27", "2026-10-28", 8, "Đã hoàn thành", 1.0),
    ("TSK-18", "Thanh toán & Escrow", "Xây dựng API tính báo giá Checkout (/api/checkout/quote)", "Tính chính xác P + S - D = C, phí sàn F = 3%P, kiểm tra số dư ví và voucher hợp lệ", "Phạm Quang Huy", "2026-10-27", "2026-10-28", 8, "Đã hoàn thành", 1.0),
    ("TSK-19", "Thanh toán & Escrow", "Xây dựng cơ chế ký quỹ Escrow Hold trong services/ledger.js", "Trừ ví khả dụng, chuyển sang ví ký quỹ HELD, ghi nhận bút toán kép", "Phạm Quang Huy", "2026-10-28", "2026-10-29", 8, "Đã hoàn thành", 1.0),
    ("TSK-20", "Thanh toán & Escrow", "Giao diện màn hình Checkout đặt hàng", "Bảng kê chi tiết tiền, chọn hình thức Meetup (0đ) hoặc TakeTwo ship (15k/25k)", "Vũ Hán Tuấn", "2026-10-28", "2026-10-29", 8, "Đã hoàn thành", 1.0),
    ("TSK-21", "Thanh toán & Escrow", "Popup nạp thêm tiền tức thời khi thiếu số dư", "Gợi ý số tiền nạp làm tròn 10.000đ, nạp xong tự động tính lại quote mà không mất draft", "Vũ Hán Tuấn", "2026-10-29", "2026-10-30", 6, "Đã hoàn thành", 1.0),
    ("TSK-22", "Giao nhận & Đơn hàng", "Xây dựng API quản lý vòng đời đơn hàng (Order State Machine)", "Các trạng thái: REQUESTED -> ACCEPTED -> DELIVERING -> DELIVERED -> COMPLETED", "Phan Thanh Bình", "2026-10-29", "2026-10-30", 8, "Đã hoàn thành", 1.0),
    ("TSK-23", "Giao nhận & Đơn hàng", "Giao diện Quản lý đơn hàng (Tab Đang mua / Đang bán)", "Danh sách đơn, xem trạng thái thanh toán Escrow, mã vận đơn và nút tương tác", "Phan Thanh Bình", "2026-10-30", "2026-10-30", 6, "Đã hoàn thành", 1.0),
    ("TSK-24", "UI/UX & Giao diện", "Khôi phục giao diện Dashboard xanh chuẩn", "Chuẩn hóa thanh Sidebar 250px, padding 24px, lược bỏ các thành phần rườm rà", "Vũ Hán Tuấn", "2026-10-30", "2026-10-30", 7, "Đã hoàn thành", 1.0),

    # Giai đoạn 4: 31/10 - 02/11 (Dispute, Voucher, Admin Portal)
    ("TSK-25", "Voucher khuyến mãi", "Xây dựng Engine quản lý Voucher (services/vouchers.js)", "Quản lý mã giảm giá SV5K/SV10K, kiểm tra ngân sách tối đa và giới hạn theo user", "Đào Thiên Phú", "2026-10-31", "2026-10-31", 7, "Đã hoàn thành", 1.0),
    ("TSK-26", "Voucher khuyến mãi", "Xử lý giữ và trả ngân sách voucher khi hủy/hoàn đơn", "Nếu đơn hủy hoặc khiếu nại hoàn tiền, hoàn trả lượt dùng và ngân sách voucher", "Đào Thiên Phú", "2026-10-31", "2026-11-01", 6, "Đã hoàn thành", 1.0),
    ("TSK-27", "Khiếu nại & Tranh chấp", "Xây dựng API tạo khiếu nại kèm hình ảnh bằng chứng", "Buyer gửi lý do khiếu nại, tải ảnh bằng chứng, hệ thống khóa giải ngân Escrow", "Phan Thanh Bình", "2026-10-31", "2026-11-01", 8, "Đã hoàn thành", 1.0),
    ("TSK-28", "Khiếu nại & Tranh chấp", "Xây dựng logic giải quyết tranh chấp (Hoàn trừ phí sàn)", "Buyer nhận lại C - Fr, sàn giữ phí Fr = min(F, C), Seller nhận 0đ, chi phí ship ghi nhận", "Phạm Quang Huy", "2026-11-01", "2026-11-01", 8, "Đã hoàn thành", 1.0),
    ("TSK-29", "Khiếu nại & Tranh chấp", "Giao diện gửi khiếu nại và theo dõi tiến trình xử lý", "Form nhập khiếu nại thân thiện, hiển thị minh bạch chính sách hoàn trừ phí sàn", "Phan Thanh Bình", "2026-11-01", "2026-11-02", 6, "Đã hoàn thành", 1.0),
    ("TSK-30", "Quản trị hệ thống", "Xây dựng cổng Admin riêng biệt (public/admin.html)", "Tách biệt khu vực quản trị khỏi giao diện người dùng, phân quyền truy cập nghiêm ngặt", "Vũ Hán Tuấn", "2026-11-01", "2026-11-02", 8, "Đã hoàn thành", 1.0),
    ("TSK-31", "Quản trị hệ thống", "Xây dựng Module Admin Quản lý tranh chấp (admin.js)", "Xem hồ sơ khiếu nại, ảnh chứng cứ, chọn nút Phán quyết giải ngân hoặc Hoàn tiền", "Phan Thanh Bình", "2026-11-02", "2026-11-02", 7, "Đã hoàn thành", 1.0),
    ("TSK-32", "Quản trị hệ thống", "Xây dựng Module Admin Đối soát sổ quỹ kế toán", "Script check-db.js kiểm tra số dư Escrow, cân đối nhật ký bút toán nợ/có", "Phạm Quang Huy", "2026-11-02", "2026-11-02", 6, "Đã hoàn thành", 1.0),
    ("TSK-33", "Quản trị hệ thống", "Xây dựng Module Admin Quản trị Voucher & Người dùng", "Danh sách người dùng, trạng thái ví, tạo mới mã khuyến mãi và cấp ngân sách", "Đào Thiên Phú", "2026-11-02", "2026-11-02", 6, "Đã hoàn thành", 1.0),

    # Giai đoạn 5: 03/11 - 04/11 (Hoàn thiện, Responsive & Kiểm thử)
    ("TSK-34", "Tối ưu hóa UI/UX", "Tối ưu hóa giao diện trên màn hình di động (Mobile Responsive)", "Chuyển sidebar thành menu gập, tối ưu touch target 44px, cuộn bảng sổ quỹ", "Vũ Hán Tuấn", "2026-11-03", "2026-11-03", 7, "Đã hoàn thành", 1.0),
    ("TSK-35", "Tối ưu hóa UI/UX", "Kiểm tra và sửa lỗi tràn giao diện (Horizontal Overflow)", "Fix container padding, độ co giãn của bảng số tiền và các thẻ card sản phẩm", "Vũ Hán Tuấn", "2026-11-03", "2026-11-03", 5, "Đã hoàn thành", 1.0),
    ("TSK-36", "Tích hợp & Khắc phục", "Sửa lỗi đồng bộ dữ liệu ví và giỏ hàng khi reload trang", "Đảm bảo F5 trang checkout giữ nguyên dữ liệu nháp và tải lại báo giá mới nhất", "Phạm Quang Huy", "2026-11-03", "2026-11-04", 6, "Đã hoàn thành", 1.0),
    ("TSK-37", "Tích hợp & Khắc phục", "Kiểm tra an toàn: ngăn chặn đặt trùng đơn (Double Checkout)", "Khóa concurrency, cùng 1 món chỉ 1 đơn được tạo thành công, tránh trừ ví 2 lần", "Phạm Quang Huy", "2026-11-04", "2026-11-04", 6, "Đã hoàn thành", 1.0),
    ("TSK-38", "Tài liệu dự án", "Tổng hợp và cập nhật tài liệu kỹ thuật hoàn thiện (PLAN.md)", "Ghi chú đầy đủ kiến trúc API, quy tắc tính toán tài chính và mô tả màn hình", "Phạm Quang Huy", "2026-11-04", "2026-11-04", 4, "Đã hoàn thành", 1.0),

    # PHẦN KIỂM THỬ (CHƯA XONG - ĐÚNG YÊU CẦU ĐỀ BÀI)
    ("TSK-39", "Kiểm thử (QA/QC)", "Xây dựng Unit Test cho module Marketplace (test/marketplace.test.js)", "Kiểm thử các hàm checkout, trừ ví, giữ Escrow, phân quyền đẩy tin", "Nguyễn Tuấn Hùng", "2026-11-03", "2026-11-06", 8, "Đang thực hiện", 0.4),
    ("TSK-40", "Kiểm thử (QA/QC)", "Xây dựng Unit Test cho Vận hành & Tranh chấp (test/operations.test.js)", "Kiểm thử luồng giải quyết khiếu nại, hoàn tiền trừ phí sàn, bảo toàn ngân sách", "Phan Thanh Bình", "2026-11-03", "2026-11-06", 8, "Đang thực hiện", 0.35),
    ("TSK-41", "Kiểm thử (QA/QC)", "Xây dựng Bộ Regression Test kiểm thử tính năng (test/plan-features.test.js)", "Kiểm tra tính toán báo giá quote API, làm tròn nạp tiền 10k, giải ngân hoàn tất", "Phạm Quang Huy", "2026-11-04", "2026-11-07", 10, "Đang thực hiện", 0.3),
    ("TSK-42", "Kiểm thử (QA/QC)", "Kiểm thử giao diện người dùng trên nhiều trình duyệt (Cross-browser Test)", "Test Chrome, Edge, Safari, Firefox đối với các form popup nạp tiền và chatbox", "Vũ Hán Tuấn", "2026-11-04", "2026-11-07", 6, "Đang thực hiện", 0.2),
    ("TSK-43", "Kiểm thử (QA/QC)", "Kiểm thử chức năng Chat P2P & Thông báo thời gian thực", "Test độ trễ polling, đính kèm ảnh dung lượng lớn, ngắt kết nối mạng khi gửi tin", "Đào Thiên Phú", "2026-11-04", "2026-11-07", 6, "Đang thực hiện", 0.2),
    ("TSK-44", "Kiểm thử (QA/QC)", "Kiểm thử tải & Concurrency (2 Buyer tranh mua 1 sản phẩm)", "Mô phỏng 2 request checkout cùng mili-giây, kiểm tra tính toàn vẹn dữ liệu SQLite", "Phạm Quang Huy", "2026-11-05", "2026-11-08", 8, "Chưa bắt đầu", 0.0),
    ("TSK-45", "Kiểm thử (QA/QC)", "Kiểm thử chấp nhận người dùng (User Acceptance Testing - UAT)", "Cho 5 sinh viên dùng thử demo thực hiện trọn vẹn luồng đăng - chat - mua - hoàn", "Cả nhóm (Huy lead)", "2026-11-05", "2026-11-09", 12, "Chưa bắt đầu", 0.0),
]

for row_idx, row_val in enumerate(tasks_data, start=4):
    ws3.row_dimensions[row_idx].height = 20
    for col_idx, val in enumerate(row_val, start=1):
        cell = ws3.cell(row=row_idx, column=col_idx, value=val)
        cell.font = font_data
        cell.border = thin_border
        cell.fill = fill_zebra if row_idx % 2 == 0 else fill_white
        
        # formatting per column
        if col_idx in [1, 6, 7]:
            cell.alignment = align_center
        elif col_idx == 8:
            cell.alignment = align_right
        elif col_idx == 9:
            cell.alignment = align_center
            if val == "Đã hoàn thành":
                cell.fill = PatternFill(start_color=DONE_FILL, end_color=DONE_FILL, fill_type="solid")
                cell.font = Font(name="Segoe UI", size=9, bold=True, color=DONE_TEXT)
            elif val == "Đang thực hiện":
                cell.fill = PatternFill(start_color=IN_PROG_FILL, end_color=IN_PROG_FILL, fill_type="solid")
                cell.font = Font(name="Segoe UI", size=9, bold=True, color=IN_PROG_TEXT)
            else:
                cell.fill = PatternFill(start_color=PENDING_FILL, end_color=PENDING_FILL, fill_type="solid")
                cell.font = Font(name="Segoe UI", size=9, bold=True, color=PENDING_TEXT)
        elif col_idx == 10:
            cell.alignment = align_right
            cell.number_format = "0.0%"
            cell.font = font_data_bold
        else:
            cell.alignment = align_left


# -------------------------------------------------------------
# SHEET 4: PHÂN CÔNG & ĐÁNH GIÁ THÀNH VIÊN
# -------------------------------------------------------------
ws4 = wb.create_sheet(title="Thanh_Vien_Phan_Cong")
ws4.views.sheetView[0].showGridLines = True

ws4.merge_cells("A1:H2")
title_mem = ws4["A1"]
title_mem.value = "BẢNG ĐÁNH GIÁ & ĐÓNG GÓP CỦA TỪNG THÀNH VIÊN (TEAM WORKLOAD EVALUATION)"
title_mem.font = font_title
title_mem.fill = fill_navy
title_mem.alignment = align_center

headers_eval = ["STT", "Họ và Tên", "Vai trò đảm nhiệm", "Mảng công việc chính", "Tổng số giờ (h)", "Số task phụ trách", "Tỷ lệ đóng góp %", "Đánh giá sơ bộ"]
for i, h in enumerate(headers_eval, start=1):
    c = ws4.cell(row=4, column=i, value=h)
    c.font = font_tbl_header
    c.fill = fill_blue
    c.alignment = align_header
    c.border = thin_border
ws4.row_dimensions[4].height = 25

eval_data = [
    (1, "Phạm Quang Huy", "Team Leader / Core Backend", "Kiến trúc hệ thống, Escrow Wallet, Sổ cái kế toán, Quote Checkout, Phí sàn, Script Test hồi quy", '=SUMIFS(Chi_Tiet_WBS_Tasks!$H$4:$H$48, Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Huy*")', '=COUNTIF(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Huy*")', '=E5/$E$10', "Hoàn thành xuất sắc phần cốt lõi tài chính và logic ký quỹ, đang viết test suite hồi quy."),
    (2, "Nguyễn Tuấn Hùng", "Backend Developer", "Quản lý sản phẩm, Bộ lọc tìm kiếm, Đăng tin, Tính năng Đẩy tin (Bump top), Unit Test Marketplace", '=SUMIFS(Chi_Tiet_WBS_Tasks!$H$4:$H$48, Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Hùng*")', '=COUNTIF(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Hùng*")', '=E6/$E$10', "Hoàn thành toàn bộ API sàn và gói đẩy top 49k/79k, đang hoàn thiện test marketplace."),
    (3, "Phan Thanh Bình", "Backend Developer", "Quản lý đơn hàng, Vận chuyển trực tiếp / qua sàn, Cơ chế khiếu nại tranh chấp, Test Operations", '=SUMIFS(Chi_Tiet_WBS_Tasks!$H$4:$H$48, Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Bình*")', '=COUNTIF(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Bình*")', '=E7/$E$10', "Xử lý trơn tru quy trình giao nhận và logic tranh chấp có bằng chứng, đang viết test operations."),
    (4, "Vũ Hán Tuấn", "Frontend Lead", "Khôi phục Dashboard xanh, Chuẩn hóa Layout 250px/24px, Màn hình Checkout, Popup nạp tiền, Responsive mobile", '=SUMIFS(Chi_Tiet_WBS_Tasks!$H$4:$H$48, Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Tuấn*")', '=COUNTIF(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Tuấn*")', '=E8/$E$10', "Giao diện đúng chuẩn spec, không bị vỡ layout trên mobile, đang hỗ trợ kiểm thử UI."),
    (5, "Đào Thiên Phú", "Fullstack Developer", "Hệ thống Chat P2P hỏi đồ, Quản lý Voucher SV5K/10K, Phân hệ Admin quản lý người dùng & khuyến mãi", '=SUMIFS(Chi_Tiet_WBS_Tasks!$H$4:$H$48, Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Phú*")', '=COUNTIF(Chi_Tiet_WBS_Tasks!$E$4:$E$48, "*Phú*")', '=E9/$E$10', "Tính năng Chat và Voucher hoạt động chuẩn xác, bảo toàn ngân sách khi hủy đơn."),
]

for row_idx, row_val in enumerate(eval_data, start=5):
    ws4.row_dimensions[row_idx].height = 28
    for col_idx, val in enumerate(row_val, start=1):
        cell = ws4.cell(row=row_idx, column=col_idx, value=val)
        cell.font = font_data
        cell.border = thin_border
        cell.fill = fill_zebra if row_idx % 2 == 0 else fill_white
        if col_idx in [1, 6]:
            cell.alignment = align_center
        elif col_idx == 5:
            cell.alignment = align_right
        elif col_idx == 7:
            cell.alignment = align_right
            cell.number_format = "0.0%"
            cell.font = font_data_bold
        else:
            cell.alignment = align_left

# Total row for Sheet 4
ws4.merge_cells("A10:D10")
tot4 = ws4.cell(row=10, column=1, value="TỔNG CỘNG KHỐI LƯỢNG DỰ ÁN")
tot4.font = font_data_bold
tot4.alignment = align_center
tot4.fill = fill_ice
for c in range(1, 5):
    ws4.cell(row=10, column=c).border = thin_border
    ws4.cell(row=10, column=c).fill = fill_ice

c4_e = ws4.cell(row=10, column=5, value="=SUM(E5:E9)")
c4_e.font = font_data_bold
c4_e.alignment = align_right
c4_e.fill = fill_ice
c4_e.border = thin_border

c4_f = ws4.cell(row=10, column=6, value="=SUM(F5:F9)")
c4_f.font = font_data_bold
c4_f.alignment = align_center
c4_f.fill = fill_ice
c4_f.border = thin_border

c4_g = ws4.cell(row=10, column=7, value="=SUM(G5:G9)")
c4_g.font = font_data_bold
c4_g.alignment = align_right
c4_g.number_format = "0.0%"
c4_g.fill = fill_ice
c4_g.border = thin_border

c4_h = ws4.cell(row=10, column=8, value="")
c4_h.border = thin_border
c4_h.fill = fill_ice


# Auto-fit columns with safety margins
for ws in [ws1, ws2, ws3, ws4]:
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            # ignore merged banner
            if cell.row in [1, 2, 3] and ws in [ws1, ws2, ws3, ws4]:
                continue
            if cell.value:
                val_str = str(cell.value)
                if val_str.startswith("="):
                    max_len = max(max_len, 10)
                else:
                    max_len = max(max_len, len(val_str))
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

# Specific column adjustments
ws1.column_dimensions['A'].width = 4
ws1.column_dimensions['B'].width = 12
ws1.column_dimensions['C'].width = 24
ws1.column_dimensions['D'].width = 42
ws1.column_dimensions['E'].width = 18
ws1.column_dimensions['F'].width = 18
ws1.column_dimensions['G'].width = 18
ws1.column_dimensions['H'].width = 18

ws2.column_dimensions['A'].width = 10
ws2.column_dimensions['B'].width = 24
ws2.column_dimensions['C'].width = 38
ws2.column_dimensions['D'].width = 20
ws2.column_dimensions['E'].width = 65
ws2.column_dimensions['F'].width = 22
ws2.column_dimensions['G'].width = 14
ws2.column_dimensions['H'].width = 22

ws3.column_dimensions['A'].width = 12
ws3.column_dimensions['B'].width = 24
ws3.column_dimensions['C'].width = 45
ws3.column_dimensions['D'].width = 60
ws3.column_dimensions['E'].width = 22
ws3.column_dimensions['F'].width = 14
ws3.column_dimensions['G'].width = 14
ws3.column_dimensions['H'].width = 14
ws3.column_dimensions['I'].width = 20
ws3.column_dimensions['J'].width = 14

ws4.column_dimensions['A'].width = 8
ws4.column_dimensions['B'].width = 22
ws4.column_dimensions['C'].width = 25
ws4.column_dimensions['D'].width = 55
ws4.column_dimensions['E'].width = 16
ws4.column_dimensions['F'].width = 18
ws4.column_dimensions['G'].width = 18
ws4.column_dimensions['H'].width = 60

output_path = "TakeTwo_Project_Progress_Tracking.xlsx"
wb.save(output_path)
print(f"File saved successfully to {output_path}")
