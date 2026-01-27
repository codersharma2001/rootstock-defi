// Minimal ABIs needed by the frontend. Keep them small to reduce bundle size.

export const erc20Abi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)"
];

export const myOftAbi = [
  ...erc20Abi,
  "function peers(uint32 eid) view returns (bytes32)",
  "function quoteSend((uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd), bool payInLzToken) view returns (tuple(uint256 nativeFee, uint256 lzTokenFee))",
  "function send((uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd), (uint256 nativeFee, uint256 lzTokenFee), address refundAddress) payable returns (tuple(bytes32 guid, uint64 nonce, uint256 fee), tuple(uint256 amountSentLD, uint256 amountReceivedLD))"
];

export const yieldFarmAbi = [
  "function stake(uint256 poolId, uint256 amount) external",
  "function withdraw(uint256 poolId, uint256 amount) external",
  "function claimRewards(uint256 poolId) external",
  "function pendingRewards(uint256 poolId, address user) external view returns (uint256)",
  "function getUserInfo(uint256 poolId, address user) external view returns (uint256 stakedAmount, uint256 pendingReward, uint256 lastStakeTime)"
];

