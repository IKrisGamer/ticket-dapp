/* ==================================================================
   buyer.js – B
   Tab Người mua: danh sách sự kiện, mua vé, vé của tôi, QR đã ký.
   ================================================================== */
(function () {
  const { escapeHtml, formatEth, formatTime, showStatus, txError } = TC.utils;

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
  const myTickets = document.getElementById("my-tickets");

  // Ô trạng thái nằm ngoài danh sách để không bị xóa khi danh sách tải lại
  const buyStatus = document.createElement("div");
  buyStatus.id = "buy-status";
  eventList.after(buyStatus);

  // Thông điệp được ký – PHẢI giống hệt staff.js của C
  function qrMessage(ticketId, ts) {
    const { chainId, deployment } = TC.state;
    return `TicketChain:${chainId}:${deployment.address.toLowerCase()}:${ticketId}:${ts}`;
  }

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
      const disabled = !ev.saleOpen;
      const label = ev.saleOpen ? "Mua vé" : "Ngừng bán";

      return `
        <div class="event-item">
          <div>
            <div class="event-name">#${id} · ${escapeHtml(ev.name)}</div>
            <div class="small muted">${escapeHtml(ev.venue)} · ${formatTime(ev.startTime)}</div>
            <div class="small">Giá <strong>${formatEth(ev.price)}</strong> · Còn <strong>${remaining}</strong>/${ev.maxTickets} vé</div>
          </div>
          <button class="btn btn-primary" data-buy="${id}" data-price="${ev.price}" ${disabled ? "disabled" : ""}>${label}</button>
        </div>`;
    }).join("");

    eventList.querySelectorAll("[data-buy]").forEach((btn) => btn.addEventListener("click", () => buy(btn)));
  }

  async function buy(btn) {
    const status = buyStatus;
    const eventId = btn.dataset.buy;
    btn.disabled = true;
    btn.textContent = "Đang mua…";
    showStatus(status, "warning", "Đang chờ xác nhận trên MetaMask…");
    const tx = await TC.state.contract.buyTicket(eventId, { value: BigInt(btn.dataset.price) });
    showStatus(status, "warning", "Đang ghi lên blockchain…");
    await tx.wait();
    showStatus(status, "success", `Mua vé sự kiện #${eventId} thành công. Vé đã nằm trong "Vé của tôi".`);
    TC.notifyChange();
  }

  // ------------------------------------------------------------------
  // Vé của tôi
  // ------------------------------------------------------------------
  async function renderMyTickets() {
    const { contract } = TC.state;
    const ids = [...(await contract.getMyTickets())];

    if (ids.length === 0) {
      myTickets.innerHTML = `<p class="muted">Bạn chưa có vé nào.</p>`;
      return;
    }

    const rows = await Promise.all(ids.reverse().map(async (id) => {
      const info = await contract.verifyTicket(id);
      const ev = await contract.getEventInfo(info.eventId);
      return { id, info, ev };
    }));

    myTickets.innerHTML = rows.map(({ id, info, ev }) => {
      const badge = info.cancelled
        ? `<span class="badge badge-danger">Sự kiện đã hủy</span>`
        : info.used
          ? `<span class="badge badge-muted">Đã sử dụng</span>`
          : `<span class="badge badge-success">Chưa sử dụng</span>`;
      const canShow = !info.used && !info.cancelled;
      return `
        <div class="ticket-item">
          <div>
            <div class="event-name">Vé #${id} · ${escapeHtml(ev.name)}</div>
            <div class="small muted">${escapeHtml(ev.venue)} · ${formatTime(ev.startTime)}</div>
            <div>${badge}</div>
          </div>
          ${canShow ? `<button class="btn" data-qr="${id}" data-event="${info.eventId}">Hiện QR</button>` : ""}
        </div>`;
    }).join("") + `
      <div id="qr-panel" class="qr-panel" hidden>
        <div id="qr-code" class="qr-box"></div>
        <div id="qr-info" class="small"></div>
        <details class="small">
          <summary>Nội dung QR (dán thủ công khi camera lỗi)</summary>
          <textarea id="qr-text" readonly rows="3"></textarea>
        </details>
        <button class="btn" id="qr-close">Đóng QR</button>
      </div>
      <div id="qr-status"></div>`;

    myTickets.querySelectorAll("[data-qr]").forEach((btn) =>
      btn.addEventListener("click", () => openQr(btn.dataset.qr, btn.dataset.event))
    );
    document.getElementById("qr-close").addEventListener("click", closeQr);

    // Giữ QR đang mở sau khi danh sách được vẽ lại
    if (activeQr && ids.map(String).includes(String(activeQr.ticketId))) {
      drawQr();
    } else {
      closeQr();
    }
  }

  // ------------------------------------------------------------------
  // QR đã ký: chứng minh người cầm QR đang giữ ví chủ vé.
  // QR chỉ có hiệu lực trong TC.config.qrTtlSeconds giây, nên ảnh chụp
  // màn hình QR cũ sẽ bị nhân viên soát vé từ chối.
  // ------------------------------------------------------------------
  let activeQr = null;   // { ticketId, eventId, ts, sig }
  let timer = null;
  let signing = false;

  async function signTicket(ticketId, eventId) {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await TC.state.signer.signMessage(qrMessage(ticketId, ts));
    activeQr = { ticketId: String(ticketId), eventId: String(eventId), ts, sig };
  }

  async function openQr(ticketId, eventId) {
    const status = document.getElementById("qr-status");
    try {
      showStatus(status, "warning", "Ký xác nhận trên MetaMask để tạo QR (không tốn phí).");
      await signTicket(ticketId, eventId);
      showStatus(status, "", "");
      drawQr();
      startTimer();
    } catch (err) {
      console.error(err);
      showStatus(status, "danger", escapeHtml(txError(err)));
    }
  }

  function drawQr() {
    const panel = document.getElementById("qr-panel");
    const box = document.getElementById("qr-code");
    if (!panel || !activeQr) return;

    const payload = JSON.stringify({ v: 1, t: activeQr.ticketId, e: activeQr.eventId, ts: activeQr.ts, s: activeQr.sig });
    box.innerHTML = "";
    new QRCode(box, { text: payload, width: 240, height: 240, correctLevel: QRCode.CorrectLevel.M });
    document.getElementById("qr-text").value = payload;
    panel.hidden = false;
    updateCountdown();
  }

  function updateCountdown() {
    const info = document.getElementById("qr-info");
    if (!info || !activeQr) return;
    const left = activeQr.ts + TC.config.qrTtlSeconds - Math.floor(Date.now() / 1000);
    info.innerHTML = `Vé <strong>#${activeQr.ticketId}</strong> · QR còn hiệu lực <strong>${Math.max(left, 0)}s</strong>, sau đó tự làm mới.`;
    return left;
  }

  function startTimer() {
    clearInterval(timer);
    timer = setInterval(async () => {
      const left = updateCountdown();
      if (left === undefined) return closeQr();
      if (left > 0 || signing) return;

      // Hết hạn: ký lại để có QR mới
      signing = true;
      try {
        await signTicket(activeQr.ticketId, activeQr.eventId);
        drawQr();
      } catch (err) {
        // Người dùng từ chối ký lại -> đóng QR
        closeQr();
        showStatus(document.getElementById("qr-status"), "warning", "QR đã hết hạn. Bấm “Hiện QR” để tạo lại.");
      } finally {
        signing = false;
      }
    }, 1000);
  }

  function closeQr() {
    clearInterval(timer);
    timer = null;
    activeQr = null;
    const panel = document.getElementById("qr-panel");
    if (panel) panel.hidden = true;
  }

  // ------------------------------------------------------------------
  async function render() {
    if (!TC.state.contract) {
      closeQr();
      eventList.innerHTML = `<p class="muted">Kết nối ví để xem sự kiện đang mở bán.</p>`;
      myTickets.innerHTML = `<p class="muted">Kết nối ví để xem vé của bạn.</p>`;
      return;
    }
    await Promise.all([renderEvents(), renderMyTickets()]);
  }

  TC.onRefresh(() => render().catch(console.error));
  render().catch(console.error);
})();
