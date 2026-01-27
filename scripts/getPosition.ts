import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const managerAddress = '0x7185d2b631d09A4085b78dB178c4a47EdF8AA941';
const bridgeId = '0x976137480431e0d99d0c3980c40b1cfc72aece2f6139f05c9ce592d6eb4c1e65';

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL_SEPOLIA);
  const managerAbi = [
    'function getPosition(bytes32) view returns (address owner_, uint256 poolId, uint256 stakedAmount, bool autoCompound, bool active, uint64 createdAt, uint256 pendingReward)'
  ];
  const manager = new ethers.Contract(managerAddress, managerAbi, provider);
  const position = await manager.getPosition(bridgeId);
  console.log('Position:', position);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
