# TicketChain – Vé sự kiện chống giả mạo bằng Blockchain

Hệ thống cho phép ban tổ chức phát hành vé giới hạn số lượng, gắn vé với ví người mua,
soát vé một lần duy nhất và lưu trạng thái vé trên blockchain để chống vé giả, vé trùng.

## Contract trên Sepolia

- Địa chỉ: `0xeF3FC277E4D3a406d3EC91f7b41e2AEd1BB63BB7`
- Mã nguồn đã verify: https://sepolia.etherscan.io/address/0xeF3FC277E4D3a406d3EC91f7b41e2AEd1BB63BB7#code

## Quy tắc do smart contract tự thực thi

| Quy tắc | Hàm | Lỗi khi vi phạm |
|---|---|---|
| Chỉ ví được cấp quyền mới tạo sự kiện | `createEvent` | `NotOrganizerRole` |
| Không bán quá số vé tối đa | `buyTicket` | `SoldOut` |
| Mỗi ví tối đa 2 vé cho một sự kiện | `buyTicket` | `WalletLimitReached` |
| Vé gắn với ví, không chuyển nhượng | `transferTicket` | `TransferNotAllowed` |
| Chỉ nhân viên được cấp quyền mới soát vé | `checkIn` | `NotStaff` |
| Mỗi vé chỉ dùng một lần | `checkIn` | `TicketAlreadyUsed` |
| Mã vé không có trên chuỗi là vé giả | `checkIn`, `verifyTicket` | `TicketNotFound` |
| Chỉ hủy sự kiện khi chưa soát vé nào | `cancelEvent` | `EventHasCheckIns` |
| Mỗi vé chỉ hoàn tiền một lần | `claimRefund` | `AlreadyRefunded` |

Chống chụp lại QR: QR chứa chữ ký của ví chủ vé và chỉ có hiệu lực 60 giây. Nhân viên soát vé
kiểm tra người ký có đúng là chủ vé trên chuỗi không, nên ảnh chụp màn hình QR cũ sẽ bị từ chối.

## Kiến trúc

~~~
EventManager (A)  ->  TicketSale (B)  ->  TicketCheckIn (C)   <- contract được deploy
 sự kiện, phân quyền   mua vé, sở hữu      soát vé, hủy, hoàn tiền, rút doanh thu
~~~

~~~
contracts/   EventManager.sol · TicketSale.sol · TicketCheckIn.sol · interfaces/
test/        eventManager · ticketSale · checkIn · refund · e2e (55 test)
scripts/     deploy.js (ghi địa chỉ cho frontend) · seed.js (dữ liệu demo)
frontend/    index.html (1 trang, 3 tab) · css/ · js/
docs/        KIEN_TRUC.md (tài liệu kiến trúc)
~~~

| File giao diện | Người làm | Nội dung |
|---|---|---|
| `js/config.js`, `js/wallet.js`, `js/organizer.js` | A | Kết nối MetaMask, chuyển mạng, tab Ban tổ chức |
| `js/buyer.js` | B | Tab Người mua, mua vé, vé của tôi, QR đã ký |
| `js/staff.js`, `js/refund.js` | C | Tab Soát vé, lịch sử, tra cứu, hủy và hoàn tiền |

## Cài đặt

Cần Node.js 20 hoặc 22 và tiện ích MetaMask.

~~~bash
npm install
npx hardhat compile
npx hardhat test
~~~

## Chạy giao diện với contract trên Sepolia

~~~bash
npm run serve        # mở http://localhost:5500
~~~

Chọn mạng Sepolia trong MetaMask rồi bấm "Kết nối MetaMask". Trang tự dùng địa chỉ contract trong `frontend/js/deployment.js`.

## Chạy trên máy (localhost)

~~~bash
# Cửa sổ 1: blockchain local, in ra 20 ví có sẵn ETH
npx hardhat node

# Cửa sổ 2
npm run deploy:local
npx hardhat run scripts/seed.js --network localhost
npm run serve
~~~

Trong MetaMask: thêm mạng `http://127.0.0.1:8545`, chainId `31337`, rồi import private key
của Account #0 (ban tổ chức), #1 (nhân viên), #2 (người mua) được in ra ở cửa sổ 1.
Nếu khởi động lại `hardhat node`, vào MetaMask → Settings → Advanced → Clear activity tab data.

## Deploy lên Sepolia

1. Copy `.env.example` thành `.env`, điền `SEPOLIA_RPC_URL`, `PRIVATE_KEY` (ví test) và `ETHERSCAN_API_KEY`. File `.env` không bao giờ được commit.
2. Lấy ETH Sepolia miễn phí từ một faucet cho ví deploy.
3. Deploy, verify và tạo dữ liệu demo:

~~~powershell
npm run deploy:sepolia
npx hardhat verify --network sepolia <ĐỊA_CHỈ_CONTRACT>
$env:DEMO_STAFF="0x...vi-nhan-vien"            # PowerShell
npx hardhat run scripts/seed.js --network sepolia
~~~

Trên macOS/Linux dùng `DEMO_STAFF=0x... npx hardhat run scripts/seed.js --network sepolia`.
`deploy.js` tự ghi địa chỉ vào `deployments/sepolia.json` và `frontend/js/deployment.js`.

## Kịch bản demo

1. Ban tổ chức tạo sự kiện, cấp quyền soát vé cho ví nhân viên.
2. Người mua mua 2 vé; nút mua bị khóa khi đủ 2 vé. Mở "Hiện QR".
3. Nhân viên quét QR (hoặc dán nội dung QR) → nền xanh "Vé hợp lệ – mời vào".
4. Quét lại cùng vé → đỏ "Vé đã được dùng".
5. Nhập mã vé không tồn tại → đỏ "Vé giả".
6. Dùng QR đã quá 60 giây → vàng "QR đã hết hạn".
7. Tra cứu công khai mã vé → hiện trạng thái thật trên chuỗi.
8. Tạo sự kiện khác, mua vé, hủy sự kiện → người mua bấm "Nhận hoàn tiền".

Camera chỉ hoạt động trên `https` hoặc `localhost`. Nếu camera lỗi, dùng ô "Dán nội dung QR thủ công".

## Hạn chế

- Một người có thể tạo nhiều ví để mua quá 2 vé; hệ thống không xác minh danh tính.
- Mỗi lần soát vé là một giao dịch, tốn gas và mất vài giây chờ xác nhận.
- Địa chỉ ví và lịch sử mua vé là công khai trên blockchain.
- QR có hiệu lực 60 giây nên trong khoảng đó ảnh chụp màn hình vẫn có thể bị dùng trước.

## Nhóm

| Thành viên | Phần |
|---|---|
| A | Sự kiện & phân quyền, kết nối ví, deploy |
| B | Mua vé & sở hữu vé, QR, dữ liệu demo |
| C | Soát vé, xác minh QR, hủy sự kiện & hoàn tiền |