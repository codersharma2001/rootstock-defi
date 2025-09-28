// Types
export interface VaultData {
  totalDeposited: string;
  currentYield: string;
  pendingRewards: string;
  activePositions: number;
}

export interface Position {
  id: number;
  deposited: number;
  currentValue: number;
  gainPercentage: string;
  chain: string;
}

export interface Activity {
  id: number;
  type: 'harvest' | 'bridge' | 'compound';
  description: string;
  color: string;
}

export type TabType = 'deposit' | 'withdraw' | 'manage';

// Mock Data
export const mockVaultData: VaultData = {
  totalDeposited: "1,250.45",
  currentYield: "8.7%",
  pendingRewards: "45.32",
  activePositions: 3
};

export const mockPositions: Position[] = [
  {
    id: 1,
    deposited: 500,
    currentValue: 562.5,
    gainPercentage: "+12.5%",
    chain: "Sepolia → Rootstock"
  },
  {
    id: 2,
    deposited: 750,
    currentValue: 811.5,
    gainPercentage: "+8.2%",
    chain: "Sepolia → Rootstock"
  }
];

export const mockActivities: Activity[] = [
  {
    id: 1,
    type: 'harvest',
    description: "Harvested 15.2 rewards",
    color: "bg-green-400"
  },
  {
    id: 2,
    type: 'bridge',
    description: "Bridged 500 MyOFT to Sepolia",
    color: "bg-blue-400"
  },
  {
    id: 3,
    type: 'compound',
    description: "Auto-compound enabled",
    color: "bg-purple-400"
  }
];

export const userBalance = "2,450.75";