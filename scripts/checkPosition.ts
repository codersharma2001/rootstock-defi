import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL_SEPOLIA);
const managerAddress = '0x7185d2b631d09A4085b78dB178c4a47EdF8AA941';
const bridgeId = '0x976137480431e0d99d0c3980c40b1cfc72aece2f6139f05c9ce592d6eb4c1e65';
const farmAddress = '0x55f60c7790D9BEE3c6b59D4573ff099FCf1EBb7b';

const managerAbi = [
  'function getPosition(bytes32) view returns (tuple(address owner_, uint256 poolId, uint256 stakedAmount, bool autoCompound, bool active, uint64 createdAt, uint256 pendingReward))'
];

const farmAbi = [
  'function userInfo(uint256,address) view returns (uint256 stakedAmount, uint256 userRewardPerTokenPaid, uint256 rewards, uint256 lastStakeTime)'
];

async function main() {
  const manager = new ethers.Contract(managerAddress, managerAbi, provider);
  const farm = new ethers.Contract(farmAddress, farmAbi, provider);

  const position = await manager.getPosition(bridgeId);
  console.log('Position from manager:', position);

  const farmInfo = await farm.userInfo(position.poolId, managerAddress);
  console.log('Manager entry in farm:', farmInfo);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
