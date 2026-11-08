/*
staff.js - C
Tab Soát vé: quét QR, xác minh chữ ký + chủ vé + thời hạn, gọi
checkIn, lịch sử soát vé theo thời gian thực, tra cứu vé công khai.
*/
(function () {
    const { escapeHtml } = TC.utils;

    // ABI - TicketCheckIn (C)
    TC.abi.push(
        "function checkIn(uint256 eventId, uint256 ticketId)",
        "function verifyTicket(uint256 ticketId) view returns (bool exits, bool used, bool cancelled, uint256 eventId, address owner)",
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

    const scannerArea = document.getElementById("scanner-area");
    const resultEl = document.getElementById("scan-result");

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
    function handleScan(text) {
        showResult("pending", `Đã đọc mã QR:<br><span class="small mono">${escapeHtml(text)}</span>`);
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
                    if (text === lastText && now - lastAt < 3000) return;
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

    //
    async function render() {
        if (!TC.state.contract) {
            eventSelect.innerHTML = "";
            return;
        }
        await renderEventSelect();
    }

    TC.onRefresh(() => render().catch(console.error));
    render().catch(console.error);
})();