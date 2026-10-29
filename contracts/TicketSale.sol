// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./EventManager.sol";
import "./interfaces/ITicketSale.sol";

/// @title TicketSale
/// @notice Ban ve gioi han so luong (phan B).
/// @dev Tien ve duoc giu trong contract de TicketCheckIn hoan tien khi su kien bi huy.
abstract contract TicketSale is EventManager, ITicketSale {
    // ------------------------------------------------------------------
    // Du lieu
    // ------------------------------------------------------------------

    struct Ticket {
        uint256 eventId;
        address owner;
        uint64 purchasedAt;
    }

    /// @notice Tong so ve da ban. ticketId chay tu 1 den ticketCount.
    uint256 public ticketCount;

    /// @notice ticketId => thong tin ve.
    mapping(uint256 => Ticket) public tickets;

    /// @dev vi => danh sach ma ve.
    mapping(address => uint256[]) internal _ownedTickets;

    // ------------------------------------------------------------------
    // Mua ve
    // ------------------------------------------------------------------

    /// @inheritdoc ITicketSale
    function buyTicket(uint256 eventId)
        external
        payable
        eventExists(eventId)
        returns (uint256 ticketId)
    {
        Event storage e = _events[eventId];

        if (!e.saleOpen) revert SaleClosed(eventId);
        if (msg.value != e.price) revert IncorrectPayment(e.price, msg.value);
        if (e.ticketsSold >= e.maxTickets) revert SoldOut(eventId);

        e.ticketsSold += 1;

        ticketId = ++ticketCount;
        tickets[ticketId] = Ticket({
            eventId: eventId,
            owner: msg.sender,
            purchasedAt: uint64(block.timestamp)
        });
        _ownedTickets[msg.sender].push(ticketId);
    }
}
