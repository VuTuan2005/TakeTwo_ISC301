# Kế hoạch kinh doanh TakeTwo

Nền tảng mua bán đồ cũ dành cho sinh viên Hà Nội

Phiên bản cập nhật theo hệ thống hiện tại

Ngày 05 tháng 11 năm 2026

## Thông tin tài liệu

TakeTwo được phát triển để giúp sinh viên tìm mua và thanh lý đồ đã qua sử dụng trong một quy trình có quản lý. Kế hoạch này trình bày thị trường mục tiêu, giá trị sản phẩm, mô hình doanh thu, phạm vi đã triển khai, quy trình vận hành, giả định tài chính và các điều kiện để chuyển từ sản phẩm local sang thử nghiệm với người dùng thực tế.

Nhóm đã xây dựng hệ thống local có đăng tin, kiểm duyệt, tìm kiếm, chat, ví nội bộ, đặt hàng, giữ tiền Escrow, điều phối vận chuyển, xử lý tranh chấp và quản trị đối soát. Các chức năng này lưu dữ liệu và thực hiện chuyển trạng thái trong ứng dụng. Tiền, nạp rút, OTP, Google và vận chuyển vẫn ở chế độ mô phỏng; dữ liệu trình diễn không chứng minh doanh thu hay giao dịch thương mại thực tế.

## Mục lục

1. Tóm tắt dự án
2. Khách hàng và vấn đề cần giải quyết
3. Thị trường và cạnh tranh
4. Sản phẩm và năng lực hiện tại
5. Mô hình kinh doanh và chính sách giá
6. Quy trình vận hành và quản trị
7. Kế hoạch tiếp cận thị trường
8. Mô hình tài chính và nhu cầu ngân sách
9. Đội ngũ và quản trị rủi ro
10. Chỉ số đánh giá và lộ trình phát triển
11. Kết luận và quyết định triển khai
12. Phụ lục về quy tắc nghiệp vụ và nguồn đối chiếu

## 1 Tóm tắt dự án

### 1.1 Định vị

TakeTwo là nền tảng C2C dành cho sinh viên đại học và cao đẳng tại Hà Nội, tập trung vào giáo trình, đồ dùng phòng trọ và ký túc xá, thiết bị điện tử và thời trang sinh viên. Một tài khoản thành viên có thể vừa mua vừa bán. Người mua và người bán là vai trò trong từng giao dịch; quản trị viên sử dụng khu vực quản lý riêng.

Sản phẩm kết nối tin đăng, hội thoại, đơn hàng và dòng tiền trong cùng một quy trình. Người mua có thể tìm kiếm, xem tình trạng, trao đổi với chủ sản phẩm và đặt hàng. Người bán có thể đăng tin, quản lý yêu cầu mua, cung cấp địa chỉ lấy hàng hoặc bàn giao trực tiếp. Admin kiểm duyệt nội dung, giám sát tiền đang giữ, xử lý bằng chứng và đối soát kết quả.

Quy trình hiện tại là: đăng tin → admin duyệt → tìm kiếm và xem chi tiết → chat trước mua → đặt hàng qua ví → giữ tiền và giữ chỗ sản phẩm → seller chấp nhận → bàn giao trực tiếp hoặc TakeTwo điều phối vận chuyển → buyer xác nhận hoặc tự hoàn tất sau 120 giờ → giải ngân. Khi có khiếu nại hợp lệ, hệ thống đóng băng Escrow và chuyển sang hồ sơ tranh chấp.

### 1.2 Giá trị kinh doanh

Đối với sinh viên cần mua đồ, TakeTwo tập trung thông tin về giá, tình trạng, khu vực và trạng thái còn bán để giảm số lần phải hỏi lại. Đối với sinh viên thanh lý đồ, tin đăng gắn với hội thoại và đơn hàng giúp theo dõi ai đang quan tâm và giao dịch đang ở bước nào. Đối với nhóm vận hành, hệ thống cung cấp dữ liệu để giải thích từng khoản thu, khoản giữ, khoản hoàn và khoản phải trả.

Các lợi ích về tiết kiệm thời gian, giảm tranh chấp và tăng khả năng bán hàng là giả thuyết cần đo bằng thử nghiệm người dùng. Sự tồn tại của tính năng chưa đủ để kết luận rằng các lợi ích đó đã đạt được.

### 1.3 Các quyết định đã thống nhất

| Nội dung | Mô hình áp dụng |
|---|---|
| Tài khoản | Một tài khoản thành viên vừa mua vừa bán; admin quản trị riêng |
| Tin đăng cơ bản | Miễn phí; tin mới cần admin duyệt |
| Phí sàn | 3% giá sản phẩm khi đơn hoàn tất; trừ vào phần seller nhận |
| Đẩy tin | 15.000đ một lượt; 49.000đ năm lượt; 79.000đ mười lượt |
| Thời gian ưu tiên | Mỗi lượt đẩy ưu tiên hiển thị bảy ngày |
| Gói đẩy | Mua lượt sử dụng; chưa có thuê bao hoặc tự gia hạn theo tháng |
| Bảo vệ Escrow | 120 giờ kể từ bàn giao trực tiếp hoặc đơn vị vận chuyển lấy hàng |
| Giao nhận | Gặp trực tiếp hoặc TakeTwo điều phối vận chuyển mô phỏng |
| Voucher | Admin cấu hình chiến dịch; hệ thống tự kiểm tra và giữ ngân sách |
| Tranh chấp | Giải ngân cho seller hoặc hoàn buyer sau khi trừ phí sàn; không hoàn một phần |
| Phạm vi hiện tại | Chạy local; chưa kết nối tiền, email hay vận chuyển thật |

### 1.4 Mục tiêu giai đoạn tiếp theo

Ưu tiên trước mắt là kiểm chứng khả năng sử dụng, độ đúng của tiền và trạng thái đơn, chất lượng tin đăng và thời gian xử lý tranh chấp. Chỉ mở thử nghiệm thanh toán thực sau khi có phương án đối tác, chính sách công khai và quy trình đối soát phù hợp. Việc triển khai rộng toàn Hà Nội được tổ chức theo cụm trường để kiểm soát chất lượng hỗ trợ.

## 2 Khách hàng và vấn đề cần giải quyết

### 2.1 Phân khúc và nhu cầu

Khách hàng mục tiêu là sinh viên đang học tại Hà Nội, có nhu cầu mua đồ với ngân sách hạn chế hoặc thanh lý đồ khi chuyển chỗ ở, đổi nhu cầu học tập và sinh hoạt. Cùng một người có thể mua giáo trình ở giao dịch này và bán thiết bị ở giao dịch khác.

| Tình huống | Nhu cầu | Cách TakeTwo đáp ứng |
|---|---|---|
| Mua giáo trình hoặc thiết bị | Biết giá, tình trạng và khu vực trước khi liên hệ | Tin đăng có cấu trúc, bộ lọc và chi tiết sản phẩm |
| Thanh lý đồ trọ hoặc ký túc xá | Đăng nhanh, theo dõi yêu cầu mua và bàn giao | Gian hàng cá nhân, đơn bán và lựa chọn nhận hàng |
| Cần hỏi thêm trước khi đặt | Trao đổi đúng món đồ và lưu lịch sử | Hội thoại gắn với buyer, seller và sản phẩm |
| Lo hàng không đúng mô tả | Có nơi ghi nhận vấn đề và bằng chứng | Giữ tiền, hồ sơ khiếu nại và quyết định của admin |
| Muốn tin được chú ý hơn | Mua dịch vụ hiển thị có giá và thời hạn rõ ràng | Lượt đẩy tin và gói lượt |

### 2.2 Kết quả khảo sát kế thừa

Khảo sát Wave 2 của nhóm ngày 15/10/2026 ghi nhận 80 phản hồi, trong đó 62 phản hồi vượt qua sàng lọc cơ bản về tuổi và tình trạng sinh viên. Trong nhóm 62 người, 57 người tự khai đã mua đồ secondhand trong 12 tháng, 33 người đã bán đồ secondhand, 24 người chọn Facebook Group trường hoặc ký túc xá là kênh giao dịch gần nhất, 39 người chọn mức sẵn sàng thử TakeTwo từ 4 đến 5 trên thang 5 điểm và 4 người chọn TakeTwo khi phải chọn một kênh duy nhất.

Tài liệu nghiên cứu đồng thời ghi nhận 54 trong 80 phản hồi không nhất quán giữa các câu A1/A2 và CK1; chỉ 19 trong 62 trường hợp nhất quán theo phép đối chiếu hiện tại. Đây là các phép kiểm tra khác nhau, không được cộng hoặc trừ để suy ra một cỡ mẫu sạch mới. Các tỷ lệ chỉ hỗ trợ định hướng phỏng vấn và thiết kế thử nghiệm, chưa đủ để suy rộng quy mô thị trường, tỷ lệ chuyển đổi hay khả năng trả phí. Không gộp Wave 1 với Wave 2 khi chưa thống nhất phương pháp.

### 2.3 Giá trị cần kiểm chứng

| Giả thuyết | Thử nghiệm | Bằng chứng cần có |
|---|---|---|
| Tin rõ ràng giúp ra quyết định nhanh | Cho sinh viên so sánh các sản phẩm tương đương | Thời gian tìm hiểu, số câu hỏi và tỷ lệ hoàn thành tác vụ |
| Chat theo sản phẩm giảm trao đổi phân tán | Theo dõi một nhóm hội thoại từ trước mua đến quyết định | Lịch sử chat, yêu cầu mua và phản hồi người dùng |
| Giữ tiền làm tăng mức sẵn sàng đặt hàng | Thử nghiệm kịch bản có giải thích chính sách | Mức hiểu chính sách, hoàn thành checkout và lý do từ chối |
| Seller sẵn sàng trả tiền đẩy tin | Gửi offer minh bạch sau thử nghiệm miễn phí | Offer đã nhận, khoản thanh toán có chứng từ và yêu cầu hoàn |
| Marketplace có giao dịch lặp lại | Theo dõi cohort thành viên theo thời gian | Tin đăng mới, đơn hoàn tất và tỷ lệ quay lại |

Điểm thưởng và lượng CO2 tiết kiệm hiện được cộng theo quy ước mô phỏng khi hoàn tất đơn. Không sử dụng các giá trị này như số liệu tác động môi trường đã được đo lường hoặc chứng nhận.

## 3 Thị trường và cạnh tranh

### 3.1 Phạm vi triển khai

Phạm vi khách hàng là sinh viên đại học và cao đẳng tại Hà Nội. Hoạt động tiếp cận dự kiến tổ chức theo năm cụm: Hòa Lạc, Cầu Giấy và Xuân Thủy, Bách Khoa và Kinh tế Quốc dân và Xây dựng, Đống Đa và Chùa Láng, Hà Đông và Thanh Xuân. Cụm trường phục vụ tìm kiếm và tổ chức vận hành, chưa phải bằng chứng rằng hệ thống đã có người dùng thật ở toàn bộ các khu vực này.

### 3.2 TAM và SAM theo giả định

Quy mô thị trường được kế thừa theo bộ giả định ở phụ lục Hà Nội của kế hoạch trước. Các con số về số sinh viên dưới đây là giả định lập kế hoạch, không phải thống kê dân số sinh viên đã được xác minh.

TAM được tính bằng số sinh viên mục tiêu nhân tỷ lệ mua đồ cũ hằng năm, số giao dịch mỗi người mua và giá trị giao dịch trung bình. SAM bằng TAM nhân 60% danh mục phù hợp và 70% khả năng tiếp cận qua kênh trực tuyến, tương đương 42% TAM.

| Chỉ tiêu | Thận trọng | Cơ sở | Cao |
|---|---|---|---|
| Sinh viên mục tiêu giả định | 650.000 | 1.000.000 | 1.200.000 |
| Tỷ lệ mua đồ cũ mỗi năm | 20% | 30% | 40% |
| Giao dịch mỗi người mua mỗi năm | 1,5 | 2,0 | 2,5 |
| Giá trị giao dịch trung bình | 120.000đ | 150.000đ | 180.000đ |
| TAM một năm | 23,4 tỷ đồng | 90 tỷ đồng | 216 tỷ đồng |
| SAM một năm | 9,828 tỷ đồng | 37,8 tỷ đồng | 90,72 tỷ đồng |

TAM và SAM phản ánh giá trị hàng hóa tiềm năng, không phải doanh thu của TakeTwo. Tỷ lệ 60% và 70% cũng cần được kiểm chứng. Bộ giả định này được dùng thống nhất trong toàn tài liệu để tránh hai bảng thị trường có đầu vào khác nhau.

### 3.3 SOM năm đầu

| Chỉ tiêu kế hoạch | Thận trọng | Cơ sở | Cao |
|---|---|---|---|
| Seller hoạt động tại M3 | 50 | 150 | 250 |
| Tăng trưởng seller mỗi tháng sau M3 | 8% | 12% | 15% |
| Giao dịch hoàn tất mỗi seller mỗi tháng | 0,10 | 0,20 | 0,25 |
| Seller hoạt động cuối M12 | 99,95 | 415,96 | 879,47 |
| Giao dịch hoàn tất kỳ vọng năm đầu | 72,43 | 526,46 | 1.268,98 |
| GMV kỳ vọng năm đầu | 10.864.922đ | 78.969.308đ | 190.347.358đ |
| Tỷ trọng trên SAM tương ứng | Khoảng 0,11% | Khoảng 0,21% | Khoảng 0,21% |

Các đầu ra dạng thập phân là giá trị kỳ vọng của mô hình cũ được giữ làm giả định nhu cầu. Mục tiêu vận hành phải làm tròn theo người và đơn thực tế. SOM được tính với giá trị giao dịch trung bình 150.000đ cho cả ba kịch bản; AOV dùng cho TAM là một phép ước tính thị trường riêng. Chưa dùng kết quả mô phỏng trong ứng dụng để xác nhận SOM.

### 3.4 Cạnh tranh và lợi thế cần chứng minh

Nhóm sinh viên có thể giao dịch qua hội nhóm, mạng xã hội và các nền tảng rao vặt. TakeTwo định vị bằng trải nghiệm tập trung theo cộng đồng sinh viên, tin đăng có cấu trúc, chat gắn sản phẩm, trạng thái giao dịch và hồ sơ đối soát. Những ưu điểm này phải được đánh giá bằng tác vụ và hồ sơ quan sát; không mặc định rằng mọi kênh hiện hữu đều thiếu kiểm soát hoặc kém an toàn.

| Tiêu chí so sánh | TakeTwo hiện có | Cách kiểm chứng với kênh thay thế |
|---|---|---|
| Chất lượng thông tin | Giá, tình trạng, mô tả, khu vực, kiểm duyệt | So sánh số trường thiếu và số câu hỏi buyer cần hỏi |
| Trao đổi | Chat theo sản phẩm, ảnh và lịch sử | Đo thời gian từ liên hệ đến yêu cầu mua |
| Trạng thái | Đang bán, giữ chỗ, đã bán và các trạng thái đơn | Đối chiếu trạng thái với xác nhận của người dùng |
| Xử lý vấn đề | Hồ sơ bằng chứng và quyết định admin | Đo thời gian tiếp nhận, giải quyết và mức hài lòng |
| Chi phí sử dụng | Phí sàn 3% và gói lượt đẩy công khai | Kiểm tra mức hiểu giá và sẵn sàng trả phí |

## 4 Sản phẩm và năng lực hiện tại

### 4.1 Tài khoản và quyền sử dụng

Thành viên đăng ký bằng thông tin cá nhân, email và cụm trường, không phải chọn vai trò mua hoặc bán. Cùng tài khoản đó có gian hàng, đơn mua, đơn bán, ví và lịch sử giao dịch. Hệ thống kiểm tra quyền sở hữu sản phẩm và quyền tham gia đơn ở backend. Người dùng không được tự mua sản phẩm của mình.

Nhãn BUYER và SELLER trên bộ chọn tài khoản mô phỏng chỉ hỗ trợ trình diễn. Admin không tham gia mua bán, mua lượt đẩy, dùng ví cá nhân hay gửi chat với tư cách buyer. Mật khẩu đăng nhập được băm; phiên được quản lý qua cookie. Email và OTP trong bản local chưa xác minh danh tính với trường đại học.

### 4.2 Danh mục tính năng đã triển khai

| Nhóm chức năng | Khả năng hiện tại | Giới hạn cần hiểu đúng |
|---|---|---|
| Đăng bán | Tên, giá, danh mục, tình trạng, mô tả, cụm trường và ảnh bìa | Chưa có thư viện nhiều ảnh cho một listing |
| Điểm hẹn | Seller có thể để trống gợi ý lúc đăng | Checkout gặp trực tiếp vẫn phải xác nhận điểm hẹn |
| Kiểm duyệt | Tin mới chờ admin duyệt; có duyệt, từ chối và ẩn tin | Kiểm duyệt thủ công, chưa có AI kiểm duyệt |
| Khám phá | Tìm kiếm, lọc, chi tiết sản phẩm và trạng thái còn bán | Chưa có hệ gợi ý cá nhân hóa |
| Yêu thích | Lưu và bỏ lưu sản phẩm theo tài khoản | Chưa có thông báo tự động khi giá thay đổi |
| Gian hàng | Xem tin của mình, gỡ tin và đẩy tin đủ điều kiện | Không gỡ sản phẩm đang có tiền tạm giữ |
| Chat | Hội thoại theo sản phẩm, văn bản, ảnh, chưa đọc, tải tin cũ | Dùng polling; chưa có WebSocket |
| Checkout | Báo giá server, voucher, hình thức nhận, người nhận và địa chỉ | Chưa kết nối thanh toán thật |
| Thiếu số dư | Báo số thiếu, gợi ý popup nạp và giữ bản nháp | Nạp xong vẫn cần người dùng xác nhận đặt hàng |
| Ví và chứng từ | Số dư khả dụng, tạm giữ, thu chi, bộ lọc và chi tiết chứng từ | Số dư là tiền mô phỏng |
| Escrow | Giữ tiền, giải ngân, hoàn, tự hoàn tất, chặn quyết toán lặp | Chưa thu hồi tiền sau khi đã giải ngân |
| Vận chuyển | Seller báo địa chỉ lấy; admin điều phối và ghi cước | Mã điều phối và thanh toán đối tác là mô phỏng |
| Tranh chấp | Lý do, bằng chứng, giải trình, thẩm định và quyết định | Không hoàn một phần; chưa quản lý logistics trả hàng riêng |
| Quản trị | KPI, đối soát đơn, Escrow, người dùng, báo cáo và voucher | Dashboard hiện phục vụ dữ liệu mô phỏng |

### 4.3 Cách tổ chức giao diện

Ứng dụng giữ phong cách dashboard xanh TakeTwo, chia thành Tổng quan, Sản phẩm, Chi tiết sản phẩm, Gian hàng, Tin nhắn, Đơn hàng, Chi tiết đơn, Ví và Sổ giao dịch, Gói đẩy tin. Admin có cổng riêng cho KPI, đối soát, vận chuyển, Escrow, khiếu nại, người dùng và voucher.

Mỗi màn tập trung vào một công việc. Những thao tác ngắn như nạp tiền hoặc gửi khiếu nại dùng popup; đăng tin và checkout có màn riêng. Điều hướng hỗ trợ tải lại và Back. Dữ liệu tài khoản cũ được xóa khỏi giao diện khi đổi tài khoản; bản nháp checkout được gắn với tài khoản để có thể tiếp tục sau khi đăng nhập lại.

### 4.4 Nền tảng kỹ thuật và kiểm soát

Hệ thống sử dụng Express, JavaScript thuần và SQLite trên local. Cập nhật ví, đơn và chứng từ được thực hiện trong transaction; yêu cầu tài chính có cơ chế chống xử lý lặp. Giá, phí giao nhận và điều kiện voucher được kiểm tra ở server. Có sổ bút toán cân bằng, công cụ đối soát và sao lưu trước migration hoặc reset chủ động.

Tại lần cập nhật này, 41 kiểm thử service/API đã đạt. Kiểm tra trình duyệt trên database riêng đã bao gồm đăng nhập, phục hồi checkout, đặt hàng, tải lại, ví, chat, vận chuyển, tranh chấp và các màn admin ở desktop, tablet và mobile. Kết quả này thể hiện phạm vi kiểm tra kỹ thuật tại local, chưa phải chứng nhận vận hành sản phẩm trên môi trường công khai hoặc với tải lớn.

### 4.5 Các phần chưa triển khai đầy đủ

Lộ trình tiếp theo gồm tối đa năm ảnh mỗi sản phẩm, review gắn với đơn hoàn tất và trung tâm thông báo dẫn tới đúng hội thoại hoặc đơn hàng. Report tin đăng và ảnh bằng chứng trong chat, tranh chấp đã có. Mật khẩu và dữ liệu sản phẩm được lưu thực trong ứng dụng; OTP, Google, tiền và vận chuyển vẫn mô phỏng. Không đưa các tính năng chưa hoàn thiện vào danh sách cam kết đã cung cấp cho khách hàng.

## 5 Mô hình kinh doanh và chính sách giá

### 5.1 Các thành phần của mô hình

| Thành phần | Nội dung |
|---|---|
| Khách hàng | Sinh viên cần mua hoặc thanh lý đồ đã qua sử dụng tại Hà Nội |
| Giá trị cung cấp | Tin rõ ràng, trao đổi theo sản phẩm, giao dịch có trạng thái và cơ chế giải quyết vấn đề |
| Kênh tiếp cận | Cộng đồng sinh viên, nhóm trường và ký túc xá, giới thiệu giữa thành viên |
| Quan hệ khách hàng | Tự phục vụ trên ứng dụng và hỗ trợ thủ công cho kiểm duyệt, giao nhận, tranh chấp |
| Nguồn thu | Phí sàn 3% khi hoàn tất, bán lượt đẩy và gói lượt; phí giữ lại khi hoàn theo chính sách hiện tại |
| Hoạt động chính | Phát triển sản phẩm, kiểm duyệt, duy trì nguồn cung, hỗ trợ, đối soát và nghiên cứu người dùng |
| Nguồn lực | Nhóm dự án, hệ thống, dữ liệu giao dịch có thể truy vết và quy trình quản trị |
| Đối tác dự kiến | Trường và cộng đồng sinh viên, đơn vị thanh toán và đơn vị vận chuyển phù hợp |
| Cơ cấu chi phí | Công nghệ, lưu trữ, hỗ trợ, marketing, trợ giá, cước phát sinh khi hoàn và phí đối tác |

Đối tác trong bảng là nhu cầu hợp tác dự kiến, không phải danh sách đã ký kết.

### 5.2 Phí sàn và lượt đẩy

| Dịch vụ | Giá và điều kiện | Thời điểm hệ thống hiện tại ghi nhận |
|---|---|---|
| Đăng tin cơ bản | Miễn phí | Không tạo doanh thu |
| Phí sàn | 3% giá hàng, làm tròn đến đồng | Khi giải ngân đơn hoàn tất |
| Đẩy lẻ | 15.000đ một lượt | Khi trừ tiền mua hoặc đẩy lẻ |
| Gói năm lượt | 49.000đ | Khi mua gói |
| Gói mười lượt | 79.000đ | Khi mua gói |

Gói hiện tại là gói lượt, không phải thuê bao theo tháng và không tự gia hạn. Mỗi lần đẩy sử dụng một lượt, được ưu tiên bảy ngày; nếu không còn lượt, người dùng có thể trả tiền đẩy lẻ. Việc ưu tiên hiển thị không bảo đảm sản phẩm được bán. Sử dụng lượt đã mua không được ghi doanh thu lần thứ hai.

Cách ghi nhận trên là báo cáo quản trị của ứng dụng mô phỏng. Trước khi thương mại hóa cần xác lập điều khoản gói, thời hạn thực hiện dịch vụ và phương pháp hạch toán phù hợp, bao gồm nghĩa vụ với các lượt chưa sử dụng.

### 5.3 Vận chuyển và các khoản không phải doanh thu

Gặp trực tiếp có phí giao nhận bằng không. Mức vận chuyển hiện tại là 15.000đ cho giao thông thường hoặc nội khu và 25.000đ cho giao nhanh. Đây là cấu hình mô phỏng; chưa phải báo giá đã ký với hãng vận chuyển.

Nếu TakeTwo thuê đơn vị vận chuyển, tiền ship thu từ buyer là khoản cần đối soát với đối tác. Trong cấu hình hiện tại, cước thu và cước phải trả bằng nhau nên không tạo biên lợi nhuận vận chuyển. Tiền ship không cộng vào phần seller nhận. Tiền nạp ví và tiền đang giữ trong Escrow cũng không phải doanh thu dịch vụ của sàn.

### 5.4 Voucher và chi phí kích hoạt giao dịch

Admin có thể tạo chiến dịch giảm số tiền cố định hoặc theo phần trăm, đặt trần giảm, giá trị đơn tối thiểu, thời gian, đối tượng, ngân sách tổng, lượt toàn chiến dịch và lượt mỗi người. Đối tượng hỗ trợ gồm tất cả, thành viên chưa có đơn hoàn tất, nhóm Hòa Lạc hoặc danh sách tài khoản.

Mỗi đơn dùng tối đa một voucher và giảm trên tiền hàng. Không nhập mã thì không tự giảm 5.000đ. Khi đặt hàng, hệ thống giữ chỗ ngân sách; khi hoàn tất, chuyển sang chi phí trợ giá đã dùng; khi hủy hoặc hoàn, trả lại phần ngân sách và lượt đang giữ. Mức giảm không tự thu nhỏ chỉ để vừa ngân sách còn lại: ngân sách phải đủ theo điều kiện mã.

Chiến dịch được đánh giá bằng giao dịch tăng thêm, trợ giá thực tế và đóng góp sau chi phí. Không sử dụng GMV cao làm lý do bỏ qua các đơn có đóng góp âm. Ví dụ tiền hàng 150.000đ có phí sàn 4.500đ; nếu sàn tài trợ voucher 5.000đ thì đơn đã âm 500đ trước các chi phí khác.

### 5.5 Chính sách hủy và hoàn hiện tại

Khi đơn còn REQUESTED, buyer có thể hủy hoặc seller từ chối; buyer nhận lại toàn bộ số đã trả, không giữ phí sàn. Sau khi seller chấp nhận, yêu cầu hoàn được xử lý qua tranh chấp khi tiền vẫn còn HELD.

Admin có hai kết quả quyết toán: giải ngân cho seller hoặc hoàn buyer sau khi trừ phí sàn. Không nhập số tiền hoàn tùy ý và không có hoàn một phần. Phí giữ khi hoàn không vượt số buyer thực trả; TakeTwo chịu cước đã phát sinh nếu đơn vị vận chuyển đã lấy hàng. Voucher được trả lại chiến dịch, không chuyển thành tiền mặt.

Chính sách giữ phí khi hoàn là quy tắc sản phẩm hiện tại và phải được giải thích rõ trước checkout. Trước thử nghiệm tiền thật, nhóm cần đánh giá mức chấp nhận của khách hàng, cách xử lý nguyên nhân lỗi và tính phù hợp của điều khoản. Phí giữ lại khi hoàn được theo dõi riêng, không được coi tranh chấp là nguồn tăng trưởng doanh thu.

## 6 Quy trình vận hành và quản trị

### 6.1 Từ tin đăng đến giữ chỗ

Seller tạo listing và gửi kiểm duyệt. Tin được duyệt mới xuất hiện công khai để tìm kiếm và đặt mua. Buyer có thể lưu yêu thích, mở chi tiết và trao đổi trước khi thanh toán. Thỏa thuận thay đổi giá trong chat chưa tự sửa giá listing; giá checkout luôn lấy từ server.

Checkout xác nhận sản phẩm, phương thức giao nhận, địa điểm, người nhận và voucher. Thiếu số dư thì báo số thiếu và mở nạp mô phỏng; không tự đặt hàng sau nạp. Đặt thành công chuyển tiền khả dụng của buyer sang Escrow, tạo đơn REQUESTED và chuyển sản phẩm RESERVED ngay, không chờ seller accept. Hệ thống từ chối tự mua và chỉ cho một yêu cầu thành công giữ cùng sản phẩm.

### 6.2 Bàn giao và thời hạn bảo vệ

Seller chấp nhận để chuyển đơn sang ACCEPTED. Với gặp trực tiếp, seller xác nhận đã bàn giao. Với vận chuyển, seller báo địa chỉ sẵn sàng lấy hàng; mã điều phối do hệ thống quản lý, seller không phải nhập mã hãng vận chuyển. Admin xác nhận lấy hàng và cập nhật các bước giao tiếp theo.

Đơn sang DELIVERING và bắt đầu 120 giờ khi có bàn giao trực tiếp hoặc xác nhận lấy hàng. Buyer có thể xác nhận đã nhận và hài lòng để giải ngân sớm. Nếu hết hạn và không có tranh chấp, hệ thống tạo COMPLETED_AUTO. Đơn tự hoàn tất được báo cáo khác với đơn buyer chủ động xác nhận. Scheduler kiểm tra khi khởi động và mỗi 30 giây; đồng hồ trên giao diện không tự quyết định rằng tiền đã được chuyển.

### 6.3 Hồ sơ tranh chấp

Buyer có thể gửi khiếu nại khi đơn ACCEPTED hoặc DELIVERING và Escrow còn giữ tiền. Nhóm lý do gồm chưa nhận hàng, giao sai hàng, không đúng mô tả, hư hỏng, seller không bàn giao hoặc vấn đề khác. Trường hợp hàng hóa sai hoặc hỏng cần ảnh; trường hợp chưa nhận hàng có thể giải trình bằng văn bản.

Hồ sơ hợp lệ làm đơn sang DISPUTED, dừng tự giải ngân và lưu thời hạn cũ. Buyer, seller bổ sung nội dung và bằng chứng trong hồ sơ. Admin có thể đọc chat liên quan theo vụ việc, yêu cầu thông tin, đánh dấu đã thẩm định và nhập căn cứ quyết định. Có nội dung bổ sung mới thì cần thẩm định lại. Quyết định lưu người thực hiện, lý do và thời điểm.

Mục tiêu vận hành là seller phản hồi trong 48 giờ và admin xử lý trong 72 giờ. Đây là mục tiêu theo dõi, không phải cơ chế tự phán quyết khi quá hạn. Hệ thống chưa mô hình hóa riêng cước trả hàng hoặc giao lại; trước vận hành thật cần quy trình kiểm tra hàng hoàn và xác nhận trách nhiệm.

### 6.4 Ví và đối soát

Ví phân biệt tiền khả dụng và tiền Escrow. Sổ giao dịch có chứng từ thu, chi và tạm giữ, lọc theo loại và tìm kiếm. Bút toán quyết toán ghi riêng phần seller nhận, phí sàn, trợ giá và khoản phải trả vận chuyển.

Admin theo dõi Escrow theo từng đơn và đối chiếu tổng đơn HELD với số dư Escrow từng buyer. Sai lệch phải được kiểm tra trước khi quyết toán, không tự sửa số dư để làm báo cáo cân. Giải ngân thủ công cần lý do và không được ghi thành buyer xác nhận. Đơn tranh chấp phải xử lý qua hồ sơ; đơn vận chuyển chưa ghi nhận lấy hàng không được giải ngân.

Khoản phải trả vận chuyển phát sinh khi xác nhận lấy hàng; thanh toán mô phỏng cần mã đối soát và chỉ được ghi một lần. Cần phân biệt khoản phải trả đã phát sinh với phí dự kiến của các đơn chưa lấy hàng.

### 6.5 Năng lực của cổng quản trị

| Màn quản trị | Nội dung quản lý |
|---|---|
| Tổng quan kinh doanh | GMV hoàn tất, số đơn, phí, trợ giá, boost, cước bù, đóng góp và tỷ lệ |
| Đơn hàng và đối soát | Tiền hàng, ship, buyer trả, phí, voucher, seller nhận, hoàn, cước và sàn ròng |
| Quản lý Escrow | Tổng giữ, thời hạn, đơn gần hoặc quá hạn, tranh chấp và chênh lệch |
| Vận chuyển và cước | Địa chỉ lấy và nhận, mã nội bộ, trạng thái, khoản phải trả và tham chiếu thanh toán |
| Khiếu nại | Hàng đợi, bằng chứng hai bên, trao đổi, dự tính tài chính và quyết định |
| Người dùng và kiểm duyệt | Lịch sử, cảnh cáo, khóa mở có lý do, kiểm tra email local, duyệt ẩn tin, xử lý report |
| Chiến dịch voucher | Tạo sửa bật tắt, điều kiện, ngân sách, lượt dùng và báo cáo đóng góp |

### 6.6 Hỗ trợ và xử lý sự cố

Thành viên bị khóa không được tạo giao dịch mới nhưng vẫn được xem đơn cũ và giải trình. Khi lỗi mạng hoặc hết phiên trong checkout, hệ thống hỗ trợ đăng nhập lại và phục hồi bản nháp theo tài khoản. Yêu cầu tài chính gửi lặp được kiểm soát để không tạo thêm một lần thu hoặc chi ngoài ý muốn.

Nhóm vận hành lưu mã đơn và chứng từ khi tiếp nhận sự cố, kiểm tra trạng thái server trước khi hướng dẫn người dùng thử lại. Database được sao lưu trước nâng cấp và reset chủ động; không xóa dữ liệu mỗi lần khởi động. Thực hành khôi phục và phân quyền sao lưu là điều kiện trước thử nghiệm công khai.

## 7 Kế hoạch tiếp cận thị trường

### 7.1 Tạo nguồn cung trước

Nhóm tuyển một nhóm sinh viên có nhu cầu thanh lý cụ thể, hỗ trợ họ tạo listing đầy đủ và đo số tin được duyệt. Tập trung theo cụm trường giúp thu thập phản hồi và hỗ trợ giao nhận trong phạm vi có thể quản lý. Không sử dụng tin seed để đạt mục tiêu listing thật.

Hoạt động tiếp cận gồm bài giới thiệu trong cộng đồng được phép, giới thiệu giữa sinh viên, hướng dẫn đăng tin và các buổi thử sản phẩm. Chỉ dùng thông điệp về khả năng đã cung cấp; không quảng bá đã xác minh danh tính hoặc bảo đảm hoàn tiền tuyệt đối khi hệ thống chưa có cơ chế tương ứng.

### 7.2 Kích hoạt buyer và giao dịch

Mời buyer theo nhu cầu thực của nhóm listing đã có, ghi lý do không đặt mua và quan sát các bước tìm kiếm, chat, checkout. Voucher được dùng như một thử nghiệm có ngân sách, không thay thế nhu cầu tự nhiên. Đánh giá riêng nhóm có trợ giá và không có trợ giá.

Chuỗi đo lường dự kiến gồm tiếp cận → truy cập → đăng ký → xem sản phẩm → chat → đặt hàng → seller chấp nhận → bàn giao → hoàn tất → quay lại. Mỗi tỷ lệ phải có cùng nhóm thời gian và tiêu chí loại dữ liệu mô phỏng; số tin hoặc số dư ví lớn tự thân không chứng minh thanh khoản.

### 7.3 Kiểm chứng khả năng trả phí

Sau giai đoạn miễn phí, nhóm gửi offer lượt đẩy có giá, vị trí hiển thị và thời gian rõ ràng cho seller đủ điều kiện. Ghi riêng click, đồng ý và thanh toán có bằng chứng. Theo dõi seller mua lại gói lượt, số lượt đã sử dụng và hiệu quả hiển thị; không giả định mọi người mua gói đều gia hạn hằng tháng.

Paid gate kế thừa là tối thiểu mười seller đủ điều kiện nhận offer và mục tiêu ba khoản thanh toán có chứng từ. Đây là ngưỡng quyết định thử nghiệm nhỏ, không phải bằng chứng đã có mô hình kinh doanh bền vững.

## 8 Mô hình tài chính và nhu cầu ngân sách

### 8.1 Nguyên tắc tài chính

Mô hình cập nhật sử dụng phí sàn 3% và gói lượt, thay cho giả định hoa hồng 10% và thuê bao tháng trong kế hoạch trước. Dự báo dưới đây là kịch bản minh họa để đánh giá độ nhạy, không phải doanh thu đã phát sinh hoặc cam kết ngân sách của nhóm.

GMV chỉ là tiền hàng của đơn hoàn tất. Doanh thu dịch vụ quản trị gồm phí hoàn tất, phí giữ lại khi hoàn và tiền bán lượt đẩy. Đóng góp sau biến phí trừ trợ giá, cước sàn chịu khi hoàn và phí thanh toán giả định. Tiền nạp ví, Escrow và tiền thu hộ ship phải được theo dõi riêng với doanh thu.

### 8.2 Kinh tế một đơn hàng

Ký hiệu P là tiền hàng, S là ship, D là voucher, C là tiền buyer trả, F là phí sàn và K là cước đã phát sinh. Hệ thống tính C bằng P cộng S trừ D; F bằng 3% P làm tròn đến đồng. Phí giữ khi hoàn Fr bằng giá trị nhỏ hơn giữa F và C.

| Khoản tiền | Hoàn tất | Hoàn sau tranh chấp | Hủy khi REQUESTED |
|---|---|---|---|
| Buyer trả lúc đặt | C | C | C |
| Buyer nhận lại | Không hoàn | C trừ Fr | Toàn bộ C |
| Seller nhận | P trừ F | 0 | 0 |
| Khoản phải trả vận chuyển | S nếu đã giao nhận theo quy trình | K đã phát sinh | 0 |
| Voucher được tiêu dùng | D | 0, trả ngân sách giữ | 0, trả ngân sách giữ |
| Đóng góp đơn trước phí ngoài | F trừ D | Fr trừ K | 0 |

Ví dụ P bằng 150.000đ, S bằng 15.000đ và D bằng 5.000đ: buyer trả 160.000đ. Khi hoàn tất, seller nhận 145.500đ, khoản phải trả vận chuyển là 15.000đ và sàn ròng âm 500đ trước các chi phí khác. Nếu hoàn sau lấy hàng, buyer nhận 155.500đ, sàn giữ phí 4.500đ, seller nhận không đồng và sàn chịu 15.000đ cước; đóng góp của đơn hoàn là âm 10.500đ. Nếu buyer hủy khi REQUESTED, buyer nhận lại toàn bộ 160.000đ.

### 8.3 Đầu vào của kịch bản năm đầu

| Đầu vào | Thận trọng | Cơ sở | Cao |
|---|---|---|---|
| GMV hoàn tất cả năm kế thừa | 10.864.922đ | 78.969.308đ | 190.347.358đ |
| Tỷ trọng GMV đủ điều kiện thu phí | 60% | 60% | 60% |
| AOV mô hình giao dịch | 150.000đ | 150.000đ | 150.000đ |
| Phí sàn | 3% | 3% | 3% |
| Lượt lẻ bán trong giai đoạn có thu phí | 30 | 150 | 360 |
| Gói năm lượt bán | 15 | 75 | 180 |
| Gói mười lượt bán | 5 | 25 | 60 |
| Tỷ lệ đơn hoàn tất có voucher | 10% | 15% | 20% |
| Voucher trung bình ở đơn có mã | 5.000đ | 5.000đ | 5.000đ |
| Tỷ lệ hoàn trên tổng đơn quyết toán | 5% | 4% | 3% |
| Tỷ lệ dùng vận chuyển và đã phát sinh cước ở nhóm hoàn | 70% | 70% | 70% |
| Cước trung bình đơn có vận chuyển | 15.000đ | 15.000đ | 15.000đ |
| Phí thanh toán giả định | 1% | 1% | 1% |

GMV và AOV kế thừa giả định nhu cầu cũ. Tỷ trọng đủ điều kiện thu phí, số gói bán, tỷ lệ voucher, hoàn và vận chuyển trong bảng là giả định mới cần nhóm phê duyệt và kiểm chứng. Tỷ trọng 60% không được trình bày là kết quả đã tính từ dữ liệu từng tháng. Các gói bán được đếm theo lần mua gói, không đồng nhất với số người trả phí duy nhất.

Giai đoạn local và free pilot không tạo doanh thu thương mại thực. Phần GMV còn lại không đủ điều kiện thu phí được giả định thuộc giai đoạn miễn phí hoặc nằm ngoài phạm vi thu. Nếu paid gate bị lùi, phải giảm tỷ trọng GMV có thu phí và số gói bán tương ứng.

### 8.4 Phương pháp tính

Số đơn hoàn tất đủ điều kiện thu phí bằng 60% GMV chia AOV. Nếu r là tỷ lệ hoàn trên tổng đơn quyết toán, số đơn hoàn kỳ vọng bằng số đơn hoàn tất nhân r rồi chia cho một trừ r. Mô hình giả định các đơn hoàn vẫn đủ điều kiện giữ mức phí 4.500đ; không có voucher làm số đã trả thấp hơn phí này.

Trợ giá bằng số đơn hoàn tất đủ điều kiện nhân tỷ lệ dùng voucher và 5.000đ. Cước sàn chịu khi hoàn bằng số đơn hoàn nhân 70% và 15.000đ. Doanh thu boost bằng số lượt lẻ nhân 15.000đ, cộng số gói năm lượt nhân 49.000đ và số gói mười lượt nhân 79.000đ.

Để ước tính phí thanh toán, mô hình giả định mỗi đơn thuộc nhóm có thu phí và mỗi lần mua boost được tài trợ bằng một lần nạp tương ứng. Giá trị buyer trả bình quân bằng 150.000đ cộng 70% của 15.000đ rồi trừ tỷ lệ voucher nhân 5.000đ. Phí 1% áp dụng trên tổng số tiền này của cả đơn hoàn tất và đơn hoàn, cộng tiền boost. Đây là giả định tính chi phí, chưa phải biểu phí đối tác; chưa mô hình hóa tái sử dụng tiền hoàn, tiền nạp dư, phí rút, chargeback hoặc phí hoàn của cổng.

### 8.5 Kết quả kịch bản minh họa

| Khoản mục năm đầu | Thận trọng | Cơ sở | Cao |
|---|---|---|---|
| Doanh thu bán lượt và gói đẩy | 1.580.000đ | 7.900.000đ | 18.960.000đ |
| Phí đơn hoàn tất | 195.569đ | 1.421.448đ | 3.426.252đ |
| Phí giữ ở đơn hoàn | 10.293đ | 59.227đ | 105.967đ |
| Tổng doanh thu dịch vụ quản trị | 1.785.862đ | 9.380.675đ | 22.492.219đ |
| Trợ giá voucher | 21.730đ | 236.908đ | 761.389đ |
| Cước sàn chịu khi hoàn | 24.017đ | 138.196đ | 247.255đ |
| Phí thanh toán giả định | 88.995đ | 604.639đ | 1.441.575đ |
| Đóng góp sau các biến phí trên | 1.651.119đ | 8.400.931đ | 20.041.999đ |

Các kết quả được tính trên số chưa làm tròn và trình bày đến đồng; cộng các dòng đã làm tròn có thể chênh một đồng. Đóng góp sau biến phí chưa trừ chi phí phát triển, hỗ trợ, marketing và quản trị; không gọi là lợi nhuận ròng. Việc thu phí thực tế vẫn phụ thuộc paid gate và năng lực thu, hoàn, đối soát.

### 8.6 Khung ngân sách kế thừa

| Khoản mục kế hoạch | Số tiền | Thời gian dự kiến |
|---|---|---|
| Phát triển sản phẩm | 5.000.000đ | M1 đến M3 |
| Hosting backend và database | 3.000.000đ | M1 đến M12 |
| Tên miền và email | 800.000đ | M1 |
| Bảo mật và kiểm thử | 3.000.000đ | M3 đến M6 |
| Lưu trữ ảnh và sao lưu | 1.200.000đ | M1 đến M12 |
| Công cụ và dịch vụ bên thứ ba | 1.500.000đ | M1 đến M12 |
| Bảo trì kỹ thuật | 3.000.000đ | M4 đến M12 |
| Kiểm duyệt và hỗ trợ | 3.000.000đ | M4 đến M12 |
| Điều khoản và quyền riêng tư | 2.000.000đ | M2 |
| Marketing và cộng đồng | 5.000.000đ | M4 đến M12 |
| Tư vấn pháp lý và đăng ký dự kiến | 3.000.000đ | Trước thử nghiệm công khai |
| Tích hợp QR và đối soát dự kiến | 1.000.000đ | Trước thử nghiệm tiền thật |
| Tổng trước dự phòng | 31.500.000đ | Toàn kế hoạch |
| Dự phòng 10% | 3.150.000đ | Chỉ giải ngân khi cần |
| Tổng trần ngân sách tham chiếu | 34.650.000đ | Toàn kế hoạch |

Khung ngân sách được kế thừa để lập kế hoạch, không phải số tiền mặt đang có và không chứng minh các khoản đã được chi. Các khoản tích hợp và pháp lý là dự toán cần báo giá lại theo mô hình ví và điều phối vận chuyển mới. Trợ giá, cước bù và phí thanh toán ở bảng kết quả là biến phí bổ sung, không được tính lặp trong marketing hoặc khoản công cụ khi quyết toán thực tế.

### 8.7 Nhu cầu bù ngân sách và điều kiện hòa vốn

| Phép so sánh tổng năm | Thận trọng | Cơ sở | Cao |
|---|---|---|---|
| Thiếu hụt so với 31,5 triệu trước dự phòng | 29.848.881đ | 23.099.069đ | 11.458.001đ |
| Thiếu hụt nếu dùng toàn bộ trần 34,65 triệu | 32.998.881đ | 26.249.069đ | 14.608.001đ |

Đây là chênh lệch giữa ngân sách tham chiếu và đóng góp mô hình, chưa phải nhu cầu vốn đỉnh theo tháng. Dự phòng là khoản ngân sách giữ sẵn, không tự động trở thành chi phí đã phát sinh. Muốn xác định vốn cần huy động phải lập lịch thu chi, dự trữ vận hành và nghĩa vụ với tiền người dùng. Không sử dụng tiền ví chưa tiêu, Escrow hoặc tiền phải trả vận chuyển như vốn tự do của nhóm.

Ở kịch bản Cơ sở, đóng góp sau biến phí khoảng 8,40 triệu đồng chưa bù được ngân sách 31,5 triệu đồng trước dự phòng. Vì vậy năm đầu vẫn là giai đoạn kiểm chứng, chưa có cơ sở kết luận hòa vốn. Công thức điều hành là đóng góp từ đơn hoàn tất cộng đóng góp gói đẩy, trừ lỗ đơn hoàn, phải đủ chi phí vận hành cố định của cùng kỳ. Chưa công bố một số payer hòa vốn cố định khi chưa có dữ liệu mua lại gói lượt, chi phí hỗ trợ và chi phí đối tác đáng tin cậy.

## 9 Đội ngũ và quản trị rủi ro

### 9.1 Phân công kế thừa

| Thành viên | Trọng tâm trách nhiệm |
|---|---|
| Huy | Điều phối dự án, phân tích nghiệp vụ, quyết định phạm vi và kế hoạch ngân sách |
| Tuấn | Tin đăng, giao diện, tích hợp hệ thống và trải nghiệm người dùng |
| Bình | Khám phá sản phẩm, chỉ số và mô hình tài chính |
| Hùng | Chat, phát triển cộng đồng và nghiên cứu kích hoạt thành viên |
| Phú | Đơn hàng, tin cậy, kiểm duyệt, tranh chấp và kiểm thử nghiệp vụ |

Phân công này là cơ sở tổ chức của nhóm; việc hoàn thành từng hạng mục cần có người phụ trách, bằng chứng kiểm tra và người xác nhận. Các quyết định tiền cần được kiểm tra độc lập khi chuyển sang vận hành thực.

### 9.2 Các rủi ro trọng yếu

| Rủi ro | Tác động | Kiểm soát hiện tại và bước tiếp theo |
|---|---|---|
| Thiếu thanh khoản | Có tin nhưng ít buyer hoặc ít đơn hoàn tất | Onboard nguồn cung theo nhu cầu, đo chat và đơn theo cohort |
| Suy luận quá mức từ khảo sát | Dự báo tăng trưởng hoặc trả phí sai | Giữ nhãn giả định, đối chiếu raw data và phỏng vấn |
| Tiền và trạng thái không khớp | Giữ hoặc trả sai số dư | Transaction, chống lặp, đối soát, backup và kiểm thử rollback |
| Hết hạn bảo vệ trước khi giao xong | Seller có thể nhận tiền khi buyer chưa nhận hàng | Công khai mốc 120 giờ hiện tại; đánh giá SLA theo giao nhận trước tiền thật |
| Tranh chấp thiếu bằng chứng | Quyết định chậm hoặc thiếu công bằng | Lý do có cấu trúc, ảnh theo trường hợp, phản hồi hai bên và audit |
| Voucher làm lỗ đơn | Trợ giá vượt phí sàn và giá trị tăng thêm | Hạn ngân sách, hạn lượt, báo cáo đóng góp và đánh giá thử nghiệm |
| Cước hoàn và phí đối tác | Chi phí vượt khung dự toán | Đối soát cước một lần, báo giá và dự trữ vận hành riêng |
| Lộ thông tin cá nhân | Lộ tài khoản, chat, ảnh hoặc địa chỉ | Kiểm soát participant, bảo vệ file, giới hạn upload và rà soát log |
| Giữ phí khi hoàn không được chấp nhận | Mất niềm tin và tăng khiếu nại | Hiển thị trước đặt, nghiên cứu chấp nhận và rà soát điều khoản trước pilot |
| Bán lượt đẩy vượt năng lực | Dịch vụ ưu tiên không đạt kỳ vọng | Chưa coi giả định 100 slot là giới hạn hệ thống đã thực thi; kiểm thử tải và thiết kế công suất trước bán thật |

### 9.3 Dữ liệu và điều kiện vận hành công khai

TakeTwo xử lý thông tin tài khoản, tin đăng, hội thoại, hình ảnh, địa chỉ giao nhận và chứng từ nghiệp vụ. Trước công khai cần hoàn thiện mục đích sử dụng dữ liệu, quyền truy cập, thời gian lưu, quy trình hỗ trợ và khôi phục. Việc kiểm tra email local không được quảng bá như xác minh danh tính sinh viên với trường.

Trước nhận tiền thực, nhóm cần xác lập mô hình hợp tác thanh toán, trách nhiệm giữ và hoàn tiền, điều khoản dịch vụ, chứng từ, xử lý khiếu nại và phương án đối soát với đơn vị vận chuyển. Việc đã có module mang tên ví hoặc Escrow không tự chứng minh đủ điều kiện cung cấp dịch vụ giữ tiền thực. Quyết định triển khai được thông qua sau rà soát chuyên môn và thử nghiệm có kiểm soát.

## 10 Chỉ số đánh giá và lộ trình phát triển

### 10.1 Chỉ số trên hệ thống hiện tại

| Chỉ số | Định nghĩa sử dụng |
|---|---|
| GMV hoàn tất | Tổng tiền hàng của đơn COMPLETED và COMPLETED_AUTO trong kỳ quyết toán |
| Đơn hoàn tất | Đếm đơn hoàn tất, phân biệt buyer xác nhận, tự hoàn tất và admin giải ngân |
| Đơn hủy và hoàn | Tách hủy trước xử lý với hoàn qua tranh chấp |
| Tỷ lệ hoàn tất | Đơn đã hoàn tất trong nhóm đơn tạo cùng kỳ chia tổng đơn nhóm đó |
| Tỷ lệ tranh chấp | Đơn từng có tranh chấp trong nhóm tạo cùng kỳ chia tổng đơn nhóm đó |
| Escrow hiện giữ | Tổng tiền của các đơn HELD tại thời điểm xem |
| Phí và trợ giá | Phí đơn hoàn tất, phí giữ khi hoàn và voucher đã tiêu dùng |
| Doanh thu boost | Tiền bán lượt và gói, không cộng lần sử dụng lượt |
| Đóng góp quản trị | Phí hoàn tất cộng phí giữ hoàn cộng boost, trừ voucher và cước sàn chịu khi hoàn |

Dashboard mặc định xem 30 ngày, nhưng Escrow là số dư hiện tại. Đóng góp trên dashboard chưa trừ phí cổng, lương, hosting và các chi phí vận hành bên ngoài. Vì vậy khác với đóng góp sau biến phí trong mô hình dự báo ở mục 8.5, vốn có thêm giả định phí thanh toán.

### 10.2 Chỉ số nghiên cứu cần bổ sung

Khi thử nghiệm người dùng, nhóm cần theo dõi listing thật, seller và buyer hoạt động, chat chuyển thành đơn, tỷ lệ buyer quay lại, seller đăng lại, thời gian bán và lý do hủy. Các bản ghi demo, thử nghiệm kỹ thuật, có trợ giá và không trợ giá phải được phân loại ở quy trình nghiên cứu hoặc cơ chế dữ liệu bổ sung trước khi báo cáo kết quả thị trường.

Completed trên ứng dụng là một trạng thái nghiệp vụ. Seller chấp nhận đơn không đồng nghĩa xác nhận đã giao hàng; buyer xác nhận, tự hoàn tất và admin giải ngân cũng không đồng nhất. KPI giao dịch thực cần có bằng chứng phù hợp với mục tiêu đo lường.

### 10.3 Lộ trình từ hiện trạng

| Giai đoạn | Trọng tâm | Đầu ra cần nghiệm thu |
|---|---|---|
| Hiện tại | Ổn định ứng dụng local và diễn tập đầy đủ | Core flow, kiểm thử tiền, phân quyền, backup và kịch bản trình diễn |
| Ưu tiên tiếp theo | Nhiều ảnh listing | Tối đa năm ảnh, ảnh bìa, kiểm tra định dạng và dung lượng |
| Sau nhiều ảnh | Review đơn hoàn tất | Một đánh giá hợp lệ mỗi đơn và điểm tổng hợp từ dữ liệu thật |
| Sau review | Thông báo trong ứng dụng | Chưa đọc và đã đọc, dẫn tới đúng đơn, chat hoặc kết quả tranh chấp |
| Chuẩn bị pilot | Triển khai online có kiểm soát và hỗ trợ | HTTPS, quản lý phiên, phân quyền, giám sát, khôi phục, lưu ảnh và kiểm thử tải |
| Trước tiền thật | Thanh toán và vận chuyển qua đối tác | Chính sách, hợp đồng, callback xác thực, đối soát, hoàn tiền và diễn tập sự cố |
| Paid validation | Kiểm chứng giá và nhu cầu trả tiền | Offer, chứng từ thực, mức dùng lượt, chi phí hỗ trợ và cohort |

Chat và report không nằm trong danh sách chưa làm vì đã có phiên bản sử dụng được. Các giai đoạn tiếp theo không thêm bước bắt buộc vào checkout chỉ để phục vụ module mở rộng.

### 10.4 Các mốc quyết định

| Mốc | Điều kiện xem xét | Quyết định |
|---|---|---|
| Sẵn sàng trình diễn | Luồng mua, tự hoàn tất và tranh chấp chạy lại được; không có quyết toán lặp | Cho phép dùng bản local để bảo vệ và thử tác vụ |
| Thử nghiệm cộng đồng | Có chính sách dữ liệu, hỗ trợ và phân loại demo với hoạt động thật | Pilot nhỏ hoặc tiếp tục sửa |
| Mục tiêu cuối giai đoạn MVP | Tham chiếu mục tiêu cũ 150 seller, 300 listing, 50 yêu cầu hợp lệ; điều chỉnh theo năng lực | Mở rộng miễn phí, lặp lại thử nghiệm hoặc dừng |
| Paid gate | Tối thiểu mười offer đủ điều kiện, mục tiêu ba thanh toán có bằng chứng và cơ chế đối soát được chấp thuận | Thử thu phí giới hạn hoặc chưa mở |
| Đánh giá năm đầu | Cohort, trợ giá, tranh chấp, đóng góp và nguồn vốn đủ giải thích | Tiếp tục, điều chỉnh mô hình hoặc thu hẹp |

M1 đến M12 trong mô hình là tháng tương đối của kế hoạch, không phải xác nhận nhóm đã hoàn thành từng giai đoạn theo lịch. Paid validation dự kiến từ M7 chỉ được kích hoạt khi điều kiện đạt, không mở tự động vì đã tới tháng đó.

## 11 Kết luận và quyết định triển khai

TakeTwo đã có ứng dụng local kết nối tin đăng, chat, đặt hàng, ví, Escrow, giao nhận, tranh chấp và quản trị trong một quy trình. Mô hình phù hợp với hành vi một sinh viên vừa mua vừa bán, có phí sàn 3% và bán lượt đẩy thay cho việc chia tài khoản mua bán hoặc mặc định thuê bao tháng.

Ưu tiên kinh doanh là kiểm chứng nhu cầu sử dụng và khả năng trả phí, đồng thời bảo đảm nhóm có thể giải thích tiền và trạng thái ở từng đơn. Kịch bản tài chính cập nhật cho thấy cần tiếp tục bố trí ngân sách và kiểm soát trợ giá; chưa có cơ sở kết luận năm đầu hòa vốn.

Quyết định hiện tại là tiếp tục hoàn thiện và thử nghiệm sản phẩm local, tổ chức pilot có giới hạn sau khi đạt điều kiện vận hành, và chỉ mở tiền thật khi đã có phương án đối tác cùng quy trình thu, giữ, hoàn và đối soát phù hợp. Các chỉ tiêu tăng trưởng và tài chính được cập nhật bằng dữ liệu thực tế sau mỗi mốc thử nghiệm.

## 12 Phụ lục về quy tắc nghiệp vụ và nguồn đối chiếu

### 12.1 Trạng thái chính

| Đối tượng | Quy tắc |
|---|---|
| Sản phẩm | AVAILABLE khi còn bán; RESERVED ngay khi đặt giữ tiền thành công; SOLD khi hoàn tất; HIDDEN khi gỡ |
| Kiểm duyệt | Trạng thái duyệt tách khỏi trạng thái bán; AVAILABLE chưa được duyệt vẫn không được mua |
| Đơn hàng | REQUESTED → ACCEPTED → DELIVERING → COMPLETED hoặc COMPLETED_AUTO |
| Hủy sớm | REQUESTED → CANCELLED; tiền trả toàn bộ |
| Tranh chấp | ACCEPTED hoặc DELIVERING → DISPUTED khi còn giữ tiền |
| Quyết định hồ sơ | DISPUTED → COMPLETED hoặc CANCELLED; khoản hoàn nhận diện thêm bằng escrow_status và hồ sơ |
| Escrow | HELD → RELEASED hoặc REFUNDED một lần |
| Voucher | Giữ ngân sách lúc đặt; tiêu dùng khi hoàn tất; giải phóng khi hủy hoặc hoàn |

### 12.2 Những nội dung đã thay đổi so với kế hoạch trước

| Nội dung trước | Nội dung cập nhật |
|---|---|
| Buyer và seller dễ bị hiểu là loại tài khoản | Một tài khoản thành viên; vai trò theo từng giao dịch |
| Tự thanh toán bên ngoài trong MVP | Đã có ví và Escrow nội bộ mô phỏng |
| Hoa hồng danh nghĩa 10% | Cấu hình sản phẩm hiện tại là 3% tiền hàng |
| Gói 49k và 79k theo tháng | Gói năm hoặc mười lượt, chưa thuê bao và tự gia hạn |
| Reserved sau seller accept | Giữ chỗ ngay khi checkout và giữ tiền thành công |
| Vận chuyển ngoài phạm vi | Đã có điều phối và khoản phải trả mô phỏng |
| Review trong luồng đã cung cấp | Review còn ở lộ trình; chat và report đã có |
| Voucher đơn giản hoặc cố định | Chiến dịch có điều kiện, ngân sách, giới hạn và đối tượng |
| Dự báo doanh thu và dòng tiền cũ | Tính lại minh họa theo 3%, gói lượt và các biến phí; chưa khẳng định vốn đỉnh |
| Hai bộ TAM và SAM khác nhau | Dùng nhất quán bộ giả định Hà Nội ở phụ lục trước |

### 12.3 Nguồn nội bộ và quy trình cập nhật

Nguồn nghiên cứu và giả định nền là TakeTwo Business Plan Hanoi Revised ngày 04/11/2026 và thông tin khảo sát Wave 2 được ghi trong tài liệu đó. Các kết quả nhu cầu và khảo sát chưa được nâng thành bằng chứng thương mại thực chỉ vì đã đưa vào kế hoạch mới.

Nguồn kiểm tra tính năng là README.md, config.js, server.js, db.js, các module marketplace, vouchers, ledger, operations và reports; giao diện người dùng và admin; bộ kiểm thử của dự án. Tài liệu đặc tả V2 được dùng làm ngữ cảnh định hướng, nhưng tính năng chỉ được ghi đã có khi đối chiếu được với hệ thống hiện tại.

Nhóm nên duy trì sổ phỏng vấn, hồ sơ quan sát tin đăng, nhật ký thử tác vụ, danh sách offer, chứng từ tiền thực khi có và nhật ký quyết định. Mỗi cập nhật giá, thời hạn, chính sách hoàn hoặc cách ghi nhận tiền cần sửa đồng thời cấu hình sản phẩm, test, hướng dẫn người dùng và kế hoạch kinh doanh.
