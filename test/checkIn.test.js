const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("TicketCheckIn - soat ve", function () {
  const PRICE = ethers.parseEther("0.01");

  async function deployFixture() {
    const [organizer, staff, buyer, stranger] = await ethers.getSigners();
    const app = await ethers.deployContract("TicketCheckIn");
    const startTime = (await time.latest()) + 7 * 24 * 60 * 60;

    await app.createEvent("Concert", "Ha Noi", startTime, PRICE, 100); // eventId 1
    await app.createEvent("Talk", "HCM", startTime, PRICE, 100);       // eventId 2
    await app.setStaff(1, staff.address, true);

    await app.connect(buyer).buyTicket(1, { value: PRICE }); // ticketId 1 -> event 1
    await app.connect(buyer).buyTicket(2, { value: PRICE }); // ticketId 2 -> event 2

    return { app, organizer, staff, buyer, stranger };
  }

  describe("ve hop le", function () {
    it("soat ve thanh cong va ghi trang thai da dung", async function () {
      const { app, staff } = await loadFixture(deployFixture);
      await app.connect(staff).checkIn(1, 1);

      expect(await app.isUsed(1)).to.equal(true);
      expect(await app.usedAt(1)).to.equal(BigInt(await time.latest()));
      expect(await app.checkInCount(1)).to.equal(1n);
    });

    it("verifyTicket tra ve dung trang thai truoc va sau khi soat", async function () {
      const { app, staff, buyer } = await loadFixture(deployFixture);

      let info = await app.verifyTicket(1);
      expect(info.exists).to.equal(true);
      expect(info.used).to.equal(false);
      expect(info.eventId).to.equal(1n);
      expect(info.owner).to.equal(buyer.address);

      await app.connect(staff).checkIn(1, 1);
      info = await app.verifyTicket(1);
      expect(info.used).to.equal(true);
      expect(info.cancelled).to.equal(false);
    });
  });

  describe("soat ve 2 lan", function () {
    it("chan ve da duoc soat", async function () {
      const { app, staff } = await loadFixture(deployFixture);
      await app.connect(staff).checkIn(1, 1);

      await expect(app.connect(staff).checkIn(1, 1))
        .to.be.revertedWithCustomError(app, "TicketAlreadyUsed")
        .withArgs(1n);
      expect(await app.checkInCount(1)).to.equal(1n);
    });
  });

  describe("ve gia", function () {
    it("chan ma ve khong ton tai tren chuoi", async function () {
      const { app, staff } = await loadFixture(deployFixture);
      await expect(app.connect(staff).checkIn(1, 999))
        .to.be.revertedWithCustomError(app, "TicketNotFound")
        .withArgs(999n);
      await expect(app.connect(staff).checkIn(1, 0))
        .to.be.revertedWithCustomError(app, "TicketNotFound")
        .withArgs(0n);
    });

    it("verifyTicket bao ve gia la khong ton tai", async function () {
      const { app } = await loadFixture(deployFixture);
      const info = await app.verifyTicket(999);
      expect(info.exists).to.equal(false);
      expect(info.owner).to.equal(ethers.ZeroAddress);
    });
  });

  describe("ve sai su kien", function () {
    it("chan ve cua su kien khac", async function () {
      const { app, staff } = await loadFixture(deployFixture);
      // ve 2 thuoc su kien 2, dem vao cua su kien 1
      await expect(app.connect(staff).checkIn(1, 2))
        .to.be.revertedWithCustomError(app, "WrongEvent")
        .withArgs(2n, 1n);
      expect(await app.isUsed(2)).to.equal(false);
    });
  });

  describe("phan quyen soat ve", function () {
    it("chan vi khong phai nhan vien", async function () {
      const { app, stranger, buyer } = await loadFixture(deployFixture);
      await expect(app.connect(stranger).checkIn(1, 1))
        .to.be.revertedWithCustomError(app, "NotStaff")
        .withArgs(1n);
      // chu ve cung khong tu soat ve cho minh duoc
      await expect(app.connect(buyer).checkIn(1, 1))
        .to.be.revertedWithCustomError(app, "NotStaff");
    });

    it("ban to chuc khong tu dong co quyen soat ve", async function () {
      const { app, organizer } = await loadFixture(deployFixture);
      await expect(app.connect(organizer).checkIn(1, 1))
        .to.be.revertedWithCustomError(app, "NotStaff");
    });

    it("nhan vien su kien nay khong soat duoc su kien khac", async function () {
      const { app, staff } = await loadFixture(deployFixture);
      await expect(app.connect(staff).checkIn(2, 2))
        .to.be.revertedWithCustomError(app, "NotStaff")
        .withArgs(2n);
    });

    it("nhan vien bi thu quyen thi khong soat duoc nua", async function () {
      const { app, staff } = await loadFixture(deployFixture);
      await app.setStaff(1, staff.address, false);
      await expect(app.connect(staff).checkIn(1, 1))
        .to.be.revertedWithCustomError(app, "NotStaff");
    });
  });

  describe("su kien da huy", function () {
    it("chan soat ve cua su kien da huy", async function () {
      const { app, staff } = await loadFixture(deployFixture);
      await app.cancelEvent(1);

      await expect(app.connect(staff).checkIn(1, 1))
        .to.be.revertedWithCustomError(app, "EventIsCancelled")
        .withArgs(1n);
      expect((await app.verifyTicket(1)).cancelled).to.equal(true);
    });
  });

  describe("event", function () {
    it("phat TicketUsed khi soat ve", async function () {
      const { app, staff } = await loadFixture(deployFixture);
      await expect(app.connect(staff).checkIn(1, 1))
        .to.emit(app, "TicketUsed")
        .withArgs(1n, 1n, staff.address, (ts) => ts > 0n);
    });
  });
});
