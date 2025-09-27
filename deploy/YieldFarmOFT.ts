import assert from 'assert'

import { type DeployFunction } from 'hardhat-deploy/types'

const contractName = 'YieldFarmOFT'

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments } = hre

    const { deploy, get } = deployments
    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')

    console.log(`Network: ${hre.network.name}`)
    console.log(`Deployer: ${deployer}`)

    // Resolve LayerZero Endpoint V2 deployment for this network
    const endpointV2Deployment = await get('EndpointV2')

    const { address } = await deploy(contractName, {
        from: deployer,
        args: [
            'YieldFarmOFT', // name
            'YFO', // symbol
            endpointV2Deployment.address, // LayerZero Endpoint
            deployer // owner / delegate
        ],
        log: true,
        skipIfAlreadyDeployed: false,
    })

    console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`)
}

deploy.tags = [contractName]

export default deploy
