**TAKE TWO**

**BUSINESS PLAN**

*Evidence-based  •  Financial-first  •  Executable MVP*

**KẾ HOẠCH KINH DOANH NỀN TẢNG C2C SECONDHAND**

Phạm vi triển khai: sinh viên đại học/cao đẳng trên địa bàn thành phố Hà Nội

BẢN MỞ RỘNG PHẠM VI TOÀN HÀ NỘI – FINANCIAL MODEL V3

04/11/2026

# **MỤC LỤC**

* 1\. Executive Summary  
* 2\. Problem, Customer & Value Proposition  
* 3\. Market Opportunity, Competition & Evidence  
* 4\. Business Model & Revenue  
* 5\. Product MVP, Go-to-Market & Operations  
* 6\. Financial Model & Capital Requirements  
* 7\. Execution Team, Risk & Compliance  
* 8\. KPI, Roadmap & Decision Gates  
* 9\. Conclusion  
* Appendix A. Survey Data & Source Integrity  
* Appendix B. Experiment Protocols  
* Appendix C. Technical Scope & Controls  
* Appendix D. Assumptions & References  
* Appendix E. Evidence Registers

# **1\. EXECUTIVE SUMMARY**

TakeTwo là nền tảng C2C hỗ trợ sinh viên mua bán sản phẩm secondhand thông qua tin đăng chuẩn hóa, tìm kiếm, trao đổi gắn với sản phẩm và quản lý trạng thái giao dịch. Thị trường dài hạn được định hướng tại Hà Nội; giai đoạn MVP tập trung cộng đồng sinh viên Hà Nội để kiểm chứng quy trình và khả năng hình thành thanh khoản.

Giá trị sản phẩm được tổ chức trong workflow: Create Listing → Discovery → Chat → Purchase Request → Accepted/Reserved → Completed/Sold → Review. Thanh toán và giao nhận trong giai đoạn MVP do buyer và seller tự thỏa thuận bên ngoài nền tảng. Trạng thái Completed trên hệ thống được báo cáo riêng với giao dịch có xác nhận từ cả hai phía.

| Chỉ tiêu | Thận trọng | Cơ sở | Cao |
| :---- | :---- | :---- | :---- |
| GMV năm 1 | 10,86 triệu VNĐ | 78,97 triệu VNĐ | 190,35 triệu VNĐ |
| Giao dịch hoàn tất năm 1 | 72,43 | 526,46 | 1.268,98 |
| Seller active cuối M12 | 99,95 | 415,96 | 879,47 |
| Doanh thu ghi nhận năm 1 | 1,01 triệu VNĐ | 7,78 triệu VNĐ | 26,70 triệu VNĐ |
| Kết quả P\&L năm 1 | \-33.649.140 VNĐ | \-26.966.750 VNĐ | \-8.272.958 VNĐ |
| Dòng tiền lũy kế cuối M12 | \-33.446.537 VNĐ | \-25.411.436 VNĐ | \-2.933.476 VNĐ |
| Dòng tiền lũy kế cuối M12 | \-34.409.307 VNĐ | \-33.173.079 VNĐ | \-29.531.383 VNĐ |

M1–M6 là giai đoạn Academic MVP và free pilot, doanh thu bằng 0\. M7–M12 là giai đoạn paid validation trong mô hình, chỉ được kích hoạt sau khi hoàn thành điều kiện vận hành, thu tiền và tuân thủ. Các kết quả tài chính là đầu ra kịch bản từ workbook TakeTwo\_Financial\_Model\_Hanoi\_UseCase, không phải doanh thu hoặc giao dịch đã phát sinh.

Ngân sách theo mô hình cập nhật là 34.650.000 VNĐ, bao gồm 31.500.000 VNĐ chi phí trước dự phòng và 3.150.000 VNĐ dự phòng 10%. Mức ngân sách này đã bổ sung tư vấn pháp lý/đăng ký và tích hợp nạp QR/đối soát so với ngân sách ban đầu 30.250.000 VNĐ.

## **Tóm tắt quyết định tài chính**

| Nội dung | Cơ sở mô hình |
| :---- | :---- |
| Nguồn thu sau paid gate | Lượt đẩy lẻ 15.000 VNĐ; gói 49.000 VNĐ/5 lượt; gói 79.000 VNĐ/10 lượt; hoa hồng chỉ phát sinh trong kịch bản cao. |
| Free pilot | M1–M6; doanh thu bằng 0\. |
| Thời điểm bắt đầu thu phí trong workbook | M7, với điều kiện paid gate được thông qua. |
| Nhu cầu vốn đỉnh – Base | 33.173.079 VNĐ theo dòng tiền lũy kế cuối M12. |
| Hòa vốn vận hành – Base | Khoảng 46 payer/tháng; tương đương khoảng 460 seller active ở tỷ lệ chuyển đổi trả phí 10%. |

# **2\. PROBLEM, CUSTOMER & VALUE PROPOSITION**

## **2.1. Customer jobs và vấn đề cần giải quyết**

| Nhóm | Customer job | Vấn đề trong hành vi hiện tại | Cách TakeTwo đáp ứng |
| :---- | :---- | :---- | :---- |
| Buyer | Tìm sản phẩm đúng nhu cầu, điều kiện, giá và vị trí | Phải kiểm tra nhiều bài đăng và hỏi lại thông tin | Listing chuẩn hóa, search/filter và product detail |
| Buyer | Biết sản phẩm còn bán, đã giữ hay đã bán | Dễ phát sinh trao đổi không cần thiết khi trạng thái không rõ | Available – Reserved – Sold và log cập nhật |
| Seller | Đăng bán và quản lý trao đổi theo từng món | Bài đăng trôi, thông tin và hội thoại phân tán | Listing gắn với chat và purchase request |
| Seller | Theo dõi người mua đã cam kết đến đâu | Khó quản lý nhiều cuộc trao đổi đồng thời | Purchase Request và transaction state |

## **2.2. Bằng chứng khảo sát hiện có**

Khảo sát Wave 2 ghi nhận 80 phản hồi, trong đó 62 phản hồi vượt qua sàng lọc cơ bản về tuổi và tình trạng sinh viên. Trong nhóm 62 người, 57 người (91,9%) tự khai đã mua đồ secondhand trong 12 tháng; 33 người (53,2%) đã bán đồ secondhand; 24 người (38,7%) chọn Facebook Group trường/KTX là kênh giao dịch gần nhất; 39 người (62,9%) chọn mức 4–5/5 về sẵn sàng thử TakeTwo; và 4 người (6,5%) chọn TakeTwo khi phải chọn một kênh duy nhất.

Có 54/80 phản hồi được ghi nhận là không nhất quán giữa các câu hỏi A1/A2 và CK1; chỉ 19/62 trường hợp nhất quán theo phép đối chiếu hiện tại. Vì vậy, kết quả khảo sát được sử dụng để định hướng nghiên cứu và xác định nhóm seller cần phỏng vấn, không dùng để suy rộng market share, conversion rate hoặc willingness to pay.

## **2.3. Value proposition**

Đối với seller có sản phẩm cần thanh lý, TakeTwo cung cấp quy trình đăng tin có cấu trúc và quản lý yêu cầu mua theo từng sản phẩm. Đối với buyer, nền tảng tập trung thông tin tình trạng, giá, vị trí và trạng thái giao dịch trong một luồng thống nhất. Lợi ích kỳ vọng là giảm bất định trước giao dịch; hiệu quả về thời gian và tỷ lệ hoàn tất được đo trong thử nghiệm, không mặc định là kết quả đã đạt.

## **2.4. Các giả thuyết giá trị cốt lõi**

| Giả thuyết | Thử nghiệm | Chỉ số đánh giá |
| :---- | :---- | :---- |
| H1 – Listing rõ ràng có ích | So sánh tác vụ tìm hiểu sản phẩm trên TakeTwo và kênh hiện tại | Thời gian hoàn thành, số câu hỏi bổ sung, tỷ lệ hoàn thành tác vụ |
| H2 – Trạng thái giao dịch có ích | Seller/buyer dùng Purchase Request và cập nhật trạng thái | Tỷ lệ request được xử lý, cập nhật trạng thái đúng |
| H3 – Seller thay đổi hành vi | Mời seller đăng listing thật, không dùng dữ liệu demo | Seller tạo listing thật, đăng lại và có tương tác |
| H4 – Có nhu cầu trả phí | Đưa offer promoted listing sau free pilot | Seller nhận offer, seller thanh toán thực tế, refund |
| H5 – Marketplace có thanh khoản | Theo dõi listing, chat, request và giao dịch hai phía xác nhận | Request hợp lệ, tỷ lệ matching và completed hai phía |

# **3\. MARKET OPPORTUNITY, COMPETITION & EVIDENCE**

## **3.1. Phạm vi thị trường**

Thị trường mục tiêu và phạm vi triển khai MVP của TakeTwo là sinh viên đại học/cao đẳng đang học tập tại Hà Nội. Nền tảng được xây dựng với phạm vi tiếp cận toàn thành phố ngay từ MVP; hoạt động acquisition được triển khai theo cụm trường/campus và khu vực để kiểm soát nguồn cung, hỗ trợ người dùng và chi phí vận hành.

### **3.2.3. TAM – Tổng thị trường tiềm năng (Total Addressable Market)**

Trong phạm vi TA là sinh viên đại học/cao đẳng đang theo học tại Hà Nội, TAM biểu thị tổng giá trị mua bán secondhand tiềm năng trước khi xét đến giới hạn danh mục, kênh tiếp cận và năng lực vận hành của TakeTwo.

Nhóm sử dụng công thức:

**TAM \= TA × Tỷ lệ người mua đồ cũ hằng năm × Số giao dịch trung bình/người/năm × AOV**

Trong đó:

* TA: Quy mô nhóm khách hàng mục tiêu.  
* Tỷ lệ người mua đồ cũ: Tỷ lệ khách hàng có phát sinh nhu cầu mua sản phẩm đã qua sử dụng trong năm.  
* Số giao dịch trung bình/người/năm: Số lần mua hàng đã qua sử dụng trung bình của mỗi người mua.  
* AOV: Giá trị giao dịch trung bình, giả định theo ba kịch bản.

| Chỉ tiêu | Low | Base | High |
| :---- | :---: | :---: | :---: |
| TA | 650.000 | 1.000.000 | 1.000.000 |
| Tỷ lệ người mua đồ cũ/năm | 20% | 30% | 40% |
| Giao dịch trung bình/người/năm | 1,5 | 2,0 | 2,5 |
| AOV | 120.000 VNĐ | 150.000 VNĐ | 180.000 VNĐ |
| **TAM/năm** | **23,4 tỷ VNĐ** | **90 tỷ VNĐ** | **180 tỷ VNĐ** |

TAM thể hiện tiềm năng thị trường theo các giả định về khách hàng và hành vi mua bán. Đây không phải doanh thu dự kiến của TakeTwo và cũng không có nghĩa nền tảng có thể tiếp cận toàn bộ thị trường ngay từ năm đầu.

Các số liệu trên là giả định lập kế hoạch, cần được kiểm chứng thêm bằng dữ liệu về quy mô khách hàng và hành vi mua bán đồ cũ.

### **3.2.4. SAM – Thị trường có thể phục vụ (Serviceable Available Market)**

SAM là phần thị trường TAM phù hợp với danh mục sản phẩm và kênh tiếp cận mà TakeTwo có thể phục vụ.

Nhóm sử dụng hai tỷ lệ lọc:

* Tỷ lệ thị trường thuộc danh mục sản phẩm phù hợp: 60%.  
* Tỷ lệ khách hàng có thể tiếp cận qua kênh trực tuyến: 70%.

Công thức:

**SAM \= TAM × 60% × 70% \= TAM × 42%**

| Kịch bản | TAM | Tỷ lệ danh mục phù hợp | Tỷ lệ kênh trực tuyến | SAM/năm |
| :---- | :---: | :---: | :---: | :---: |
| Low | 23,4 tỷ VNĐ | 60% | 70% | **9,828 tỷ VNĐ** |
| Base | 90 tỷ VNĐ | 60% | 70% | **37,8 tỷ VNĐ** |
| High | 180 tỷ VNĐ | 60% | 70% | **75,6 tỷ VNĐ** |

Theo kịch bản Base, thị trường phù hợp với danh mục sản phẩm và kênh trực tuyến của TakeTwo được ước tính ở mức 37,8 tỷ VNĐ/năm.

Các tỷ lệ 60% và 70% hiện là giả định của nhóm, chưa phải tỷ lệ đã được xác minh bằng khảo sát thị trường. Nhóm cần giữ rõ cơ sở giả định này khi trình bày kết quả.

## **3.3. SOM năm 1 theo mô hình funnel**

| Chỉ tiêu | Thận trọng | Cơ sở | Cao |
| :---- | :---- | :---- | :---- |
| Seller active tại M3 | 50 | 150 | 250 |
| Tăng trưởng seller active/tháng sau M3 | 8% | 12% | 15% |
| Giao dịch hoàn tất/seller active/tháng | 0,10 | 0,20 | 0,25 |
| Giao dịch hoàn tất năm 1 | 72,43 | 526,46 | 1.268,98 |
| GMV năm 1 | 10,86 triệu VNĐ | 78,97 triệu VNĐ | 190,35 triệu VNĐ |
| Tỷ lệ trên SAM pilot | 0,33% | 1,88% | 4,50% |

SOM năm 1 được tính bottom-up từ mục tiêu seller active toàn Hà Nội tại M3, tốc độ tăng trưởng seller active/tháng và số giao dịch hoàn tất trên mỗi seller active. Các giả định và kết quả theo ba kịch bản được trình bày tại Phụ lục F và workbook Hà Nội.

## **3.4. Competitive benchmark**

| Tiêu chí | Facebook Group / Marketplace | TakeTwo (thiết kế sản phẩm) |
| :---- | :---- | :---- |
| Nguồn người dùng | Cộng đồng sẵn có và thói quen sử dụng hiện hữu | Marketplace sinh viên toàn Hà Nội; acquisition theo cụm trường/campus |
| Listing / discovery | Bài đăng và công cụ tìm kiếm theo nền tảng | Trường dữ liệu sản phẩm có cấu trúc, lọc theo nhu cầu |
| Trao đổi | Tin nhắn/bình luận | Chat gắn với listing |
| Trạng thái giao dịch | Phụ thuộc cập nhật của người bán | Available – Reserved – Sold |
| Trust | Hồ sơ, lịch sử tương tác và cơ chế nền tảng | Review gắn với transaction đã hoàn tất trên hệ thống |

TakeTwo được định vị như một công cụ bổ trợ cho cộng đồng hiện hữu trong giai đoạn đầu. Group sinh viên và referral là kênh tiếp cận seller ban đầu; khả năng giữ seller và đưa buyer quay lại nền tảng được đo bằng listing thật, chat, request và giao dịch xác nhận.

## **3.5. Cạnh tranh và thời điểm gia nhập**

Các kênh thay thế chính gồm Facebook Group/Marketplace, Chợ Tốt, nhóm Zalo và các sàn thương mại điện tử có danh mục hàng đã qua sử dụng. Giai đoạn pilot tập trung so sánh hành vi trên các bài đăng tương đồng về danh mục, tình trạng và giá. Cuối kỳ học, thời điểm chuyển KTX/phòng trọ và tốt nghiệp được xem là giả thuyết mùa vụ cần kiểm tra bằng quan sát listing và phỏng vấn seller.

# **4\. BUSINESS MODEL & REVENUE**

## **4.1. Mô hình theo giai đoạn**

| Giai đoạn | Thời gian | Cung cấp giá trị | Doanh thu |
| :---- | :---- | :---- | :---- |
| Academic MVP | M1–M3 | Listing, search, chat, request, status; hoàn thiện core flow | 0 VNĐ |
| Free pilot | M4–M6 | Seller và buyer thật; theo dõi matching và xác nhận giao dịch | 0 VNĐ |
| Paid validation | M7–M12 | Thử lượt đẩy và gói dịch vụ sau khi qua paid gate | Theo kịch bản workbook |
| Growth | Sau năm 1 | Mở rộng seller/campus và tối ưu retention | Xây dựng theo dữ liệu cohort |

## **4.2. Danh mục sản phẩm và giá**

| Sản phẩm | Giá bán | Quyền lợi mô hình hóa |
| :---- | :---- | :---- |
| Lượt đẩy lẻ | 15.000 VNĐ | 01 lượt ưu tiên hiển thị trong 7 ngày |
| Gói 49k | 49.000 VNĐ/tháng | 05 lượt đẩy trong tháng |
| Gói 79k | 79.000 VNĐ/tháng | 10 lượt đẩy trong tháng |

Tin đăng cơ bản vẫn miễn phí. Các gói được mô hình hóa theo tháng; tỷ trọng payer mua lượt lẻ/gói 49k/gói 79k lần lượt là 60%/30%/10% ở kịch bản Thận trọng và Cơ sở; 50%/35%/15% ở kịch bản Cao. Tần suất sử dụng trung bình của payer mua lẻ là 2 lượt/tháng; tỷ lệ sử dụng lượt trong gói là 70%.

## **4.3. Nguồn thu**

* Doanh thu lượt đẩy lẻ: số payer × tỷ trọng mua lẻ × 2 lượt × 15.000 VNĐ.  
* Doanh thu gói 49k: số payer × tỷ trọng mua gói 49k × 49.000 VNĐ.  
* Doanh thu gói 79k: số payer × tỷ trọng mua gói 79k × 79.000 VNĐ.  
* Hoa hồng: tỷ lệ danh nghĩa 10% GMV; tỷ lệ thu được trong workbook là 0% ở Thận trọng và Cơ sở, 10% ở kịch bản Cao.

Mô hình không ghi nhận doanh thu trong M1–M6. Việc thu phí từ M7 phụ thuộc vào paid gate, khả năng thu tiền, đối soát và điều kiện tuân thủ. Tiền nạp trước vào ví được theo dõi riêng với doanh thu dịch vụ; số dư chưa sử dụng được trình bày là nghĩa vụ phải trả trong mô hình.

## **4.4. Quy trình kiểm chứng willingness to pay**

Sau free pilot, seller đủ điều kiện được nhận offer lượt đẩy 15.000 VNĐ/7 ngày, kèm mô tả vị trí hiển thị, thời hạn, chính sách hoàn tiền và việc dịch vụ không bảo đảm bán được sản phẩm. Ngưỡng thử nghiệm quản trị là tối thiểu 10 seller đủ điều kiện nhận offer và ít nhất 3 khoản thanh toán có bằng chứng. Click, đồng ý miệng và thanh toán thành công được ghi nhận thành các trạng thái riêng.

## **4.5. Phân loại giao dịch**

Type A – giao dịch có hỗ trợ hoặc trợ giá – được dùng để kiểm thử quy trình và kích hoạt nguồn cung. Type B – giao dịch độc lập giữa buyer và seller, không trợ giá giao dịch, được hai phía xác nhận – được dùng để đánh giá nhu cầu tự nhiên. Hai nhóm được báo cáo riêng.

# **5\. PRODUCT MVP, GO-TO-MARKET & OPERATIONS**

## **5.1. Phạm vi MVP**

| Module | Business rule | Ngoài phạm vi pilot |
| :---- | :---- | :---- |
| Account / Listing / Search | Seller sở hữu listing; bắt buộc condition, price, category, location | KYC nâng cao |
| Chat / Purchase Request | Buyer không request listing của chính mình; seller accept/reject | Tích hợp logistics |
| Transaction status | Available → Reserved → Sold; Cancelled có quy tắc rollback | Escrow/payment gateway |
| Review / Moderation | Review gắn Completed; admin xử lý report | AI fraud scoring và AI recommendation |

Completed trên nền tảng là platform-recorded completion. Chỉ số giao dịch xác nhận hai phía được báo cáo riêng; dữ liệu seed/demo không được đưa vào KPI giao dịch thật.

## **5.2. Go-to-market**

| Hoạt động | Owner | Đầu ra |
| :---- | :---- | :---- |
| Phỏng vấn seller có lịch sử bán thật | Huy – Project Lead/BA | Ghi chú phỏng vấn, vấn đề và lý do sử dụng kênh hiện tại |
| Onboard seller và listing thật | Tuấn – Listing/Frontend; Hùng – Communication | Seller ID và listing thật đầy đủ thông tin |
| Mời buyer và kiểm thử discovery | Bình – Discovery; Hùng – Communication | Search, product view, chat và buyer task log |
| Theo dõi request và completed | Phú – Transaction/Trust/QA | Status transition và xác nhận hai phía |
| Theo dõi ngân sách và cash ledger | Huy – Project Lead/BA | Actual cash in/out, chứng từ và forecast |

## **5.3. Quy trình giao dịch**

Buyer xem product detail → liên hệ seller → gửi Purchase Request → seller accept/reject. Khi được chấp nhận, transaction chuyển Accepted và listing có thể chuyển Reserved. Khi hai bên hủy, transaction chuyển Cancelled và listing được đưa về Available nếu phù hợp. Khi giao dịch hoàn tất, hai phía xác nhận và trạng thái chuyển Completed/Sold; buyer đủ điều kiện có thể tạo review.

Seller chịu trách nhiệm về tính chính xác của thông tin và cập nhật trạng thái sản phẩm. Buyer chịu trách nhiệm kiểm tra sản phẩm và thỏa thuận giao nhận. Admin kiểm duyệt nội dung vi phạm và xử lý report; MVP không giữ tiền giao dịch và không cung cấp cơ chế bảo đảm thanh toán.

## **5.4. Ưu tiên nguồn lực**

Trong giai đoạn kiểm chứng, nguồn lực tập trung vào chất lượng listing, khả năng tìm kiếm, xử lý request và ghi nhận giao dịch. Hoạt động cộng đồng gắn với từng thử nghiệm và có tracking nguồn tuyển; giao dịch do thành viên nhóm đóng vai buyer hoặc được trợ giá được phân loại riêng.

# **6\. FINANCIAL MODEL & CAPITAL REQUIREMENTS**

## **6.1. Cơ sở mô hình tài chính**

Workbook TakeTwo\_Financial\_Model\_Hanoi\_UseCase gồm các sheet Summary, Assumptions, Budget, Model, Fix\_log, Use\_Case và Hanoi\_Market. Các đầu vào seller active và công suất được mở rộng theo phạm vi toàn Hà Nội; cơ chế doanh thu và bảng giá được giữ nguyên.

| Giả định chính | Thận trọng | Cơ sở | Cao |
| :---- | :---- | :---- | :---- |
| Seller active tại M3 | 50 | 150 | 250 |
| Tăng trưởng seller active/tháng | 8% | 12% | 15% |
| Giao dịch/seller active/tháng | 0,10 | 0,20 | 0,25 |
| AOV | 150.000 VNĐ | 150.000 VNĐ | 150.000 VNĐ |
| Tỷ lệ seller active trả tiền/tháng | 5% | 10% | 15% |
| Tháng bắt đầu thu phí | M7 | M7 | M7 |
| Tỷ lệ hoa hồng thu được trên hoa hồng danh nghĩa | 0% | 0% | 10% |

## **6.2. Dự báo hoạt động và GMV năm 1**

| Chỉ tiêu | Thận trọng | Cơ sở | Cao |
| :---- | :---- | :---- | :---- |
| Seller active cuối M12 | 99,95 | 415,96 | 879,47 |
| Giao dịch hoàn tali | 72,43 | 526,46 | 1.268,98 |
| GMV | 10.864.922 VNĐ | 78.969.308 VNĐ | 190.347.358 VNĐ |
| Lượt đẩy thực sử dụng | 73,61 | 565,05 | 1.880,30 |
| Công suất slot tối đa/tháng | 428,57 | 428,57 | 428,57 |
| Kiểm tra công suất tại M12 | OK | OK | OK |

Công suất slot được tính từ 100 vị trí ưu tiên đồng thời trên toàn nền tảng, thời gian hiển thị 7 ngày và quy ước 30 ngày/tháng, tương đương khoảng 428,6 lượt/tháng. Kịch bản High được kiểm tra theo công suất tháng trong sheet Model; doanh thu chỉ phản ánh nhu cầu trong giới hạn năng lực đã mô hình hóa.

## **6.3. Dự báo doanh thu năm 1**

| Nguồn doanh thu | Thận trọng | Cơ sở | Cao |
| :---- | :---- | :---- | :---- |
| Lượt đẩy lẻ | 449.120 VNĐ | 3.447.740 VNĐ | 8.612.068 VNĐ |
| Gói 49k | 366.782 VNĐ | 2.815.654 VNĐ | 9.846.464 VNĐ |
| Gói 79k | 197.114 VNĐ | 1.513.175 VNĐ | 6.803.534 VNĐ |
| Hoa hồng thu được | 0 VNĐ | 0 VNĐ | 1.435.345 VNĐ |
| TỔNG DOANH THU | 1.013.016 VNĐ | 7.776.569 VNĐ | 26.697.411 VNĐ |

Doanh thu chỉ phát sinh trong M7–M12 theo mô hình. Kịch bản Cơ sở không ghi nhận hoa hồng; kịch bản Cao ghi nhận hoa hồng dựa trên tỷ lệ thu được giả định 10% của hoa hồng danh nghĩa 10% GMV.

## **6.4. Ngân sách và phân bổ**

| Khoản mục | Ngân sách | Thời gian phân bổ |
| :---- | :---- | :---- |
| Phát triển MVP | 5.000.000 VNĐ | M1–M3 |
| Hosting, backend và cơ sở dữ liệu | 3.000.000 VNĐ | M1–M12 |
| Tên miền và email | 800.000 VNĐ | M1 |
| Bảo mật và kiểm thử | 3.000.000 VNĐ | M3–M6 |
| Lưu trữ hình ảnh và sao lưu | 1.200.000 VNĐ | M1–M12 |
| Công cụ và dịch vụ bên thứ ba | 1.500.000 VNĐ | M1–M12 |
| Bảo trì kỹ thuật | 3.000.000 VNĐ | M4–M12 |
| Kiểm duyệt và hỗ trợ người dùng | 3.000.000 VNĐ | M4–M12 |
| Điều khoản sử dụng và chính sách quyền riêng tư | 2.000.000 VNĐ | M2 |
| Marketing và phát triển cộng đồng | 5.000.000 VNĐ | M4–M12 |
| Tư vấn pháp lý & đăng ký (placeholder) | 3.000.000 VNĐ | M5 |
| Tích hợp nạp QR \+ đối soát (placeholder) | 1.000.000 VNĐ | M5–M6 |
| Tổng chi phí trước dự phòng | 31.500.000 VNĐ |  |
| Dự phòng 10% | 3.150.000 VNĐ |  |
| TỔNG NGÂN SÁCH | 34.650.000 VNĐ | M1–M12 |

## **6.5. P\&L và dòng tiền**

| Chỉ tiêu | Thận trọng | Cơ sở | Cao |
| :---- | :---- | :---- | :---- |
| Tổng doanh thu | 1.013.016 VNĐ | 7.776.569 VNĐ | 28.697.412 VNĐ |
| Chi phí vận hành | 34.650.000 VNĐ | 34.650.000 VNĐ | 34.650.000 VNĐ |
| Phí cổng/đối soát | 12.156 VNĐ | 93.319 VNĐ | 344.369 VNĐ |
| Kết quả P\&L | \-33.649.140 VNĐ | \-26.966.750 VNĐ | \-8.272.958 VNĐ |
| Dòng tiền lũy kế cuối M12 | \-33.446.537 VNĐ | \-25.411.436 VNĐ | \-2.933.476 VNĐ |
| Số dư ví chưa dùng cuối M12 | 40.521 VNĐ | 248.640 VNĐ | 861.720 VNĐ |

Trong kịch bản Cơ sở toàn Hà Nội, doanh thu dịch vụ dự kiến khoảng 7.776.569 VNĐ, GMV khoảng 78.969.308 VNĐ và 526 giao dịch hoàn tất theo giá trị kỳ vọng. Các khoản chi phí được giữ theo ngân sách hiện tại 34.650.000 VNĐ; phí cổng/đối soát tính theo giả định 1% tiền nạp. Dòng tiền và P\&L chi tiết được tổng hợp trong workbook phiên bản Hà Nội.

Tiền nạp ví được mô hình hóa bằng 120% doanh thu dịch vụ, trong đó phần chênh lệch 20% được theo dõi như số dư nghĩa vụ phải trả. Số dư cuối M12 ở kịch bản Cơ sở là 248.640 VNĐ. Phí cổng/đối soát được giả định ở mức 1% tiền nạp. Đối với gói 49k và 79k, workbook hiện ghi nhận toàn bộ giá gói theo số payer mua gói; tỷ lệ sử dụng 70% chỉ tham gia kiểm tra công suất slot. Vì vậy, phần doanh thu gói trong dự báo là doanh thu theo giả định bán gói, chưa phân bổ theo số lượt thực tế đã sử dụng và chưa tách riêng số dư lượt chưa dùng.

## **6.6. Hòa vốn vận hành**

| Chỉ tiêu | Thận trọng | Cơ sở | Cao |
| :---- | :---- | :---- | :---- |
| Chi phí vận hành bình quân/tháng M7–M12 | 1.866.944 VNĐ | 1.866.944 VNĐ | 1.866.944 VNĐ |
| ARPPU/tháng | 40.600 VNĐ | 40.600 VNĐ | 44.000 VNĐ |
| Payer cần/tháng để hòa vốn | 45,98 | 45,98 | 42,43 |
| Seller active cần | 919,68 | 459,84 | 282,87 |
| Tỷ lệ seller active trên TA Base 1.000.000 sinh viên Hà Nội | 5,36% | 2,68% | 1,65% |

Điểm hòa vốn vận hành được tính theo chi phí bình quân M7–M12 chia cho ARPPU. Với quy mô Hà Nội, số payer và seller active cần thiết được đối chiếu theo từng kịch bản trong workbook; chỉ tiêu này phản ánh quy mô hoạt động cần thiết để bù chi phí vận hành theo cấu trúc doanh thu hiện tại.

## **6.7. Kết luận tài chính**

Kịch bản Cơ sở năm đầu theo phạm vi toàn Hà Nội dự kiến đạt khoảng 526 giao dịch hoàn tất, GMV khoảng 78,97 triệu VNĐ và doanh thu dịch vụ khoảng 7,78 triệu VNĐ. Mô hình giữ nguyên giá lượt đẩy 15.000 VNĐ, gói 49.000 VNĐ/5 lượt, gói 79.000 VNĐ/10 lượt và cơ chế hoa hồng chỉ ghi nhận phần thực thu. Ngân sách chi phí được giữ theo cấu trúc hiện tại 34,65 triệu VNĐ; kết quả tài chính được cập nhật theo workbook mới.

# **7\. EXECUTION TEAM, RISK & COMPLIANCE**

## **7.1. Đội ngũ thực hiện**

| Vai trò | Owner | Trách nhiệm |
| :---- | :---- | :---- |
| Project Lead / BA | Huy | Scope, decision log, cash ledger, business rules, điều phối seller research |
| Listing / Frontend | Tuấn | Listing form, category, owner validation, onboarding listing |
| Discovery | Bình | Search/filter, discovery event logs, buyer task test |
| Communication / Community | Hùng | Conversation, chat, seller outreach và buyer activation |
| Transaction / Trust / QA | Phú | Transaction state, review eligibility, moderation, QA và kiểm tra giao dịch |

## **7.2. Risk matrix**

| Rủi ro | Tác động | Kiểm soát vận hành |
| :---- | :---- | :---- |
| Cold-start liquidity | Thiếu listing và buyer interaction để tạo giao dịch | Onboard seller trước; theo dõi listing có chat và request |
| Chất lượng survey/evidence | Sai lệch trong suy luận nhu cầu và dự báo | Đối chiếu raw data; lưu transcript, listing observation và receipt |
| Thiếu hụt dòng tiền | Ngân sách 34,65 triệu VNĐ chưa có xác nhận nguồn vốn | Theo dõi cash ledger, giải ngân theo gate và cập nhật forecast |
| Completed không phản ánh giao dịch thật | KPI thanh khoản bị ghi nhận cao hơn thực tế | Tách platform Completed và two-side verified |
| Rủi ro ví, hoàn tiền và nạp tiền | Phát sinh nghĩa vụ với số dư chưa sử dụng, tranh chấp nạp tiền | Điều khoản số dư, hoàn tiền, hạn dùng và đối soát trước khi thu tiền |
| Bảo mật và dữ liệu cá nhân | Lộ tài khoản, tin nhắn, vị trí hoặc dữ liệu người dùng | Phân quyền tối thiểu, kiểm soát backend, bảo vệ thông tin đăng nhập và giới hạn file upload |
| Phụ thuộc kênh Facebook | Khó chuyển đổi seller khỏi kênh quen thuộc | Định vị TakeTwo bổ trợ group; đo seller quay lại và buyer được giới thiệu |
| Công suất vị trí ưu tiên | Nhu cầu lượt đẩy vượt số slot hiển thị | Theo dõi công suất 5 slot đồng thời; không bán vượt năng lực thực tế |

## **7.3. Legal, user trust và ranh giới trách nhiệm**

TakeTwo xử lý thông tin tài khoản, hình ảnh sản phẩm, vị trí tương đối, tin nhắn và transaction records. Nền tảng công khai mục đích xử lý dữ liệu, giới hạn quyền truy cập và cung cấp chức năng report/ẩn listing vi phạm. Backend kiểm tra quyền sở hữu listing; mật khẩu không lưu dạng rõ; token và thông tin nhạy cảm không xuất hiện trong log.

Trước khi vận hành công khai hoặc thu phí promoted listing/gói dịch vụ, dự án rà soát nghĩa vụ liên quan đến thương mại điện tử, bảo vệ dữ liệu cá nhân, điều khoản sử dụng, thuế/chứng từ, quảng bá dịch vụ và cơ chế tiếp nhận/hoàn tiền. Các khoản tư vấn pháp lý và đăng ký được dự toán 3.000.000 VNĐ trong workbook, hiện là placeholder cần báo giá. MVP không giữ tiền mua bán giữa buyer và seller.

## **7.4. SWOT**

| Strengths | Weaknesses | Opportunities | Threats |
| :---- | :---- | :---- | :---- |
| Workflow thống nhất; phạm vi cộng đồng tập trung; database và business rules rõ để kiểm thử | Chưa có thanh khoản được chứng minh; doanh thu nhỏ so với chi phí; đội ngũ giới hạn theo học kỳ | Cộng đồng sinh viên có thể thử nghiệm có kiểm soát; xu hướng reuse/secondhand | Network effect và thói quen dùng Facebook; tin giả/listing sai; trạng thái không cập nhật; rủi ro tuân thủ |

# **8\. KPI, ROADMAP & DECISION GATES**

## **8.1. KPI trọng tâm**

| KPI | Định nghĩa | Quyết định hỗ trợ |
| :---- | :---- | :---- |
| Completed transactions | Số giao dịch Completed trên hệ thống; báo cáo riêng giao dịch buyer và seller xác nhận | Đánh giá thanh khoản và độ tin cậy dữ liệu |
| Active real listings | Listing thật, đang Available trong kỳ; loại demo/seed | Đo nguồn cung |
| Chat-to-purchase-request rate | Purchase request hợp lệ / conversation hợp lệ cùng cohort | Đo khả năng chuyển đổi buyer intent |
| Repeat seller rate | Seller quay lại tạo listing thật / seller đủ điều kiện theo dõi | Đo retention bên cung |
| Net cash burn & cash balance | Actual cash out – actual cash in; số dư cuối kỳ | Quyết định tiếp tục, giảm burn hoặc bố trí vốn |

KPI thương mại trong giai đoạn paid validation gồm tỷ lệ seller trả phí, ARPPU, lượt đẩy thực dùng, doanh thu thuần sau refund, số dư ví chưa sử dụng, tỷ lệ sử dụng lượt trong gói và chi phí thu hút seller trả tiền.

## **8.2. Roadmap 12 tuần và giai đoạn tiếp theo**

| Thời gian | Trọng tâm | Deliverable |
| :---- | :---- | :---- |
| W1–W2 (M1) | Chốt MVP, phỏng vấn seller, business rules | Requirements freeze, seller interview log, kế hoạch chi |
| W3–W4 (M1) | Phát triển và kiểm thử core flow | Demo listing, search, chat, request, state transition |
| W5–W6 (M2) | Onboard seller đầu tiên | Listing thật, seller log, danh mục |
| W7–W8 (M2) | Mời buyer, tối ưu discovery | Chat hợp lệ, buyer task test, feedback |
| W9–W10 (M3) | Theo dõi transaction end-to-end | Purchase request, confirmed completed, error log |
| W11–W12 (M3) | Tổng kết MVP và quyết định pilot | KPI dashboard, cash forecast, biên bản gate W12 |
| M4–M6 | Free pilot | Mở rộng seller/buyer thật, đo matching và giao dịch hai phía |
| M7–M9 | Paid validation theo điều kiện | Paid offer, receipt, refund, đối soát, đo payer và ARPPU |
| M10–M12 | Tối ưu mô hình và đánh giá năm đầu | Cohort retention, doanh thu, chi phí, cash balance và quyết định mở rộng |

## **8.3. Decision gates**

| Gate | Điều kiện đánh giá | Quyết định |
| :---- | :---- | :---- |
| W12 – cuối M3 | Mục tiêu 150 seller thật, 300 listing thật, 50 purchase request hợp lệ trên các cụm trường được triển khai; core flow không còn blocker | GO free pilot / ITERATE / STOP |
| M6 | Listing thật, buyer request, giao dịch có xác nhận hai phía; phân loại demo/real và trợ giá/không trợ giá | Tiếp tục pilot hoặc điều chỉnh phạm vi |
| Paid gate – trước M7 | Tối thiểu 10 seller đủ điều kiện nhận offer; mục tiêu 3 khoản thanh toán có bằng chứng; cơ chế thu/hoàn tiền và tuân thủ được xác lập | GO PAID / ITERATE / STOP PAID |
| M9 | Payer, ARPPU, lượt sử dụng, refund, cash balance và công suất slot | Điều chỉnh giá/gói và công suất |
| M12 | GMV, giao dịch hai phía, seller retention, doanh thu, P\&L và nhu cầu vốn | GO SCALE / ITERATE / STOP |

## **8.4. Weekly operating review**

Project Lead tổng hợp tiến độ core flow, listing thật, các bước funnel, biến động cash balance và ba rủi ro trọng yếu hằng tuần. Owner từng module báo cáo bằng chứng và chỉ số vận hành. Các khoản chi được đối chiếu với Budget theo tháng; biên bản ghi rõ quyết định, người phụ trách và thời hạn.

# **9\. CONCLUSION**

TakeTwo được triển khai như một marketplace C2C secondhand dành cho sinh viên đại học/cao đẳng trên toàn địa bàn Hà Nội. Kịch bản Cơ sở năm đầu dự kiến khoảng 416 seller active cuối M12, 526 giao dịch hoàn tất, GMV 78,97 triệu VNĐ và doanh thu dịch vụ 7,78 triệu VNĐ. Mô hình doanh thu giữ nguyên lượt đẩy lẻ, gói 49.000 VNĐ/5 lượt, gói 79.000 VNĐ/10 lượt và hoa hồng thực thu theo điều kiện thanh toán.

Giai đoạn M1–M6 tập trung hoàn thiện MVP có khả năng phục vụ người dùng tại Hà Nội và kiểm chứng thanh khoản theo cụm trường/campus, không ghi nhận doanh thu. M7–M12 là paid validation có điều kiện. Ngân sách chi phí hiện tại là 34,65 triệu VNĐ; P\&L và dòng tiền theo phạm vi Hà Nội được trình bày trong workbook phiên bản mới.

Các quyết định mở rộng được gắn với kết quả seller activation, giao dịch hai phía xác nhận, hành vi trả phí, công suất vận hành và dòng tiền. TakeTwo ưu tiên xây dựng dữ liệu vận hành có thể truy vết trước khi mở rộng địa bàn hoặc tăng chi phí thu hút người dùng.

# **APPENDIX A. SURVEY DATA & SOURCE INTEGRITY**

| Tập dữ liệu | Thông tin ghi nhận | Cách sử dụng |
| :---- | :---- | :---- |
| Wave 2 raw | 80 phản hồi; ngày 15/10/2026 | Tổng số phản hồi theo dữ liệu nội bộ |
| Qua lọc cơ bản | 62 người từ 18 tuổi và đang là sinh viên | Không xác minh trường/campus của toàn bộ mẫu |
| A1/A2 và CK1 | 19/62 trường hợp nhất quán; 54/80 phản hồi không nhất quán theo đối chiếu hiện tại | Không gọi tập 62 là mẫu sạch hoặc đại diện |
| Sẵn sàng thử | 39/62 chọn mức 4–5/5 | Chỉ phản ánh ý định tự khai |
| Kênh ưu tiên duy nhất | 4/62 chọn TakeTwo | Tín hiệu về switching friction |
| Willingness to pay | Chưa có bằng chứng thanh toán đáng tin cậy | Không dùng làm paid conversion |

Bảng hỏi có dấu hiệu lựa chọn không loại trừ nhau, khoảng tuổi chồng lấn, thiếu skip logic và CK1 không khớp câu tần suất. Các tỷ lệ được giữ theo dữ liệu hiện có, không điều chỉnh bằng phỏng đoán. Wave 1 (50 phản hồi) không gộp với Wave 2 do các tỷ lệ không tương thích.

# **APPENDIX B. EXPERIMENT PROTOCOLS**

## **B.1. Seller interview**

Tuyển seller đã đăng đồ secondhand thật trong ba tháng gần nhất. Ghi participant ID, ngày/kênh phỏng vấn, bằng chứng bán hàng nếu được phép, kênh đăng gần nhất, lý do chọn kênh, khó khăn trong lần bán gần nhất, điều kiện khiến seller đăng thêm trên TakeTwo và trích dẫn nguyên văn khi có consent.

## **B.2. Listing comparison task**

Chọn sản phẩm tương đương về danh mục, tình trạng và giá. Buyer thực hiện tác vụ xác định mức độ phù hợp và thông tin cần hỏi thêm trên TakeTwo và kênh hiện tại; đảo thứ tự thực hiện để giảm learning effect. Ghi thời gian, số câu hỏi bổ sung, mức độ chắc chắn và trường hợp bất lợi.

## **B.3. Paid listing smoke test**

Sau khi có seller thật và đủ điều kiện thu phí, gửi offer 15.000 VNĐ/lượt/7 ngày. Ghi seller đủ điều kiện, seller thực nhận offer, người đồng ý, khoản thanh toán thành công, refund và chi phí acquisition theo cohort. Paid conversion \= unique paying sellers / eligible sellers thực nhận offer.

## **B.4. Transaction classification & attribution**

Mỗi transaction lưu buyer ID, seller ID, trạng thái demo/real, nguồn tuyển, loại hỗ trợ, giá trị trợ giá, giá trị thanh toán thực tế và xác nhận hai phía. Báo cáo riêng Type A (có hỗ trợ/trợ giá) và Type B (độc lập, không trợ giá, hai phía xác nhận).

## **B.5. SOM funnel, matching & capacity**

Theo dõi unique eligible reached, visitor, registration, buyer tạo request, request ID, listing đủ chuẩn, transaction accepted, completed một phía và completed hai phía. Ghi nhận giờ vận hành moderation/support, thời gian xử lý, nguyên nhân reject/cancel và công suất vị trí ưu tiên.

# **APPENDIX C. TECHNICAL SCOPE & CONTROLS**

## **C.1. Entity model**

Các entity tối thiểu gồm User, Product, Category, ProductImage, Favorite, Conversation, Message, Transaction, Review và Report. Listing thuộc một seller; conversation gắn buyer–seller–product; purchase request thuộc buyer và listing; transaction gắn hai phía và cập nhật trạng thái; review chỉ được tạo với transaction Completed; report do user tạo và admin xử lý.

## **C.2. Business rules**

| Rule | Test case |
| :---- | :---- |
| Ownership | Người dùng không sửa listing của người khác, kể cả gọi API trực tiếp |
| Cannot self-buy | Buyer không gửi request cho listing do chính mình sở hữu |
| State machine | Seller accept hợp lệ → reserved; cancelled → rollback đúng; completed → sold |
| Review eligibility | Không review trước Completed hoặc review trùng cho một giao dịch |
| Security | Không lộ password/token; chỉ participant có quyền đọc conversation |
| Moderation | Admin xem, xử lý và lưu log report |

## **C.3. Event tracking**

Event taxonomy gồm listing\_created (flag real/demo), product\_viewed, chat\_started, purchase\_request\_created, request\_accepted, request\_rejected, transaction\_completed\_single, transaction\_completed\_both, review\_created và report\_submitted. Mỗi event lưu timestamp, user ID phù hợp, product ID, transaction ID khi có và acquisition source nếu được phép. Không ghi định danh cá nhân thừa hoặc nội dung nhạy cảm vào analytics logs.

# **APPENDIX D. ASSUMPTIONS & REFERENCES**

| Nhóm giả định | Giá trị sử dụng trong workbook |
| :---- | :---- |
| Giá lượt đẩy | 15.000 VNĐ/lượt, ưu tiên hiển thị 7 ngày |
| Gói dịch vụ | 49.000 VNĐ/5 lượt; 79.000 VNĐ/10 lượt mỗi tháng |
| Seller active tại M3 | 50 / 150 / 250 theo ba kịch bản Hà Nội |
| Tăng trưởng seller active | 8% / 12% / 15% mỗi tháng sau M3 |
| Giao dịch/seller active/tháng | 0,10 / 0,20 / 0,25 |
| AOV | 150.000 VNĐ |
| Seller trả tiền/tháng | 5% / 10% / 15% |
| Tỷ trọng payer lẻ / 49k / 79k | 60/30/10%; 60/30/10%; 50/35/15% |
| Tỷ lệ sử dụng lượt trong gói | 70% |
| Tỷ lệ tiền nạp dư so với chi tiêu | 20% |
| Phí cổng/đối soát | 1% tiền nạp |
| Chi phí pháp lý và tích hợp QR | 3.000.000 VNĐ và 1.000.000 VNĐ; placeholder cần báo giá |
| Dự phòng ngân sách | 10% |

## **D.2. References**

* \[1\] TakeTwo Research Team (2026). “TakeTwo – Khảo sát hành vi mua bán đồ cũ của sinh viên Hà Nội (Wave 2)”, dữ liệu nội bộ, ngày 15/10/2026.  
* \[2\] TakeTwo – Business Plan, tài liệu nội bộ của nhóm, 2026\.  
* \[5\] Cục Thống kê – Cơ sở dữ liệu PX-Web, “Số sinh viên các trường đại học phân theo địa phương”, bảng V13.27, cập nhật 22/07/2025. https\://pxweb.nso.gov.vn/pxweb/vi/Gi%C3%A1o%20d%E1%BB%A5c/Gi%C3%A1o%20d%E1%BB%A5c/V13.27.px/  
* \[7\] Thống kê thành phố Hà Nội, Niên giám thống kê điện tử năm 2024, mục giáo dục và đào tạo. https\://thongkehanoi.nso.gov.vn/nien-giam-thong-ke/12

# **APPENDIX E. EVIDENCE REGISTERS**

Các bảng dưới đây là cấu trúc ghi nhận bằng chứng của dự án. Chỉ điền dữ liệu khi hoạt động tương ứng đã diễn ra và có hồ sơ gốc.

## **E.1. Seller interview log**

| Trường dữ liệu | Nội dung ghi nhận |
| :---- | :---- |
| Participant ID / Date | Mã người tham gia; ngày và kênh phỏng vấn |
| Eligibility | Bằng chứng từng đăng bán; danh mục và thời điểm |
| Current channel | Kênh bán gần nhất và lý do lựa chọn |
| Pain point | Khó khăn trong lần bán gần nhất |
| TakeTwo trigger | Điều kiện khiến seller đăng thêm trên TakeTwo |
| Consent / Evidence | Đồng ý ghi nhận; link hồ sơ; người lưu |

## **E.2. Competitor listing observation log**

| Trường dữ liệu | Nội dung ghi nhận |
| :---- | :---- |
| Observation ID | OBS-01 đến OBS-20 |
| Source / Time | Nền tảng, nhóm, ngày và thời điểm quan sát |
| Product | Category, condition, price, location |
| Listing quality | Thông tin thiếu, câu hỏi buyer cần hỏi thêm |
| Visibility | Trạng thái tại thời điểm quan sát lặp lại |
| Evidence | Link/ảnh đã xử lý dữ liệu cá nhân |

## **E.3. Transaction validation log**

| Trường dữ liệu | Nội dung ghi nhận |
| :---- | :---- |
| TX ID | Mã giao dịch trên ứng dụng |
| Participants | Seller ID và Buyer ID |
| Classification | Demo/real; Type A/Type B |
| Platform status | Request, accepted, completed một phía |
| Two-side verification | Buyer xác nhận; seller xác nhận; timestamp |
| GMV | Giá trị giao dịch được hai phía xác nhận |

## **E.4. Paid offer & cash ledger**

| Bảng | Trường dữ liệu |
| :---- | :---- |
| Paid offer | Offer ID; seller đủ điều kiện; giá; đã nhận offer; đã thanh toán; receipt; refund |
| Cash ledger | Date; khoản thu/chi; số tiền (+in/−out); owner; người duyệt; chứng từ |
| Wallet balance | Tiền nạp; dịch vụ đã sử dụng; số dư chưa dùng; refund/chargeback |
| Stage gate | Seller/listing/request thật; completed hai phía; cash balance; quyết định; người duyệt; ngày |

# **PHỤ LỤC F. MARKET SIZING TOÀN HÀ NỘI – TAM, SAM & SOM**

Phạm vi TA của TakeTwo là sinh viên đại học/cao đẳng đang theo học tại Hà Nội. Các quy mô TA dưới đây là giả định lập kế hoạch theo ba kịch bản Low/Base/High, không được trình bày như số liệu thống kê chính thức đã xác minh. Khi có số liệu thống kê sinh viên phân theo địa phương và năm học, nhóm sử dụng số liệu đó để cập nhật đầu vào TA.

## **F.1. TAM – Tổng thị trường tiềm năng**

TAM \= TA × Tỷ lệ người mua đồ cũ hằng năm × Số giao dịch trung bình/người/năm × AOV.

| Chỉ tiêu | Low | Base | High |
| :---- | :---- | :---- | :---- |
| TA sinh viên đại học/cao đẳng Hà Nội | 650.000 | 1.000.000 | 1.200.000 |
| Tỷ lệ người mua secondhand/năm | 20% | 30% | 40% |
| Giao dịch/người mua/năm | 1,5 | 2,0 | 2,5 |
| AOV | 120.000 VNĐ | 150.000 VNĐ | 180.000 VNĐ |
| TAM/năm | 23,4 tỷ VNĐ | 90 tỷ VNĐ | 216 tỷ VNĐ |

TAM phản ánh tổng giá trị giao dịch secondhand tiềm năng trong nhóm sinh viên tại Hà Nội theo các giả định hành vi; đây không phải doanh thu của TakeTwo.

## **F.2. SAM – Thị trường có thể phục vụ**

SAM \= TAM × 60% danh mục sản phẩm phù hợp × 70% khả năng tiếp cận qua kênh trực tuyến \= TAM × 42%.

| Kịch bản | TAM | Danh mục phù hợp | Kênh trực tuyến | SAM/năm |
| :---- | :---- | :---- | :---- | :---- |
| Low | 23,4 tỷ | 60% | 70% | 9,828 tỷ VNĐ |
| Base | 90 tỷ | 60% | 70% | 37,8 tỷ VNĐ |
| High | 216 tỷ | 60% | 70% | 90,72 tỷ VNĐ |

Theo kịch bản Base, SAM toàn Hà Nội đạt 37,8 tỷ VNĐ/năm. Hai tỷ lệ lọc 60% và 70% là giả định mô hình được giữ nhất quán giữa các kịch bản.

## **F.3. SOM năm 1 – Pilot và Paid Validation toàn Hà Nội**

SOM năm 1 được xác định bottom-up từ số seller active toàn Hà Nội tại M3, tốc độ tăng trưởng seller active hàng tháng và năng suất giao dịch trên mỗi seller. M1–M6 tập trung xây dựng nguồn cung và free pilot theo cụm trường/campus; M7–M12 mở paid validation sau khi đạt điều kiện vận hành và thu phí.

| Chỉ tiêu | Low | Base | High |
| :---- | :---- | :---- | :---- |
| Seller active tại M3 | 50 | 150 | 250 |
| Tăng trưởng seller active/tháng | 8% | 12% | 15% |
| Giao dịch/seller active/tháng | 0,10 | 0,20 | 0,25 |
| Seller active cuối M12 | 99,95 | 415,96 | 879,47 |
| Giao dịch hoàn tất năm 1 | 72,43 | 526,46 | 1.268,98 |
| GMV năm 1 | 10,86 triệu | 78,97 triệu | 190,35 triệu |
| Tỷ trọng trên SAM tương ứng | 0,11% | 0,21% | 0,21% |

Các kết quả giao dịch dạng thập phân là giá trị kỳ vọng của mô hình. Mục tiêu vận hành được làm tròn thành số nguyên và được quản lý theo cohort seller, không xem là giao dịch đã phát sinh.

## **F.4. SOM năm 2 – Mở rộng trong phạm vi Hà Nội**

Năm 2 tiếp tục mở rộng seller acquisition giữa các trường/campus trong Hà Nội, đồng thời tăng tỷ lệ seller hoạt động lặp lại. Kế hoạch mở rộng được quản trị theo cụm trường thay vì giả định thâm nhập đồng đều toàn thành phố ngay từ đầu.

| Định hướng | Base – Scale | High – Scale cao |
| :---- | :---- | :---- |
| GMV năm 2 | 315.000.000 VNĐ | 756.000.000 VNĐ |
| AOV | 150.000 VNĐ | 150.000 VNĐ |
| Giao dịch hoàn tất/năm | 2.100 | 5.040 |
| Giao dịch bình quân/tháng | 175 | 420 |
| Tỷ trọng trên SAM Base 37,8 tỷ | 0,83% | 2,00% |

Các chỉ tiêu năm 2 là mục tiêu mở rộng theo phạm vi Hà Nội, phụ thuộc vào khả năng tăng seller active, giữ chân người bán và duy trì tỷ lệ giao dịch trên seller. Mô hình doanh thu không thay đổi: lượt đẩy lẻ, hai gói dịch vụ và hoa hồng thực thu theo điều kiện thanh toán.

## **F.5. Competitive benchmark – phạm vi quan sát toàn Hà Nội**

| Tiêu chí | Kênh hiện hữu | TakeTwo | Chỉ số quan sát |
| :---- | :---- | :---- | :---- |
| Nguồn người dùng | Group Facebook, Marketplace, Zalo, Chợ Tốt | Marketplace tập trung sinh viên Hà Nội | Listing thật, seller active, buyer active |
| Listing/search | Bài đăng theo cấu trúc từng nền tảng | Structured fields: condition, price, location | Task completion, thời gian tìm kiếm |
| Trao đổi | Messenger, bình luận, chat sàn | Chat gắn listing | Số câu hỏi bổ sung, chat-to-request |
| Trạng thái | Phụ thuộc cập nhật của seller | Available → Reserved → Sold | Độ chính xác, tỷ lệ cập nhật |
| Trust | Hồ sơ, lịch sử và cơ chế nền tảng | Review gắn transaction | Tỷ lệ xác nhận hai phía, report rate |

Giai đoạn quan sát sử dụng mẫu bài đăng thực tại các nhóm sinh viên và nền tảng secondhand có liên quan ở Hà Nội. Kết quả benchmark chỉ được báo cáo sau khi thu thập và lưu bằng chứng; không suy diễn kết quả từ một lần quan sát.

# **PHỤ LỤC G. USE CASE DIAGRAM & ACTOR SPECIFICATION**

Use case diagram mô tả tương tác giữa Buyer, Seller, Admin, Payment Provider và Notification Service với nền tảng TakeTwo. Payment Provider chỉ xử lý thanh toán dịch vụ TakeTwo như lượt đẩy và gói dịch vụ; MVP không xử lý tiền mua bán hàng hóa giữa buyer và seller.

![][image1]

| Actor | Vai trò | Use case tiêu biểu |
| :---- | :---- | :---- |
| Buyer | Người mua | Tìm kiếm/lọc, xem chi tiết, chat, gửi request, theo dõi giao dịch, xác nhận hoàn tất, đánh giá |
| Seller | Người bán | Đăng tin, quản lý listing, xử lý request, cập nhật trạng thái, mua lượt đẩy/gói dịch vụ |
| Admin | Quản trị viên | Duyệt/gỡ tin, quản lý người dùng, xử lý report/khiếu nại, dashboard |
| Payment Provider | Đối tác thanh toán | Xử lý payment order cho dịch vụ TakeTwo |
| Notification Service | Dịch vụ thông báo | Gửi thông báo chat, purchase request, trạng thái và thanh toán |

[image1]: <data:image/png;base64,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>