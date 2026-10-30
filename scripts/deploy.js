/**
 * Deploy TicketCheckIn (contract cuoi cung, da gom EventManager va TicketSale).
 *
 *   npx hardhat run scripts/deploy.js --network localhost
 *   npx hardhat run scripts/deploy.js --network sepolia
 *
 * Sau khi deploy, script ghi:
 *   - deployments/<network>.json      : thong tin deploy (de seed, verify)
 *   - frontend/js/deployment.js       : dia chi contract cho giao dien
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const { chainId } = await hre.ethers.provider.getNetwork();

  console.log(`Network : ${network} (chainId ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);

  const app = await hre.ethers.deployContract("TicketCheckIn");
  await app.waitForDeployment();
  const receipt = await app.deploymentTransaction().wait();
  const address = await app.getAddress();

  console.log(`TicketCheckIn deployed at ${address} (block ${receipt.blockNumber})`);

  const info = {
    network,
    chainId: Number(chainId),
    address,
    deployBlock: receipt.blockNumber,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const deployDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deployDir, { recursive: true });
  fs.writeFileSync(path.join(deployDir, `${network}.json`), JSON.stringify(info, null, 2) + "\n");

  const frontendFile = path.join(__dirname, "..", "frontend", "js", "deployment.js");
  let all = {};
  if (fs.existsSync(frontendFile)) {
    const match = fs.readFileSync(frontendFile, "utf8").match(/=\s*(\{[\s\S]*\});/);
    if (match) all = JSON.parse(match[1]);
  }
  all[String(info.chainId)] = {
    network: info.network,
    address: info.address,
    deployBlock: info.deployBlock,
  };
  fs.mkdirSync(path.dirname(frontendFile), { recursive: true });
  fs.writeFileSync(
    frontendFile,
    "// File nay do scripts/deploy.js tu sinh ra. Khong sua tay.\n" +
      `window.TC_DEPLOYMENTS = ${JSON.stringify(all, null, 2)};\n`
  );

  console.log("Da ghi deployments/" + network + ".json va frontend/js/deployment.js");

  if (network === "sepolia") {
    console.log("\nVerify tren Etherscan:");
    console.log(`  npx hardhat verify --network sepolia ${address}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});