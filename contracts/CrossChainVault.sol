// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { OAppReceiver } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppReceiver.sol";
import { OAppSender } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import { OApp } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

/**
 * @title CrossChainVault
 * @dev A vault that can receive deposits and send yield information across chains
 * @notice This contract manages cross-chain vault operations for yield optimization
 */
contract CrossChainVault is OApp {
    using SafeERC20 for IERC20;

    // Vault information
    struct VaultInfo {
        IERC20 asset;
        uint256 totalDeposits;
        uint256 totalShares;
        uint256 lastYieldUpdate;
        uint256 yieldRate; // Annual yield rate in basis points (10000 = 100%)
        bool active;
    }

    // User deposit information
    struct UserDeposit {
        uint256 shares;
        uint256 depositTime;
        uint256 lastClaimTime;
    }

    // Cross-chain message types
    uint16 constant MSG_DEPOSIT = 1;
    uint16 constant MSG_WITHDRAW = 2;
    uint16 constant MSG_YIELD_UPDATE = 3;
    uint16 constant MSG_CLAIM_YIELD = 4;

    // Events
    event VaultCreated(uint256 indexed vaultId, address indexed asset, uint256 yieldRate);
    event Deposited(address indexed user, uint256 indexed vaultId, uint256 amount, uint256 shares);
    event Withdrawn(address indexed user, uint256 indexed vaultId, uint256 shares, uint256 amount);
    event YieldClaimed(address indexed user, uint256 indexed vaultId, uint256 amount);
    event CrossChainMessage(uint32 indexed srcEid, bytes32 indexed sender, uint16 msgType);
    event YieldRateUpdated(uint256 indexed vaultId, uint256 newRate);

    // State variables
    mapping(uint256 => VaultInfo) public vaults;
    mapping(uint256 => mapping(address => UserDeposit)) public userDeposits;
    mapping(uint32 => bool) public trustedRemotes;
    uint256 public vaultCount;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    constructor(
        address _endpoint,
        address _delegate
    ) OApp(_endpoint, _delegate) Ownable(_delegate) {}

    /**
     * @dev Create a new vault
     * @param _asset Asset token for the vault
     * @param _yieldRate Annual yield rate in basis points
     */
    function createVault(IERC20 _asset, uint256 _yieldRate) external onlyOwner {
        require(address(_asset) != address(0), "Invalid asset");
        require(_yieldRate <= BASIS_POINTS, "Yield rate too high");

        vaults[vaultCount] = VaultInfo({
            asset: _asset,
            totalDeposits: 0,
            totalShares: 0,
            lastYieldUpdate: block.timestamp,
            yieldRate: _yieldRate,
            active: true
        });

        emit VaultCreated(vaultCount, address(_asset), _yieldRate);
        vaultCount++;
    }

    /**
     * @dev Deposit assets into a vault
     * @param _vaultId Vault ID to deposit into
     * @param _amount Amount to deposit
     */
    function deposit(uint256 _vaultId, uint256 _amount) external {
        require(_vaultId < vaultCount, "Vault does not exist");
        require(vaults[_vaultId].active, "Vault not active");
        require(_amount > 0, "Amount must be positive");

        VaultInfo storage vault = vaults[_vaultId];
        
        // Calculate shares to mint
        uint256 shares;
        if (vault.totalShares == 0) {
            shares = _amount;
        } else {
            shares = (_amount * vault.totalShares) / vault.totalDeposits;
        }

        // Update vault and user info
        vault.asset.safeTransferFrom(msg.sender, address(this), _amount);
        vault.totalDeposits += _amount;
        vault.totalShares += shares;

        UserDeposit storage userDeposit = userDeposits[_vaultId][msg.sender];
        userDeposit.shares += shares;
        if (userDeposit.depositTime == 0) {
            userDeposit.depositTime = block.timestamp;
            userDeposit.lastClaimTime = block.timestamp;
        }

        emit Deposited(msg.sender, _vaultId, _amount, shares);
    }

    /**
     * @dev Withdraw assets from a vault
     * @param _vaultId Vault ID to withdraw from
     * @param _shares Amount of shares to redeem
     */
    function withdraw(uint256 _vaultId, uint256 _shares) external {
        require(_vaultId < vaultCount, "Vault does not exist");
        require(_shares > 0, "Shares must be positive");

        UserDeposit storage userDeposit = userDeposits[_vaultId][msg.sender];
        require(userDeposit.shares >= _shares, "Insufficient shares");

        VaultInfo storage vault = vaults[_vaultId];
        
        // Calculate amount to withdraw
        uint256 amount = (_shares * vault.totalDeposits) / vault.totalShares;

        // Update vault and user info
        vault.totalDeposits -= amount;
        vault.totalShares -= _shares;
        userDeposit.shares -= _shares;

        vault.asset.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, _vaultId, _shares, amount);
    }

    /**
     * @dev Claim accumulated yield
     * @param _vaultId Vault ID to claim yield from
     */
    function claimYield(uint256 _vaultId) external {
        require(_vaultId < vaultCount, "Vault does not exist");

        uint256 yield = calculatePendingYield(_vaultId, msg.sender);
        require(yield > 0, "No yield to claim");

        UserDeposit storage userDeposit = userDeposits[_vaultId][msg.sender];
        userDeposit.lastClaimTime = block.timestamp;

        // Mint yield tokens (assuming this vault can mint reward tokens)
        // In a real implementation, this would interact with the yield farming contract
        
        emit YieldClaimed(msg.sender, _vaultId, yield);
    }

    /**
     * @dev Calculate pending yield for a user
     * @param _vaultId Vault ID
     * @param _user User address
     * @return Pending yield amount
     */
    function calculatePendingYield(uint256 _vaultId, address _user) public view returns (uint256) {
        if (_vaultId >= vaultCount) return 0;

        VaultInfo memory vault = vaults[_vaultId];
        UserDeposit memory userDeposit = userDeposits[_vaultId][_user];

        if (userDeposit.shares == 0) return 0;

        uint256 userAmount = (userDeposit.shares * vault.totalDeposits) / vault.totalShares;
        uint256 timeElapsed = block.timestamp - userDeposit.lastClaimTime;
        
        return (userAmount * vault.yieldRate * timeElapsed) / (BASIS_POINTS * SECONDS_PER_YEAR);
    }

    /**
     * @dev Send cross-chain message to update yield rates
     * @param _dstEid Destination endpoint ID
     * @param _vaultId Vault ID
     * @param _newYieldRate New yield rate
     * @param _options LayerZero options
     */
    function sendYieldUpdate(
        uint32 _dstEid,
        uint256 _vaultId,
        uint256 _newYieldRate,
        bytes calldata _options
    ) external payable onlyOwner {
        require(trustedRemotes[_dstEid], "Untrusted remote");
        
        bytes memory payload = abi.encode(MSG_YIELD_UPDATE, _vaultId, _newYieldRate);
        _lzSend(_dstEid, payload, _options, payable(msg.sender));
    }

    /**
     * @dev Handle incoming LayerZero messages
     * @param _origin Origin information
     * @param _payload Message payload
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 /* _guid */,
        bytes calldata _payload,
        address /* _executor */,
        bytes calldata /* _extraData */
    ) internal override {
        require(trustedRemotes[_origin.srcEid], "Untrusted source");

        (uint16 msgType, uint256 vaultId, uint256 data) = abi.decode(_payload, (uint16, uint256, uint256));

        if (msgType == MSG_YIELD_UPDATE && vaultId < vaultCount) {
            vaults[vaultId].yieldRate = data;
            vaults[vaultId].lastYieldUpdate = block.timestamp;
            emit YieldRateUpdated(vaultId, data);
        }

        emit CrossChainMessage(_origin.srcEid, _origin.sender, msgType);
    }

    /**
     * @dev Set trusted remote for cross-chain communication
     * @param _srcEid Source endpoint ID
     * @param _trusted Whether the remote is trusted
     */
    function setTrustedRemote(uint32 _srcEid, bool _trusted) external onlyOwner {
        trustedRemotes[_srcEid] = _trusted;
    }

    /**
     * @dev Update yield rate for a vault
     * @param _vaultId Vault ID
     * @param _newRate New yield rate in basis points
     */
    function updateYieldRate(uint256 _vaultId, uint256 _newRate) external onlyOwner {
        require(_vaultId < vaultCount, "Vault does not exist");
        require(_newRate <= BASIS_POINTS, "Rate too high");

        vaults[_vaultId].yieldRate = _newRate;
        vaults[_vaultId].lastYieldUpdate = block.timestamp;
        emit YieldRateUpdated(_vaultId, _newRate);
    }

    /**
     * @dev Set vault active status
     * @param _vaultId Vault ID
     * @param _active New active status
     */
    function setVaultActive(uint256 _vaultId, bool _active) external onlyOwner {
        require(_vaultId < vaultCount, "Vault does not exist");
        vaults[_vaultId].active = _active;
    }

    /**
     * @dev Get user vault information
     * @param _vaultId Vault ID
     * @param _user User address
     * @return shares User's shares
     * @return depositValue Current value of user's deposit
     * @return pendingYield Pending yield to claim
     */
    function getUserVaultInfo(uint256 _vaultId, address _user) 
        external view returns (uint256 shares, uint256 depositValue, uint256 pendingYield) 
    {
        if (_vaultId >= vaultCount) return (0, 0, 0);

        UserDeposit memory userDeposit = userDeposits[_vaultId][_user];
        VaultInfo memory vault = vaults[_vaultId];

        shares = userDeposit.shares;
        if (vault.totalShares > 0) {
            depositValue = (shares * vault.totalDeposits) / vault.totalShares;
        }
        pendingYield = calculatePendingYield(_vaultId, _user);
    }

    /**
     * @dev Emergency withdrawal function
     * @param _token Token to withdraw
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(IERC20 _token, uint256 _amount) external onlyOwner {
        _token.safeTransfer(owner(), _amount);
    }
}
