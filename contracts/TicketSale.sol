// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./EventManager.sol";
import "./interfaces/ITicketSale.sol";

/// @title TicketSale
/// @notice Ban ve gioi han so luong, toi da 2 ve moi vi moi su kien (phan B).
/// @dev Tien ve duoc giu trong contract de TicketCheckIn hoan tien khi su kien bi huy.
abstract contract TicketSale is EventManager, ITicketSale {
    // ------------------------------------------------------------------
    // Du lieu
    // ------------------------------------------------------------------

    /// @notice So ve toi da moi vi duoc mua cho mot su kien.
    uint8 public constant MAX_PER_WALLET = 2;

    struct Ticket {
        uint256 eventId;
        address owner;
        uint64 purchasedAt;
    }

    /// @notice Tong so ve da ban. ticketId chay tu 1 den ticketCount.
    uint256 public ticketCount;

    /// @notice ticketId => thong tin ve.
    mapping(uint256 => Ticket) public tickets;

    /// @notice eventId => vi => so ve da mua.
    mapping(uint256 => mapping(address => uint8)) public purchasedCount;

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
        if (purchasedCount[eventId][msg.sender] >= MAX_PER_WALLET) {
            revert WalletLimitReached(eventId, msg.sender);
        }

        e.ticketsSold += 1;
        purchasedCount[eventId][msg.sender] += 1;

        ticketId = ++ticketCount;
        tickets[ticketId] = Ticket({
            eventId: eventId,
            owner: msg.sender,
            purchasedAt: uint64(block.timestamp)
        });
        _ownedTickets[msg.sender].push(ticketId);
    }

    // ------------------------------------------------------------------
    // So huu ve
    // ------------------------------------------------------------------

    /// @inheritdoc ITicketSale
    function transferTicket(uint256, address) external pure {
        revert TransferNotAllowed();
    }
}
