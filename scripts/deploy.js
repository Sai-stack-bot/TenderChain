const hre = require("hardhat");
const fs  = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying TenderManagement contract...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log(
    "Account balance:",
    (await hre.ethers.provider.getBalance(deployer.address)).toString()
  );

  const TenderManagement = await hre.ethers.getContractFactory("TenderManagement");
  const tender = await TenderManagement.deploy();
  await tender.waitForDeployment();

  const address = await tender.getAddress();
  console.log("TenderManagement deployed to:", address);

  // -------------------------------------------------------
  // Save ABI + address to frontend/src/contracts/
  // -------------------------------------------------------
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/TenderManagement.sol/TenderManagement.json"
  );

  const frontendContractsDir = path.join(__dirname, "../frontend/src/contracts");
  if (!fs.existsSync(frontendContractsDir)) {
    fs.mkdirSync(frontendContractsDir, { recursive: true });
  }

  // Copy ABI
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const frontendABI = {
    contractName: artifact.contractName,
    abi: artifact.abi,
  };
  fs.writeFileSync(
    path.join(frontendContractsDir, "TenderManagement.json"),
    JSON.stringify(frontendABI, null, 2)
  );

  // Save address
  const addressConfig = {
    TenderManagement: address,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(frontendContractsDir, "contract-address.json"),
    JSON.stringify(addressConfig, null, 2)
  );

  console.log("\n✅ ABI and address written to frontend/src/contracts/");
  console.log("   TenderManagement.json");
  console.log("   contract-address.json");
  console.log("\nDeployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
