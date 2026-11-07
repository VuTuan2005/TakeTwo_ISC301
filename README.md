# TakeTwo — Marketplace đồ cũ sinh viên Hà Nội

Ứng dụng local dùng Express, JavaScript thuần và SQLite. Đăng tin, duyệt tin, chat, đặt hàng, Escrow, tranh chấp và đối soát lưu dữ liệu thật trong database. **Tiền, OTP, Google và vận chuyển vẫn mô phỏng**, không giao dịch với ngân hàng hoặc hãng vận chuyển.

## Chạy

Node.js 22.x theo package.json; đã kiểm tra với Node.js 24.18.0 trên Windows.

```powershell
npm ci
npm start
```

Mở http://localhost:3000. Admin đăng nhập được chuyển sang http://localhost:3000/admin.html. Giao diện dùng dashboard xanh TakeTwo; mỗi màn thực hiện một việc, hỗ trợ URL hash, reload và Back.

## Tài khoản mẫu

| Vai trò | Email | Mật khẩu seed |
|---|---|---|
| Buyer | tuanvhhe194875@fpt.edu.vn | Student@123 |
| Seller | minhanh.seller@fpt.edu.vn | Student@123 |
| Sinh viên | longtb.vnu@vnu.edu.vn | Student@123 |
| Admin | admin@taketwo.vn | Admin@TakeTwo2026 |

Trong chế độ mô phỏng có bộ chọn tài khoản ở sidebar và OTP/mật khẩu tắt `123456`. OTP tạo mới hiện trong biểu mẫu; không gửi email. Kiểm tra email sinh viên ở admin được ghi nhãn local, chưa xác minh với trường.

Một tài khoản thành viên có thể vừa mua vừa đăng bán. Nhãn BUYER/SELLER trên bộ chọn tài khoản mô phỏng chỉ giúp nhận biết kịch bản demo; vai trò trong từng đơn được xác định theo buyer và seller của đơn đó. Tài khoản admin được tách riêng để quản trị.

## Luồng sử dụng

1. Seller đăng món đồ; điểm hẹn gợi ý **không bắt buộc**. Tin vào hàng chờ duyệt. Seller mở được chi tiết tin vừa đăng bằng ID server trả về.
2. Admin → Người dùng & Kiểm duyệt → duyệt tin. Tin được tìm thấy công khai và có thể đẩy top. Các gói: 15.000đ/1, 49.000đ/5, 79.000đ/10 lượt; mỗi lượt ưu tiên 7 ngày.
3. Buyer mở chi tiết, nhắn tin cho seller trước khi đặt mua. Chat hỗ trợ ảnh, chưa đọc và tải tin nhắn cũ. Người ngoài không đọc được hội thoại hoặc ảnh riêng tư.
4. Buyer đặt mua, chọn gặp trực tiếp hoặc TakeTwo vận chuyển, xác nhận người nhận và địa điểm. Nhập mã voucher nếu có; **không tự giảm cố định 5.000đ**.
5. Nếu thiếu tiền, checkout hiển thị số thiếu và mở nạp tiền. Sau nạp quay lại kiểm tra báo giá; không tự đặt hàng. Bản nháp checkout lưu trong sessionStorage theo tài khoản, phục hồi sau reload.
6. Đặt mua giữ tiền và chuyển sản phẩm RESERVED. Buyer hủy/seller từ chối khi REQUESTED được hoàn toàn bộ, không giữ phí.
7. Seller chấp nhận. Gặp trực tiếp: seller xác nhận đã bàn giao. Vận chuyển: seller nhập địa chỉ lấy hàng, **không nhập mã vận đơn**; admin xác nhận lấy hàng và điều phối các bước tiếp theo.
8. Từ bàn giao/lấy hàng bắt đầu 120 giờ. Buyer xác nhận nhận hàng hoặc hệ thống tự hoàn tất. Scheduler kiểm tra khi khởi động và mỗi 30 giây; màn đơn đồng bộ mỗi 10 giây.
9. Khi ACCEPTED hoặc DELIVERING và còn giữ tiền, buyer gửi khiếu nại. Hàng hỏng/sai hàng/sai mô tả cần ảnh; chưa nhận hàng có thể giải trình bằng văn bản. Hồ sơ đóng băng Escrow, lưu deadline cũ; hai bên bổ sung bằng chứng, kể cả khi bị khóa tài khoản.
10. Admin đọc hồ sơ/chat theo vụ việc, đánh dấu thẩm định rồi chọn giải ngân hoặc hoàn sau trừ phí. Nội dung bổ sung mới làm mất dấu thẩm định cũ. Mọi quyết định cần lý do, lưu người và thời gian. Không có hoàn một phần hoặc số tiền admin tự nhập.

## Quy tắc tiền

`P`: tiền hàng; `S`: ship; `D`: voucher; `C = P + S - D`; `F = round(P × 3%)`; `Fr = min(F, C)`.

| Kết quả | Buyer | Seller | Đơn vị vận chuyển | Sàn ròng trước chi phí khác |
|---|---|---|---|---|
| Hoàn tất | Đã trả C | P − F | Khoản phải trả S | F − D |
| Hoàn sau tranh chấp | Nhận lại C − Fr | 0 | Cước K đã phát sinh | Fr − K |
| Hủy khi REQUESTED | Nhận lại C | 0 | 0 | 0 |

Ví dụ P=150.000, S=15.000, D=5.000: buyer trả 160.000; khi hoàn tất seller nhận 145.500, phải trả vận chuyển 15.000, sàn ròng −500. Nếu hoàn sau lấy hàng: buyer nhận 155.500, giữ phí 4.500, TakeTwo chịu cước 15.000, sàn ròng −10.500.

Cước phát sinh một lần lúc admin xác nhận lấy hàng; khoản phải trả chỉ thanh toán mô phỏng một lần, có mã đối soát. Không dùng phí ship làm thu nhập của seller. Hoàn tiền trả lại ngân sách/lượt voucher; voucher không đổi thành tiền mặt. Hoàn tiền chỉ xử lý khi Escrow còn giữ, chưa hỗ trợ thu hồi tiền đã giải ngân.

Mọi biến động tiền có transaction SQLite và bút toán cân bằng. Các API tài chính hỗ trợ header `Idempotency-Key`; gửi lại cùng khóa/nội dung trả kết quả cũ, đổi nội dung bị 409. Frontend giữ khóa khi lỗi mạng để có thể thử lại. Sai trạng thái 409, sai quyền 403.

## Admin

Admin không đặt mua, đăng bán, đẩy tin, nạp/rút hay tham gia chat như người dùng.

- Tổng quan: GMV hàng đã hoàn tất, phí, voucher, boost, cước bù, đóng góp ròng, Escrow, tỷ lệ hoàn tất/tranh chấp. Mặc định 30 ngày; tỷ lệ theo nhóm đơn tạo trong kỳ, doanh thu theo kỳ quyết toán; Escrow là số hiện tại. Toàn bộ KPI gắn dữ liệu mô phỏng.
- Đối soát: buyer/seller, tiền hàng/ship/voucher/đã trả/phí/seller nhận/hoàn/cước/sàn ròng; lọc ngày, tên, trạng thái, phương thức, voucher, đơn lỗ và giữ tiền. Tổng cộng theo toàn bộ kết quả lọc.
- Vận chuyển: địa chỉ lấy/giao, mã nội bộ, các bước trạng thái, cước và thanh toán đối tác có tham chiếu.
- Escrow: tổng giữ, deadline, gần/quá hạn, sai lệch từng buyer; giải ngân thủ công cần lý do và không ghi nhận là buyer xác nhận. Tranh chấp không được bỏ qua hồ sơ.
- Tranh chấp: bằng chứng và giải trình hai phía, chat, dự tính tài chính, yêu cầu bổ sung và quyết định. Seller có mục tiêu 48h, admin 72h; quá hạn ưu tiên xử lý, không tự phán quyết.
- Người dùng/kiểm duyệt: lịch sử đơn/vi phạm, cảnh cáo, khóa/mở có lý do, kiểm tra email local, duyệt/ẩn tin và xử lý báo cáo. Tài khoản khóa vẫn đọc đơn và giải trình; không tạo giao dịch mới.
- Voucher: tạo/sửa/bật/tắt; cố định/phần trăm, trần giảm, đơn tối thiểu, lịch, đối tượng, tổng ngân sách, lượt toàn chiến dịch/mỗi người, báo cáo GMV/trợ giá/đóng góp. Không duyệt từng lần dùng. Ngân sách mới không thấp hơn số đã dùng + đang giữ.

## Kiểm tra và dữ liệu

```powershell
npm test
npm run db:check
node scripts/local-browser-check.mjs
```

41 kiểm thử service/API gồm quyền, state machine, tranh mua, ngân sách voucher, tiền ship/hoàn sau phí, chống gửi lặp, rollback, ảnh riêng tư, khóa demo và phiên sau khi khởi động lại. Browser check tự mở Chrome headless, chạy database riêng trong `scratch/`, kiểm tra đăng nhập, đăng ký, sổ giao dịch, luồng mua trực tiếp, vận chuyển/tranh chấp, chat, checkout thiếu tiền, reload và admin ở 1440/768/390px. Ảnh và kết quả được lưu trong thư mục QA riêng, không thay dữ liệu người dùng.

`db:check` chỉ đọc; kiểm tra Escrow từng ví, bút toán và dự trữ voucher nếu có schema mới. Sai lệch chặn quyết toán liên quan; không tự cân số dư để giấu lỗi.

Database không reset khi khởi động. Migration sao lưu vào `backups/` trước cập nhật schema; giữ số dư, ID, đơn cũ và đánh dấu phiên bản kế toán lịch sử. Sổ bút toán mới ghi từ phiên bản nâng cấp, không dựng lại toàn bộ giao dịch quá khứ.

Muốn reset mẫu: dừng server, chạy:

```powershell
npm run demo:reset
npm start
```

Reset chủ động cũng sao lưu. Khôi phục bằng cách dừng server, giữ bản database hiện tại, sao chép bản sao đã chọn thành `taketwo.db`, rồi khởi động lại. Sao lưu cả `uploads/` nếu cần bảo toàn ảnh chat/bằng chứng.

## Cấu hình và cấu trúc

PowerShell: `$env:PORT='3001'` hoặc `$env:DEMO_MODE='false'`; chương trình không tự đọc `.env`.

| Biến | Mặc định |
|---|---|
| PORT / HOST | 3000 / 127.0.0.1 |
| TAKETWO_DB_PATH | taketwo.db trong dự án |
| DEMO_MODE | true; false khóa OTP/Google/chuyển tài khoản/nạp-rút/giả lập thời gian |
| JWT_SECRET | Ưu tiên dùng biến môi trường; nếu không đặt, khóa local được tạo cạnh database trong file `*.session-secret` để duy trì phiên sau restart |

`services/marketplace.js`: tiền và trạng thái; `vouchers.js`: quy tắc voucher; `ledger.js`: bút toán; `operations.js`: vận chuyển/hồ sơ/admin; `reports.js`: báo cáo; `migrate-active.js`: bổ sung dữ liệu vận chuyển đang giữ tiền. Frontend dùng `app.js`, `workspace.js`, `plan-ui.js`, và admin riêng `admin.js`.

Ảnh bằng chứng JPEG/PNG/WebP tối đa 5MB, tối đa 5 ảnh/nội dung, lưu ngoài public; kiểm tra chữ ký file và quyền người xem. Phần mở rộng sau: nhiều ảnh listing, review và thông báo tập trung. Thanh toán/email/vận chuyển thật và triển khai online chưa tích hợp.
