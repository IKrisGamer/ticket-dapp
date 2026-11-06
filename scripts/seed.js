/**
 * Tao du lieu mau de demo: vai su kien va mua san vai ve.
 *
 *   npx hardhat run scripts/seed.js --network localhost
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
  const [organizer, , buyer] = await ethers.getSigners();

  const app = await ethers.getContractAt("TicketCheckIn", address, organizer);
  const now = (await ethers.provider.getBlock("latest")).timestamp;

  const events = [
    { name: "Dem nhac Mua Thu", venue: "Nha hat Lon Ha Noi", days: 14, price: "0.001", max: 100 },
    { name: "Hoi thao Blockchain 2026", venue: "Dai hoc Bach Khoa", days: 7, price: "0.0005", max: 3 },
  ];

  console.log(`Seeding ${network} - contract ${address}`);
  const firstId = (await app.eventCount()) + 1n;

  for (const e of events) {
    const tx = await app.createEvent(e.name, e.venue, now + e.days * DAY, ethers.parseEther(e.price), e.max);
    await tx.wait();
    console.log(`  + Su kien "${e.name}" (${e.price} ETH, ${e.max} ve)`);
  }

  if (buyer) {
    const price = (await app.getEventInfo(firstId)).price;
    await (await app.connect(buyer).buyTicket(firstId, { value: price })).wait();
    console.log(`  + ${buyer.address} mua 1 ve su kien #${firstId}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
