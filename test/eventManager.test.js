const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("EventManager", function () {
  const PRICE = ethers.parseEther("0.01");

  async function deployFixture() {
    const [owner, organizer, staff, stranger] = await ethers.getSigners();
    const manager = await ethers.deployContract("EventManager");
    const startTime = (await time.latest()) + 7 * 24 * 60 * 60;
    return { manager, owner, organizer, staff, stranger, startTime };
  }

  async function eventFixture() {
    const f = await deployFixture();
    await f.manager.setOrganizer(f.organizer.address, true);
    await f.manager
      .connect(f.organizer)
      .createEvent("Concert", "Ha Noi", f.startTime, PRICE, 100);
    return { ...f, eventId: 1n };
  }

  describe("createEvent", function () {
    it("deployer la owner va co san quyen ban to chuc", async function () {
      const { manager, owner } = await loadFixture(deployFixture);
      expect(await manager.owner()).to.equal(owner.address);
      expect(await manager.isOrganizer(owner.address)).to.equal(true);
    });

    it("tao su kien va luu dung thong tin", async function () {
      const { manager, organizer, startTime } = await loadFixture(eventFixture);
      const ev = await manager.getEventInfo(1);

      expect(await manager.eventCount()).to.equal(1n);
      expect(ev.organizer).to.equal(organizer.address);
      expect(ev.name).to.equal("Concert");
      expect(ev.venue).to.equal("Ha Noi");
      expect(ev.startTime).to.equal(BigInt(startTime));
      expect(ev.price).to.equal(PRICE);
      expect(ev.maxTickets).to.equal(100n);
      expect(ev.ticketsSold).to.equal(0n);
      expect(ev.saleOpen).to.equal(true);
    });

    it("phat event EventCreated", async function () {
      const { manager, organizer, startTime } = await loadFixture(eventFixture);
      await expect(
        manager.connect(organizer).createEvent("Talk", "HCM", startTime, PRICE, 50)
      )
        .to.emit(manager, "EventCreated")
        .withArgs(2n, organizer.address, "Talk", PRICE, 50n, BigInt(startTime));
    });

    it("chan vi khong co quyen ban to chuc", async function () {
      const { manager, stranger, startTime } = await loadFixture(deployFixture);
      await expect(
        manager.connect(stranger).createEvent("Fake", "X", startTime, PRICE, 10)
      ).to.be.revertedWithCustomError(manager, "NotOrganizerRole");
    });

    it("chan thong tin su kien khong hop le", async function () {
      const { manager, startTime } = await loadFixture(deployFixture);
      const past = (await time.latest()) - 1;

      await expect(manager.createEvent("", "X", startTime, PRICE, 10))
        .to.be.revertedWithCustomError(manager, "InvalidEventParams");
      await expect(manager.createEvent("A", "X", startTime, PRICE, 0))
        .to.be.revertedWithCustomError(manager, "InvalidEventParams");
      await expect(manager.createEvent("A", "X", past, PRICE, 10))
        .to.be.revertedWithCustomError(manager, "InvalidEventParams");
    });

    it("chi owner duoc cap quyen ban to chuc", async function () {
      const { manager, organizer, stranger } = await loadFixture(deployFixture);
      await expect(manager.connect(stranger).setOrganizer(stranger.address, true))
        .to.be.revertedWithCustomError(manager, "NotOwner");

      await expect(manager.setOrganizer(organizer.address, true))
        .to.emit(manager, "OrganizerUpdated")
        .withArgs(organizer.address, true);
    });

    it("bao loi khi xem su kien khong ton tai", async function () {
      const { manager } = await loadFixture(eventFixture);
      await expect(manager.getEventInfo(99))
        .to.be.revertedWithCustomError(manager, "EventNotFound")
        .withArgs(99n);
    });
  });

  describe("toggleSale", function () {
    it("ban to chuc dong va mo lai ban ve", async function () {
      const { manager, organizer, eventId } = await loadFixture(eventFixture);

      await expect(manager.connect(organizer).toggleSale(eventId))
        .to.emit(manager, "SaleToggled")
        .withArgs(eventId, false);
      expect((await manager.getEventInfo(eventId)).saleOpen).to.equal(false);

      await manager.connect(organizer).toggleSale(eventId);
      expect((await manager.getEventInfo(eventId)).saleOpen).to.equal(true);
    });

    it("chan nguoi khong phai ban to chuc cua su kien", async function () {
      const { manager, owner, stranger, eventId } = await loadFixture(eventFixture);
      // owner cung la organizer nhung khong phai nguoi tao su kien nay
      await expect(manager.connect(owner).toggleSale(eventId))
        .to.be.revertedWithCustomError(manager, "NotEventOrganizer")
        .withArgs(eventId);
      await expect(manager.connect(stranger).toggleSale(eventId))
        .to.be.revertedWithCustomError(manager, "NotEventOrganizer");
    });
  });
  
  describe("setStaff", function () {
    it("ban to chuc cap quyen soat ve", async function () {
      const { manager, organizer, staff, eventId } = await loadFixture(eventFixture);

      await expect(manager.connect(organizer).setStaff(eventId, staff.address, true))
        .to.emit(manager, "StaffUpdated")
        .withArgs(eventId, staff.address, true);
      expect(await manager.isStaff(eventId, staff.address)).to.equal(true);
    });

    it("ban to chuc thu hoi quyen soat ve", async function () {
      const { manager, organizer, staff, eventId } = await loadFixture(eventFixture);
      await manager.connect(organizer).setStaff(eventId, staff.address, true);

      await expect(manager.connect(organizer).setStaff(eventId, staff.address, false))
        .to.emit(manager, "StaffUpdated")
        .withArgs(eventId, staff.address, false);
      expect(await manager.isStaff(eventId, staff.address)).to.equal(false);
    });

    it("quyen soat ve chi ap dung cho dung su kien", async function () {
      const { manager, organizer, staff, eventId, startTime } = await loadFixture(eventFixture);
      await manager.connect(organizer).createEvent("Talk", "HCM", startTime, PRICE, 10);
      await manager.connect(organizer).setStaff(eventId, staff.address, true);

      expect(await manager.isStaff(eventId, staff.address)).to.equal(true);
      expect(await manager.isStaff(2, staff.address)).to.equal(false);
    });

    it("chan nguoi khong phai ban to chuc cap quyen", async function () {
      const { manager, staff, stranger, eventId } = await loadFixture(eventFixture);
      await expect(manager.connect(stranger).setStaff(eventId, staff.address, true))
        .to.be.revertedWithCustomError(manager, "NotEventOrganizer")
        .withArgs(eventId);
      await expect(manager.connect(staff).setStaff(eventId, stranger.address, true))
        .to.be.revertedWithCustomError(manager, "NotEventOrganizer");
    });

    it("chan dia chi 0 va su kien khong ton tai", async function () {
      const { manager, organizer, staff, eventId } = await loadFixture(eventFixture);
      await expect(manager.connect(organizer).setStaff(eventId, ethers.ZeroAddress, true))
        .to.be.revertedWithCustomError(manager, "ZeroAddress");
      await expect(manager.connect(organizer).setStaff(42, staff.address, true))
        .to.be.revertedWithCustomError(manager, "EventNotFound")
        .withArgs(42n);
    });
  });
});