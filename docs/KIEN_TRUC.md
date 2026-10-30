# Tài liệu kiến trúc – TicketChain

## 1. Tổng quan

~~~
 Trình duyệt (index.html, 3 tab)        Ví MetaMask            Mạng Sepolia
┌───────────────────────────────┐  ký giao dịch  ┌───────┐  gửi tx  ┌─────────────────────────┐
│ config.js  wallet.js  (A)     │ ─────────────▶ │  Ví   │ ───────▶ │ TicketCheckIn (deploy)  │
│ organizer.js          (A)     │                └───────┘          │   kế thừa TicketSale    │
│ buyer.js              (B)     │ ◀──────── đọc dữ liệu (view) ─────│     kế thừa EventManager│
│ staff.js, refund.js   (C)     │                                   └─────────────────────────┘
└───────────────────────────────┘
~~~

- Không có máy chủ và không có cơ sở dữ liệu riêng. Mọi dữ liệu sự kiện, vé, quyền đều nằm trên blockchain.
- Giao diện là trang tĩnh, dùng ethers.js v6 gọi contract qua MetaMask.

## 2. Ba contract kế thừa nhau

~~~
EventManager (A)  ->  TicketSale (B)  ->  TicketCheckIn (C)   <- contract được deploy
 sự kiện, phân quyền   mua vé, sở hữu vé    soát vé, hủy, hoàn tiền, rút doanh thu
~~~

- Mỗi người viết một file contract riêng, nên làm song song được và ít bị conflict.
- Chỉ deploy một contract là `TicketCheckIn`. Nhờ kế thừa, nó có đủ hàm của cả ba phần và dùng chung một vùng dữ liệu.
- `EventManager` để `toggleSale` là `virtual` để `TicketCheckIn` ghi đè: sự kiện đã hủy thì không mở bán lại được.

## 3. Ba vai trò (phần A)

| Vai trò | Xác định bằng | Được làm |
|---|---|---|
| Quản trị (owner) | Ví deploy contract, lưu trong `owner` (immutable) | `setOrganizer`: cấp hoặc thu quyền ban tổ chức |
| Ban tổ chức (organizer) | `isOrganizer[ví] == true` | `createEvent`; với sự kiện do mình tạo: `setStaff`, `toggleSale` |
| Nhân viên soát vé (staff) | `isStaff[eventId][ví] == true` | Soát vé của đúng sự kiện đó (phần C) |

Ví deploy vừa là owner vừa có sẵn quyền ban tổ chức (gán trong `constructor`).

| Modifier | Điều kiện | Lỗi khi sai |
|---|---|---|
| `onlyOwner` | `msg.sender == owner` | `NotOwner()` |
| `eventExists(id)` | `1 <= id <= eventCount` | `EventNotFound(id)` |
| `onlyOrganizer(id)` | sự kiện tồn tại và `organizer` là `msg.sender` | `EventNotFound(id)` / `NotEventOrganizer(id)` |
| `onlyStaff(id)` | `isStaff[id][msg.sender]` | `NotStaff(id)` |

Lỗi dùng custom error (`revert NotOwner()`) thay cho `require(..., "chuỗi")` vì tốn ít gas hơn và mang được tham số.

## 4. Dữ liệu phần A trên chuỗi

~~~solidity
struct Event {
    address organizer;   // ví tạo sự kiện
    string  name;
    string  venue;
    uint64  startTime;   // unix timestamp, phải ở tương lai khi tạo
    uint256 price;       // giá mỗi vé (wei)
    uint32  maxTickets;  // số vé tối đa
    uint32  ticketsSold; // TicketSale (B) cập nhật
    bool    saleOpen;    // đang mở bán hay tạm dừng
}
uint256 public eventCount;
mapping(uint256 => Event) internal _events;
mapping(address => bool) public isOrganizer;
mapping(uint256 => mapping(address => bool)) public isStaff;
~~~

`_events` để `internal` để contract con (B, C) đọc và sửa được. Bên ngoài xem qua `getEventInfo`.

## 5. Event (log) phần A

| Event | Phát khi |
|---|---|
| `OrganizerUpdated(account, allowed)` | Deploy và mỗi lần `setOrganizer` |
| `EventCreated(eventId, organizer, name, price, maxTickets, startTime)` | Tạo sự kiện |
| `StaffUpdated(eventId, staff, allowed)` | Cấp hoặc thu quyền soát vé |
| `SaleToggled(eventId, open)` | Mở hoặc dừng bán vé |

## 6. Quy tắc do smart contract tự thực thi

| Quy tắc | Phần |
|---|---|
| Chỉ ví được cấp quyền mới tạo sự kiện | A |
| Tên không rỗng, số vé > 0, thời gian ở tương lai | A |
| Chỉ ban tổ chức của sự kiện mới cấp quyền soát vé, mở/dừng bán | A |
| Không bán quá số vé tối đa; tối đa 2 vé mỗi ví; vé không chuyển nhượng | B |
| Chỉ nhân viên của sự kiện mới soát vé; mỗi vé dùng một lần; vé không có trên chuỗi là vé giả | C |
| Hủy sự kiện, hoàn tiền mỗi vé một lần | C |

## 7. Luồng chính

1. Quản trị deploy `TicketCheckIn` → trở thành owner và có quyền ban tổ chức.
2. Quản trị cấp quyền ban tổ chức cho ví khác nếu cần (`setOrganizer`).
3. Ban tổ chức tạo sự kiện (`createEvent`) và cấp quyền soát vé (`setStaff`).
4. Người mua mua vé (B), mở QR đã ký.
5. Nhân viên quét QR, contract đánh dấu vé đã dùng (C).
6. Ban tổ chức xem thống kê, dừng/mở bán (`toggleSale`) hoặc hủy sự kiện (C).

## 8. Giao diện phần A

| File | Nội dung |
|---|---|
| `js/config.js` | Cấu hình mạng, ABI của EventManager, câu báo lỗi tiếng Việt, tiện ích `TC.utils` |
| `js/wallet.js` | Kết nối MetaMask, tự chuyển sang Sepolia, tạo `TC.state.contract`, phát `tc:ready`, `tc:changed` |
| `js/organizer.js` | Tab Ban tổ chức: tạo sự kiện, cấp/thu quyền soát vé, bảng thống kê, dừng/mở bán |
| `css/organizer.css` | Giao diện riêng của header và tab Ban tổ chức |
| `js/deployment.js` | Địa chỉ contract theo chainId, do `scripts/deploy.js` tự sinh |

Mỗi file JS tự thêm ABI của mình vào `TC.abi`, nên khi B hoặc C đổi contract thì không phải sửa file của A.
Ẩn hoặc khóa nút trên giao diện chỉ để tiện người dùng; bảo mật thật nằm ở modifier trong contract.

## 9. Triển khai

- Mạng: Sepolia testnet (chainId 11155111). Công cụ: Hardhat 2, Solidity 0.8.28, ethers.js v6.
- Lệnh: `npm run deploy:sepolia`, rồi `npx hardhat verify --network sepolia <địa chỉ>`.
- `scripts/deploy.js` ghi địa chỉ vào `deployments/sepolia.json` và `frontend/js/deployment.js`.
- Địa chỉ contract: `<điền sau khi deploy bản cuối>`
- Etherscan: `https://sepolia.etherscan.io/address/<địa chỉ>`
- Khóa deploy để trong `.env`, file này nằm trong `.gitignore` và không bao giờ được commit.