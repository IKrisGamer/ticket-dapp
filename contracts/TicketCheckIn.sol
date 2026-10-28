// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/ITicketCheckIn.sol";

abstract contract TicketCheckIn is ITicketCheckIn {
    mapping(uint256 => bool) public isUsed;
    mapping(uint256 => uint256) public usedAt;
    mapping(uint256 => uint256) public checkInCount;
    mapping(uint256 => bool) public isCancelled;
    mapping(uint256 => bool) public isRefunded;
}