import { task, types } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

interface TaskArgs {
  contract: string;
  poolId: string;
  privatekey?: string;
  crosschain?: boolean;
  destination?: string;
}

task("lz:claim", "Claim rewards from a yield farming pool")
  .addParam("contract", "YieldFarmOFT contract address")
  .addParam("poolId", "Pool ID to claim rewards from")
  .addOptionalParam(
    "privatekey",
    "Private key of the account to claim rewards for"
  )
  .addOptionalParam(
    "crosschain",
    "Whether to send rewards cross-chain (true/false)",
    false,
    types.boolean
  )
  .addOptionalParam(
    "destination",
    "Destination network for cross-chain rewards"
  )
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { contract, poolId, privatekey, crosschain, destination } =
      taskArgs;
    const network = hre.network.name;

    console.log(`Claiming rewards from pool ${poolId} on ${network}`);
    if (crosschain && destination) {
      console.log(`Will send rewards to ${destination}`);
    }
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
      // Check pending rewards
      const pendingRewards = await yieldFarmOFT.pendingRewards(
        poolId,
        signer.address
      );
      console.log(
        `Pending rewards: ${hre.ethers.utils.formatEther(pendingRewards)} tokens`
      );

      if (pendingRewards.eq(0)) {
        console.log("No rewards to claim");
        return;
      }

      // Get user info before claiming
      const userInfoBefore = await yieldFarmOFT.getUserInfo(
        poolId,
        signer.address
      );
      console.log(
        `Current staked amount: ${hre.ethers.utils.formatEther(userInfoBefore.stakedAmount)} tokens`
      );

      if (crosschain && destination) {
        // Cross-chain claim
        const networkEndpoints: Record<string, number> = {
          "sepolia-testnet": 40161,
          "rootstock-testnet": 40230,
        };

        const dstEid = networkEndpoints[destination];
        if (!dstEid) {
          throw new Error(`Unknown destination network: ${destination}`);
        }

        // Get quote for cross-chain transfer
        const options = "0x"; // Empty options for now

        console.log(
          `Claiming and sending rewards cross-chain to ${destination}...`
        );

        // Estimate gas for the cross-chain operation
        let gasEstimate;
        try {
          gasEstimate = await yieldFarmOFT.estimateGas.claimAndSendCrossChain(
            poolId,
            dstEid,
            options,
            { value: hre.ethers.utils.parseEther("0.01") } // Estimate with 0.01 ETH
          );
        } catch (error) {
          console.log("Using default gas estimate due to estimation error");
          gasEstimate = hre.ethers.BigNumber.from("500000");
        }

        const claimTx = await yieldFarmOFT.claimAndSendCrossChain(
          poolId,
          dstEid,
          options,
          {
            value: hre.ethers.utils.parseEther("0.01"), // 0.01 ETH for LayerZero fees
            gasLimit: gasEstimate.mul(120).div(100), // Add 20% buffer
          }
        );

        console.log(`Cross-chain claim transaction sent: ${claimTx.hash}`);
        const receipt = await claimTx.wait();
        console.log(
          `✅ Cross-chain claim confirmed in block ${receipt.blockNumber}`
        );
      } else {
        // Regular claim
        console.log(`Claiming rewards locally...`);
        const claimTx = await yieldFarmOFT.claimRewards(poolId);
        console.log(`Transaction sent: ${claimTx.hash}`);

        const receipt = await claimTx.wait();
        console.log(
          `✅ Claim transaction confirmed in block ${receipt.blockNumber}`
        );

        // Check new token balance
        const newBalance = await yieldFarmOFT.balanceOf(signer.address);
        console.log(
          `New token balance: ${hre.ethers.utils.formatEther(newBalance)} tokens`
        );
      }

      // Get updated user info
      const userInfoAfter = await yieldFarmOFT.getUserInfo(
        poolId,
        signer.address
      );
      console.log(`\nUpdated user info:`);
      console.log(
        `- Staked amount: ${hre.ethers.utils.formatEther(userInfoAfter.stakedAmount)} tokens`
      );
      console.log(
        `- Pending rewards: ${hre.ethers.utils.formatEther(userInfoAfter.pendingReward)} tokens`
      );
    } catch (error) {
      console.error("❌ Claiming failed:", error);
      throw error;
    }
  });
