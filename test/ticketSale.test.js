const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("TicketSale", function () {
  const PRICE = ethers.parseEther("0.01");
  const MAX_TICKETS = 3;

  async function deployFixture() {
    const [organizer, buyer, buyer2, buyer3] = await ethers.getSigners();
    const sale = await ethers.deployContract("TicketSale");
    const startTime = (await time.latest()) + 7 * 24 * 60 * 60;

    await sale.createEvent("Concert", "Ha Noi", startTime, PRICE, MAX_TICKETS); // eventId 1
    await sale.createEvent("Talk", "HCM", startTime, PRICE, 100);                // eventId 2

    return { sale, organizer, buyer, buyer2, buyer3 };
  }

  describe("buyTicket", function () {
    it("mua ve thanh cong va ghi nhan chu so huu", async function () {
      const { sale, buyer } = await loadFixture(deployFixture);

      await expect(sale.connect(buyer).buyTicket(1, { value: PRICE }))
        .to.emit(sale, "TicketPurchased")
        .withArgs(1n, 1n, buyer.address, PRICE);

      const ticket = await sale.tickets(1);
      expect(ticket.eventId).to.equal(1n);
      expect(ticket.owner).to.equal(buyer.address);
      expect(await sale.ticketCount()).to.equal(1n);
      expect(await sale.purchasedCount(1, buyer.address)).to.equal(1n);
      expect((await sale.getEventInfo(1)).ticketsSold).to.equal(1n);
    });

    it("getMyTickets tra ve dung danh sach ve", async function () {
      const { sale, buyer, buyer2 } = await loadFixture(deployFixture);
      await sale.connect(buyer).buyTicket(1, { value: PRICE });
      await sale.connect(buyer2).buyTicket(1, { value: PRICE });
      await sale.connect(buyer).buyTicket(2, { value: PRICE });

      expect([...(await sale.connect(buyer).getMyTickets())]).to.deep.equal([1n, 3n]);
      expect([...(await sale.getTicketsOf(buyer2.address))]).to.deep.equal([2n]);
    });

    it("bao loi khi mua ve su kien khong ton tai", async function () {
      const { sale, buyer } = await loadFixture(deployFixture);
      await expect(sale.connect(buyer).buyTicket(99, { value: PRICE }))
        .to.be.revertedWithCustomError(sale, "EventNotFound")
        .withArgs(99n);
    });

    it("chan mua khi ban to chuc da dong ban ve", async function () {
      const { sale, buyer } = await loadFixture(deployFixture);
      await sale.toggleSale(1);
      await expect(sale.connect(buyer).buyTicket(1, { value: PRICE }))
        .to.be.revertedWithCustomError(sale, "SaleClosed")
        .withArgs(1n);
    });
  });

  describe("gioi han so ve", function () {
    it("khong ban qua so ve toi da cua su kien", async function () {
      const { sale, buyer, buyer2, buyer3 } = await loadFixture(deployFixture);
      await sale.connect(buyer).buyTicket(1, { value: PRICE });
      await sale.connect(buyer).buyTicket(1, { value: PRICE });
      await sale.connect(buyer2).buyTicket(1, { value: PRICE });

      await expect(sale.connect(buyer3).buyTicket(1, { value: PRICE }))
        .to.be.revertedWithCustomError(sale, "SoldOut")
        .withArgs(1n);
      expect((await sale.getEventInfo(1)).ticketsSold).to.equal(BigInt(MAX_TICKETS));
    });

    it("moi vi chi mua toi da 2 ve cho mot su kien", async function () {
      const { sale, buyer } = await loadFixture(deployFixture);
      await sale.connect(buyer).buyTicket(2, { value: PRICE });
      await sale.connect(buyer).buyTicket(2, { value: PRICE });

      await expect(sale.connect(buyer).buyTicket(2, { value: PRICE }))
        .to.be.revertedWithCustomError(sale, "WalletLimitReached")
        .withArgs(2n, buyer.address);
    });

    it("gioi han 2 ve tinh rieng cho tung su kien", async function () {
      const { sale, buyer } = await loadFixture(deployFixture);
      await sale.connect(buyer).buyTicket(1, { value: PRICE });
      await sale.connect(buyer).buyTicket(1, { value: PRICE });

      await expect(sale.connect(buyer).buyTicket(2, { value: PRICE })).to.not.be.reverted;
      expect(await sale.MAX_PER_WALLET()).to.equal(2n);
    });
  });
});
