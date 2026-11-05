# Kế hoạch hoàn thiện TakeTwo trên local, khôi phục giao diện cũ và xây khu vực quản trị riêng

## 1. Mục tiêu và quy tắc nghiệp vụ đã chốt

### 1.1. Mục tiêu sản phẩm

TakeTwo phải chạy ổn định trên local và thực hiện được đầy đủ các luồng:

- Đăng bán, tìm kiếm, mở chi tiết và đẩy tin.
- Chat buyer–seller trước khi đặt mua.
- Đặt mua, dùng voucher, nạp thêm tiền và giữ tiền Escrow.
- Gặp trực tiếp hoặc TakeTwo tổ chức vận chuyển.
- Xác nhận nhận hàng, tự hoàn tất và xử lý khiếu nại có bằng chứng.
- Quản trị kinh doanh, đơn hàng, vận chuyển, Escrow, người dùng, kiểm duyệt và voucher.

Tiếp tục dùng Express, JavaScript thuần và SQLite. Tiền, OTP, thanh toán và vận chuyển vẫn mô phỏng; dữ liệu và các bước xử lý phải hoạt động thật trong ứng dụng.

Khôi phục **dashboard xanh trước lần sửa giao diện vừa rồi**, giữ nhận diện và chỉnh lại độ rối, căn chỉnh, kích thước và responsive. Không sử dụng taste skill.

### 1.2. Bỏ hoàn một phần

Bỏ hoàn một phần là hợp lý cho phiên bản này vì giảm đáng kể các trường hợp phải phân bổ lại tiền hàng, voucher và phí.

Tranh chấp có hai kết quả:

1. **Giải ngân cho seller.**
2. **Hoàn tiền cho buyer sau khi trừ phí sàn.**

Tên hiển thị phải là **“Hoàn tiền sau khi trừ phí sàn”**, không gọi là “Hoàn 100%”.

Buyer phải thấy chính sách này ở checkout và trong phần yêu cầu hoàn tiền. Admin chỉ chọn kết quả xử lý và nhập lý do; số tiền do hệ thống tính, không nhập tùy ý.

### 1.3. Quy tắc tiền

Ký hiệu:

| Ký hiệu | Ý nghĩa |
|---|---|
| `P` | Tiền hàng |
| `S` | Phí vận chuyển thu buyer |
| `D` | Voucher được áp dụng |
| `C` | Tiền buyer thanh toán: `P + S − D` |
| `F` | Phí sàn: làm tròn `P × 3%` |
| `K` | Chi phí vận chuyển đã phát sinh |
| `Fr` | Phí thực giữ khi hoàn: `min(F, C)` |

**Đơn hoàn tất:**

```text
Buyer thanh toán       = P + S − D
Seller nhận            = P − F
Phải trả vận chuyển    = S
Đóng góp ròng của đơn  = F − D
```

Phí vận chuyển không cộng vào ví seller. Trong bản local, cước thu buyer bằng cước phải trả đơn vị vận chuyển.

**Đơn khiếu nại được hoàn:**

```text
Buyer nhận lại         = C − Fr
Seller nhận            = 0
Phí sàn giữ lại        = Fr
Đóng góp ròng của đơn  = Fr − K
```

Voucher không được đổi thành tiền hoàn. Lượt và ngân sách voucher của đơn hoàn được trả lại.

Nếu vận chuyển đã phát sinh, TakeTwo vẫn phải trả khoản `K` và ghi nhận chi phí đó. Không tiếp tục trừ thêm phí ship khỏi tiền buyer nếu chính sách đã chọn chỉ giữ phí sàn.

Ví dụ đã thống nhất:

| Kết quả | Buyer đã trả | Buyer được hoàn | Seller nhận | Vận chuyển phải trả | Sàn ròng |
|---|---:|---:|---:|---:|---:|
| Hoàn tất | 160.000đ | 0đ | 145.500đ | 15.000đ | −500đ |
| Hoàn sau khi đã lấy hàng | 160.000đ | 155.500đ | 0đ | 15.000đ | −10.500đ |

Ví dụ dùng tiền hàng 150.000đ, ship 15.000đ, voucher 5.000đ và phí sàn 4.500đ.

**Phân biệt hủy trước xử lý và hoàn do tranh chấp:**

- Buyer hủy hoặc seller từ chối khi đơn còn `REQUESTED`: trả đủ tiền đã giữ, không thu phí, trả lượt voucher.
- Sau khi seller nhận đơn: xử lý vấn đề qua hồ sơ tranh chấp.
- Không tự rút tiền từ ví seller để hoàn lại một đơn đã giải ngân. Phạm vi hoàn trong phiên bản này là đơn còn tiền Escrow.

---

## 2. Giao diện và luồng buyer–seller

### 2.1. Khôi phục dashboard xanh cũ

Lấy giao diện trước lần sửa làm chuẩn về màu, sidebar, button, card và table. Giữ các sửa lỗi backend và quản lý trạng thái đang có.

Các quyết định bố cục:

- Màu hành động chính `#1677FF`.
- Sidebar desktop khoảng 250px.
- Padding nội dung desktop 24px; khoảng cách panel 16–24px.
- Nội dung chính 14–16px; thông tin phụ 12–13px.
- Tiêu đề màn 22–26px.
- Số tiền trong bảng căn phải, dùng chữ số có chiều rộng đồng đều.
- Một màu trạng thái cho một ý nghĩa; giảm badge và thông tin lặp.
- Một màn chỉ có một tiêu đề và nhóm hành động liên quan.

Các màn người dùng:

| Màn | Nội dung |
|---|---|
| Tổng quan | Số dư, Escrow, lượt đẩy, việc cần xử lý |
| Sản phẩm | Tìm kiếm, bộ lọc và danh sách |
| Chi tiết sản phẩm | Thông tin đầy đủ, chat, lưu, mua hoặc quản lý bài |
| Gian hàng | Các bài đăng của tài khoản hiện tại |
| Tin nhắn | Hội thoại theo sản phẩm |
| Đơn hàng | Tab đang mua/đang bán |
| Chi tiết đơn | Trạng thái, giao nhận, tiền, lịch sử và thao tác |
| Ví | Nạp/rút mô phỏng và chứng từ |
| Gói đẩy tin | Giá, quyền lợi, số lượt và mua gói |

Tổng quan không chứa lại toàn bộ bảng giao dịch, toàn bộ đơn và bảng quản trị.

Mobile:

- Sidebar chuyển thành menu có nhãn.
- Form một cột.
- Chi tiết đơn xếp dọc.
- Bảng sổ quỹ cuộn trong khung.
- Toàn trang không tràn ngang.
- Vùng chạm quan trọng tối thiểu 44px.
- Toast giới hạn số lượng, không che nút thao tác.

### 2.2. Đăng bài, chi tiết sản phẩm và đẩy top

**Form đăng bán:**

- Bắt buộc: tên, danh mục, giá, tình trạng và cụm trường.
- Điểm hẹn gợi ý là tùy chọn.
- Không nhập điểm hẹn vẫn đăng thành công.
- Mô tả và ảnh giữ cơ chế hiện có; không tự bịa địa điểm.

Sau đăng thành công:

1. Nhận `product_id` từ API.
2. Chuyển đến chi tiết đúng sản phẩm đó.
3. Hiển thị trạng thái đang bán.
4. Có liên kết về gian hàng.
5. Reload và restart server vẫn giữ được bài.

**Mở chi tiết:**

- Bấm ảnh, tên hoặc vùng nội dung thẻ mở đúng sản phẩm.
- Bấm Lưu/Đẩy/Gỡ không đồng thời mở chi tiết.
- Không dùng vị trí trong mảng thay cho ID database.
- ID sai có thông báo riêng; sản phẩm đã gỡ có trạng thái phù hợp.
- Không hiển thị chi tiết cũ trong lúc tải sản phẩm mới.

**Đẩy top:**

- Chỉ chủ bài đang bán được đẩy.
- Một lần đẩy dùng một lượt.
- Hết lượt thì thu 15.000đ mô phỏng.
- Gói 49k cộng 5 lượt; gói 79k cộng 10 lượt.
- Ưu tiên hiển thị 7 ngày.
- Đồng bộ ví, số lượt và danh sách sau khi xử lý.
- Phân biệt lỗi không tồn tại, sai quyền, sai trạng thái và thiếu tiền.

Hai lỗi sản phẩm cũ được đưa vào kiểm thử hồi quy; không sửa theo một nguyên nhân chưa tái hiện được.

### 2.3. Chat trước khi đặt mua

Buyer mở sản phẩm và chọn **Nhắn tin cho người bán**. Không yêu cầu đặt đơn hoặc giữ tiền trước.

Quy tắc:

- Một hội thoại cho một cặp buyer–seller trên một sản phẩm.
- Không chat với chính mình.
- Chỉ hai người tham gia đọc và gửi tin.
- Seller có danh sách hội thoại theo từng sản phẩm.
- Hội thoại có thẻ tóm tắt sản phẩm và nút mở lại sản phẩm.
- Nhắn tin không giữ chỗ và không thay đổi giá niêm yết.
- Chưa có luồng thương lượng giá tự động; giá thanh toán lấy từ sản phẩm và báo giá server.

Hỗ trợ:

- Tin nhắn văn bản.
- Ảnh đính kèm.
- Thời gian gửi.
- Trạng thái chưa đọc.
- Tải thêm lịch sử.
- Gửi lại khi lỗi mạng mà không tạo tin trùng.

Khi listing đã bán hoặc bị gỡ, không mở hội thoại mới; hội thoại cũ vẫn đọc được. Trao đổi của đơn đang xử lý tiếp tục được phép, trừ tài khoản bị hạn chế.

Dùng polling khi màn chat đang mở; dừng polling khi rời màn hoặc đổi tài khoản. Chưa cần WebSocket.

### 2.4. Checkout và nạp tiền

Checkout gồm:

1. Sản phẩm.
2. Người nhận.
3. Hình thức nhận.
4. Voucher.
5. Bảng tiền, số dư và chính sách hoàn.

**Gặp trực tiếp:**

- Phí 0đ.
- Điểm hẹn được gợi ý từ listing nếu có.
- Buyer có thể sửa.
- Phải có điểm hẹn khi xác nhận đặt mua.
- Seller xem điểm hẹn trước khi nhận đơn.

**TakeTwo vận chuyển:**

- Buyer nhập địa chỉ nhận.
- Seller cung cấp địa chỉ lấy hàng khi xác nhận sẵn sàng.
- Giữ mức cước mô phỏng 15.000đ/25.000đ hiện tại.
- Không yêu cầu seller nhập mã vận đơn.

**Thiếu tiền:**

Hiển thị tổng cần trả, số dư và số còn thiếu. Có nút **Nạp thêm tiền**, không chỉ một nút thanh toán bị vô hiệu hóa.

Popup nạp:

- Mở trên checkout.
- Giữ người nhận, địa chỉ, hình thức nhận và voucher.
- Gợi ý số nạp đủ dùng, làm tròn lên 10.000đ.
- Cho sửa số tiền.
- Khóa nút khi đang xử lý.

Sau nạp:

- Cập nhật ví từ server.
- Tính lại báo giá và voucher.
- Quay về checkout.
- Không tự đặt mua.
- Nếu vẫn thiếu, cập nhật lại số thiếu.

Checkout dùng đường dẫn có product ID. Reload khôi phục dữ liệu nháp theo đúng tài khoản và lấy lại báo giá mới. Không lưu mật khẩu, OTP hay token trong dữ liệu nháp.

### 2.5. Nhận đơn và giao nhận

Luồng chính:

```text
Chat → Đặt mua → Giữ tiền → Seller nhận đơn
→ Gặp trực tiếp hoặc TakeTwo tổ chức giao hàng
→ Buyer xác nhận / Hết hạn / Khiếu nại
→ Giải ngân hoặc hoàn sau khi trừ phí sàn
```

**Seller nhận đơn:**

- Chỉ xác nhận có thể thực hiện giao dịch.
- Không yêu cầu mã vận đơn.
- Chưa bắt đầu đồng hồ 120 giờ.

**Gặp trực tiếp:**

- Seller xác nhận đã bàn giao.
- Bắt đầu 120 giờ.
- Không có vận đơn hoặc khoản phải trả vận chuyển.

**TakeTwo vận chuyển:**

1. Seller xác nhận hàng sẵn sàng và địa chỉ lấy.
2. Admin tạo lượt giao nhận trong khu quản trị.
3. Hệ thống sinh mã giao nhận nội bộ.
4. Admin cập nhật Đã lấy hàng → Đang giao → Đã giao.
5. Khi ghi nhận đã lấy hàng, bắt đầu 120 giờ như quy tắc gửi hàng hiện có.
6. Phí phải trả vận chuyển phát sinh từ thời điểm lấy hàng.

Mã nội bộ phải được ghi nhãn rõ trong bản local, không trình bày như mã tra cứu của hãng thật.

Buyer có thể xác nhận đã nhận trong giai đoạn giao nhận. Không bắt buyer chờ admin cập nhật một trạng thái trung gian nếu buyer thực tế đã nhận hàng.

---

## 3. Khu vực admin riêng và cách vận hành

### 3.1. Tách admin khỏi mua bán

Tạo khu quản trị riêng tại `/admin.html`.

Admin đăng nhập được chuyển vào khu này, có sidebar và điều hướng riêng theo phong cách dashboard xanh.

Backend chặn admin thực hiện:

- Đăng bán.
- Mua hàng.
- Chat với tư cách buyer/seller.
- Lưu yêu thích.
- Mua gói hoặc đẩy bài cho tài khoản mình.
- Nạp/rút ví cá nhân.
- Nhận đơn, gửi hàng hoặc xác nhận nhận hàng thay người dùng.

Admin quản lý bằng các API quản trị riêng, có lý do và nhật ký. Không dùng cơ chế “admin được bỏ qua mọi kiểm tra chủ sở hữu”.

### 3.2. Tổng quan kinh doanh

Hiển thị:

- GMV hàng hóa đã hoàn tất, không gồm ship.
- Số đơn hoàn tất, hủy, hoàn tiền và đang tranh chấp.
- Phí sàn của đơn hoàn tất.
- Phí giữ lại từ đơn hoàn tiền.
- Tổng voucher thực tài trợ.
- Doanh thu boost đã thu.
- Chi phí vận chuyển TakeTwo phải bù khi hoàn.
- Đóng góp ròng trước chi phí chung.
- Escrow đang giữ.
- Tỷ lệ hoàn tất.
- Tỷ lệ tranh chấp.

Công thức tổng:

```text
Đóng góp ròng =
Phí đơn hoàn tất
+ Phí giữ lại khi hoàn
+ Doanh thu boost
− Voucher thực tài trợ
− Chi phí vận chuyển phải bù khi hoàn
```

Tiền nạp ví, tiền Escrow và tiền thu hộ vận chuyển không được cộng vào doanh thu.

Doanh thu boost ghi nhận một lần khi mua gói hoặc trả tiền đẩy lẻ. Dùng lượt đã mua không ghi nhận doanh thu lần nữa.

Bộ lọc mặc định 30 ngày gần nhất:

- GMV theo thời điểm hoàn tất.
- Thu/chi theo thời điểm ghi bút toán.
- Tỷ lệ hoàn tất và tranh chấp theo nhóm đơn tạo trong kỳ.
- Mỗi chỉ số ghi rõ mốc thời gian và mẫu số.
- Mẫu số bằng 0 hiển thị 0 và giải thích, không tạo tỷ lệ giả.

### 3.3. Đơn hàng và đối soát

Mỗi dòng có:

- Mã đơn.
- Buyer và seller.
- Tiền hàng.
- Phí vận chuyển.
- Voucher.
- Buyer đã trả.
- Phí sàn thu/giữ.
- Buyer được hoàn.
- Seller thực nhận.
- Khoản phải trả vận chuyển.
- Sàn ròng.
- Trạng thái đơn và Escrow.
- Phiên bản cách tính tiền.

Lọc theo:

- Khoảng thời gian tạo hoặc quyết toán.
- Buyer/seller.
- Trạng thái.
- Phương thức nhận.
- Còn giữ Escrow.
- Tranh chấp/hoàn tiền.
- Đóng góp ròng âm.
- Chiến dịch voucher.

Mở đơn thấy bảng phân bổ tiền, dòng thời gian và các chứng từ liên quan. Tổng cuối bảng phải khớp toàn bộ tập dữ liệu đang lọc, không chỉ trang đang nhìn.

Không sửa giá hoặc số tiền của đơn đã tạo trực tiếp trên giao diện admin.

### 3.4. Quản lý vận chuyển và khoản phải trả

Trong quản trị đơn có hàng đợi vận chuyển:

- Chờ seller chuẩn bị.
- Sẵn sàng lấy hàng.
- Đã tạo giao nhận.
- Đã lấy.
- Đang giao.
- Đã giao.
- Đã hủy.

Mỗi lượt giao nhận lưu:

- Đơn liên quan.
- Địa chỉ lấy và giao.
- Mã nội bộ.
- Cước thu buyer và cước phải trả.
- Các mốc trạng thái.
- Admin thực hiện.
- Lý do hủy hoặc điều chỉnh.

Khoản phải trả có trạng thái chưa thanh toán/đã thanh toán mô phỏng. Xác nhận thanh toán phải có ghi chú tham chiếu và chỉ ghi một lần.

Hủy trước khi lấy hàng không phát sinh cước. Sau khi đã lấy, bản local mặc định phát sinh đủ cước. Chưa mô hình hóa phí giao lại hoặc phí hoàn hàng riêng.

### 3.5. Quản lý Escrow

Có danh sách:

- Tổng tiền đang giữ.
- Tiền giữ theo từng đơn.
- Thời hạn còn lại.
- Đơn còn dưới 24 giờ.
- Đơn quá hạn chưa xử lý.
- Đơn bị đóng băng bởi tranh chấp.
- Đơn hoặc ví có số dư không khớp.

Kiểm tra cả:

1. Escrow của từng đơn bằng số tiền đáng lẽ đang giữ.
2. Tổng Escrow của người dùng bằng tổng các đơn đang giữ của người đó.

Không chỉ kiểm tra tổng ví đủ tiền rồi dùng tiền của đơn khác để xử lý.

Admin giải ngân hoặc hoàn tiền phải:

- Có quyền.
- Đơn còn `HELD`.
- Đủ điều kiện nghiệp vụ.
- Xem trước bảng tiền.
- Nhập lý do.
- Ghi người thực hiện và thời gian.

Đơn tranh chấp phải xử lý qua hồ sơ tranh chấp. Không có nút giải ngân ở màn Escrow để bỏ qua quy trình bằng chứng.

Đơn sai lệch bị chặn thao tác tiền; các đơn hợp lệ khác vẫn được xử lý. Không tự ép số dư về 0 để che sai lệch.

### 3.6. Khiếu nại có bằng chứng

Buyer có thể khiếu nại đơn đã được seller nhận và còn giữ Escrow.

Loại vấn đề:

- Chưa nhận được hàng.
- Sai sản phẩm.
- Sai mô tả/tình trạng.
- Hàng hư hỏng.
- Seller không thực hiện giao dịch.
- Vấn đề khác.

Hồ sơ gồm:

- Loại vấn đề.
- Mô tả chi tiết.
- Thời điểm phát hiện.
- Yêu cầu xử lý.
- Bằng chứng buyer.
- Phản hồi và bằng chứng seller.
- Dữ liệu giao nhận.
- Hội thoại liên quan.
- Lịch sử admin yêu cầu bổ sung.
- Kết quả và lý do quyết định.

**Bằng chứng:**

- Sai hàng, sai mô tả hoặc hư hỏng: cần ảnh hoặc tài liệu hình ảnh chỉ rõ vấn đề.
- Chưa nhận hàng: dùng trạng thái giao nhận và trao đổi; không bắt chụp món hàng chưa nhận.
- Seller không phản hồi: dùng lịch sử đơn và hội thoại.
- Hệ thống kiểm tra tệp hợp lệ; admin đánh giá nội dung, không coi “có file” đồng nghĩa đã chứng minh đúng.

Tiến trình hồ sơ:

```text
Đã tiếp nhận
→ Chờ bổ sung / Chờ seller phản hồi
→ Đang xem xét
→ Đã quyết định
```

Ngay khi tiếp nhận khiếu nại hợp lệ, đơn sang `DISPUTED` và ngừng auto-confirm. Lưu lại deadline cũ để đối chiếu.

Mặc định:

- Seller có 48 giờ phản hồi.
- Mục tiêu admin xử lý trong 72 giờ.
- Quá hạn được đánh dấu ưu tiên, không tự giải ngân.
- Admin có thể tiếp tục sau hạn phản hồi nếu ghi rõ bên không phản hồi và căn cứ đang có.

Hai quyết định cuối:

- Giải ngân seller.
- Hoàn buyer sau khi trừ phí sàn.

Trước quyết định, admin phải đánh dấu đã xem hồ sơ và chỉ ra bằng chứng/tin nhắn làm căn cứ. Lý do được lưu bất biến. Không cho đóng vụ việc chỉ bằng một nút khi hồ sơ chưa được đánh giá.

Bằng chứng và lời giải trình cũ không bị ghi đè; bổ sung là bản ghi mới.

### 3.7. Người dùng và kiểm duyệt

Màn người dùng có:

- Buyer/seller.
- Trạng thái tài khoản.
- Email và trạng thái xác minh.
- Lịch sử đơn.
- Số lần cảnh cáo.
- Vi phạm và báo cáo liên quan.
- Lịch sử khóa/mở.

Khóa/mở bắt buộc có lý do.

Tài khoản bị khóa:

- Không đăng bài, đặt đơn, đẩy tin hoặc mở hội thoại mới.
- Vẫn đọc đơn cũ và phản hồi hồ sơ tranh chấp.
- Không làm mất tiền hoặc chặn hệ thống hoàn/giải ngân đơn cũ.
- Bài đang bán bị ẩn khỏi sàn; bài đang giữ tiền không bị xóa.

Trong local, xác minh OTP phải ghi đúng nguồn xác minh mô phỏng; không tuyên bố đã xác thực với trường đại học.

Listing có trạng thái chờ duyệt, đang hiển thị, bị ẩn và đã gỡ:

- Seller tạo bài mới ở trạng thái chờ duyệt.
- Admin duyệt để bài xuất hiện công khai.
- Seller vẫn xem được bài của mình.
- Gỡ là xóa mềm, giữ tham chiếu đơn/chat/bằng chứng.
- Không tự công khai lại hàng bị khiếu nại chất lượng sau hoàn tiền; chuyển về chờ kiểm duyệt.

Người dùng có thể báo cáo listing với loại vi phạm và mô tả. Admin xử lý báo cáo, ghi kết quả và có thể cảnh cáo, ẩn bài hoặc khóa tài khoản.

### 3.8. Voucher và chiến dịch

Admin cấu hình một lần; hệ thống tự áp dụng và cập nhật.

Mỗi chiến dịch phiên bản này có một mã, với:

- Tên, mã và mô tả.
- Giảm cố định hoặc phần trăm.
- Mức giảm tối đa.
- Tiền hàng tối thiểu.
- Ngày bắt đầu/kết thúc.
- Đối tượng.
- Ngân sách.
- Tổng lượt.
- Lượt/người.
- Bật/tắt.

Đối tượng hỗ trợ:

- Tất cả người mua.
- Người chưa có đơn hoàn tất.
- Một cụm trường.
- Danh sách tài khoản được chọn.

Một đơn dùng một voucher; voucher giảm tiền hàng, không giảm ship. Không có mã thì không tự giảm 5.000đ.

Ngân sách:

```text
Còn có thể sử dụng =
Ngân sách tổng
− Ngân sách đang giữ bởi đơn chờ xử lý
− Trợ giá đã ghi nhận trên đơn hoàn tất
```

Khi tạo đơn, giữ lượt và ngân sách. Hoàn tất thì ghi nhận đã dùng. Hủy/hoàn thì trả lượt và ngân sách. Hai người tranh lượt cuối chỉ một người được giữ.

Admin không thể giảm ngân sách/hạn mức xuống dưới phần đã dùng và đang giữ.

Báo cáo chiến dịch:

- Đơn hoàn tất.
- GMV tạo ra.
- Phí sàn ghi nhận.
- Phí giữ lại của đơn hoàn.
- Tổng trợ giá.
- Ngân sách giữ/đã dùng/còn lại.
- Chi phí ship phải bù khi hoàn.
- Đóng góp ròng của chiến dịch.

Không gọi toàn bộ tiền buyer thanh toán là doanh thu của TakeTwo.

---

## 4. Thiết kế kỹ thuật, dữ liệu và giao tiếp API

### 4.1. Tổ chức xử lý

Giữ service transaction tài chính làm nền; tách thêm các nhóm:

- Báo giá và voucher.
- Chat.
- Giao nhận.
- Tranh chấp và bằng chứng.
- Quản trị và kiểm duyệt.
- Báo cáo/đối soát.

Controller bất đồng bộ phải được hỗ trợ đúng. Bỏ giả định mọi POST đều xử lý đồng bộ trước khi bổ sung upload/chat.

Không giữ transaction SQLite trong lúc chờ ghi file hoặc gọi tác vụ bất đồng bộ. Chuẩn bị dữ liệu trước, thực hiện phần SQL nguyên tử, rồi trả phản hồi sau commit.

### 4.2. Các nhóm dữ liệu bổ sung

| Nhóm | Dữ liệu cần lưu |
|---|---|
| Tài khoản | Trạng thái, xác minh email, lý do khóa, lịch sử cảnh cáo |
| Listing | Trạng thái duyệt, người duyệt, lý do ẩn/gỡ, điểm hẹn tùy chọn |
| Chat | Hội thoại, participant, sản phẩm, tin nhắn, mốc đã đọc |
| Đơn | Snapshot tiền/fee/voucher, cách nhận, mốc trạng thái, phiên bản tính tiền |
| Voucher | Chiến dịch, điều kiện, ngân sách, lượt giữ/dùng/trả |
| Vận chuyển | Lượt giao nhận, sự kiện, cước và khoản phải trả |
| Tranh chấp | Hồ sơ, bài trao đổi, bằng chứng, SLA và quyết định |
| Kiểm duyệt | Báo cáo listing, vi phạm và thao tác xử lý |
| Tài chính | Bút toán, phân bổ theo đơn, hoàn tiền và thanh toán vận chuyển |
| Audit | Actor, hành động, đối tượng, lý do, thời gian, thay đổi liên quan |

Mỗi đơn chỉ có **một kết quả quyết toán cuối cùng**. Dùng ràng buộc duy nhất theo order ID cùng kiểm tra `HELD` trong transaction để chống giải ngân/hoàn tiền hai lần.

### 4.3. Sổ tài chính

Dùng nhật ký bút toán cân bằng cho các nghiệp vụ mới, gồm:

- Số dư khả dụng.
- Escrow từng đơn.
- Phải trả vận chuyển.
- Tài khoản trung chuyển cước.
- Phí sàn.
- Doanh thu boost.
- Chi phí voucher.
- Chi phí vận chuyển khi hoàn.
- Nguồn tiền mô phỏng.

Từng nghiệp vụ có mã duy nhất và tham chiếu order/shipment/user.

Các thay đổi ví, số dư Escrow, quyết toán, voucher và nhật ký phải commit cùng nhau.

Nạp tiền, thanh toán, phán quyết và thanh toán vận chuyển có khóa idempotency. Gửi lại cùng yêu cầu trả cùng kết quả hoặc báo đã xử lý, không ghi thêm tiền.

### 4.4. API chính

| Nhóm | Giao tiếp |
|---|---|
| Sản phẩm | Giữ API hiện có; bổ sung trạng thái duyệt và điểm hẹn tùy chọn |
| Chat | Tạo/liệt kê hội thoại; đọc/gửi tin theo conversation ID; đánh dấu đã đọc |
| Checkout | `POST /api/checkout/quote`; giữ endpoint tạo đơn hiện tại |
| Voucher người dùng | Danh sách mã và điều kiện; kiểm tra trong báo giá |
| Đơn | Nhận, từ chối, hủy trước nhận, đánh dấu sẵn sàng, bàn giao trực tiếp, xác nhận nhận |
| Giao nhận admin | Tạo lượt, cập nhật trạng thái, xem/cập nhật khoản phải trả |
| Tranh chấp | Tạo hồ sơ, bổ sung lời giải trình, gắn bằng chứng, xem tiến trình |
| Tranh chấp admin | Phân loại, yêu cầu bổ sung, đánh giá hồ sơ, xem trước tiền và quyết định |
| Quản trị | Dashboard, đối soát, Escrow, người dùng, listing và báo cáo |
| Voucher admin | Tạo/sửa/bật/tắt, xem lượt dùng và báo cáo chiến dịch |
| Tệp | Upload và tải bằng chứng có kiểm tra quyền |

**Báo giá checkout** nhận product ID, cách nhận và mã voucher; trả:

- Tiền hàng, ship, giảm giá.
- Tổng cần trả.
- Phí sàn.
- Số dư và số thiếu.
- Gợi ý nạp.
- Chính sách hoàn và số phí có thể bị giữ.

Báo giá không giữ sản phẩm, tiền hay lượt voucher. Tạo đơn phải kiểm tra lại tất cả trong transaction.

Frontend gửi tổng đã nhìn thấy; nếu tính lại khác thì server yêu cầu cập nhật báo giá, không âm thầm thu số khác.

### 4.5. Quyền truy cập

- Middleware giao dịch chỉ cho buyer/seller.
- Middleware quản trị chỉ cho admin.
- Backend xác định người thao tác từ session, không tin ID actor trong payload.
- Chat chỉ participant đọc.
- Hồ sơ tranh chấp chỉ buyer, seller của đơn và admin được xem.
- Admin chỉ xem hội thoại liên quan khi xử lý hồ sơ, có ghi nhận truy cập.
- Thông tin mật khẩu/hash không có trong phản hồi.
- Nội dung tin nhắn và lý do xử lý được render như văn bản an toàn.

### 4.6. Upload bằng chứng

- JPEG, PNG và WebP.
- Tối đa 5 MB/tệp; tối đa 5 ảnh cho một lần bổ sung.
- Kiểm tra định dạng thực ở server.
- Lưu ngoài thư mục public, tên file do server tạo.
- Tải ảnh qua endpoint kiểm tra quyền.
- Không dùng đường dẫn file do client cung cấp.
- Không cho dùng attachment của hồ sơ/hội thoại người khác.

Để giữ dependency tối thiểu cho local, mỗi yêu cầu upload một ảnh dạng dữ liệu hiện có; phần tin nhắn/hồ sơ chỉ gửi attachment ID. Không gửi lại toàn bộ ảnh mỗi lần polling.

### 4.7. Migration và dữ liệu cũ

- Sao lưu trước migration.
- Không tự reset.
- Không đổi ID sản phẩm/người dùng.
- Giữ số dư và chứng từ cũ.
- Đơn đã quyết toán giữ kết quả lịch sử và nhãn phiên bản tính tiền cũ.
- Đơn đang giữ tiền được kiểm tra và chuyển sang quy tắc TakeTwo chịu vận chuyển; không sửa số tiền buyer đã trả hoặc voucher đã chốt.
- Đơn cũ đang giao có bản ghi giao nhận chuyển đổi, ghi rõ nguồn migration.
- Nếu không đủ dữ liệu để đối soát, đánh dấu cần kiểm tra và chặn quyết toán thay vì suy đoán.

Reset demo chủ động tạo dữ liệu mới theo toàn bộ quy tắc mới, có bản sao trước reset.

Cập nhật `public/flow-mua-ban.html` để thể hiện chat trước mua, duyệt tin, admin riêng, hai nhánh giao nhận, tiền ship cho đơn vị vận chuyển và hoàn sau khi trừ phí sàn.

---

## 5. Thứ tự triển khai và nghiệm thu

### 5.1. Mốc triển khai

| Mốc | Công việc | Điều kiện hoàn thành |
|---|---|---|
| 1 | Baseline, sao lưu, tái hiện lỗi cũ | Có dữ liệu và kiểm thử bảo vệ sản phẩm/đẩy tin |
| 2 | Quy tắc tiền, migration và sổ tài chính | Quyết toán/hoàn/vận chuyển cân bằng, không lặp |
| 3 | Tách admin và kiểm tra quyền | Admin không gọi được API mua bán |
| 4 | Voucher, báo giá và nạp từ checkout | Mã tự áp dụng, ngân sách đúng, không mất nháp |
| 5 | Chat trước mua và upload có quyền | Hai bên trao đổi được trước khi trả tiền |
| 6 | Giao nhận và khoản phải trả | Seller không nhập vận đơn; cước đúng người nhận |
| 7 | Tranh chấp có bằng chứng | Hồ sơ đủ tiến trình, lý do và nhật ký quyết định |
| 8 | Người dùng, duyệt tin và báo cáo | Khóa/mở/ẩn/gỡ có kiểm soát và lý do |
| 9 | Dashboard kinh doanh, đối soát và chiến dịch | Các tổng số khớp nguồn dữ liệu và bộ lọc |
| 10 | Khôi phục dashboard xanh và responsive | Nhận diện cũ, bố cục gọn, không lỗi thao tác |
| 11 | Hồi quy và cập nhật tài liệu | Chạy đủ kịch bản bằng trình duyệt và restart |

Kế hoạch này bao gồm phạm vi mở rộng mới của admin, chat và bằng chứng; triển khai theo các mốc nghiệm thu, không coi là cùng phạm vi với bản sửa ba giờ ban đầu.

### 5.2. Kiểm thử tài chính bắt buộc

- Đơn hoàn tất đúng công thức mới; seller không nhận ship.
- Hai lựa chọn cước và gặp trực tiếp đều cân bằng.
- Hoàn khiếu nại trừ đúng phí sàn.
- Phí giữ lại không vượt số buyer đã thanh toán.
- Hoàn không đổi voucher thành tiền.
- Hủy trước nhận không thu phí.
- Cước chưa phát sinh không tạo khoản phải trả.
- Cước phát sinh vẫn phải trả khi hoàn.
- Thanh toán vận chuyển không tạo chi phí lần hai.
- Hai request cùng mua chỉ tạo một đơn.
- Hai request quyết toán chỉ xử lý một lần.
- Lỗi giữa transaction rollback ví, voucher và quyết toán.
- Escrow từng đơn và tổng ví được đối chiếu riêng.
- Số âm của sàn do voucher/ship được hiển thị đúng, không bị ép thành 0.

### 5.3. Kiểm thử voucher

- Mã hợp lệ, sai, hết hạn, chưa bắt đầu, bị tắt.
- Điều kiện người dùng và giá trị đơn.
- Giảm cố định/phần trăm và mức trần.
- Không có mã thì không tự giảm.
- Không vượt ngân sách hoặc hạn mức.
- Tranh lượt/ngân sách cuối chỉ một request thành công.
- Tạo đơn lỗi không mất lượt.
- Hoàn trả lượt/ngân sách một lần.
- Sửa mã không thay đơn cũ.
- Báo cáo GMV, trợ giá và đóng góp ròng khớp từng đơn.

### 5.4. Kiểm thử quyền và hồ sơ

- Admin bị chặn mua, bán, boost và chat như người dùng.
- Người thường không truy cập API admin.
- Người ngoài không đọc chat, hồ sơ hoặc ảnh.
- Khóa tài khoản chặn giao dịch mới nhưng không làm mất tiền đơn cũ.
- Seller không thể nhận/gửi đơn người khác.
- Buyer không khiếu nại đơn người khác.
- Khiếu nại đóng băng auto-confirm.
- Không phán quyết khi chưa ghi nhận đánh giá hồ sơ.
- Quyết định có lý do, actor và thời gian.
- Hồ sơ thiếu bằng chứng có yêu cầu bổ sung rõ ràng.
- Trường hợp chưa nhận hàng không bị bắt tải ảnh món hàng.

### 5.5. Kiểm thử trình duyệt

Chạy ở 1440px, 768px và 390px:

1. Seller đăng bài không điểm hẹn → admin duyệt → xuất hiện trên sàn.
2. Buyer mở đúng chi tiết và chat trước mua.
3. Buyer áp voucher, thiếu tiền, nạp qua popup và quay lại checkout.
4. Gặp trực tiếp → seller bàn giao → buyer xác nhận.
5. TakeTwo giao hàng → seller chuẩn bị → admin tạo/cập nhật giao nhận → buyer xác nhận.
6. Khiếu nại có ảnh → seller giải trình → admin hoàn sau phí.
7. Khiếu nại bị bác → admin giải ngân.
8. Hết hạn không khiếu nại → tự hoàn tất.
9. Admin đối soát seller nhận, cước phải trả, voucher và sàn ròng.
10. Reload, Back, đổi tài khoản, lỗi mạng và restart server không làm sai dữ liệu.

**Nghiệm thu cuối:** dashboard xanh được phục hồi; web hoạt động xuyên suốt trên local; chat có trước thanh toán; voucher tự động; seller không tự nhập vận đơn; admin có khu riêng; khiếu nại có bằng chứng; mọi khoản tiền được phân bổ và đối soát rõ ràng; không còn hoàn một phần.
