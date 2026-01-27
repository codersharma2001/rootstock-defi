import { ethers } from "ethers";

export type ChainConfig = {
  key: "rootstock" | "sepolia";
  name: string;
  chainId: number;
  chainHex: string;
  eid: number;
  rpcUrl: string;
  nativeSymbol: string;
  oft: string; // OST / MyOFT
  farm?: string; // YieldFarmOFT (only on Sepolia)
};

// Deployed addresses from /deployments
export const ROOTSTOCK: ChainConfig = {
  key: "rootstock",
  name: "Rootstock Testnet",
  chainId: 31,
  chainHex: "0x1f",
  eid: 40350,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL_ROOTSTOCK_TESTNET || "https://public-node.testnet.rsk.co",
  nativeSymbol: "tRBTC",
  oft: "0xC5b58bC164DC5c935DC9cFa3cbc7525bc6f3bA11"
};

export const SEPOLIA: ChainConfig = {
  key: "sepolia",
  name: "Sepolia Testnet",
  chainId: 11155111,
  chainHex: "0xaa36a7",
  eid: 40161,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL_SEPOLIA || "https://ethereum-sepolia-rpc.publicnode.com",
  nativeSymbol: "ETH",
  oft: "0xC5b58bC164DC5c935DC9cFa3cbc7525bc6f3bA11",
  farm: "0x55f60c7790D9BEE3c6b59D4573ff099FCf1EBb7b"
};

export const CHAINS = {
  rootstock: ROOTSTOCK,
  sepolia: SEPOLIA
};

export const LZ_OPTIONS_HEX = "0x00030100110100000000000000000000000000030d40"; // executor gas 200k
export const DEFAULT_POOL_ID = 0; // YieldFarmOFT default pool

export function getStaticProvider(chain: ChainConfig) {
  return new ethers.providers.JsonRpcProvider(chain.rpcUrl, chain.chainId);
}

