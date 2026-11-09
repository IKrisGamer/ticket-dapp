const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

/**
 * Kịch bản đầy đủ như lúc demo:
 * phát hành -> mua -> ký QR -> soát vé -> chặn vé trùng -> rút doanh thu
 * và một sự kiện khác bị hủy -> hoàn tiền.
 */
describe("Luồng đầy đủ (end-to-end)", function () {
  const PRICE = ethers.parseEther("0.02");

  // Giống hệt định dạng frontend dùng (buyer.js ký, staff.js xác minh)
  function qrMessage(chainId, contractAddress, ticketId, ts) {
    return `TicketChain:${chainId}:${contractAddress.toLowerCase()}:${ticketId}:${ts}`;
  }

  it("phát hành, mua, soát vé, hoàn tiền", async function () {
    const [admin, organizer, staff, alice, bob, mallory] = await ethers.getSigners();
    const app = await ethers.deployContract("TicketCheckIn");
    const address = await app.getAddress();
    const { chainId } = await ethers.provider.getNetwork();
    const start = (await time.latest()) + 3 * 24 * 60 * 60;

    // 1. Admin cấp quyền ban tổ chức, ban tổ chức tạo 2 sự kiện và cấp quyền nhân viên
    await app.connect(admin).setOrganizer(organizer.address, true);
    await app.connect(organizer).createEvent("Live Concert", "Ha Noi", start, PRICE, 3);
    await app.connect(organizer).createEvent("Workshop", "Da Nang", start, PRICE, 10);
    await app.connect(organizer).setStaff(1, staff.address, true);

    // 2. Mua vé: giới hạn số lượng và giới hạn mỗi ví
    await app.connect(alice).buyTicket(1, { value: PRICE }); // vé 1
    await app.connect(alice).buyTicket(1, { value: PRICE }); // vé 2
    await expect(app.connect(alice).buyTicket(1, { value: PRICE }))
      .to.be.revertedWithCustomError(app, "WalletLimitReached");
    await app.connect(bob).buyTicket(1, { value: PRICE });   // vé 3
    await expect(app.connect(mallory).buyTicket(1, { value: PRICE }))
      .to.be.revertedWithCustomError(app, "SoldOut");

    // 3. Alice mở QR: ký thông điệp bằng ví của mình
    const ts = await time.latest();
    const sig = await alice.signMessage(qrMessage(chainId, address, 1, ts));

    // 4. Nhân viên xác minh chữ ký khớp chủ vé trên chuỗi
    const info = await app.verifyTicket(1);
    const signer = ethers.verifyMessage(qrMessage(chainId, address, 1, ts), sig);
    expect(signer).to.equal(info.owner);

    // Mallory tự ký cho vé của Alice -> chữ ký không khớp
    const fakeSig = await mallory.signMessage(qrMessage(chainId, address, 1, ts));
    expect(ethers.verifyMessage(qrMessage(chainId, address, 1, ts), fakeSig)).to.not.equal(info.owner);

    // 5. Soát vé một lần duy nhất
    await expect(app.connect(staff).checkIn(1, 1)).to.emit(app, "TicketUsed");
    await expect(app.connect(staff).checkIn(1, 1))
      .to.be.revertedWithCustomError(app, "TicketAlreadyUsed");
    await expect(app.connect(staff).checkIn(1, 404))
      .to.be.revertedWithCustomError(app, "TicketNotFound");

    // 6. Sự kiện đã soát vé -> không hủy được, ban tổ chức rút doanh thu
    await expect(app.connect(organizer).cancelEvent(1))
      .to.be.revertedWithCustomError(app, "EventHasCheckIns");
    await expect(app.connect(organizer).withdrawRevenue(1))
      .to.changeEtherBalance(organizer, PRICE * 3n);

    // 7. Sự kiện 2 bị hủy -> người mua tự rút tiền
    await app.connect(bob).buyTicket(2, { value: PRICE }); // vé 4
    await app.connect(organizer).cancelEvent(2);
    await expect(app.connect(bob).claimRefund(4)).to.changeEtherBalance(bob, PRICE);
    await expect(app.connect(bob).claimRefund(4))
      .to.be.revertedWithCustomError(app, "AlreadyRefunded");

    // Contract không còn giữ tiền thừa
    expect(await ethers.provider.getBalance(address)).to.equal(0n);
  });
});