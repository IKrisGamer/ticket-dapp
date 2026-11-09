const { expect } = require('chai');
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("TicketCheckIn - huy su kien, hoan tien, rut doanh thu", function () {
    const PRICE = ethers.parseEther("0.01");

    async function deployFixture() {
        const [organizer, staff, buyer, buyer2, stranger] = await ethers.getSigners();
        const app = await ethers.deployContract("TicketCheckIn");
        const startTime = (await time.latest()) + 7 * 24 * 60 * 60; // 1 tuần

        await app.createEvent("Consert", "Ha Noi", startTime, PRICE, 100); // eventId 1
        await app.setStaff(1, staff.address, true);

        await app.connect(buyer).buyTicket(1, { value: PRICE }); // ticketId 1
        await app.connect(buyer2).buyTicket(1, { value: PRICE }); // ticketId 2

        return { app, organizer, staff, buyer, buyer2, stranger };
    }

    describe("cancelEvent", function () {
       it("ban to chuc huy su kien va ban ve tư dong dong", async function () {
        const { app } = await loadFixture(deployFixture);
        await expect(app.cancelEvent(1))
            .to.emit(app, "EventCancelled")
            .withArgs(1n, (ts) => ts > 0n);

        expect(await app.isCancelled(1)).to.equal(true);
        expect((await app.getEventInfo(1)).saleOpen).to.equal(false);
       });

       it("chi ban to chuc cua su kien duoc huy", async function () {
        const { app, stranger } = await loadFixture(deployFixture);
        await expect(app.connect(stranger).cancelEvent(1))
        .to.be.revertedWithCustomError(app,"NotEventOrganizer")
        .withArgs(1n);
       });

       it("khong duoc huy 2 lan", async function () {
        const { app } = await loadFixture(deployFixture);
        await app.cancelEvent(1);
        await expect(app.cancelEvent(1))
            .to.be.revertedWithCustomError(app, "EventIsCancelled")
            .withArgs(1n);
       });

       it("khong duoc huy khi da co ve duoc soat", async function () {
        const { app, staff } = await loadFixture(deployFixture);
        await app.connect(staff).checkIn(1, 1);
        await expect(app.cancelEvent(1))
            .to.be.revertedWithCustomError(app, "EventHasCheckIns")
            .withArgs(1n);
       });

       it("khong mo lai ban va khong duoc mua sau khi huy", async function(){
        const { app, stranger } = await loadFixture(deployFixture);
        await app.cancelEvent(1);

        await expect(app.toggleSale(1))
            .to.be.revertedWithCustomError(app, "EventIsCancelled")
        await expect(app.connect(stranger).buyTicket(1, { value: PRICE }))
            .to.be.revertedWithCustomError(app, "SaleClosed")
       });
    });

    describe("claimRefund", function (){
        it("chan rut tien khi su kien chua bi huy", async function() {
            const { app, buyer } = await loadFixture(deployFixture);
            await expect(app.connect(buyer).claimRefund(1))
                .to.be.revertedWithCustomError(app, "EventNotCancelled")
                .withArgs(1n);
        });

        it("nguoi mua nhan lai dung gia ve", async function() {
            const { app, buyer } = await loadFixture(deployFixture);
            await app.cancelEvent(1);

            await expect(app.connect(buyer).claimRefund(1))
                .to.changeEtherBalances([buyer, app], [PRICE, -PRICE]);
            expect(await app.isRefunded(1)).to.equal(true);
        });

        it("phat event Refunded", async function() {
            const { app, buyer } = await loadFixture(deployFixture);
            await app.cancelEvent(1);
            await expect(app.connect(buyer).claimRefund(1))
                .to.emit(app, "Refunded")
                .withArgs(1n, buyer.address, PRICE);
        });

        it("chan rut tien 2 lan cho cung 1 ve", async function() {
            const { app, buyer} = await loadFixture(deployFixture);
            await app.cancelEvent(1);
            await app.connect(buyer).claimRefund(1);

            await expect(app.connect(buyer).claimRefund(1))
                .to.be.revertedWithCustomError(app, "AlreadyRefunded")
                .withArgs(1n);
        });

        it("chi chu ve duoc rut tien", async function() {
            const { app, buyer } = await loadFixture(deployFixture);
            await app.cancelEvent(1);
            //ve 2 la cua buyer2
            await expect(app.connect(buyer).claimRefund(2))
                .to.be.revertedWithCustomError(app, "NotTicketOwner")
                .withArgs(2n);
        });

        it("chan rut tien cho ve khong ton tai", async function() {
            const { app, buyer } = await loadFixture(deployFixture);
            await app.cancelEvent(1);
            await expect(app.connect(buyer).claimRefund(99))
                .to.be.revertedWithCustomError(app, "TicketNotFound")
        });
    });

      describe("withdrawRevenue", function () {
    it("khong rut duoc khi chua co ve nao duoc soat", async function () {
      const { app } = await loadFixture(deployFixture);
      await expect(app.withdrawRevenue(1))
        .to.be.revertedWithCustomError(app, "WithdrawNotAllowed")
        .withArgs(1n);
    });

    it("rut dung doanh thu sau khi bat dau soat ve", async function () {
      const { app, organizer, staff } = await loadFixture(deployFixture);
      await app.connect(staff).checkIn(1, 1);

      await expect(app.withdrawRevenue(1))
        .to.changeEtherBalances([organizer, app], [PRICE * 2n, -PRICE * 2n]);
    });

    it("khong rut lai khi het doanh thu moi", async function () {
      const { app, staff } = await loadFixture(deployFixture);
      await app.connect(staff).checkIn(1, 1);
      await expect(app.withdrawRevenue(1))
        .to.emit(app, "RevenueWithdrawn")
        .withArgs(1n, (await ethers.getSigners())[0].address, PRICE * 2n);

      await expect(app.withdrawRevenue(1))
        .to.be.revertedWithCustomError(app, "NothingToWithdraw");
    });

    it("chi ban to chuc cua su kien duoc rut", async function () {
      const { app, staff, stranger } = await loadFixture(deployFixture);
      await app.connect(staff).checkIn(1, 1);
      await expect(app.connect(stranger).withdrawRevenue(1))
        .to.be.revertedWithCustomError(app, "NotEventOrganizer");
    });
  });
});

