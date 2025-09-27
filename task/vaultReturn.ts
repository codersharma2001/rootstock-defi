import { ethers } from 'ethers'
import { task } from 'hardhat/config'
import '@nomiclabs/hardhat-ethers'

const ERC20_META_ABI = [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function balanceOf(address owner) view returns (uint256)'
]

function toBridgeId(raw: string): string {
    if (ethers.utils.isHexString(raw)) {
        return ethers.utils.hexZeroPad(raw, 32)
    }
    return ethers.utils.id(raw)
}

task('lz:vault:return', 'Exit a lifecycle-managed farm position and bridge assets home')
    .addParam('manager', 'VaultLifecycleManager contract address')
    .addParam('bridge', 'Bridge identifier (tx hash or arbitrary string)')
    .addParam('percent', 'Percentage of the position to exit (1-100)')
    .addParam('oft', 'OFT contract address used for bridging back')
    .addParam('destination', 'Destination network name for LayerZero send')
    .addParam('privatekey', 'Private key to sign transactions (also used for LayerZero send)')
    .addOptionalParam('recipient', 'Recipient address on destination chain (defaults to signer)')
    .setAction(async (taskArgs, hre) => {
        const provider = hre.ethers.provider
        const signer = new ethers.Wallet(taskArgs.privatekey, provider)
        const manager = await hre.ethers.getContractAt('VaultLifecycleManager', taskArgs.manager, signer)

        const stakingTokenAddress: string = await manager.stakingToken()
        const token = new ethers.Contract(stakingTokenAddress, ERC20_META_ABI, signer)
        const decimals: number = await token.decimals()
        let symbol = 'TOKEN'
        try {
            symbol = await token.symbol()
        } catch (_) {
            // optional metadata
        }

        const bridgeId = toBridgeId(taskArgs.bridge)
        const percent = Number(taskArgs.percent)
        const recipient = taskArgs.recipient ?? signer.address

        const balanceBefore = await token.balanceOf(signer.address)
        console.log(`Exiting position ${bridgeId} at ${percent}% for recipient ${recipient}`)
        const tx = await manager.exitPosition(bridgeId, percent, signer.address)
        console.log(`Exit transaction hash: ${tx.hash}`)
        const receipt = await tx.wait()
        console.log(`Exit confirmed in block ${receipt.blockNumber}`)

        const balanceAfter = await token.balanceOf(signer.address)
        const withdrawn = balanceAfter.sub(balanceBefore)
        const withdrawnHuman = ethers.utils.formatUnits(withdrawn, decimals)
        console.log(`Tokens withdrawn to signer: ${withdrawnHuman} ${symbol}`)

        if (withdrawn.isZero()) {
            console.log('No tokens withdrawn, skipping bridge back')
            return
        }

        console.log('Initiating LayerZero send back to origin chain...')
        await hre.run('lz:oft:send', {
            contract: taskArgs.oft,
            recipient,
            source: hre.network.name,
            destination: taskArgs.destination,
            amount: withdrawnHuman,
            privatekey: taskArgs.privatekey
        })
    })
