// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { OApp } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { Origin } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { MessagingFee } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

/**
 * @title RewardsDistributor
 * @dev Cross-chain rewards distribution contract for yield farming protocol
 * @notice Manages distribution of rewards across multiple chains and protocols
 */
contract RewardsDistributor is OApp {
    using SafeERC20 for IERC20;

    // Reward pool structure
    struct RewardPool {
        IERC20 rewardToken;
        uint256 totalRewards;
        uint256 distributedRewards;
        uint256 startTime;
        uint256 endTime;
        uint256 rewardRate;
        bool active;
        mapping(address => uint256) userRewards;
        mapping(address => uint256) userClaimedRewards;
    }

    // Cross-chain reward claim
    struct CrossChainClaim {
        address user;
        uint256 amount;
        uint32 srcEid;
        bool processed;
    }

    // Merkle distribution for gas-efficient mass distributions
    struct MerkleDistribution {
        bytes32 merkleRoot;
        uint256 totalAmount;
        uint256 claimedAmount;
        uint256 startTime;
        uint256 endTime;
        mapping(address => bool) claimed;
    }

    // Events
    event RewardPoolCreated(uint256 indexed poolId, address indexed rewardToken, uint256 totalRewards);
    event RewardsClaimed(address indexed user, uint256 indexed poolId, uint256 amount);
    event CrossChainRewardsReceived(uint32 indexed srcEid, address indexed user, uint256 amount);
    event CrossChainRewardsSent(uint32 indexed dstEid, address indexed user, uint256 amount);
    event MerkleDistributionCreated(uint256 indexed distributionId, bytes32 merkleRoot, uint256 totalAmount);
    event MerkleRewardsClaimed(address indexed user, uint256 indexed distributionId, uint256 amount);
    event RewardRateUpdated(uint256 indexed poolId, uint256 newRate);

    // Message types for cross-chain communication
    uint16 constant MSG_CLAIM_REWARDS = 1;
    uint16 constant MSG_DISTRIBUTE_REWARDS = 2;
    uint16 constant MSG_UPDATE_RATES = 3;

    // State variables
    mapping(uint256 => RewardPool) public rewardPools;
    mapping(uint256 => MerkleDistribution) public merkleDistributions;
    mapping(bytes32 => CrossChainClaim) public crossChainClaims;
    mapping(uint32 => bool) public trustedRemotes;
    mapping(address => bool) public authorizedDistributors;
    
    uint256 public poolCount;
    uint256 public distributionCount;
    uint256 public totalCrossChainVolume;
    
    // Fee configuration
    uint256 public crossChainFee = 100; // 1% fee for cross-chain operations
    uint256 public constant FEE_DENOMINATOR = 10000;
    address public feeRecipient;

    constructor(
        address _endpoint,
        address _delegate
    ) OApp(_endpoint, _delegate) Ownable(_delegate) {
        feeRecipient = _delegate;
        authorizedDistributors[_delegate] = true;
    }

    modifier onlyAuthorized() {
        require(authorizedDistributors[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    /**
     * @dev Create a new reward pool
     * @param _rewardToken Token to distribute as rewards
     * @param _totalRewards Total amount of rewards to distribute
     * @param _duration Duration of the reward distribution in seconds
     */
    function createRewardPool(
        IERC20 _rewardToken,
        uint256 _totalRewards,
        uint256 _duration
    ) external onlyAuthorized {
        require(address(_rewardToken) != address(0), "Invalid reward token");
        require(_totalRewards > 0, "Total rewards must be positive");
        require(_duration > 0, "Duration must be positive");

        _rewardToken.safeTransferFrom(msg.sender, address(this), _totalRewards);

        RewardPool storage pool = rewardPools[poolCount];
        pool.rewardToken = _rewardToken;
        pool.totalRewards = _totalRewards;
        pool.distributedRewards = 0;
        pool.startTime = block.timestamp;
        pool.endTime = block.timestamp + _duration;
        pool.rewardRate = _totalRewards / _duration;
        pool.active = true;

        emit RewardPoolCreated(poolCount, address(_rewardToken), _totalRewards);
        poolCount++;
    }

    /**
     * @dev Allocate rewards to a user in a specific pool
     * @param _poolId Pool ID
     * @param _user User address
     * @param _amount Amount of rewards to allocate
     */
    function allocateRewards(uint256 _poolId, address _user, uint256 _amount) external onlyAuthorized {
        require(_poolId < poolCount, "Pool does not exist");
        require(rewardPools[_poolId].active, "Pool not active");
        require(_user != address(0), "Invalid user address");

        RewardPool storage pool = rewardPools[_poolId];
        require(pool.distributedRewards + _amount <= pool.totalRewards, "Exceeds total rewards");

        pool.userRewards[_user] += _amount;
        pool.distributedRewards += _amount;
    }

    /**
     * @dev Claim rewards from a pool
     * @param _poolId Pool ID to claim from
     */
    function claimRewards(uint256 _poolId) external {
        require(_poolId < poolCount, "Pool does not exist");
        
        RewardPool storage pool = rewardPools[_poolId];
        uint256 claimableAmount = pool.userRewards[msg.sender] - pool.userClaimedRewards[msg.sender];
        require(claimableAmount > 0, "No rewards to claim");

        pool.userClaimedRewards[msg.sender] = pool.userRewards[msg.sender];
        pool.rewardToken.safeTransfer(msg.sender, claimableAmount);

        emit RewardsClaimed(msg.sender, _poolId, claimableAmount);
    }

    /**
     * @dev Claim rewards and send to another chain
     * @param _poolId Pool ID to claim from
     * @param _dstEid Destination chain endpoint ID
     * @param _options LayerZero options
     */
    function claimAndSendCrossChain(
        uint256 _poolId,
        uint32 _dstEid,
        bytes calldata _options
    ) external payable {
        require(_poolId < poolCount, "Pool does not exist");
        require(trustedRemotes[_dstEid], "Untrusted destination");

        RewardPool storage pool = rewardPools[_poolId];
        uint256 claimableAmount = pool.userRewards[msg.sender] - pool.userClaimedRewards[msg.sender];
        require(claimableAmount > 0, "No rewards to claim");

        // Apply cross-chain fee
        uint256 fee = (claimableAmount * crossChainFee) / FEE_DENOMINATOR;
        uint256 netAmount = claimableAmount - fee;

        pool.userClaimedRewards[msg.sender] = pool.userRewards[msg.sender];
        
        // Send fee to fee recipient
        if (fee > 0) {
            pool.rewardToken.safeTransfer(feeRecipient, fee);
        }

        // Prepare cross-chain message
        bytes memory payload = abi.encode(MSG_DISTRIBUTE_REWARDS, msg.sender, netAmount);
        MessagingFee memory feeInfo = MessagingFee({ nativeFee: msg.value, lzTokenFee: 0 });
        _lzSend(_dstEid, payload, _options, feeInfo, payable(msg.sender));

        totalCrossChainVolume += netAmount;
        emit RewardsClaimed(msg.sender, _poolId, claimableAmount);
        emit CrossChainRewardsSent(_dstEid, msg.sender, netAmount);
    }

    /**
     * @dev Create a merkle-based reward distribution
     * @param _merkleRoot Merkle root of the reward distribution
     * @param _totalAmount Total amount to distribute
     * @param _duration Duration for which the distribution is valid
     */
    function createMerkleDistribution(
        bytes32 _merkleRoot,
        uint256 _totalAmount,
        uint256 _duration
    ) external onlyAuthorized {
        require(_merkleRoot != bytes32(0), "Invalid merkle root");
        require(_totalAmount > 0, "Total amount must be positive");

        MerkleDistribution storage distribution = merkleDistributions[distributionCount];
        distribution.merkleRoot = _merkleRoot;
        distribution.totalAmount = _totalAmount;
        distribution.claimedAmount = 0;
        distribution.startTime = block.timestamp;
        distribution.endTime = block.timestamp + _duration;

        emit MerkleDistributionCreated(distributionCount, _merkleRoot, _totalAmount);
        distributionCount++;
    }

    /**
     * @dev Claim rewards from merkle distribution
     * @param _distributionId Distribution ID
     * @param _amount Amount to claim
     * @param _merkleProof Merkle proof
     */
    function claimMerkleRewards(
        uint256 _distributionId,
        uint256 _amount,
        bytes32[] calldata _merkleProof
    ) external {
        require(_distributionId < distributionCount, "Distribution does not exist");
        
        MerkleDistribution storage distribution = merkleDistributions[_distributionId];
        require(block.timestamp >= distribution.startTime, "Distribution not started");
        require(block.timestamp <= distribution.endTime, "Distribution ended");
        require(!distribution.claimed[msg.sender], "Already claimed");

        // Verify merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, _amount));
        require(_verifyMerkleProof(_merkleProof, distribution.merkleRoot, leaf), "Invalid proof");

        distribution.claimed[msg.sender] = true;
        distribution.claimedAmount += _amount;

        // In a real implementation, you'd need to have the reward tokens available
        // This is a simplified version
        emit MerkleRewardsClaimed(msg.sender, _distributionId, _amount);
    }

    /**
     * @dev Handle incoming LayerZero messages
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 /* _guid */,
        bytes calldata _payload,
        address /* _executor */,
        bytes calldata /* _extraData */
    ) internal override {
        require(trustedRemotes[_origin.srcEid], "Untrusted source");

        (uint16 msgType, address user, uint256 amount) = abi.decode(_payload, (uint16, address, uint256));

        if (msgType == MSG_DISTRIBUTE_REWARDS) {
            // Handle cross-chain reward distribution
            // In a real implementation, you'd mint or transfer tokens here
            emit CrossChainRewardsReceived(_origin.srcEid, user, amount);
        }
    }

    /**
     * @dev Get claimable rewards for a user in a pool
     * @param _poolId Pool ID
     * @param _user User address
     * @return Claimable reward amount
     */
    function getClaimableRewards(uint256 _poolId, address _user) external view returns (uint256) {
        if (_poolId >= poolCount) return 0;
        
        RewardPool storage pool = rewardPools[_poolId];
        return pool.userRewards[_user] - pool.userClaimedRewards[_user];
    }

    /**
     * @dev Get user's total rewards across all pools
     * @param _user User address
     * @return Total allocated rewards
     * @return Total claimed rewards
     */
    function getUserTotalRewards(address _user) external view returns (uint256, uint256) {
        uint256 totalAllocated = 0;
        uint256 totalClaimed = 0;

        for (uint256 i = 0; i < poolCount; i++) {
            RewardPool storage pool = rewardPools[i];
            totalAllocated += pool.userRewards[_user];
            totalClaimed += pool.userClaimedRewards[_user];
        }

        return (totalAllocated, totalClaimed);
    }

    /**
     * @dev Set authorized distributor
     * @param _distributor Address to authorize/unauthorize
     * @param _authorized Authorization status
     */
    function setAuthorizedDistributor(address _distributor, bool _authorized) external onlyOwner {
        authorizedDistributors[_distributor] = _authorized;
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
     * @dev Update cross-chain fee
     * @param _newFee New fee in basis points
     */
    function setCrossChainFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= 1000, "Fee too high"); // Max 10%
        crossChainFee = _newFee;
    }

    /**
     * @dev Set fee recipient
     * @param _newRecipient New fee recipient address
     */
    function setFeeRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Invalid recipient");
        feeRecipient = _newRecipient;
    }

    /**
     * @dev Update reward rate for a pool
     * @param _poolId Pool ID
     * @param _newRate New reward rate
     */
    function updateRewardRate(uint256 _poolId, uint256 _newRate) external onlyAuthorized {
        require(_poolId < poolCount, "Pool does not exist");
        rewardPools[_poolId].rewardRate = _newRate;
        emit RewardRateUpdated(_poolId, _newRate);
    }

    /**
     * @dev Verify merkle proof
     * @param proof Merkle proof
     * @param root Merkle root
     * @param leaf Leaf to verify
     * @return True if proof is valid
     */
    function _verifyMerkleProof(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return computedHash == root;
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
