import { ethers } from "ethers";
import { task } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

interface DepositArgs {
  contract: string;
  vaultId: string;
  amount: string;
  privatekey?: string;
}

interface WithdrawArgs {
  contract: string;
  vaultId: string;
  shares: string;
  privatekey?: string;
}

interface VaultInfoArgs {
  contract: string;
  vaultId: string;
  user?: string;
}

// Vault deposit task
task("lz:vault:deposit", "Deposit tokens into a cross-chain vault")
  .addParam("contract", "CrossChainVault contract address")
  .addParam("vaultId", "Vault ID to deposit into")
  .addParam("amount", "Amount to deposit (in tokens, not wei)")
  .addOptionalParam("privatekey", "Private key of the account to deposit from")
  .setAction(async (taskArgs: DepositArgs, hre: HardhatRuntimeEnvironment) => {
    const { contract, vaultId, amount, privatekey } = taskArgs;
    const network = hre.network.name;

    console.log(
      `Depositing ${amount} tokens into vault ${vaultId} on ${network}`
    );
    console.log(`Contract address: ${contract}`);

    const signer = privatekey
      ? new ethers.Wallet(privatekey, hre.ethers.provider)
      : (await hre.ethers.getSigners())[0];

    console.log(`Using account: ${signer.address}`);

    const vault = await hre.ethers.getContractAt(
      "CrossChainVault",
      contract,
      signer
    );

    try {
      // Get vault info
      const vaultInfo = await vault.vaults(vaultId);
      console.log(`Vault asset: ${vaultInfo.asset}`);
      console.log(
        `Current total deposits: ${ethers.utils.formatEther(vaultInfo.totalDeposits)} tokens`
      );

      const amountInWei = ethers.utils.parseEther(amount);

      // Check balance and approval
      const assetToken = await hre.ethers.getContractAt(
        "IERC20",
        vaultInfo.asset,
        signer
      );
      const balance = await assetToken.balanceOf(signer.address);

      if (balance.lt(amountInWei)) {
        throw new Error(
          `Insufficient balance. Need ${amount} but have ${ethers.utils.formatEther(balance)}`
        );
      }

      // Approve if needed
      const allowance = await assetToken.allowance(signer.address, contract);
      if (allowance.lt(amountInWei)) {
        console.log(`Approving ${amount} tokens...`);
        const approveTx = await assetToken.approve(contract, amountInWei);
        await approveTx.wait();
        console.log(`✅ Approval confirmed`);
      }

      // Deposit
      console.log(`Depositing ${amount} tokens...`);
      const depositTx = await vault.deposit(vaultId, amountInWei);
      console.log(`Transaction sent: ${depositTx.hash}`);

      const receipt = await depositTx.wait();
      console.log(`✅ Deposit confirmed in block ${receipt.blockNumber}`);

      // Get updated info
      const userInfo = await vault.getUserVaultInfo(vaultId, signer.address);
      console.log(`\nUser vault info:`);
      console.log(`- Shares: ${ethers.utils.formatEther(userInfo.shares)}`);
      console.log(
        `- Deposit value: ${ethers.utils.formatEther(userInfo.depositValue)} tokens`
      );
      console.log(
        `- Pending yield: ${ethers.utils.formatEther(userInfo.pendingYield)} tokens`
      );
    } catch (error) {
      console.error("❌ Deposit failed:", error);
      throw error;
    }
  });

// Vault withdraw task
task("lz:vault:withdraw", "Withdraw tokens from a cross-chain vault")
  .addParam("contract", "CrossChainVault contract address")
  .addParam("vaultId", "Vault ID to withdraw from")
  .addParam("shares", "Shares to redeem (in tokens, not wei)")
  .addOptionalParam("privatekey", "Private key of the account to withdraw to")
  .setAction(async (taskArgs: WithdrawArgs, hre: HardhatRuntimeEnvironment) => {
    const { contract, vaultId, shares, privatekey } = taskArgs;
    const network = hre.network.name;

    console.log(
      `Withdrawing ${shares} shares from vault ${vaultId} on ${network}`
    );
    console.log(`Contract address: ${contract}`);

    const signer = privatekey
      ? new ethers.Wallet(privatekey, hre.ethers.provider)
      : (await hre.ethers.getSigners())[0];

    console.log(`Using account: ${signer.address}`);

    const vault = await hre.ethers.getContractAt(
      "CrossChainVault",
      contract,
      signer
    );

    try {
      const sharesInWei = ethers.utils.parseEther(shares);

      // Get user info before withdrawal
      const userInfoBefore = await vault.getUserVaultInfo(
        vaultId,
        signer.address
      );
      console.log(
        `Current shares: ${ethers.utils.formatEther(userInfoBefore.shares)}`
      );

      if (userInfoBefore.shares.lt(sharesInWei)) {
        throw new Error(
          `Insufficient shares. Have ${ethers.utils.formatEther(userInfoBefore.shares)} but trying to withdraw ${shares}`
        );
      }

      // Withdraw
      console.log(`Withdrawing ${shares} shares...`);
      const withdrawTx = await vault.withdraw(vaultId, sharesInWei);
      console.log(`Transaction sent: ${withdrawTx.hash}`);

      const receipt = await withdrawTx.wait();
      console.log(`✅ Withdrawal confirmed in block ${receipt.blockNumber}`);

      // Get updated info
      const userInfoAfter = await vault.getUserVaultInfo(
        vaultId,
        signer.address
      );
      console.log(`\nUpdated user vault info:`);
      console.log(
        `- Shares: ${ethers.utils.formatEther(userInfoAfter.shares)}`
      );
      console.log(
        `- Deposit value: ${ethers.utils.formatEther(userInfoAfter.depositValue)} tokens`
      );
    } catch (error) {
      console.error("❌ Withdrawal failed:", error);
      throw error;
    }
  });

// Vault info task
task("lz:vault:info", "Get vault information")
  .addParam("contract", "CrossChainVault contract address")
  .addParam("vaultId", "Vault ID to get info for")
  .addOptionalParam("user", "User address to get specific user info")
  .setAction(
    async (taskArgs: VaultInfoArgs, hre: HardhatRuntimeEnvironment) => {
      const { contract, vaultId, user } = taskArgs;
      const network = hre.network.name;

      console.log(`Getting vault ${vaultId} info on ${network}`);
      console.log(`Contract address: ${contract}`);

      const vault = await hre.ethers.getContractAt("CrossChainVault", contract);

      try {
        // Get vault info
        const vaultInfo = await vault.vaults(vaultId);
        console.log(`\nVault ${vaultId} Info:`);
        console.log(`- Asset token: ${vaultInfo.asset}`);
        console.log(
          `- Total deposits: ${ethers.utils.formatEther(vaultInfo.totalDeposits)} tokens`
        );
        console.log(
          `- Total shares: ${ethers.utils.formatEther(vaultInfo.totalShares)}`
        );
        console.log(
          `- Yield rate: ${vaultInfo.yieldRate} basis points (${vaultInfo.yieldRate / 100}%)`
        );
        console.log(`- Active: ${vaultInfo.active}`);
        console.log(
          `- Last yield update: ${new Date(vaultInfo.lastYieldUpdate * 1000).toLocaleString()}`
        );

        // Calculate share price
        if (vaultInfo.totalShares.gt(0)) {
          const sharePrice = vaultInfo.totalDeposits
            .mul(ethers.utils.parseEther("1"))
            .div(vaultInfo.totalShares);
          console.log(
            `- Share price: ${ethers.utils.formatEther(sharePrice)} tokens per share`
          );
        }

        if (user) {
          // Get user-specific info
          const userInfo = await vault.getUserVaultInfo(vaultId, user);
          console.log(`\nUser ${user} Info:`);
          console.log(
            `- Shares: ${ethers.utils.formatEther(userInfo.shares)}`
          );
          console.log(
            `- Deposit value: ${ethers.utils.formatEther(userInfo.depositValue)} tokens`
          );
          console.log(
            `- Pending yield: ${ethers.utils.formatEther(userInfo.pendingYield)} tokens`
          );
        }
      } catch (error) {
        console.error("❌ Failed to get vault info:", error);
        throw error;
      }
    }
  );

// Vault yield claim task
task("lz:vault:claim-yield", "Claim yield from a vault")
  .addParam("contract", "CrossChainVault contract address")
  .addParam("vaultId", "Vault ID to claim yield from")
  .addOptionalParam(
    "privatekey",
    "Private key of the account to claim yield for"
  )
  .setAction(async (taskArgs: DepositArgs, hre: HardhatRuntimeEnvironment) => {
    const { contract, vaultId, privatekey } = taskArgs;
    const network = hre.network.name;

    console.log(`Claiming yield from vault ${vaultId} on ${network}`);

    const signer = privatekey
      ? new ethers.Wallet(privatekey, hre.ethers.provider)
      : (await hre.ethers.getSigners())[0];

    const vault = await hre.ethers.getContractAt(
      "CrossChainVault",
      contract,
      signer
    );

    try {
      // Check pending yield
      const pendingYield = await vault.calculatePendingYield(
        vaultId,
        signer.address
      );
      console.log(
        `Pending yield: ${ethers.utils.formatEther(pendingYield)} tokens`
      );

      if (pendingYield.eq(0)) {
        console.log("No yield to claim");
        return;
      }

      // Claim yield
      const claimTx = await vault.claimYield(vaultId);
      console.log(`Transaction sent: ${claimTx.hash}`);

      const receipt = await claimTx.wait();
      console.log(`✅ Yield claim confirmed in block ${receipt.blockNumber}`);
    } catch (error) {
      console.error("❌ Yield claim failed:", error);
      throw error;
    }
  });
