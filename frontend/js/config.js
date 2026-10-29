/* ==================================================================
   config.js – A
   Cấu hình chung, ABI của EventManager và các hàm tiện ích.
   Mỗi file của B và C tự thêm ABI của mình vào TC.abi, nên không ai
   phải sửa file của người khác khi contract thay đổi.
   ================================================================== */
window.TC = window.TC || {};

TC.config = {
  // Mạng mặc định khi MetaMask đang ở mạng chưa có contract
  defaultChainId: 11155111,

  // Thời gian hiệu lực của QR đã ký (giây). B và C phải dùng chung giá trị này.
  qrTtlSeconds: 60,

  networks: {
    11155111: {
      chainId: "0xaa36a7",
      chainName: "Sepolia",
      nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://rpc.sepolia.org"],
      blockExplorerUrls: ["https://sepolia.etherscan.io"],
    },
    31337: {
      chainId: "0x7a69",
      chainName: "Hardhat Localhost",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: ["http://127.0.0.1:8545"],
      blockExplorerUrls: [],
    },
  },
};

/** Địa chỉ contract theo chainId, lấy từ js/deployment.js. */
TC.getDeployment = function (chainId) {
  const all = window.TC_DEPLOYMENTS || {};
  return all[String(chainId)] || null;
};

// ------------------------------------------------------------------
// ABI – EventManager (A). B và C push thêm phần của mình.
// ------------------------------------------------------------------
TC.abi = TC.abi || [];
TC.abi.push(
  "function owner() view returns (address)",
  "function eventCount() view returns (uint256)",
  "function isOrganizer(address) view returns (bool)",
  "function isStaff(uint256, address) view returns (bool)",
  "function getEventInfo(uint256 eventId) view returns (tuple(address organizer, string name, string venue, uint64 startTime, uint256 price, uint32 maxTickets, uint32 ticketsSold, bool saleOpen))",
  "function setOrganizer(address account, bool allowed)",
  "function createEvent(string name, string venue, uint64 startTime, uint256 price, uint32 maxTickets) returns (uint256)",
  "function setStaff(uint256 eventId, address staff, bool allowed)",
  "function toggleSale(uint256 eventId)",
  "event EventCreated(uint256 indexed eventId, address indexed organizer, string name, uint256 price, uint32 maxTickets, uint64 startTime)",
  "event StaffUpdated(uint256 indexed eventId, address indexed staff, bool allowed)",
  "event SaleToggled(uint256 indexed eventId, bool open)",
  "error NotOwner()",
  "error NotOrganizerRole()",
  "error NotEventOrganizer(uint256 eventId)",
  "error NotStaff(uint256 eventId)",
  "error EventNotFound(uint256 eventId)",
  "error InvalidEventParams()",
  "error ZeroAddress()"
);

// Thông báo tiếng Việt cho từng custom error. B và C thêm phần của mình.
TC.errorMessages = TC.errorMessages || {};
Object.assign(TC.errorMessages, {
  NotOwner: "Chỉ ví quản trị mới làm được việc này.",
  NotOrganizerRole: "Ví này chưa được cấp quyền ban tổ chức.",
  NotEventOrganizer: "Bạn không phải ban tổ chức của sự kiện này.",
  NotStaff: "Ví này không phải nhân viên soát vé của sự kiện.",
  EventNotFound: "Sự kiện không tồn tại.",
  InvalidEventParams: "Thông tin sự kiện không hợp lệ (tên trống, số vé bằng 0 hoặc thời gian đã qua).",
  ZeroAddress: "Địa chỉ ví không hợp lệ.",
});

// ------------------------------------------------------------------
// Tiện ích dùng chung
// ------------------------------------------------------------------
TC.utils = {
  shortAddr(addr) {
    return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
  },

  formatEth(wei) {
    const s = ethers.formatEther(wei);
    return `${s.endsWith(".0") ? s.slice(0, -2) : s} ETH`;
  },

  formatTime(unixSeconds) {
    return new Date(Number(unixSeconds) * 1000).toLocaleString("vi-VN", {
      hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric",
    });
  },

  escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  },

  /**
   * Tìm dữ liệu revert (0x + selector) trong lỗi. Khi gửi giao dịch, ethers v6
   * không tự giải mã custom error, và MetaMask lồng dữ liệu nhiều tầng.
   */
  findRevertData(err, depth = 0) {
    if (!err || typeof err !== "object" || depth > 5) return null;
    if (typeof err.data === "string" && /^0x[0-9a-fA-F]{8}/.test(err.data)) return err.data;
    for (const key of ["data", "error", "info", "cause"]) {
      const found = TC.utils.findRevertData(err[key], depth + 1);
      if (found) return found;
    }
    return null;
  },

  /** Đổi lỗi giao dịch thành câu tiếng Việt dễ hiểu. */
  txError(err) {
    if (!err) return "Lỗi không xác định.";
    if (err.code === "ACTION_REJECTED" || err.code === 4001 || err.info?.error?.code === 4001) {
      return "Bạn đã từ chối giao dịch trên MetaMask.";
    }
    let name = err.revert?.name;
    if (!name && TC.state?.contract) {
      const data = TC.utils.findRevertData(err);
      try {
        name = data ? TC.state.contract.interface.parseError(data)?.name : null;
      } catch {
        name = null;
      }
    }
    if (name && TC.errorMessages[name]) return TC.errorMessages[name];
    if (name) return `Contract từ chối: ${name}`;
    if (err.code === "INSUFFICIENT_FUNDS") return "Ví không đủ ETH để trả phí giao dịch.";
    return err.shortMessage || err.message || String(err);
  },

  /** Hiện trạng thái trong một phần tử: type = success | danger | warning */
  showStatus(el, type, html) {
    if (!el) return;
    el.innerHTML = html ? `<div class="status status-${type}">${html}</div>` : "";
  },
};