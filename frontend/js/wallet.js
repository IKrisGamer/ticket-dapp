/* ==================================================================
   wallet.js – A
   Kết nối MetaMask và hiển thị tài khoản đang dùng.
   ================================================================== */
(function () {
  window.TC = window.TC || {};
  TC.state = { provider: null, signer: null, account: null, chainId: null };

  const connectBtn = document.getElementById("connect-btn");
  const accountEl = document.getElementById("account-address");
  const networkBadge = document.getElementById("network-badge");

  function shortAddr(addr) {
    return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
  }

  async function connect() {
    if (!window.ethereum) {
      alert("Không tìm thấy MetaMask. Hãy cài tiện ích MetaMask rồi tải lại trang.");
      return;
    }
    connectBtn.disabled = true;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const account = await signer.getAddress();
      const chainId = Number((await provider.getNetwork()).chainId);

      Object.assign(TC.state, { provider, signer, account, chainId });

      accountEl.textContent = shortAddr(account);
      accountEl.title = account;
      networkBadge.textContent = `Chain ${chainId}`;
      networkBadge.className = "badge badge-success";
      connectBtn.textContent = "Đã kết nối";
    } catch (err) {
      console.error(err);
      alert(err.shortMessage || err.message);
    } finally {
      connectBtn.disabled = false;
    }
  }

  connectBtn.addEventListener("click", connect);
})();