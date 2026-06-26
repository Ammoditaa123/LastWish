import hre from "hardhat";

async function main() {
  console.log("Deploying LastWishVault smart contract...");

  const LastWishVault = await hre.ethers.getContractFactory("LastWishVault");
  const contract = await LastWishVault.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("LastWishVault deployed successfully to L2 testnet!");
  console.log("Contract Address:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
