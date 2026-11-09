/*
staff.js - C
Tab Soát vé: quét QR, xác minh chữ ký + chủ vé + thời hạn, gọi
checkIn, lịch sử soát vé theo thời gian thực, tra cứu vé công khai.
*/
(function () {
    const { escapeHtml, shortAddr, formatTime, txError, showStatus } = TC.utils;

    // ABI - TicketCheckIn (C)
    TC.abi.push(
        "function checkIn(uint256 eventId, uint256 ticketId)",
        "function verifyTicket(uint256 ticketId) view returns (bool exists, bool used, bool cancelled, uint256 eventId, address owner)",
        "function isUsed(uint256) view returns (bool)",
        "function usedAt(uint256) view returns (uint256)",
        "function checkInCount(uint256) view returns (uint256)",
        "function isCancelled(uint256) view returns (bool)",
        "event TicketUsed(uint256 indexed ticketId, uint256 indexed eventId, address indexed staff, uint256 timestamp)",
        "error TicketNotFound(uint256 ticketId)",
        "error TicketAlreadyUsed(uint256 ticketId)",
        "error WrongEvent(uint256 ticketId, uint256 eventId)",
        "error EventIsCancelled(uint256 eventId)",
    );

    Object.assign(TC.errorMessages, {
        TicketNotFound: "Vé giả: mã vé không tồn tại trên blockchain.",
        TicketAlreadyUsed: "Vé đã được sử dụng.",
        WrongEvent: "Vé không thuộc sự kiện này.",
        EventIsCancelled: "Sự kiện đã bị hủy.",
    });

    // Cho phép đồng hồ điện thoại người mua lệch tối đa 30 giây
    const CLOCK_SKEW = 30;

    const scannerArea = document.getElementById("scanner-area");
    const resultEl = document.getElementById("scan-result");
    const logEl = document.getElementById("checkin-log");
    const lookupArea = document.getElementById("lookup-area");

    scannerArea.innerHTML = `
        <label class="field">Sự kiện đang soát
            <select id="staff-event"></select>
        </label>
        <div class="row">
            <button class="btn btn-primary" id="scan-start">Bật camera</button>
            <button class="btn" id="scan-stop" disabled>Tắt camera</button>
        </div>
        <div id="qr-reader" class="scanner-box"></div>
        <details class="small">
            <summary>Dán nội dung QR thủ công (khi camera lỗi)</summary>
            <textarea id="manual-qr" rows="3" placeholder='{"v":1,"t":"1","e":"1","ts":...,"s":"0x..."}'></textarea>
            <button class="btn" id="manual-check">Kiểm tra</button>
        </details>
        `;

    const eventSelect = document.getElementById("staff-event");
    const startBtn = document.getElementById("scan-start");
    const stopBtn = document.getElementById("scan-stop");

    function showResult(level, html) {
        resultEl.innerHTML = `<div class="result result-${level}">${html}</div>`;
    }

    //Xử lí mã QR quét được
    let busy = false;
    const acceptedQr = new Set(); // QR đã cho vào thành công
    async function handleScan(text) {
        if (busy) return;
        const { contract, chainId, deployment } = TC.state;
        if (!contract) return showResult("warning", "Hãy kết nối ví nhân viên trước.");

        const eventId = eventSelect.value;
        if (!eventId) return showResult("warning", "Ví của bạn không phải nhân viên soát vé của sự kiện nào.");

        //1. đọc QR
        // 1. Đọc nội dung QR
        let data;
        try {
            data = JSON.parse(String(text).trim());
        } catch {
            return showResult("danger", "Mã QR không đúng định dạng của TicketChain.");
        }
        const ticketId = String(data?.t ?? "");
        const ts = Number(data?.ts);
        if (!/^\d+$/.test(ticketId) || !/^\d+$/.test(String(data?.e ?? "")) || !Number.isInteger(ts) ||
            typeof data?.s !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(data.s)) {
            return showResult("danger", "Mã QR thiếu thông tin hoặc đã bị sửa.");
        }

        busy = true;
        try {
            showResult("pending", "Đang kiểm tra vé trên blockchain...");

            //2. Đổi chiều dữ liệu trên chuỗi
            const info = await contract.verifyTicket(ticketId);
            if (!info.exists) return showResult("danger", `Vé giả: mã vé ${ticketId} không tồn tại trên blockchain.`);
            if (String(info.eventId) !== String(eventId) || String(data.e) !== String(eventId)) {
                return showResult("danger", `Vé #${ticketId} không thuộc sự kiện này.`);
            }
            if (info.cancelled) return showResult("danger", "Sự kiện đã bị hủy, vé không còn giá trị.");
            if (info.used) {
                const at = await contract.usedAt(ticketId);
                return showResult("danger", `Vé #${ticketId} đã được dùng lúc ${formatTime(at)}.`);
            }

            //3. chữ ký phải là của chủ vé (thông điệp giống hệt buyer.js)
            const message = `TicketChain:${chainId}:${deployment.address.toLowerCase()}:${ticketId}:${ts}`;
            let signer = "";
            try {
                signer = ethers.verifyMessage(message, data.s);
            } catch {
                signer = "";
            }
            if (signer.toLowerCase() !== info.owner.toLowerCase()) {
                return showResult("danger", "Chữ ký không khớp chủ vé: QR bị chụp lại hoặc làm giả.");
            }

            //4. QR còn hạn
            const now = Math.floor(Date.now() / 1000);
            if (ts > now + CLOCK_SKEW) return showResult("warning", "Thời gian trên QR không hợp lệ.");
            if (now - ts > TC.config.qrTtlSeconds) {
                return showResult("warning", `QR đã hết hạn (${now - ts}s trước). Nhờ khách mở lại vé để có QR mới.`);
            }

            // 5. Ghi "đã dùng" lên blockchain
            showResult("pending", `Vé #${ticketId} hợp lệ. Xác nhận giao dịch trên MetaMask để cho vào..`);
            const tx = await contract.checkIn(eventId, ticketId);
            showResult("pending", "Đang ghi trạng thái đã dùng lên blockchain...");
            await tx.wait();
            acceptedQr.add(text);

            showResult("success", `Vé hợp lệ - mời vào<br><span class="small"> Vé #${ticketId} - chủ vé ${shortAddr(info.owner)}</span>`);
            TC.notifyChange();

        } catch (err) {
            console.error(err);
            showResult("danger", escapeHtml(txError(err)));
        } finally {
            busy = false;
        }
    }

    //Camera
    let scanner = null;
    let lastText = "";
    let lastAt = 0;
    startBtn.addEventListener("click", async () => {
        try {
            scanner = scanner || new Html5Qrcode("qr-reader");
            await scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 240, height: 240 } },
                (text) => {
                    // bỏ qua một mã quét liên tục trong 3 giây
                    const now = Date.now();
                    if (acceptedQr.has(text)) return;
                    if (text === lastText && now - lastAt < 5000) return;
                    lastText = text;
                    lastAt = now;
                    handleScan(text);
                }
            );
            startBtn.disabled = true;
            stopBtn.disabled = false;
        } catch (err) {
            console.error(err);
            showResult("warning", "không mở được camera. Kiểm tra quyền camera (trang phải chạy trên https hoặc localhost) hoặc dán nội dung QR thủ công.");
        }
    });

    stopBtn.addEventListener("click", async () => {
        if (scanner?.isScanning) await scanner.stop();
        startBtn.disabled = false;
        stopBtn.disabled = true;
    });

    document.getElementById("manual-check").addEventListener("click", () => {
        handleScan(document.getElementById("manual-qr").value);
    });

    // Danh sách sự kiện mà ví này được soát

    async function renderEventSelect() {
        const { contract, account } = TC.state;
        const previous = eventSelect.value;
        const count = Number(await contract.eventCount());
        const options = [];
        for (let id = 1; id <= count; id++) {
            if (!(await contract.isStaff(id, account))) continue;
            const ev = await contract.getEventInfo(id);
            options.push(`<option value="${id}">#${id} – ${escapeHtml(ev.name)}</option>`);
        }
        eventSelect.innerHTML = options.join("");
        if (previous && [...eventSelect.options].some((o) => o.value === previous)) eventSelect.value = previous;
        startBtn.disabled = options.length === 0 || scanner?.isScanning;
        if (options.length === 0) {
            showResult("warning", "Ví này không phải nhân viên soát vé của sự kiện nào.");
        } else if (resultEl.textContent.includes("không phải nhân viên")) {
            resultEl.innerHTML = "";
        }
    }

    // Lịch sử soát vé – đọc event TicketUsed, cập nhật mỗi block mới

    let logs = [];
    let lastBlock = null;
    let watching = null;

    function renderLog() {
        const eventId = eventSelect.value;
        const rows = logs.filter((l) => !eventId || l.eventId === eventId).slice(0, 50);
        logEl.innerHTML = rows.length === 0
            ? `<p class="muted">Chưa có vé nào được soát${eventId ? " cho sự kiện này" : ""}.</p>`
            : `<div class="table-wrap"><table class="table">
            <thead><tr><th>Giờ</th><th>Vé</th><th>Sự kiện</th><th>Nhân viên</th></tr></thead>
            <tbody>${rows.map((l) => `
            <tr class="${l.fresh ? "row-new" : ""}">
                <td class="small">${formatTime(l.timestamp)}</td>
                <td>#${l.ticketId}</td><td>#${l.eventId}</td>
                <td class="mono small">${shortAddr(l.staff)}</td>
            </tr>`).join("")}</tbody></table></div>`;
    }

    async function loadLogs(fromBlock, toBlock, fresh) {
        const { contract } = TC.state;
        const events = await contract.queryFilter(contract.filters.TicketUsed(), fromBlock, toBlock);
        const items = events.map((e) => ({
            ticketId: String(e.args.ticketId),
            eventId: String(e.args.eventId),
            staff: e.args.staff,
            timestamp: e.args.timestamp,
            fresh,
            key: `${e.transactionHash}:${e.index}`,
        }));
        const known = new Set(logs.map((l) => l.key));
        logs = [...items.filter((i) => !known.has(i.key)).reverse(), ...logs];
    }
    async function startLog() {
        const { provider, deployment } = TC.state;
        if (watching) watching.provider.off("block", watching.handler);
        logs = [];
        lastBlock = await provider.getBlockNumber();
        await loadLogs(deployment.deployBlock || 0, lastBlock, false);
        renderLog();

        const handler = async (blockNumber) => {
            if (blockNumber <= lastBlock) return;
            const from = lastBlock + 1;
            lastBlock = blockNumber;
            try {
                logs.forEach((l) => (l.fresh = false));
                await loadLogs(from, blockNumber, true);
                renderLog();
            } catch (err) {
                console.error(err);
            }
        };
        provider.on("block", handler);
        watching = { provider, handler };
    }

    eventSelect.addEventListener("change", renderLog);

    // Tra cứu vé công khai – ai cũng dùng được, không tốn gas
    lookupArea.innerHTML = `
        <p class="small muted">Nhập mã vé để kiểm tra vé thật hay giả, đã dùng hay chưa. Không cần quyền nhân viên.</p>
        <form id="lookup-form" class="row">
            <input type="number" id="lookup-id" min="1" step="1" placeholder="Mã vé, ví dụ 1" required>
            <button class="btn btn-primary" type="submit">Kiểm tra</button>
        </form>
        <div id="lookup-result"></div>
  `;

    document.getElementById("lookup-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const out = document.getElementById("lookup-result");
        const { contract } = TC.state;
        if (!contract) return showStatus(out, "warning", "Hãy kết nối ví để tra cứu.");

        const id = document.getElementById("lookup-id").value;
        try {
            const info = await contract.verifyTicket(id);
            if (!info.exists) {
                return showStatus(out, "danger", `Vé #${escapeHtml(id)} <strong>không tồn tại</strong> trên blockchain – vé giả.`);
            }
            const ev = await contract.getEventInfo(info.eventId);
            const state = info.cancelled
                ? ["danger", "Sự kiện đã bị hủy"]
                : info.used
                    ? ["warning", `Đã sử dụng lúc ${formatTime(await contract.usedAt(id))}`]
                    : ["success", "Hợp lệ – chưa sử dụng"];
            showStatus(out, state[0], `
        Vé #${escapeHtml(id)} · ${escapeHtml(ev.name)}<br>
        <span class="small">Chủ vé: <span class="mono">${shortAddr(info.owner)}</span></span><br>
        ${state[1]}`);
        } catch (err) {
            console.error(err);
            showStatus(out, "danger", escapeHtml(txError(err)));
        }
    });
    //
    async function render(e) {
        if (!TC.state.contract) {
            eventSelect.innerHTML = "";
            logEl.innerHTML = `<p class="muted">Kết nối ví để xem lịch sử soát vé.</p>`;
            return;
        }
        await renderEventSelect();
        if (e?.type === "tc:ready") await startLog();
        else renderLog();
    }

    TC.onRefresh((e) => render(e).catch(console.error));
    render().catch(console.error);
})();