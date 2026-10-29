/* ==================================================================
   organizer.js – A
   Tab Ban tổ chức: tạo sự kiện.
   ================================================================== */
(function () {
  const { escapeHtml, showStatus, txError } = TC.utils;

  const createArea = document.getElementById("create-event-area");

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
})();