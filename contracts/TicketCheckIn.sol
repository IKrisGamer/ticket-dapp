// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/ITicketCheckIn.sol";

abstract contract TicketCheckIn is ITicketCheckIn {
    mapping(uint256 => bool) public isUsed; // đã soát chưa (ticketId)
    mapping(uint256 => uint256) public usedAt; // thời điểm soát (ticketId)
    mapping(uint256 => uint256) public checkInCount; // số vé đã soát (eventId)
    mapping(uint256 => bool) public isCancelled; // đã hủy chưa (eventId)
    mapping(uint256 => bool) public isRefunded; // đã hoàn tiền chưa (ticketId)
}