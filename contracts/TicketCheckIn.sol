// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./TicketSale.sol";
import "./interfaces/ITicketCheckIn.sol";

/// @title TicketCheckIn
/// @notice Soat ve mot lan duy nhat, huy su kien va hoan tien (phan C).
/// @dev Day la contract cuoi cung trong chuoi ke thua va la contract duoc deploy:
///      EventManager (A) -> TicketSale (B) -> TicketCheckIn (C).
abstract contract TicketCheckIn is TicketSale, ITicketCheckIn {
    mapping(uint256 => bool) public isUsed; // đã soát chưa (ticketId)
    mapping(uint256 => uint256) public usedAt; // thời điểm soát (ticketId)
    mapping(uint256 => uint256) public checkInCount; // số vé đã soát (eventId)
    mapping(uint256 => bool) public isCancelled; // đã hủy chưa (eventId)
    mapping(uint256 => bool) public isRefunded; // đã hoàn tiền chưa (ticketId)

    
    // ------------------------------------------------------------------
    // Soat ve
    // ------------------------------------------------------------------

    /// @inheritdoc ITicketCheckIn
    function checkIn(uint256 eventId, uint256 ticketId) external onlyStaff(eventId) {
        if (!_ticketExists(ticketId)) revert TicketNotFound(ticketId);
        if (tickets[ticketId].eventId != eventId) revert WrongEvent(ticketId, eventId);
        if (isCancelled[eventId]) revert EventIsCancelled(eventId);
        if (isUsed[ticketId]) revert TicketAlreadyUsed(ticketId);

        isUsed[ticketId] = true;
        usedAt[ticketId] = block.timestamp;
        checkInCount[eventId] += 1;
    }
}