// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./interfaces/ITicketSale.sol";

/// @title TicketSale
/// @notice Ban ve (phan B).
/// @dev Tuan 1: chi khai bao du lieu ve. Tuan 2 se ke thua EventManager (A)
///      va trien khai cac ham trong ITicketSale.
abstract contract TicketSale is ITicketSale {
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
}
