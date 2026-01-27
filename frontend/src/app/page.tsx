'use client';

import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { ArrowRightLeft, Shield, Wallet, RefreshCw, BarChart3, TrendingUp, ArrowDownToLine } from "lucide-react";
import { myOftAbi, yieldFarmAbi, erc20Abi } from "../lib/abis";
import { ROOTSTOCK, SEPOLIA, LZ_OPTIONS_HEX, DEFAULT_POOL_ID, getStaticProvider } from "../lib/contracts";
import { useCallback } from "react";

type Direction = "to-sepolia" | "to-rootstock";

const format = (value?: ethers.BigNumber, decimals = 18, fallback = "0") =>
  value ? Number(ethers.utils.formatUnits(value, decimals)).toLocaleString() : fallback;

export default function CrossChainVaultPage() {
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number | null>(null);

  const [ostRootstock, setOstRootstock] = useState<string>("0");
  const [ostSepolia, setOstSepolia] = useState<string>("0");
  const [staked, setStaked] = useState<string>("0");
  const [pendingRewards, setPendingRewards] = useState<string>("0");

  const [bridgeAmount, setBridgeAmount] = useState<string>("");
  const [stakeAmount, setStakeAmount] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [direction, setDirection] = useState<Direction>("to-sepolia");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  const staticProviders = useMemo(
    () => ({
      rootstock: getStaticProvider(ROOTSTOCK),
      sepolia: getStaticProvider(SEPOLIA)
    }),
    []
  );

  // ----- wallet wiring -----
  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    const eth = (window as any).ethereum;
    const web3 = new ethers.providers.Web3Provider(eth, "any");
    setProvider(web3);

    const handleAccounts = (accounts: string[]) => {
      setAddress(accounts[0] ?? "");
    };
    const handleChain = (cid: string) => {
      setChainId(parseInt(cid, 16));
    };
    eth.on("accountsChanged", handleAccounts);
    eth.on("chainChanged", handleChain);

    web3.listAccounts().then((accs) => {
      if (accs.length) {
        setAddress(accs[0]);
        setSigner(web3.getSigner());
      }
    });
    web3.getNetwork().then((n) => setChainId(n.chainId));

    return () => {
      eth.removeListener("accountsChanged", handleAccounts);
      eth.removeListener("chainChanged", handleChain);
    };
  }, []);

  // ----- data refresh -----
  const refreshData = useCallback(async () => {
    if (!address) return;
    try {
      const tokenRoot = new ethers.Contract(ROOTSTOCK.oft, erc20Abi, staticProviders.rootstock);
      const tokenSepolia = new ethers.Contract(SEPOLIA.oft, erc20Abi, staticProviders.sepolia);
      const [balRoot, balSep] = await Promise.all([
        tokenRoot.balanceOf(address),
        tokenSepolia.balanceOf(address)
      ]);
      setOstRootstock(format(balRoot));
      setOstSepolia(format(balSep));

      if (SEPOLIA.farm) {
        const farm = new ethers.Contract(SEPOLIA.farm, yieldFarmAbi, staticProviders.sepolia);
        const [userInfo, pending] = await Promise.all([
          farm.getUserInfo(DEFAULT_POOL_ID, address),
          farm.pendingRewards(DEFAULT_POOL_ID, address)
        ]);
        setStaked(format(userInfo[0]));
        setPendingRewards(format(pending));
      }
    } catch (err) {
      console.warn("refresh failed", err);
    }
  }, [address, staticProviders.rootstock, staticProviders.sepolia]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const connect = async () => {
    if (!provider) {
      setStatus("Install MetaMask to continue.");
      return;
    }
    const accounts = await provider.send("eth_requestAccounts", []);
    setAddress(accounts[0]);
    setSigner(provider.getSigner());
    const net = await provider.getNetwork();
    setChainId(net.chainId);
  };

  const currentChain = useMemo(() => {
    if (chainId === ROOTSTOCK.chainId) return ROOTSTOCK;
    if (chainId === SEPOLIA.chainId) return SEPOLIA;
    return null;
  }, [chainId]);

  const switchChain = async (target: typeof ROOTSTOCK | typeof SEPOLIA) => {
    if (!provider) return false;
    try {
      await provider.send("wallet_switchEthereumChain", [{ chainId: target.chainHex }]);
      setChainId(target.chainId);
      return true;
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        // add network then retry
        await provider.send("wallet_addEthereumChain", [
          {
            chainId: target.chainHex,
            chainName: target.name,
            nativeCurrency: {
              name: target.nativeSymbol,
              symbol: target.nativeSymbol,
              decimals: 18
            },
            rpcUrls: [target.rpcUrl],
            blockExplorerUrls: [
              target.key === "rootstock"
                ? "https://rootstock-testnet.blockscout.com"
                : "https://sepolia.etherscan.io"
            ]
          }
        ]);
        await provider.send("wallet_switchEthereumChain", [{ chainId: target.chainHex }]);
        setChainId(target.chainId);
        return true;
      }
      throw switchError;
    }
  };

  const ensureSignerOn = async (target: typeof ROOTSTOCK | typeof SEPOLIA) => {
    if (!provider) throw new Error("Connect wallet first");
    if (chainId !== target.chainId) {
      await switchChain(target);
    }
    return provider.getSigner();
  };

  // --- helpers ---
  const checkPeer = async (source: typeof ROOTSTOCK | typeof SEPOLIA, dest: typeof ROOTSTOCK | typeof SEPOLIA) => {
    const srcProvider = new ethers.providers.Web3Provider((window as any).ethereum, "any");
    const contract = new ethers.Contract(source.oft, myOftAbi, srcProvider);
    const peer = await contract.peers(dest.eid);
    const expected = ethers.utils.hexZeroPad(dest.oft, 32);
    return peer.toLowerCase() === expected.toLowerCase();
  };

  const bridge = async () => {
    if (!bridgeAmount || Number(bridgeAmount) <= 0) return;
    const source = direction === "to-sepolia" ? ROOTSTOCK : SEPOLIA;
    const dest = direction === "to-sepolia" ? SEPOLIA : ROOTSTOCK;

    try {
      setBusy(true);
      setStatus("Preparing bridge transaction...");
      const activeSigner = await ensureSignerOn(source);
      const user = await activeSigner.getAddress();
      const myOft = new ethers.Contract(source.oft, myOftAbi, activeSigner);
      const decimals: number = await myOft.decimals();
      const amount = ethers.utils.parseUnits(bridgeAmount, decimals);
      const bal = await myOft.balanceOf(user);
      if (bal.lt(amount)) throw new Error("Insufficient OST balance on source chain");

      const peerOk = await checkPeer(source, dest);
      if (!peerOk) {
        throw new Error(`Trusted peer not set between ${source.name} and ${dest.name}. Run lz:oft:send once from CLI to configure setPeer.`);
      }

      const minAmount = amount.mul(995).div(1000); // 0.5% slippage buffer
      const recipientBytes = ethers.utils.hexZeroPad(user, 32);
      const sendParam = [dest.eid, recipientBytes, amount, minAmount, LZ_OPTIONS_HEX, "0x", "0x"];

      setStatus("Quoting LayerZero fee...");
      const feeQuote = await myOft.quoteSend(sendParam, false);
      const nativeFee: ethers.BigNumber = (feeQuote.nativeFee ?? feeQuote[0]) as ethers.BigNumber;
      const feeWithBuffer = nativeFee.mul(120).div(100); // +20%

      setStatus(`Sending ${bridgeAmount} OST to ${dest.name}...`);
      const tx = await myOft.send(sendParam, [feeWithBuffer, 0], user, { value: feeWithBuffer });
      await tx.wait();
      setStatus(`Bridge sent ✅ Tx: ${tx.hash}`);
      await refreshData();
    } catch (err: any) {
      setStatus(err?.message || "Bridge failed");
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const stake = async () => {
    if (!stakeAmount || Number(stakeAmount) <= 0) return;
    if (!SEPOLIA.farm) {
      setStatus("Farm address missing");
      return;
    }
    try {
      setBusy(true);
      setStatus("Switching to Sepolia...");
      const activeSigner = await ensureSignerOn(SEPOLIA);
      const user = await activeSigner.getAddress();
      const token = new ethers.Contract(SEPOLIA.oft, erc20Abi, activeSigner);
      const farm = new ethers.Contract(SEPOLIA.farm, yieldFarmAbi, activeSigner);

      const decimals: number = await token.decimals();
      const amount = ethers.utils.parseUnits(stakeAmount, decimals);
      const allowance = await token.allowance(user, SEPOLIA.farm);
      if (allowance.lt(amount)) {
        setStatus("Approving OST for staking...");
        const approveTx = await token.approve(SEPOLIA.farm, amount);
        await approveTx.wait();
      }

      setStatus("Staking on Sepolia...");
      const tx = await farm.stake(DEFAULT_POOL_ID, amount);
      await tx.wait();
      setStatus(`Staked ${stakeAmount} OST ✅`);
      await refreshData();
    } catch (err: any) {
      setStatus(err?.message || "Stake failed");
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const claimRewards = async () => {
    if (!SEPOLIA.farm) return;
    try {
      setBusy(true);
      setStatus("Claiming rewards on Sepolia...");
      const activeSigner = await ensureSignerOn(SEPOLIA);
      const farm = new ethers.Contract(SEPOLIA.farm, yieldFarmAbi, activeSigner);
      const tx = await farm.claimRewards(DEFAULT_POOL_ID);
      await tx.wait();
      setStatus("Rewards claimed ✅");
      await refreshData();
    } catch (err: any) {
      setStatus(err?.message || "Claim failed");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (withBridgeHome = false) => {
    if (!SEPOLIA.farm) return;
    if (!withdrawAmount || Number(withdrawAmount) <= 0) return;
    try {
      setBusy(true);
      setStatus("Withdrawing stake on Sepolia...");
      const activeSigner = await ensureSignerOn(SEPOLIA);
      const farm = new ethers.Contract(SEPOLIA.farm, yieldFarmAbi, activeSigner);
      const token = new ethers.Contract(SEPOLIA.oft, erc20Abi, activeSigner);
      const decimals: number = await token.decimals();
      const amount = ethers.utils.parseUnits(withdrawAmount, decimals);

      const tx = await farm.withdraw(DEFAULT_POOL_ID, amount);
      await tx.wait();
      setStatus(`Withdrew ${withdrawAmount} OST ✅`);
      await refreshData();

      if (withBridgeHome) {
        setBridgeAmount(withdrawAmount);
        setDirection("to-rootstock");
        setStatus("Now bridging withdrawn OST back to Rootstock...");
        await bridge();
      }
    } catch (err: any) {
      setStatus(err?.message || "Withdraw failed");
    } finally {
      setBusy(false);
    }
  };

  const connectedLabel = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <header className="container mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-blue-400 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-purple-200">Rootstock ↔ Sepolia</p>
            <h1 className="text-2xl font-bold">OST Cross-Chain Vault</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {currentChain && (
            <span className="text-xs bg-white/10 border border-white/20 px-3 py-2 rounded-lg">
              {currentChain.name}
            </span>
          )}
          <button
            onClick={connect}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              address ? "bg-green-600" : "bg-purple-600 hover:bg-purple-700"
            }`}
          >
            <Wallet className="w-4 h-4" />
            {connectedLabel}
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-16 space-y-8">
        {/* Top stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="OST on Rootstock" value={`${ostRootstock} OST`} icon={<TrendingUp className="w-6 h-6 text-green-300" />} />
          <StatCard label="OST on Sepolia" value={`${ostSepolia} OST`} icon={<TrendingUp className="w-6 h-6 text-blue-300" />} />
          <StatCard label="Staked on Sepolia" value={`${staked} OST`} icon={<BarChart3 className="w-6 h-6 text-yellow-300" />} />
          <StatCard label="Pending Rewards" value={`${pendingRewards} OST`} icon={<RefreshCw className="w-6 h-6 text-purple-300" />} />
        </div>

        {/* Bridge */}
        <section className="bg-white/10 border border-white/15 rounded-2xl p-6 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" /> Bridge OST
            </h2>
            <div className="flex gap-2 text-sm">
              <button
                onClick={() => setDirection("to-sepolia")}
                className={`px-3 py-1 rounded-md ${direction === "to-sepolia" ? "bg-purple-600" : "bg-white/10"}`}
              >
                Rootstock → Sepolia
              </button>
              <button
                onClick={() => setDirection("to-rootstock")}
                className={`px-3 py-1 rounded-md ${direction === "to-rootstock" ? "bg-purple-600" : "bg-white/10"}`}
              >
                Sepolia → Rootstock
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm mb-2">Amount (OST)</label>
              <input
                type="number"
                value={bridgeAmount}
                onChange={(e) => setBridgeAmount(e.target.value)}
                placeholder="0.0"
                className="w-full p-4 rounded-lg bg-black/30 border border-white/20 text-white placeholder-gray-400 text-xl"
              />
              <p className="text-xs text-gray-300 mt-2">
                Bridge uses LayerZero v2. Fees are paid in the source-chain native token (tRBTC or ETH).
              </p>
            </div>
            <div className="flex flex-col justify-end">
              <button
                onClick={bridge}
                disabled={busy}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 rounded-lg py-3 font-semibold"
              >
                {busy ? "Working..." : direction === "to-sepolia" ? "Bridge to Sepolia" : "Bridge to Rootstock"}
              </button>
              <p className="text-xs text-yellow-200 mt-2">
                Ensure peers are configured (CLI task `lz:oft:send` does this once).
              </p>
            </div>
          </div>
        </section>

        {/* Farming */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white/10 border border-white/15 rounded-2xl p-6 backdrop-blur">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Stake on Sepolia (Pool 0)</h2>
              <span className="text-xs bg-blue-500/20 px-2 py-1 rounded">Sepolia only</span>
            </div>
            <label className="block text-sm mb-2">Amount to stake (OST)</label>
            <input
              type="number"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              placeholder="0.0"
              className="w-full p-4 rounded-lg bg-black/30 border border-white/20 text-white placeholder-gray-400 text-xl"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={stake}
                disabled={busy}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg py-3 font-semibold"
              >
                {busy ? "Working..." : "Approve & Stake"}
              </button>
              <button
                onClick={claimRewards}
                disabled={busy}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg py-3 font-semibold"
              >
                Claim Rewards
              </button>
            </div>
          </div>

          <div className="bg-white/10 border border-white/15 rounded-2xl p-6 backdrop-blur">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Withdraw / Bridge Home</h2>
              <span className="text-xs bg-pink-500/20 px-2 py-1 rounded">Sepolia → Rootstock</span>
            </div>
            <label className="block text-sm mb-2">Amount to withdraw (OST)</label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0.0"
              className="w-full p-4 rounded-lg bg-black/30 border border-white/20 text-white placeholder-gray-400 text-xl"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => withdraw(false)}
                disabled={busy}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg py-3 font-semibold"
              >
                Withdraw to Wallet
              </button>
              <button
                onClick={() => withdraw(true)}
                disabled={busy}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 rounded-lg py-3 font-semibold flex items-center justify-center gap-2"
              >
                <ArrowDownToLine className="w-4 h-4" />
                Withdraw & Bridge Home
              </button>
            </div>
            <p className="text-xs text-yellow-200 mt-3">
              Withdraw pays rewards, then optionally bridges OST back to Rootstock using LayerZero.
            </p>
          </div>
        </section>

        {/* Status */}
        {status && (
          <div className="bg-black/40 border border-white/20 rounded-xl p-4 text-sm">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-300 animate-spin" />
              <span>{status}</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/15 flex items-center justify-between">
      <div>
        <p className="text-gray-300 text-sm">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
      </div>
      {icon}
    </div>
  );
}
