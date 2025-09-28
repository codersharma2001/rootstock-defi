'use client';

import React, { useState } from 'react';
import { 
  Header, 
  StatsDashboard, 
  ActivePositions, 
  RecentActivity, 
  TabNavigation, 
  HeroSection, 
  Footer 
} from './components/VaultComponents';
import { DepositForm, WithdrawForm, ManageForm } from './components/VaultForms';
import { 
  mockVaultData, 
  mockPositions, 
  mockActivities, 
  userBalance,
  TabType 
} from './components/vaultData';

export default function CrossChainVaultPage() {
  // State management
  const [activeTab, setActiveTab] = useState<TabType>('deposit');
  const [amount, setAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [autoCompoundEnabled, setAutoCompoundEnabled] = useState(true);
  const [harvestFrequency, setHarvestFrequency] = useState('daily');

  // Event handlers
  const handleWalletConnect = () => {
    setIsConnected(!isConnected);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
  };

  const handleMaxClick = () => {
    setAmount(userBalance);
  };

  const handleDeposit = () => {
    if (!isConnected || !amount) return;
    // Deposit logic here
    console.log('Depositing:', amount);
    alert(`Depositing ${amount} MyOFT`);
  };

  const handleWithdraw = () => {
    if (!withdrawAmount) return;
    // Withdraw logic here
    console.log('Withdrawing:', withdrawAmount);
    alert(`Withdrawing ${withdrawAmount} MyOFT`);
  };

  const handleAutoCompoundToggle = () => {
    setAutoCompoundEnabled(!autoCompoundEnabled);
  };

  const handleManualHarvest = () => {
    // Manual harvest logic here
    console.log('Manual harvest triggered');
    alert('Manual harvest initiated');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'deposit':
        return (
          <DepositForm
            amount={amount}
            userBalance={userBalance}
            isConnected={isConnected}
            onAmountChange={setAmount}
            onMaxClick={handleMaxClick}
            onDeposit={handleDeposit}
          />
        );
      case 'withdraw':
        return (
          <WithdrawForm
            withdrawAmount={withdrawAmount}
            onWithdrawAmountChange={setWithdrawAmount}
            onWithdraw={handleWithdraw}
          />
        );
      case 'manage':
        return (
          <ManageForm
            autoCompoundEnabled={autoCompoundEnabled}
            harvestFrequency={harvestFrequency}
            onAutoCompoundToggle={handleAutoCompoundToggle}
            onHarvestFrequencyChange={setHarvestFrequency}
            onManualHarvest={handleManualHarvest}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <Header 
        isConnected={isConnected} 
        onWalletConnect={handleWalletConnect} 
      />

      <div className="container mx-auto px-4 pb-8">
        {/* Hero Section - Vault Operations */}
        <HeroSection>
          <TabNavigation 
            activeTab={activeTab} 
            onTabChange={handleTabChange} 
          />
          {renderTabContent()}
        </HeroSection>

        {/* Stats Dashboard */}
        <StatsDashboard vaultData={mockVaultData} />

        {/* Positions and Activity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ActivePositions positions={mockPositions} />
          <RecentActivity activities={mockActivities} />
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}