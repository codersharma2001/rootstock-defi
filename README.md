# Rootstock LayerZero Yield Vault

This project turns the original LayerZero OFT sample into a full cross-chain yield loop. You can mint an omnichain token on Rootstock, bridge it to Sepolia, stake it in a local farm, harvest the rewards, and bridge everything back to the origin chain using a single set of Hardhat tasks.

---

## High-level Architecture

- **MyOFT.sol** (Rootstock & Sepolia) – the omnichain fungible token used as the staking asset. Both networks reuse the same address after deployment.
- **YieldFarmOFT.sol** (Sepolia) – a simple staking contract that mints rewards and understands LayerZero sends.
- **VaultLifecycleManager.sol** (Sepolia) – records bridge IDs, stakes bridged balances into the farm, optionally auto-compounds rewards, and exits positions on demand.
- **CrossChainVault.sol / RewardsDistributor.sol** – upgraded to LayerZero V2 (new `MessagingFee` struct) so on-chain messages work with the latest endpoints.
- **Hardhat tasks** – a CLI workflow (`lz:oft:mint`, `lz:oft:send`, `lz:vault:farm`, `lz:vault:return`) that wires all the above together.

We stay on **Hardhat + ethers v5** because LayerZero’s dev tooling depends on it. Every script and test now imports `@nomiclabs/hardhat-ethers` and uses `ethers.utils.*` helpers.

---

## Requirements

- Node.js ≥ 18.18
- pnpm/npm/yarn (examples below use `npm`)
- Rootstock testnet RBTC & Sepolia ETH for gas
- RPC URLs (set in `.env`):
  - `RPC_URL_ROOTSTOCK_TESTNET`
  - `RPC_URL_SEPOLIA`
- A deployer key with funds on both networks (`PRIVATE_KEY` in `.env`)

Install dependencies once:

```bash
npm install
```

Add a `.env` file (the project reads it automatically):

```ini
RPC_URL_ROOTSTOCK_TESTNET=https://...
RPC_URL_SEPOLIA=https://...
PRIVATE_KEY=0xyourdeployerkey
```

---

## Deployment walkthrough

### 1. Deploy the OFT on both chains

```bash
# Rootstock testnet
npx hardhat deploy --network rootstock-testnet --tags MyOFT

# Sepolia testnet
npx hardhat deploy --network sepolia-testnet --tags MyOFT
```

Both runs will print the deployed address. In our example the OFT lives at `0xC5b58bC164DC5c935DC9cFa3cbc7525bc6f3bA11` on each network.

### 2. Deploy the YieldFarm contract on Sepolia

```bash
npx hardhat deploy --network sepolia-testnet --tags YieldFarmOFT
```

Keep the resulting address (e.g. `0x55f60c7790D9BEE3c6b59D4573ff099FCf1EBb7b`).

### 3. Register a staking pool

Inside a Hardhat console (Sepolia) call `addPool` once. We use pool ID `0` for the lifecycle tasks.

```bash
npx hardhat console --network sepolia-testnet
>
const farm = await ethers.getContractAt(
  "YieldFarmOFT",
  "0x55f60c7790D9BEE3c6b59D4573ff099FCf1EBb7b"
);
await farm.addPool(
  "0xC5b58bC164DC5c935DC9cFa3cbc7525bc6f3bA11", // staking token
  ethers.utils.parseUnits("0.1", 18)             // reward rate per second (adjust as needed)
);
```

### 4. Deploy the VaultLifecycleManager on Sepolia

Use the OFT address as the staking token and the farm address from step 2.

```bash
npx hardhat console --network sepolia-testnet
>
const Manager = await ethers.getContractFactory("VaultLifecycleManager");
const mgr = await Manager.deploy(
  "0xC5b58bC164DC5c935DC9cFa3cbc7525bc6f3bA11", // staking token (MyOFT)
  "0x55f60c7790D9BEE3c6b59D4573ff099FCf1EBb7b"  // YieldFarmOFT
);
await mgr.deployed();
console.log(mgr.address);
```

Example manager address: `0x7185d2b631d09A4085b78dB178c4a47EdF8AA941`.

---

## Workflow: bridge → farm → return

### Step A – Mint or top up tokens

```bash
npx hardhat lz:oft:mint \
  --network rootstock-testnet \
  --contract 0xC5b58bC164DC5c935DC9cFa3cbc7525bc6f3bA11 \
  --amount 10 \
  --private-key $PRIVATE_KEY
```

### Step B – Bridge from Rootstock to Sepolia

```bash
npx hardhat lz:oft:send \
  --contract 0xC5b58bC164DC5c935DC9cFa3cbc7525bc6f3bA11 \
  --recipient 0xE13d3527C631F3409aE91b838B56cFF0477420C7 \
  --source rootstock-testnet \
  --destination sepolia-testnet \
  --amount 5 \
  --privatekey $PRIVATE_KEY
```

The script automatically sets the trusted peer on the destination chain and prints the transaction hash. Save that hash – we use it as the lifecycle identifier.

### Step C – Approve the manager (once per wallet)

If you haven’t approved the manager yet:

```bash
npx hardhat console --network sepolia-testnet
>
const oft = await ethers.getContractAt("MyOFT", "0xC5b58bC164DC5c935DC9cFa3cbc7525bc6f3bA11");
await oft.approve(
  "0x7185d2b631d09A4085b78dB178c4a47EdF8AA941", // manager
  ethers.utils.parseEther("1000")                // generous allowance
);
```

### Step D – Stake bridged tokens

Use the bridge transaction hash from step B (example shown below).

```bash
npx hardhat lz:vault:farm \
  --network sepolia-testnet \
  --manager 0x7185d2b631d09A4085b78dB178c4a47EdF8AA941 \
  --bridge 0x976137480431e0d99d0c3980c40b1cfc72aece2f6139f05c9ce592d6eb4c1e65 \
  --poolid 0 \
  --amount 5 \
  --autocompound true \
  --privatekey $PRIVATE_KEY
```

The manager transfers the tokens into the farm and records the position.

### Step E – Inspect the position (optional)

```bash
npx hardhat console --network sepolia-testnet
>
const manager = await ethers.getContractAt(
  "VaultLifecycleManager",
  "0x7185d2b631d09A4085b78dB178c4a47EdF8AA941"
);
await manager.getPosition(
  "0x976137480431e0d99d0c3980c40b1cfc72aece2f6139f05c9ce592d6eb4c1e65"
);
```

### Step F – Harvest and bridge back when ready

```bash
npx hardhat lz:vault:return \
  --network sepolia-testnet \
  --manager 0x7185d2b631d09A4085b78dB178c4a47EdF8AA941 \
  --bridge 0x976137480431e0d99d0c3980c40b1cfc72aece2f6139f05c9ce592d6eb4c1e65 \
  --percent 100 \
  --oft 0xC5b58bC164DC5c935DC9cFa3cbc7525bc6f3bA11 \
  --destination rootstock-testnet \
  --privatekey $PRIVATE_KEY
```

`lz:vault:return` harvests rewards, withdraws your principal, and calls the OFT send task so the result lands back on Rootstock. You can lower `--percent` to only withdraw part of the position.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `ERC20InsufficientBalance` revert | The Sepolia wallet doesn’t hold enough OFT to stake. | Bridge or mint more before running `lz:vault:farm`, or reduce `--amount`. |
| `Pool does not exist` revert | `YieldFarmOFT.addPool` was never called. | Run the console snippet in step 3. |
| `cannot estimate gas; ENS name` | You passed placeholders like `<stakingToken>` into `deploy`. | Replace them with real addresses. |
| Hardhat task fails with `ENOTFOUND eth-sepolia.g.alchemy.com` | RPC URL missing/incorrect. | Set `RPC_URL_SEPOLIA` (and Rootstock equivalent) in `.env`. |
| Allowance errors | Manager has no allowance for the staking token. | Perform the approval step C. |

---

## Development notes

- Contracts compile with Solidity 0.8.22 and optimizer 200 runs.
- Hardhat tasks live in `task/` (`sendOFT.ts`, `mintOFT.ts`, `vaultFarm.ts`, `vaultReturn.ts`, `vaultOperations.ts`).
- Deploy scripts: `deploy/MyOFT.ts`, `deploy/YieldFarmOFT.ts`, `deploy/MyOFT.ts` (Rootstock/Sepolia), `deploy/VaultLifecycleManager.ts` (if you add one for automation).
- Tests in `test/hardhat/MyOFT.test.ts` use ethers v5 helpers (`ethers.utils`), so run `npx hardhat test` after `npm install`.

---

## Command reference

| Purpose | Command |
| --- | --- |
| Compile everything | `npx hardhat compile` |
| Type-check tasks/tests | `npx tsc --noEmit` |
| Deploy MyOFT | `npx hardhat deploy --network <chain> --tags MyOFT` |
| Deploy YieldFarmOFT (Sepolia) | `npx hardhat deploy --network sepolia-testnet --tags YieldFarmOFT` |
| Mint tokens | `npx hardhat lz:oft:mint ...` |
| Bridge tokens | `npx hardhat lz:oft:send ...` |
| Stake bridged tokens | `npx hardhat lz:vault:farm ...` |
| Exit / bridge back | `npx hardhat lz:vault:return ...` |
| Inspect positions | `npx hardhat console --network sepolia-testnet` → `manager.getPosition(...)` |

---

## Acknowledgements

- LayerZero team for the OFT/OApp contracts and devtools
- OpenZeppelin for the ERC‑20 implementation and SafeERC20 helpers
- Hardhat community for the deployment tooling we rely on

If you hit an issue that isn’t covered above, please open it in the repository or reach out on the LayerZero forums. Happy bridging!
