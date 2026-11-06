/* ==================================================================
   buyer.js – B
   Tab Người mua: danh sách sự kiện, mua vé, vé của tôi, QR đã ký.
   ================================================================== */
(function () {
  const { escapeHtml, formatEth, formatTime } = TC.utils;

  // ABI – TicketSale (B)
  TC.abi.push(
    "function MAX_PER_WALLET() view returns (uint8)",
    "function ticketCount() view returns (uint256)",
    "function tickets(uint256) view returns (uint256 eventId, address owner, uint64 purchasedAt)",
    "function purchasedCount(uint256, address) view returns (uint8)",
    "function buyTicket(uint256 eventId) payable returns (uint256)",
    "function getMyTickets() view returns (uint256[])",
    "function getTicketsOf(address account) view returns (uint256[])",
    "function verifyTicket(uint256 ticketId) view returns (bool exists, bool used, bool cancelled, uint256 eventId, address owner)",
    "event TicketPurchased(uint256 indexed ticketId, uint256 indexed eventId, address indexed buyer, uint256 price)",
    "error SaleClosed(uint256 eventId)",
    "error IncorrectPayment(uint256 expected, uint256 received)",
    "error SoldOut(uint256 eventId)",
    "error WalletLimitReached(uint256 eventId, address buyer)",
    "error TransferNotAllowed()"
  );

  Object.assign(TC.errorMessages, {
    SaleClosed: "Sự kiện đang tạm dừng bán vé.",
    IncorrectPayment: "Số ETH gửi không đúng giá vé.",
    SoldOut: "Sự kiện đã hết vé.",
    WalletLimitReached: "Mỗi ví chỉ được mua tối đa 2 vé cho một sự kiện.",
    TransferNotAllowed: "Vé gắn với ví người mua, không chuyển nhượng được.",
  });

  const eventList = document.getElementById("event-list");

  // ------------------------------------------------------------------
  // Danh sách sự kiện
  // ------------------------------------------------------------------
  async function renderEvents() {
    const { contract } = TC.state;
    const count = Number(await contract.eventCount());

    if (count === 0) {
      eventList.innerHTML = `<p class="muted">Chưa có sự kiện nào.</p>`;
      return;
    }

    const items = [];
    for (let id = count; id >= 1; id--) {
      const ev = await contract.getEventInfo(id);
      items.push({ id, ev });
    }

    eventList.innerHTML = items.map(({ id, ev }) => {
      const remaining = Number(ev.maxTickets) - Number(ev.ticketsSold);
      const label = ev.saleOpen ? "Đang bán" : "Ngừng bán";

      return `
        <div class="event-item">
          <div>
            <div class="event-name">#${id} · ${escapeHtml(ev.name)}</div>
            <div class="small muted">${escapeHtml(ev.venue)} · ${formatTime(ev.startTime)}</div>
            <div class="small">Giá <strong>${formatEth(ev.price)}</strong> · Còn <strong>${remaining}</strong>/${ev.maxTickets} vé</div>
          </div>
          <span class="badge ${ev.saleOpen ? "badge-success" : "badge-muted"}">${label}</span>
        </div>`;
    }).join("");
  }

  // ------------------------------------------------------------------
  async function render() {
    if (!TC.state.contract) {
      eventList.innerHTML = `<p class="muted">Kết nối ví để xem sự kiện đang mở bán.</p>`;
      return;
    }
    await renderEvents();
  }

  TC.onRefresh(() => render().catch(console.error));
  render().catch(console.error);
})();
