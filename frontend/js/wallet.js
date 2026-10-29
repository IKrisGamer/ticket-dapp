/* ==================================================================
   wallet.js – A
   Kết nối MetaMask, chuyển mạng, tạo đối tượng contract dùng chung.

   Sau khi kết nối xong, các file khác dùng:
     TC.state.contract   – contract đã gắn signer (gửi giao dịch được)
     TC.state.account    – địa chỉ ví đang dùng
     TC.state.chainId    – chainId hiện tại (number)
     TC.state.deployment – { address, deployBlock, network }
   và lắng nghe:
     "tc:ready"   – ví vừa kết nối hoặc vừa đổi tài khoản
     "tc:changed" – vừa có giao dịch thành công, cần tải lại dữ liệu
   ================================================================== */
(function () {
  TC.state = { provider: null, signer: null, account: null, chainId: null, contract: null, deployment: null };

  const connectBtn = document.getElementById("connect-btn");
  const accountEl = document.getElementById("account-address");
  const networkBadge = document.getElementById("network-badge");

  function setBadge(text, type) {
    networkBadge.textContent = text;
    networkBadge.className = `badge badge-${type}`;
  }

  /** Chuyển MetaMask sang mạng có contract, thêm mạng nếu ví chưa có. */
  async function switchNetwork(chainId) {
    const params = TC.config.networks[chainId];
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: params.chainId }],
      });
    } catch (err) {
      // 4902: ví chưa có mạng này
      if (err.code === 4902 || err.data?.originalError?.code === 4902) {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [params] });
      } else {
        throw err;
      }
    }
  }

  async function connect() {
    if (!window.ethereum) {
      alert("Không tìm thấy MetaMask. Hãy cài tiện ích MetaMask rồi tải lại trang.");
      return;
    }
    connectBtn.disabled = true;
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });

      // Nếu mạng hiện tại chưa có contract thì chuyển sang mạng mặc định
      let chainId = Number(await window.ethereum.request({ method: "eth_chainId" }));
      if (!TC.getDeployment(chainId)) {
        await switchNetwork(TC.config.defaultChainId);
        chainId = Number(await window.ethereum.request({ method: "eth_chainId" }));
      }
      await setup();
    } catch (err) {
      console.error(err);
      setBadge("Kết nối thất bại", "danger");
      alert(TC.utils.txError(err));
    } finally {
      connectBtn.disabled = false;
    }
  }

  /** Tạo provider, signer, contract cho tài khoản và mạng hiện tại. */
  async function setup() {
    const provider = new ethers.BrowserProvider(window.ethereum, "any");
    const accounts = await provider.send("eth_accounts", []);
    if (accounts.length === 0) return disconnect();

    const chainId = Number((await provider.getNetwork()).chainId);
    const deployment = TC.getDeployment(chainId);
    const networkName = TC.config.networks[chainId]?.chainName || `Chain ${chainId}`;

    if (!deployment) {
      Object.assign(TC.state, { provider, signer: null, account: null, chainId, contract: null, deployment: null });
      setBadge(`${networkName}: chưa có contract`, "warning");
      accountEl.textContent = "";
      connectBtn.textContent = "Chuyển mạng";
      return;
    }

    const signer = await provider.getSigner();
    const account = await signer.getAddress();
    const abi = [...new Set(TC.abi)];
    const contract = new ethers.Contract(deployment.address, abi, signer);

    Object.assign(TC.state, { provider, signer, account, chainId, contract, deployment });

    setBadge(networkName, "success");
    accountEl.textContent = TC.utils.shortAddr(account);
    accountEl.title = account;
    connectBtn.textContent = "Đã kết nối";

    document.dispatchEvent(new CustomEvent("tc:ready", { detail: TC.state }));
  }

  function disconnect() {
    Object.assign(TC.state, { provider: null, signer: null, account: null, contract: null, deployment: null });
    setBadge("Chưa kết nối", "muted");
    accountEl.textContent = "";
    connectBtn.textContent = "Kết nối MetaMask";
    document.dispatchEvent(new CustomEvent("tc:ready", { detail: TC.state }));
  }

  /** Gọi sau mỗi giao dịch thành công để các phần khác tải lại dữ liệu. */
  TC.notifyChange = function () {
    document.dispatchEvent(new CustomEvent("tc:changed"));
  };

  /** Đăng ký hàm chạy khi ví sẵn sàng và mỗi khi dữ liệu thay đổi. */
  TC.onRefresh = function (fn) {
    document.addEventListener("tc:ready", fn);
    document.addEventListener("tc:changed", fn);
  };

  TC.connect = connect;
  connectBtn.addEventListener("click", connect);

  // Đổi tài khoản hoặc đổi mạng trên MetaMask -> tải lại trạng thái
  if (window.ethereum) {
    window.ethereum.on?.("accountsChanged", () => setup().catch(console.error));
    window.ethereum.on?.("chainChanged", () => setup().catch(console.error));
  }
  // Tự kết nối lại nếu trang đã được cấp quyền từ trước.
  // Chờ DOMContentLoaded để mọi file JS khác đã đăng ký ABI và giao diện.
  document.addEventListener("DOMContentLoaded", () => {
    if (!window.ethereum) return;
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => accounts.length && setup())
      .catch(console.error);
  });
})();