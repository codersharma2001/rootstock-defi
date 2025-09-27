// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OFT } from "@layerzerolabs/oft-evm/contracts/OFT.sol";
import { SendParam } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { MessagingFee } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title YieldFarmOFT
 * @dev Cross-chain yield farming token with staking and rewards functionality
 * @notice This contract extends OFT to enable cross-chain yield farming
 */
contract YieldFarmOFT is OFT {
    using SafeERC20 for IERC20;
    // Staking pool structure
    struct StakingPool {
        IERC20 stakingToken;
        uint256 rewardRate; // Reward tokens per second
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
        uint256 totalStaked;
        bool active;
    }

    // User staking info
    struct UserInfo {
        uint256 stakedAmount;
        uint256 userRewardPerTokenPaid;
        uint256 rewards;
        uint256 lastStakeTime;
    }

    // Events
    event PoolAdded(uint256 indexed poolId, address indexed stakingToken, uint256 rewardRate);
    event PoolUpdated(uint256 indexed poolId, uint256 newRewardRate);
    event Staked(address indexed user, uint256 indexed poolId, uint256 amount);
    event Withdrawn(address indexed user, uint256 indexed poolId, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 indexed poolId, uint256 amount);
    event CrossChainRewardsSent(address indexed user, uint32 indexed dstEid, uint256 amount);

    // State variables
    mapping(uint256 => StakingPool) public stakingPools;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    uint256 public poolCount;
    uint256 public constant REWARD_DURATION = 7 days;
    uint256 public constant MIN_STAKE_AMOUNT = 1e18; // 1 token minimum
    uint256 public constant EARLY_WITHDRAWAL_FEE = 250; // 2.5% fee for early withdrawal (within 24h)
    uint256 public constant FEE_DENOMINATOR = 10000;

    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate
    ) OFT(_name, _symbol, _lzEndpoint, _delegate) Ownable(_delegate) {}

    /**
     * @dev Add a new staking pool
     * @param _stakingToken Token to be staked in this pool
     * @param _rewardRate Reward tokens per second
     */
    function addPool(IERC20 _stakingToken, uint256 _rewardRate) external onlyOwner {
        require(address(_stakingToken) != address(0), "Invalid staking token");
        require(_rewardRate > 0, "Reward rate must be positive");

        stakingPools[poolCount] = StakingPool({
            stakingToken: _stakingToken,
            rewardRate: _rewardRate,
            lastUpdateTime: block.timestamp,
            rewardPerTokenStored: 0,
            totalStaked: 0,
            active: true
        });

        emit PoolAdded(poolCount, address(_stakingToken), _rewardRate);
        poolCount++;
    }

    /**
     * @dev Update reward rate for a pool
     * @param _poolId Pool ID to update
     * @param _rewardRate New reward rate
     */
    function updatePool(uint256 _poolId, uint256 _rewardRate) external onlyOwner {
        require(_poolId < poolCount, "Pool does not exist");
        _updateReward(_poolId, address(0));
        
        stakingPools[_poolId].rewardRate = _rewardRate;
        emit PoolUpdated(_poolId, _rewardRate);
    }

    /**
     * @dev Stake tokens in a pool
     * @param _poolId Pool ID to stake in
     * @param _amount Amount to stake
     */
    function stake(uint256 _poolId, uint256 _amount) external {
        require(_poolId < poolCount, "Pool does not exist");
        require(stakingPools[_poolId].active, "Pool is not active");
        require(_amount >= MIN_STAKE_AMOUNT, "Amount below minimum");

        _updateReward(_poolId, msg.sender);

        stakingPools[_poolId].stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        stakingPools[_poolId].totalStaked += _amount;
        userInfo[_poolId][msg.sender].stakedAmount += _amount;
        userInfo[_poolId][msg.sender].lastStakeTime = block.timestamp;

        emit Staked(msg.sender, _poolId, _amount);
    }

    /**
     * @dev Withdraw staked tokens from a pool
     * @param _poolId Pool ID to withdraw from
     * @param _amount Amount to withdraw
     */
    function withdraw(uint256 _poolId, uint256 _amount) external {
        require(_poolId < poolCount, "Pool does not exist");
        require(userInfo[_poolId][msg.sender].stakedAmount >= _amount, "Insufficient staked amount");

        _updateReward(_poolId, msg.sender);

        uint256 amountToTransfer = _amount;
        
        // Apply early withdrawal fee if withdrawing within 24 hours
        if (block.timestamp < userInfo[_poolId][msg.sender].lastStakeTime + 1 days) {
            uint256 fee = (_amount * EARLY_WITHDRAWAL_FEE) / FEE_DENOMINATOR;
            amountToTransfer = _amount - fee;
            // Fee stays in the contract as additional rewards
        }

        stakingPools[_poolId].totalStaked -= _amount;
        userInfo[_poolId][msg.sender].stakedAmount -= _amount;

        stakingPools[_poolId].stakingToken.safeTransfer(msg.sender, amountToTransfer);

        emit Withdrawn(msg.sender, _poolId, _amount);
    }

    /**
     * @dev Claim rewards from a pool
     * @param _poolId Pool ID to claim rewards from
     */
    function claimRewards(uint256 _poolId) external {
        require(_poolId < poolCount, "Pool does not exist");
        
        _updateReward(_poolId, msg.sender);
        
        uint256 reward = userInfo[_poolId][msg.sender].rewards;
        if (reward > 0) {
            userInfo[_poolId][msg.sender].rewards = 0;
            _mint(msg.sender, reward);
            emit RewardsClaimed(msg.sender, _poolId, reward);
        }
    }

    /**
     * @dev Claim rewards and send them to another chain
     * @param _poolId Pool ID to claim rewards from
     * @param _dstEid Destination chain endpoint ID
     * @param _options LayerZero options for the cross-chain transfer
     */
    function claimAndSendCrossChain(
        uint256 _poolId,
        uint32 _dstEid,
        bytes calldata _options
    ) external payable {
        require(_poolId < poolCount, "Pool does not exist");
        
        _updateReward(_poolId, msg.sender);
        
        uint256 reward = userInfo[_poolId][msg.sender].rewards;
        require(reward > 0, "No rewards to claim");
        
        userInfo[_poolId][msg.sender].rewards = 0;
        _mint(address(this), reward);

        // Prepare OFT send parameters
        SendParam memory sendParam = SendParam({
            dstEid: _dstEid,
            to: bytes32(uint256(uint160(msg.sender))),
            amountLD: reward,
            minAmountLD: reward,
            extraOptions: _options,
            composeMsg: bytes(""),
            oftCmd: bytes("")
        });

        MessagingFee memory feeInfo = MessagingFee({ nativeFee: msg.value, lzTokenFee: 0 });
        this.send{ value: msg.value }(sendParam, feeInfo, msg.sender);

        emit RewardsClaimed(msg.sender, _poolId, reward);
        emit CrossChainRewardsSent(msg.sender, _dstEid, reward);
    }

    /**
     * @dev Get pending rewards for a user in a pool
     * @param _poolId Pool ID
     * @param _user User address
     * @return Pending reward amount
     */
    function pendingRewards(uint256 _poolId, address _user) external view returns (uint256) {
        if (_poolId >= poolCount) return 0;
        
        StakingPool memory pool = stakingPools[_poolId];
        UserInfo memory user = userInfo[_poolId][_user];
        
        uint256 rewardPerToken = pool.rewardPerTokenStored;
        if (pool.totalStaked > 0) {
            rewardPerToken += ((block.timestamp - pool.lastUpdateTime) * pool.rewardRate * 1e18) / pool.totalStaked;
        }
        
        return user.stakedAmount * (rewardPerToken - user.userRewardPerTokenPaid) / 1e18 + user.rewards;
    }

    /**
     * @dev Get user staking info
     * @param _poolId Pool ID
     * @param _user User address
     * @return stakedAmount Amount staked by user
     * @return pendingReward Pending rewards
     * @return lastStakeTime Last time user staked
     */
    function getUserInfo(uint256 _poolId, address _user) 
        external view returns (uint256 stakedAmount, uint256 pendingReward, uint256 lastStakeTime) 
    {
        if (_poolId >= poolCount) return (0, 0, 0);
        
        UserInfo memory user = userInfo[_poolId][_user];
        return (
            user.stakedAmount,
            this.pendingRewards(_poolId, _user),
            user.lastStakeTime
        );
    }

    /**
     * @dev Internal function to update rewards
     * @param _poolId Pool ID
     * @param _user User address (address(0) to update pool only)
     */
    function _updateReward(uint256 _poolId, address _user) internal {
        StakingPool storage pool = stakingPools[_poolId];
        
        if (pool.totalStaked > 0) {
            pool.rewardPerTokenStored += 
                ((block.timestamp - pool.lastUpdateTime) * pool.rewardRate * 1e18) / pool.totalStaked;
        }
        pool.lastUpdateTime = block.timestamp;

        if (_user != address(0)) {
            UserInfo storage user = userInfo[_poolId][_user];
            user.rewards += (user.stakedAmount * (pool.rewardPerTokenStored - user.userRewardPerTokenPaid)) / 1e18;
            user.userRewardPerTokenPaid = pool.rewardPerTokenStored;
        }
    }

    /**
     * @dev Emergency function to pause/unpause a pool
     * @param _poolId Pool ID
     * @param _active New active status
     */
    function setPoolActive(uint256 _poolId, bool _active) external onlyOwner {
        require(_poolId < poolCount, "Pool does not exist");
        stakingPools[_poolId].active = _active;
    }

    /**
     * @dev Emergency withdrawal function for owner
     * @param _token Token to withdraw
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(IERC20 _token, uint256 _amount) external onlyOwner {
        _token.safeTransfer(owner(), _amount);
    }
}
