// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ITicketSale
/// @notice Giao dien cho phan ban ve va so huu ve (phan B).
/// @dev Moi vi chi mua toi da 2 ve cho moi su kien. Ve gan voi vi nguoi mua,
///      khong chuyen nhuong duoc.
interface ITicketSale {
    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    /// @notice Phat ra khi mua ve thanh cong.
    event TicketPurchased(
        uint256 indexed ticketId,
        uint256 indexed eventId,
        address indexed buyer,
        uint256 price
    );

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error SaleClosed(uint256 eventId);
    error IncorrectPayment(uint256 expected, uint256 received);
    error SoldOut(uint256 eventId);
    error WalletLimitReached(uint256 eventId, address buyer);
    error TransferNotAllowed();

    // ------------------------------------------------------------------
    // Functions
    // ------------------------------------------------------------------

    /// @notice Mua mot ve. Phai gui dung so ETH bang gia ve.
    function buyTicket(uint256 eventId) external payable returns (uint256 ticketId);

    /// @notice Ve khong chuyen nhuong duoc, ham nay luon revert.
    function transferTicket(uint256 ticketId, address to) external;

    /// @notice Danh sach ma ve cua vi dang goi.
    function getMyTickets() external view returns (uint256[] memory);

    /// @notice Danh sach ma ve cua mot vi bat ky.
    function getTicketsOf(address account) external view returns (uint256[] memory);
}
