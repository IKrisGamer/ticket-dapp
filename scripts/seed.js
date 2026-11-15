/**
 * Tao du lieu mau de demo: 3 su kien, cap quyen nhan vien, mua san vai ve.
 *
 *   npx hardhat run scripts/seed.js --network localhost
 *   npx hardhat run scripts/seed.js --network sepolia
 *
 * Ba vi demo:
 *   - Ban to chuc : vi deploy (signer 0)
 *   - Nhan vien   : signer 1 tren localhost, hoac bien moi truong DEMO_STAFF
 *   - Nguoi mua   : signer 2 tren localhost, hoac bien moi truong DEMO_BUYER
 *
 * Tren Sepolia chi co 1 private key, nen script chi tao su kien va cap quyen
 * cho DEMO_STAFF; nguoi mua tu mua ve tren giao dien bang MetaMask.
 *   DEMO_STAFF=0x... DEMO_BUYER=0x... npx hardhat run scripts/seed.js --network sepolia
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers } = hre;
const DAY = 24 * 60 * 60;

function loadDeployment(network) {
  const file = path.join(__dirname, "..", "deployments", `${network}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Chua co ${file}. Hay chay scripts/deploy.js truoc.`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function main() {
  const network = hre.network.name;
  const { address } = loadDeployment(network);
  const signers = await ethers.getSigners();
  const organizer = signers[0];
  const isLocal = signers.length > 2;

  const staffAddress = process.env.DEMO_STAFF || (isLocal ? signers[1].address : null);
  const buyer = isLocal ? signers[2] : null;

  const app = await ethers.getContractAt("TicketCheckIn", address, organizer);
  const now = (await ethers.provider.getBlock("latest")).timestamp;

  const events = [
    { name: "Dem nhac Mua Thu", venue: "Nha hat Lon Ha Noi", days: 14, price: "0.001", max: 100 },
    { name: "Hoi thao Blockchain 2026", venue: "Dai hoc Bach Khoa", days: 7, price: "0.0005", max: 3 },
    { name: "Workshop Solidity", venue: "Online", days: 21, price: "0", max: 50 },
  ];

  console.log(`Seeding ${network} - contract ${address}`);
  const firstId = (await app.eventCount()) + 1n;

  for (const e of events) {
    const tx = await app.createEvent(e.name, e.venue, now + e.days * DAY, ethers.parseEther(e.price), e.max);
    await tx.wait();
    console.log(`  + Su kien "${e.name}" (${e.price} ETH, ${e.max} ve)`);
  }

  if (staffAddress) {
    for (let i = 0n; i < BigInt(events.length); i++) {
      await (await app.setStaff(firstId + i, staffAddress, true)).wait();
    }
    console.log(`  + Cap quyen soat ve cho ${staffAddress}`);
  }

  if (buyer) {
    const price = (await app.getEventInfo(firstId)).price;
    await (await app.connect(buyer).buyTicket(firstId, { value: price })).wait();
    await (await app.connect(buyer).buyTicket(firstId, { value: price })).wait();
    console.log(`  + ${buyer.address} mua 2 ve su kien #${firstId}`);
  }

  console.log("\nVi demo:");
  console.log(`  Ban to chuc: ${organizer.address}`);
  console.log(`  Nhan vien  : ${staffAddress || "(chua dat DEMO_STAFF)"}`);
  console.log(`  Nguoi mua  : ${buyer ? buyer.address : process.env.DEMO_BUYER || "(tu mua tren giao dien)"}`);
  if (isLocal) {
    console.log("\nTren localhost, import private key cua Account #0, #1, #2 (in ra khi chay");
    console.log("`npx hardhat node`) vao MetaMask de dong vai 3 vi tren.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
