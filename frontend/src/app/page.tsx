'use client';

import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, DollarSign, TrendingUp, Wallet, Settings, RefreshCw, BarChart3, Shield } from 'lucide-react';

const CrossChainVaultPage = () => {
  const [activeTab, setActiveTab] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const mockData = {
    totalDeposited: "1,250.45",
    currentYield: "8.7%",
    pendingRewards: "45.32",
    activePositions: 3
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header Navigation */}
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
              onClick={() => setIsConnected(!isConnected)}
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

      <div className="container mx-auto px-4 pb-8">
        
        {/* Hero Section - Vault Operations */}
        <section className="mb-12">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-white mb-4">
              Auto-Farm Across Chains
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Bridge to Sepolia, earn yield, return profits home. All automated.
            </p>
          </div>

          {/* Main Vault Interface */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
              
              {/* Tab Navigation */}
              <div className="flex mb-6 bg-black/30 rounded-lg p-1">
                {['deposit', 'withdraw', 'manage'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
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

              {/* Deposit Tab */}
              {activeTab === 'deposit' && (
                <div className="space-y-6">
                  {/* Balance Display */}
                  <div className="bg-black/20 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Your MyOFT Balance:</span>
                      <span className="text-white font-bold">2,450.75 MyOFT</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Don't have MyOFT? <button className="text-purple-400 underline">Buy/Mint Here</button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-white mb-2">Amount to Deposit</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full p-4 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-400 text-xl"
                      />
                      <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-400 hover:text-purple-300">
                        MAX
                      </button>
                    </div>
                  </div>

                  {/* Transaction Steps Preview */}
                  {amount && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                      <p className="text-blue-300 font-medium mb-3">Required Transactions:</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                          <span className="text-gray-300">1. Approve MyOFT spending</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                          <span className="text-gray-300">2. Deposit to vault (triggers auto-bridge)</span>
                        </div>
                      </div>
                      <p className="text-xs text-blue-200 mt-2">
                        Est. gas: ~0.01 RBTC | Bridge time: 5-10 minutes
                      </p>
                    </div>
                  )}
                  
                  {/* Chain Flow Visualization */}
                  <div className="bg-black/20 rounded-lg p-4">
                    <p className="text-gray-300 mb-3">Automatic Journey:</p>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-white">Rootstock Vault</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-white">Sepolia Farm</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-white">Auto Return</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    disabled={!isConnected || !amount}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-lg font-semibold text-lg transition-all"
                  >
                    {!isConnected ? 'Connect Wallet First' : 
                     !amount ? 'Enter Amount' : 
                     `Deposit ${amount} MyOFT`}
                  </button>

                  {/* Warning */}
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-yellow-300 text-xs">
                      ⚠️ Your funds will be bridged to Sepolia automatically. Bridge transactions are irreversible.
                    </p>
                  </div>
                </div>
              )}

              {/* Withdraw Tab */}
              {activeTab === 'withdraw' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-white mb-2">Amount to Withdraw</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-full p-4 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-400 text-xl"
                    />
                  </div>
                  
                  <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4">
                    <p className="text-yellow-300 text-sm">
                      ⚠️ Withdrawing will harvest current rewards and bridge back to Rootstock
                    </p>
                  </div>

                  <button className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white py-4 rounded-lg font-semibold text-lg transition-all">
                    Harvest & Return Home
                  </button>
                </div>
              )}

              {/* Manage Tab */}
              {activeTab === 'manage' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-white">Auto-Compound Rewards</span>
                    <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-all">
                      Enabled
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-white">Harvest Frequency</span>
                    <select className="bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white">
                      <option>Daily</option>
                      <option>Weekly</option>
                      <option>Monthly</option>
                    </select>
                  </div>

                  <button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-4 rounded-lg font-semibold text-lg transition-all flex items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5" />
                    Manual Harvest
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Stats Dashboard */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Your Portfolio Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 text-green-400" />
                <span className="text-2xl font-bold text-white">${mockData.totalDeposited}</span>
              </div>
              <p className="text-gray-300 text-sm">Total Deposited</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-8 h-8 text-purple-400" />
                <span className="text-2xl font-bold text-white">{mockData.currentYield}</span>
              </div>
              <p className="text-gray-300 text-sm">Current APY</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <BarChart3 className="w-8 h-8 text-yellow-400" />
                <span className="text-2xl font-bold text-white">${mockData.pendingRewards}</span>
              </div>
              <p className="text-gray-300 text-sm">Pending Rewards</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <Shield className="w-8 h-8 text-blue-400" />
                <span className="text-2xl font-bold text-white">{mockData.activePositions}</span>
              </div>
              <p className="text-gray-300 text-sm">Active Positions</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Active Positions */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">Active Positions</h3>
            <div className="space-y-3">
              <div className="bg-black/20 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white font-medium">Position #1</span>
                  <span className="text-green-400">+12.5%</span>
                </div>
                <div className="text-sm text-gray-300">
                  <p>Deposited: 500 MyOFT</p>
                  <p>Current Value: 562.5 MyOFT</p>
                  <p>Chain: Sepolia → Rootstock</p>
                </div>
              </div>
              
              <div className="bg-black/20 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white font-medium">Position #2</span>
                  <span className="text-green-400">+8.2%</span>
                </div>
                <div className="text-sm text-gray-300">
                  <p>Deposited: 750 MyOFT</p>
                  <p>Current Value: 811.5 MyOFT</p>
                  <p>Chain: Sepolia → Rootstock</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">Recent Activity</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-gray-300">Harvested 15.2 rewards</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-gray-300">Bridged 500 MyOFT to Sepolia</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <span className="text-gray-300">Auto-compound enabled</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center">
          <p className="text-gray-400">
            Powered by LayerZero V2 • Secured by multi-chain architecture
          </p>
        </div>
      </div>
    </div>
  );
};

export default CrossChainVaultPage;