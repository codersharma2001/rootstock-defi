'use client';

import React from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';

// Deposit Form Component
interface DepositFormProps {
  amount: string;
  userBalance: string;
  isConnected: boolean;
  onAmountChange: (amount: string) => void;
  onMaxClick: () => void;
  onDeposit: () => void;
}

export const DepositForm: React.FC<DepositFormProps> = ({
  amount,
  userBalance,
  isConnected,
  onAmountChange,
  onMaxClick,
  onDeposit
}) => {
  return (
    <div className="space-y-6">
      {/* Balance Display */}
      <div className="bg-black/20 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-300">Your MyOFT Balance:</span>
          <span className="text-white font-bold">{userBalance} MyOFT</span>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Don&apos;t have MyOFT? <button className="text-purple-400 underline">Buy/Mint Here</button>
        </div>
      </div>

      <div>
        <label className="block text-white mb-2">Amount to Deposit</label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.00"
            className="w-full p-4 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-400 text-xl"
          />
          <button 
            onClick={onMaxClick}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-400 hover:text-purple-300"
          >
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
        onClick={onDeposit}
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
  );
};

// Withdraw Form Component
interface WithdrawFormProps {
  withdrawAmount: string;
  onWithdrawAmountChange: (amount: string) => void;
  onWithdraw: () => void;
}

export const WithdrawForm: React.FC<WithdrawFormProps> = ({
  withdrawAmount,
  onWithdrawAmountChange,
  onWithdraw
}) => {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-white mb-2">Amount to Withdraw</label>
        <input
          type="number"
          value={withdrawAmount}
          onChange={(e) => onWithdrawAmountChange(e.target.value)}
          placeholder="0.00"
          className="w-full p-4 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-400 text-xl"
        />
      </div>
      
      <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4">
        <p className="text-yellow-300 text-sm">
          ⚠️ Withdrawing will harvest current rewards and bridge back to Rootstock
        </p>
      </div>

      <button 
        onClick={onWithdraw}
        className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white py-4 rounded-lg font-semibold text-lg transition-all"
      >
        Harvest & Return Home
      </button>
    </div>
  );
};

// Manage Form Component
interface ManageFormProps {
  autoCompoundEnabled: boolean;
  harvestFrequency: string;
  onAutoCompoundToggle: () => void;
  onHarvestFrequencyChange: (frequency: string) => void;
  onManualHarvest: () => void;
}

export const ManageForm: React.FC<ManageFormProps> = ({
  autoCompoundEnabled,
  harvestFrequency,
  onAutoCompoundToggle,
  onHarvestFrequencyChange,
  onManualHarvest
}) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <span className="text-white">Auto-Compound Rewards</span>
        <button 
          onClick={onAutoCompoundToggle}
          className={`px-4 py-2 rounded-lg transition-all ${
            autoCompoundEnabled 
              ? 'bg-purple-600 hover:bg-purple-700 text-white' 
              : 'bg-gray-600 hover:bg-gray-700 text-white'
          }`}
        >
          {autoCompoundEnabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-white">Harvest Frequency</span>
        <select 
          value={harvestFrequency}
          onChange={(e) => onHarvestFrequencyChange(e.target.value)}
          className="bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      <button 
        onClick={onManualHarvest}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-4 rounded-lg font-semibold text-lg transition-all flex items-center justify-center gap-2"
      >
        <RefreshCw className="w-5 h-5" />
        Manual Harvest
      </button>
    </div>
  );
};