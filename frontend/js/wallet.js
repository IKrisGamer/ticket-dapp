/* ==================================================================
   wallet.js – A
   Kết nối MetaMask, tự chuyển sang mạng Sepolia, hiển thị tài khoản.
   ================================================================== */
(function () {
  window.TC = window.TC || {};
  TC.state = { provider: null, signer: null, account: null, chainId: null };

  const connectBtn = document.getElementById("connect-btn");
  const accountEl = document.getElementById("account-address");
  const networkBadge = document.getElementById("network-badge");

  const SEPOLIA = {
    chainId: "0xaa36a7",
    chainName: "Sepolia",
    nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://rpc.sepolia.org"],
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
  };

  /** Chuyển MetaMask sang Sepolia, thêm mạng nếu ví chưa có. */
  async function switchToSepolia() {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA.chainId }],
      });
    } catch (err) {
      // 4902: ví chưa có mạng này
      if (err.code === 4902 || err.data?.originalError?.code === 4902) {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [SEPOLIA] });
      } else {
        throw err;
      }
    }
  }

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
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const current = await window.ethereum.request({ method: "eth_chainId" });
      if (current !== SEPOLIA.chainId) await switchToSepolia();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const account = await signer.getAddress();
      const chainId = Number((await provider.getNetwork()).chainId);

      Object.assign(TC.state, { provider, signer, account, chainId });

      accountEl.textContent = shortAddr(account);
      accountEl.title = account;
      networkBadge.textContent = chainId === 11155111 ? "Sepolia" : `Chain ${chainId}`;
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