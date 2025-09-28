'use client';

import React from 'react';
import { DollarSign, TrendingUp, BarChart3, Shield, Wallet } from 'lucide-react';
import { VaultData, Position, Activity } from './vaultData';

// Header Component
interface HeaderProps {
  isConnected: boolean;
  onWalletConnect: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isConnected, onWalletConnect }) => {
  return (
    <header className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-blue-400 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">
            Cross-Chain <span className="text-purple-400">Vault</span>
          </span>
        </div>
        
        {/* Wallet Connection */}
        <div className="flex items-center gap-3">
          {isConnected && (
            <div className="flex items-center gap-2 bg-black/30 px-3 py-2 rounded-lg">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span className="text-sm text-white">Rootstock</span>
            </div>
          )}
          <button 
            onClick={onWalletConnect}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              isConnected 
                ? 'bg-green-600 text-white' 
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            <Wallet className="w-4 h-4" />
            {isConnected ? '0x742d...A8B3' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    </header>
  );
};

// Stats Dashboard Component
interface StatsDashboardProps {
  vaultData: VaultData;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ vaultData }) => {
  const stats = [
    {
      icon: DollarSign,
      value: `$${vaultData.totalDeposited}`,
      label: "Total Deposited",
      color: "text-green-400"
    },
    {
      icon: TrendingUp,
      value: vaultData.currentYield,
      label: "Current APY",
      color: "text-purple-400"
    },
    {
      icon: BarChart3,
      value: `$${vaultData.pendingRewards}`,
      label: "Pending Rewards",
      color: "text-yellow-400"
    },
    {
      icon: Shield,
      value: vaultData.activePositions.toString(),
      label: "Active Positions",
      color: "text-blue-400"
    }
  ];

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Your Portfolio Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`w-8 h-8 ${stat.color}`} />
              <span className="text-2xl font-bold text-white">{stat.value}</span>
            </div>
            <p className="text-gray-300 text-sm">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

// Active Positions Component
interface ActivePositionsProps {
  positions: Position[];
}

export const ActivePositions: React.FC<ActivePositionsProps> = ({ positions }) => {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
      <h3 className="text-xl font-bold text-white mb-4">Active Positions</h3>
      <div className="space-y-3">
        {positions.map((position) => (
          <div key={position.id} className="bg-black/20 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white font-medium">Position #{position.id}</span>
              <span className="text-green-400">{position.gainPercentage}</span>
            </div>
            <div className="text-sm text-gray-300">
              <p>Deposited: {position.deposited} MyOFT</p>
              <p>Current Value: {position.currentValue} MyOFT</p>
              <p>Chain: {position.chain}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Recent Activity Component
interface RecentActivityProps {
  activities: Activity[];
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ activities }) => {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
      <h3 className="text-xl font-bold text-white mb-4">Recent Activity</h3>
      <div className="space-y-3 text-sm">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-center gap-3">
            <div className={`w-2 h-2 ${activity.color} rounded-full`}></div>
            <span className="text-gray-300">{activity.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Tab Navigation Component
interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = ['deposit', 'withdraw', 'manage'];

  return (
    <div className="flex mb-6 bg-black/30 rounded-lg p-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`flex-1 py-2 px-4 rounded-md transition-all capitalize ${
            activeTab === tab
              ? 'bg-purple-600 text-white'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};

// Hero Section Component
interface HeroSectionProps {
  children: React.ReactNode;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ children }) => {
  return (
    <section className="mb-12">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold text-white mb-4">
          Auto-Farm Across Chains
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Bridge to Sepolia, earn yield, return profits home. All automated.
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
          {children}
        </div>
      </div>
    </section>
  );
};

// Footer Component
export const Footer: React.FC = () => {
  return (
    <div className="mt-12 text-center">
      <p className="text-gray-400">
        Powered by LayerZero V2 • Secured by multi-chain architecture
      </p>
    </div>
  );
};