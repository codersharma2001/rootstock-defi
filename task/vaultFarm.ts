import { task, types } from 'hardhat/config'
import '@nomiclabs/hardhat-ethers'
import { utils, Contract } from 'ethers'

const ERC20_ABI = [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 value) returns (bool)'
]

function toBridgeId(raw: string): string {
    if (utils.isHexString(raw)) {
        return utils.hexZeroPad(raw, 32)
    }
    return utils.id(raw)
}

task('lz:vault:farm', 'Stake bridged assets into a yield farm via VaultLifecycleManager')
    .addParam('manager', 'VaultLifecycleManager contract address')
    .addParam('bridge', 'Bridge identifier (tx hash or arbitrary string)')
    .addParam('poolid', 'Yield farm pool ID')
    .addParam('amount', 'Amount of tokens to stake (human readable)')
    .addOptionalParam('autocompound', 'Enable auto-compounding of rewards', true, types.boolean)
    .addOptionalParam('privatekey', 'Private key to sign the transaction')
    .addOptionalParam('token', 'Override staking token address')
    .setAction(async (taskArgs, hre) => {
        const provider = hre.ethers.provider
        const signer = taskArgs.privatekey
            ? new hre.ethers.Wallet(taskArgs.privatekey, provider)
            : (await hre.ethers.getSigners())[0]

        const manager = await hre.ethers.getContractAt('VaultLifecycleManager', taskArgs.manager, signer)
        const stakingTokenAddress: string = taskArgs.token ?? (await manager.stakingToken())

        const token = new Contract(stakingTokenAddress, ERC20_ABI, signer)
        const decimals: number = await token.decimals()
        let symbol = 'TOKEN'
        try {
            symbol = await token.symbol()
        } catch (_) {
            // symbol optional
        }

        const amount = utils.parseUnits(taskArgs.amount, decimals)
        const allowance = await token.allowance(signer.address, taskArgs.manager)
        if (allowance.lt(amount)) {
            if (!allowance.isZero()) {
                const resetTx = await token.approve(taskArgs.manager, 0)
                await resetTx.wait()
            }
            const approveTx = await token.approve(taskArgs.manager, amount)
            await approveTx.wait()
            console.log(`Approved ${taskArgs.manager} to spend ${taskArgs.amount} ${symbol}`)
        }

        const bridgeId = toBridgeId(taskArgs.bridge)
        const poolId = Number(taskArgs.poolid)
        console.log(`Opening position for bridgeId ${bridgeId} in pool ${poolId} (autoCompound=${taskArgs.autocompound})`)

        const tx = await manager.openPosition(bridgeId, poolId, amount, taskArgs.autocompound)
        console.log(`Transaction hash: ${tx.hash}`)
        const receipt = await tx.wait()
        console.log(`Position opened in block ${receipt.blockNumber}`)
    })
