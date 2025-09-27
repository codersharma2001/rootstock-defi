// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IYieldFarm {
    function stake(uint256 poolId, uint256 amount) external;
    function withdraw(uint256 poolId, uint256 amount) external;
    function claimRewards(uint256 poolId) external;
    function userInfo(uint256 poolId, address user)
        external
        view
        returns (uint256 stakedAmount, uint256 userRewardPerTokenPaid, uint256 rewards, uint256 lastStakeTime);
}

/**
 * @title VaultLifecycleManager
 * @notice Coordinates farming for bridged assets and orchestrates exits back to the origin chain.
 */
contract VaultLifecycleManager is Ownable {
    using SafeERC20 for IERC20;

    struct Position {
        address owner;
        uint256 poolId;
        uint256 stakedAmount;
        bool autoCompound;
        bool active;
        uint64 createdAt;
    }

    IERC20 public immutable stakingToken;
    IYieldFarm public immutable farm;

    mapping(bytes32 => Position) public positions;

    event PositionOpened(bytes32 indexed bridgeId, address indexed owner, uint256 indexed poolId, uint256 amount, bool autoCompound);
    event PositionHarvested(bytes32 indexed bridgeId, uint256 harvestedAmount, bool compounded);
    event PositionExited(bytes32 indexed bridgeId, address indexed recipient, uint256 amountReturned, uint256 rewardPaid, uint16 percent);

    constructor(IERC20 _stakingToken, IYieldFarm _farm) Ownable(msg.sender) {
        require(address(_stakingToken) != address(0), "staking token zero");
        require(address(_farm) != address(0), "farm zero");
        stakingToken = _stakingToken;
        farm = _farm;
    }

    function openPosition(
        bytes32 bridgeId,
        uint256 poolId,
        uint256 amount,
        bool autoCompound
    ) external {
        Position storage existing = positions[bridgeId];
        require(existing.owner == address(0), "position exists");
        require(amount > 0, "amount zero");

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        stakingToken.safeIncreaseAllowance(address(farm), amount);
        farm.stake(poolId, amount);

        positions[bridgeId] = Position({
            owner: msg.sender,
            poolId: poolId,
            stakedAmount: amount,
            autoCompound: autoCompound,
            active: true,
            createdAt: uint64(block.timestamp)
        });

        emit PositionOpened(bridgeId, msg.sender, poolId, amount, autoCompound);
    }

    function harvestPosition(bytes32 bridgeId) external returns (uint256 harvestedAmount) {
        Position storage position = positions[bridgeId];
        require(position.owner != address(0), "unknown position");
        require(position.active, "inactive position");
        require(position.owner == msg.sender || msg.sender == owner(), "unauthorised");

        harvestedAmount = _harvest(bridgeId, position);
    }

    function exitPosition(
        bytes32 bridgeId,
        uint16 percent,
        address recipient
    ) external returns (uint256 amountReturned, uint256 rewardPaid) {
        require(percent > 0 && percent <= 100, "percent out of range");
        require(recipient != address(0), "recipient zero");

        Position storage position = positions[bridgeId];
        require(position.owner != address(0), "unknown position");
        require(position.active, "inactive position");
        require(position.owner == msg.sender, "not owner");

        uint256 harvestedAmount = _harvest(bridgeId, position);

        (uint256 stakedAmount,,,) = farm.userInfo(position.poolId, address(this));
        if (stakedAmount == 0) {
            position.active = false;
            delete positions[bridgeId];
            return (0, harvestedAmount);
        }

        uint256 withdrawAmount = (stakedAmount * percent) / 100;
        farm.withdraw(position.poolId, withdrawAmount);
        stakingToken.safeTransfer(recipient, withdrawAmount);
        amountReturned = withdrawAmount;

        if (!position.autoCompound && harvestedAmount > 0) {
            stakingToken.safeTransfer(recipient, harvestedAmount);
            rewardPaid = harvestedAmount;
        }

        (uint256 remaining,,,) = farm.userInfo(position.poolId, address(this));
        if (remaining == 0 || percent == 100) {
            position.active = false;
            delete positions[bridgeId];
        } else {
            position.stakedAmount = remaining;
        }

        emit PositionExited(bridgeId, recipient, amountReturned, rewardPaid, percent);
    }

    function getPosition(bytes32 bridgeId)
        external
        view
        returns (
            address owner_,
            uint256 poolId,
            uint256 stakedAmount,
            bool autoCompound,
            bool active,
            uint64 createdAt,
            uint256 pendingReward
        )
    {
        Position memory position = positions[bridgeId];
        if (position.owner == address(0)) {
            return (address(0), 0, 0, false, false, 0, 0);
        }
        (uint256 staked,, uint256 rewards,) = farm.userInfo(position.poolId, address(this));
        return (
            position.owner,
            position.poolId,
            staked,
            position.autoCompound,
            position.active,
            position.createdAt,
            rewards
        );
    }

    function _harvest(bytes32 bridgeId, Position storage position) internal returns (uint256 harvestedAmount) {
        uint256 beforeBal = stakingToken.balanceOf(address(this));
        farm.claimRewards(position.poolId);
        uint256 afterBal = stakingToken.balanceOf(address(this));
        harvestedAmount = afterBal - beforeBal;

        if (harvestedAmount > 0) {
            if (position.autoCompound) {
                stakingToken.safeIncreaseAllowance(address(farm), harvestedAmount);
                try farm.stake(position.poolId, harvestedAmount) {
                    (uint256 staked,,,) = farm.userInfo(position.poolId, address(this));
                    position.stakedAmount = staked;
                    emit PositionHarvested(bridgeId, harvestedAmount, true);
                    return 0;
                } catch {
                    // fall through to treat as non-compounded reward
                }
            }
            emit PositionHarvested(bridgeId, harvestedAmount, false);
        }
    }
}
