import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

interface TaskArgs {
  contract: string;
  poolId: string;
  amount: string;
  privatekey?: string;
}

task("lz:stake", "Stake tokens in a yield farming pool")
  .addParam("contract", "YieldFarmOFT contract address")
  .addParam("poolId", "Pool ID to stake in")
  .addParam("amount", "Amount to stake (in tokens, not wei)")
  .addOptionalParam("privatekey", "Private key of the account to stake from")
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { contract, poolId, amount, privatekey } = taskArgs;
    const network = hre.network.name;

    console.log(`Staking ${amount} tokens in pool ${poolId} on ${network}`);
    console.log(`Contract address: ${contract}`);

    let signer;
    if (privatekey) {
      signer = new hre.ethers.Wallet(privatekey, hre.ethers.provider);
    } else {
      const accounts = await hre.ethers.getSigners();
      signer = accounts[0];
    }

    console.log(`Using account: ${signer.address}`);

    // Get contract instance
    const yieldFarmOFT = await hre.ethers.getContractAt(
      "YieldFarmOFT",
      contract,
      signer
    );

    try {
      // Check user's balance
      const balance = await yieldFarmOFT.balanceOf(signer.address);
      const amountInWei = hre.ethers.utils.parseEther(amount);

      console.log(
        `Current balance: ${hre.ethers.utils.formatEther(balance)} tokens`
      );

      if (balance.lt(amountInWei)) {
        throw new Error(
          `Insufficient balance. Need ${amount} tokens but have ${hre.ethers.utils.formatEther(balance)}`
        );
      }

      // Get pool info
      const poolInfo = await yieldFarmOFT.stakingPools(poolId);
      console.log(`Pool info:`);
      console.log(`- Staking token: ${poolInfo.stakingToken}`);
      console.log(`- Reward rate: ${poolInfo.rewardRate} tokens/second`);
      console.log(
        `- Total staked: ${hre.ethers.utils.formatEther(poolInfo.totalStaked)} tokens`
      );
      console.log(`- Active: ${poolInfo.active}`);

      if (!poolInfo.active) {
        throw new Error("Pool is not active");
      }

      // Check if we need to approve tokens first
      const stakingToken = await hre.ethers.getContractAt(
        "IERC20",
        poolInfo.stakingToken,
        signer
      );
      const allowance = await stakingToken.allowance(signer.address, contract);

      if (allowance.lt(amountInWei)) {
        console.log(`Approving ${amount} tokens for staking...`);
        const approveTx = await stakingToken.approve(contract, amountInWei);
        await approveTx.wait();
        console.log(`✅ Approval transaction confirmed: ${approveTx.hash}`);
      }

      // Stake tokens
      console.log(`Staking ${amount} tokens...`);
      const stakeTx = await yieldFarmOFT.stake(poolId, amountInWei);
      console.log(`Transaction sent: ${stakeTx.hash}`);

      const receipt = await stakeTx.wait();
      console.log(
        `✅ Staking transaction confirmed in block ${receipt.blockNumber}`
      );

      // Get updated user info
      const userInfo = await yieldFarmOFT.getUserInfo(poolId, signer.address);
      console.log(`\nUpdated user info:`);
      console.log(
        `- Staked amount: ${hre.ethers.utils.formatEther(userInfo.stakedAmount)} tokens`
      );
      console.log(
        `- Pending rewards: ${hre.ethers.utils.formatEther(userInfo.pendingReward)} tokens`
      );
    } catch (error) {
      console.error("❌ Staking failed:", error);
      throw error;
    }
  });
