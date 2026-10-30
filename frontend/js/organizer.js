/* ==================================================================
   organizer.js – A
   Tab Ban tổ chức: tạo sự kiện, quản lý nhân viên soát vé, thống kê.
   ================================================================== */
(function () {
  const { escapeHtml, formatEth, formatTime, showStatus, txError } = TC.utils;

  // Đọc thêm số vé đã soát và trạng thái hủy từ phần C để làm thống kê
  TC.abi.push(
    "function checkInCount(uint256) view returns (uint256)",
    "function isCancelled(uint256) view returns (bool)"
  );

  const createArea = document.getElementById("create-event-area");
  const staffArea = document.getElementById("staff-area");
  const statsArea = document.getElementById("stats-area");

  // ------------------------------------------------------------------
  // Form tạo sự kiện
  // ------------------------------------------------------------------
  createArea.innerHTML = `
    <form id="create-event-form" class="form-grid">
      <label class="field">Tên sự kiện
        <input type="text" name="name" required maxlength="80" placeholder="Đêm nhạc Mùa Thu">
      </label>
      <label class="field">Địa điểm
        <input type="text" name="venue" required maxlength="80" placeholder="Nhà hát Lớn Hà Nội">
      </label>
      <label class="field">Thời gian bắt đầu
        <input type="datetime-local" name="start" required>
      </label>
      <label class="field">Giá vé (ETH)
        <input type="number" name="price" required min="0" step="0.0001" value="0.001">
      </label>
      <label class="field">Số vé tối đa
        <input type="number" name="max" required min="1" max="100000" step="1" value="100">
      </label>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Tạo sự kiện</button>
      </div>
    </form>
    <div id="create-event-status"></div>
  `;

  const form = document.getElementById("create-event-form");
  const createStatus = document.getElementById("create-event-status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { contract } = TC.state;
    if (!contract) return showStatus(createStatus, "warning", "Hãy kết nối ví trước.");

    const data = new FormData(form);
    const startTime = Math.floor(new Date(data.get("start")).getTime() / 1000);
    const btn = form.querySelector("button");
    btn.disabled = true;

    try {
      showStatus(createStatus, "warning", "Đang chờ xác nhận trên MetaMask…");
      const tx = await contract.createEvent(
        data.get("name").trim(),
        data.get("venue").trim(),
        startTime,
        ethers.parseEther(String(data.get("price"))),
        Number(data.get("max"))
      );
      showStatus(createStatus, "warning", "Đang ghi lên blockchain…");
      await tx.wait();
      showStatus(createStatus, "success", "Đã tạo sự kiện.");
      form.reset();
      TC.notifyChange();
    } catch (err) {
      console.error(err);
      showStatus(createStatus, "danger", escapeHtml(txError(err)));
    } finally {
      btn.disabled = false;
    }
  });

  // ------------------------------------------------------------------
  // Quản lý nhân viên soát vé
  // ------------------------------------------------------------------
  staffArea.innerHTML = `
    <form id="staff-form" class="form-grid">
      <label class="field">Sự kiện
        <select name="eventId" id="staff-event-select" required></select>
      </label>
      <label class="field">Địa chỉ ví nhân viên
        <input type="text" name="staff" required placeholder="0x…" pattern="^0x[0-9a-fA-F]{40}$">
      </label>
      <div class="form-actions">
        <button type="submit" name="action" value="grant" class="btn btn-primary">Cấp quyền</button>
        <button type="submit" name="action" value="revoke" class="btn">Thu hồi</button>
        <button type="button" id="staff-check-btn" class="btn">Kiểm tra</button>
      </div>
    </form>
    <div id="staff-status"></div>
  `;

  const staffForm = document.getElementById("staff-form");
  const staffSelect = document.getElementById("staff-event-select");
  const staffStatus = document.getElementById("staff-status");

  staffForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { contract } = TC.state;
    if (!contract) return showStatus(staffStatus, "warning", "Hãy kết nối ví trước.");

    const allow = e.submitter?.value !== "revoke";
    const eventId = staffSelect.value;
    const staff = staffForm.staff.value.trim();
    if (!ethers.isAddress(staff)) return showStatus(staffStatus, "danger", "Địa chỉ ví không hợp lệ.");

    const buttons = staffForm.querySelectorAll("button");
    buttons.forEach((b) => (b.disabled = true));
    try {
      showStatus(staffStatus, "warning", "Đang chờ xác nhận trên MetaMask…");
      const tx = await contract.setStaff(eventId, staff, allow);
      await tx.wait();
      showStatus(staffStatus, "success",
        `${allow ? "Đã cấp" : "Đã thu hồi"} quyền soát vé sự kiện #${eventId} cho ${TC.utils.shortAddr(staff)}.`);
      TC.notifyChange();
    } catch (err) {
      console.error(err);
      showStatus(staffStatus, "danger", escapeHtml(txError(err)));
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  });

  document.getElementById("staff-check-btn").addEventListener("click", async () => {
    const { contract } = TC.state;
    const staff = staffForm.staff.value.trim();
    if (!contract || !staffSelect.value || !ethers.isAddress(staff)) {
      return showStatus(staffStatus, "warning", "Chọn sự kiện và nhập địa chỉ ví hợp lệ.");
    }
    const ok = await contract.isStaff(staffSelect.value, staff);
    showStatus(staffStatus, ok ? "success" : "warning",
      ok ? "Ví này đang có quyền soát vé." : "Ví này chưa có quyền soát vé.");
  });

  // ------------------------------------------------------------------
  // Thống kê các sự kiện của ví đang kết nối
  // ------------------------------------------------------------------
  async function loadMyEvents() {
    const { contract, account } = TC.state;
    const count = Number(await contract.eventCount());
    const list = [];
    for (let id = 1; id <= count; id++) {
      const ev = await contract.getEventInfo(id);
      if (ev.organizer.toLowerCase() !== account.toLowerCase()) continue;
      const [used, cancelled] = await Promise.all([contract.checkInCount(id), contract.isCancelled(id)]);
      list.push({ id, ev, used, cancelled });
    }
    return list;
  }

  async function render() {
    const { contract, account } = TC.state;
    if (!contract) {
      statsArea.innerHTML = `<p class="muted">Kết nối ví để xem sự kiện của bạn.</p>`;
      staffSelect.innerHTML = "";
      return;
    }

    const isOrganizer = await contract.isOrganizer(account);
    form.querySelector("button").disabled = !isOrganizer;
    if (!isOrganizer) {
      showStatus(createStatus, "warning", "Ví này chưa được cấp quyền ban tổ chức nên chưa tạo được sự kiện.");
    } else if (createStatus.textContent.includes("chưa được cấp quyền")) {
      showStatus(createStatus, "", "");
    }

    const events = await loadMyEvents();
    staffSelect.innerHTML = events
      .map(({ id, ev }) => `<option value="${id}">#${id} – ${escapeHtml(ev.name)}</option>`)
      .join("");

    if (events.length === 0) {
      statsArea.innerHTML = `<p class="muted">Bạn chưa tạo sự kiện nào.</p>`;
      return;
    }

    statsArea.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>#</th><th>Sự kiện</th><th>Bắt đầu</th><th>Giá</th><th>Đã bán</th><th>Đã soát</th><th>Trạng thái</th><th></th></tr>
          </thead>
          <tbody>
            ${events.map(({ id, ev, used, cancelled }) => `
              <tr>
                <td>${id}</td>
                <td><strong>${escapeHtml(ev.name)}</strong><br><span class="small muted">${escapeHtml(ev.venue)}</span></td>
                <td class="small">${formatTime(ev.startTime)}</td>
                <td>${formatEth(ev.price)}</td>
                <td>${ev.ticketsSold} / ${ev.maxTickets}</td>
                <td>${used}</td>
                <td>${cancelled
                  ? `<span class="badge badge-danger">Đã hủy</span>`
                  : ev.saleOpen
                    ? `<span class="badge badge-success">Đang bán</span>`
                    : `<span class="badge badge-muted">Tạm dừng</span>`}</td>
                <td>${cancelled ? "" : `<button class="btn btn-sm" data-toggle="${id}">${ev.saleOpen ? "Dừng bán" : "Mở bán"}</button>`}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div id="stats-status"></div>
    `;

    statsArea.querySelectorAll("[data-toggle]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const status = document.getElementById("stats-status");
        btn.disabled = true;
        try {
          const tx = await TC.state.contract.toggleSale(btn.dataset.toggle);
          await tx.wait();
          TC.notifyChange();
        } catch (err) {
          console.error(err);
          showStatus(status, "danger", escapeHtml(txError(err)));
          btn.disabled = false;
        }
      })
    );
  }

  TC.onRefresh(() => render().catch(console.error));
  render().catch(console.error);
})();