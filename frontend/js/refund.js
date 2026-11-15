/*
refund.js – C
   Hủy sự kiện, rút doanh thu (gắn vào #cancel-area ở tab Ban tổ chức)
   và nhận hoàn tiền (gắn vào #refund-area ở tab Người mua).
   File này không sửa HTML của A và B, chỉ vẽ vào hai vùng được chừa sẵn.
 */
(function () {
    const { escapeHtml, formatEth, showStatus, txError } = TC.utils;

    TC.abi.push(
        "function cancelEvent(uint256 eventId)",
        "function claimRefund(uint256 ticketId)",
        "function withdrawRevenue(uint256 eventId)",
        "function isRefunded(uint256) view returns (bool)",
        "function withdrawnAmount(uint256) view returns (uint256)",
        "function checkInCount(uint256) view returns (uint256)",
        "function isCancelled(uint256) view returns (bool)",
        "function getMyTickets() view returns (uint256[])",
        "function verifyTicket(uint256 ticketId) view returns (bool exists, bool used, bool cancelled, uint256 eventId, address owner)",
        "error EventNotCancelled(uint256 eventId)",
        "error EventHasCheckIns(uint256 eventId)",
        "error AlreadyRefunded(uint256 ticketId)",
        "error NotTicketOwner(uint256 ticketId)",
        "error RefundFailed(uint256 ticketId)",
        "error WithdrawNotAllowed(uint256 eventId)",
        "error NothingToWithdraw(uint256 eventId)",
        "error WithdrawFailed(uint256 eventId)"
    );

    Object.assign(TC.errorMessages, {
        EventNotCancelled: "Sự kiện chưa bị hủy nên chưa thể hoàn tiền.",
        EventHasCheckIns: "Sự kiện đã có vé được soát nên không thể hủy.",
        AlreadyRefunded: "Vé này đã được hoàn tiền.",
        NotTicketOwner: "Bạn không phải chủ của vé này.",
        RefundFailed: "Chuyển tiền hoàn thất bại.",
        WithdrawNotAllowed: "Chỉ rút doanh thu được sau khi sự kiện bắt đầu soát vé.",
        NothingToWithdraw: "Không còn doanh thu mới để rút.",
        WithdrawFailed: "Chuyển doanh thu thất bại.",
    });

    // Mỗi vùng gồm phần nội dung (vẽ lại khi dữ liệu đổi) và ô trạng thái (giữ nguyên)

    document.getElementById("cancel-area").innerHTML = `<div id="cancel-content"></div><div id="cancel-status"></div>`;
    document.getElementById("refund-area").innerHTML = `<div id="refund-content"></div><div id="refund-status"></div>`;
    const cancelArea = document.getElementById("cancel-content");
    const refundArea = document.getElementById("refund-content");

    async function runTx(btn, statusEl, send, successText) {
        btn.disabled = true;
        try {
            showStatus(statusEl, "warning", "Đang chờ xác nhận trên MetaMask…");
            const tx = await send();
            showStatus(statusEl, "warning", "Đang ghi lên blockchain…");
            await tx.wait();
            showStatus(statusEl, "success", successText);
            TC.notifyChange();
        } catch (err) {
            console.error(err);
            showStatus(statusEl, "danger", escapeHtml(txError(err)));
            btn.disabled = false;
        }
    }

    // Tab Ban tổ chức: hủy sự kiện, rút doanh thu

    async function renderCancelArea() {
        const { contract, account } = TC.state;
        const count = Number(await contract.eventCount());
        const rows = [];

        for (let id = 1; id <= count; id++) {
            const ev = await contract.getEventInfo(id);
            if (ev.organizer.toLowerCase() !== account.toLowerCase()) continue;
            const [cancelled, used, withdrawn] = await Promise.all([
                contract.isCancelled(id), contract.checkInCount(id), contract.withdrawnAmount(id),
            ]);
            const available = ev.price * ev.ticketsSold - withdrawn;
            rows.push({ id, ev, cancelled, used, available });
        }

        if (rows.length === 0) { cancelArea.innerHTML = ""; return; }

        cancelArea.innerHTML = `
      <div class="card">
        <h3>Hủy sự kiện &amp; doanh thu</h3>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>#</th><th>Sự kiện</th><th>Đã soát</th><th>Doanh thu chưa rút</th><th></th></tr></thead>
          <tbody>${rows.map(({ id, ev, cancelled, used, available }) => `
            <tr>
              <td>${id}</td>
              <td>${escapeHtml(ev.name)}</td>
              <td>${used}</td>
              <td>${cancelled ? `<span class="badge badge-danger">Đã hủy</span>` : formatEth(available)}</td>
              <td class="row">
                ${!cancelled && used === 0n ? `<button class="btn btn-danger btn-sm" data-cancel="${id}">Hủy sự kiện</button>` : ""}
                ${!cancelled && used > 0n && available > 0n ? `<button class="btn btn-primary btn-sm" data-withdraw="${id}">Rút doanh thu</button>` : ""}
              </td>
            </tr>`).join("")}</tbody>
        </table></div>
      </div>`;

        const status = document.getElementById("cancel-status");

        cancelArea.querySelectorAll("[data-cancel]").forEach((btn) =>
            btn.addEventListener("click", () => {
                const id = btn.dataset.cancel;
                if (!confirm(`Hủy sự kiện #${id}? Việc này không thể hoàn tác và người mua sẽ được hoàn tiền.`)) return;
                runTx(btn, status, () => TC.state.contract.cancelEvent(id), `Đã hủy sự kiện #${id}.`);
            })
        );
        cancelArea.querySelectorAll("[data-withdraw]").forEach((btn) =>
            btn.addEventListener("click", () => {
                const id = btn.dataset.withdraw;
                runTx(btn, status, () => TC.state.contract.withdrawRevenue(id), `Đã rút doanh thu sự kiện #${id}.`);
            })
        );
    }

    // Tab Người mua: nhận hoàn tiền cho vé của sự kiện đã hủy

    async function renderRefundArea() {
        const { contract } = TC.state;
        const ids = [...(await contract.getMyTickets())];
        const rows = [];

        for (const id of ids) {
            const info = await contract.verifyTicket(id);
            if (!info.cancelled) continue;
            const [ev, refunded] = await Promise.all([contract.getEventInfo(info.eventId), contract.isRefunded(id)]);
            rows.push({ id, ev, refunded });
        }

        if (rows.length === 0) { refundArea.innerHTML = ""; return; }

        refundArea.innerHTML = `
      <div class="card">
        <h3>Hoàn tiền</h3>
        <p class="small muted">Các vé dưới đây thuộc sự kiện đã bị hủy. Bấm để nhận lại tiền vào ví.</p>
        ${rows.map(({ id, ev, refunded }) => `
          <div class="ticket-item">
            <div>
              <div class="event-name">Vé #${id} · ${escapeHtml(ev.name)}</div>
              <div class="small">Số tiền hoàn: <strong>${formatEth(ev.price)}</strong></div>
            </div>
            ${refunded
                ? `<span class="badge badge-success">Đã hoàn</span>`
                : `<button class="btn btn-primary" data-refund="${id}">Nhận hoàn tiền</button>`}
          </div>`).join("")}
      </div>`;

        const status = document.getElementById("refund-status");
        refundArea.querySelectorAll("[data-refund]").forEach((btn) =>
            btn.addEventListener("click", () => {
                const id = btn.dataset.refund;
                runTx(btn, status, () => TC.state.contract.claimRefund(id), `Đã hoàn tiền vé #${id}.`);
            })
        );
    }

    async function render() {
        if (!TC.state.contract) {
            cancelArea.innerHTML = "";
            refundArea.innerHTML = "";
            return;
        }
        await Promise.all([renderCancelArea(), renderRefundArea()]);
    }

    TC.onRefresh(() => render().catch(console.error));
})();