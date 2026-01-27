import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL_SEPOLIA);
const farmAddress = '0x55f60c7790D9BEE3c6b59D4573ff099FCf1EBb7b';
const managerAddress = '0x7185d2b631d09A4085b78dB178c4a47EdF8AA941';
const userAddress = '0xE13d3527C631F3409aE91b838B56cFF0477420C7';

const farmAbi = [
  'function userInfo(uint256,address) view returns (uint256 stakedAmount, uint256 userRewardPerTokenPaid, uint256 rewards, uint256 lastStakeTime)'
];

async function main() {
  const providerNetwork = await provider.getNetwork();
  console.log('Connected network:', providerNetwork.chainId);

  const farm = new ethers.Contract(farmAddress, farmAbi, provider);

  const managerInfo = await farm.userInfo(0, managerAddress);
  console.log('Manager entry (pool0):', managerInfo);

  const userInfo = await farm.userInfo(0, userAddress);
  console.log('User entry (pool0):', userInfo);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
