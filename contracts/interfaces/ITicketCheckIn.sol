// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
interface ITicketCheckIn {
    event TicketUsed(uint256 indexed ticketId, uint256 indexed eventId,
                     address indexed staff, uint256 timestamp);
    event EventCancelled(uint256 indexed eventId, uint256 timestamp);
    event Refunded(uint256 indexed ticketId, address indexed owner, uint256 amount);

    /// @notice Phat ra khi ban to chuc rut doanh thu.
    event RevenueWithdrawn(uint256 indexed eventId, address indexed organizer, uint256 amount);

    error TicketNotFound(uint256 ticketId);
    error TicketAlreadyUsed(uint256 ticketId);
    error WrongEvent(uint256 ticketId, uint256 eventId);
    error EventIsCancelled(uint256 eventId);
    error EventNotCancelled(uint256 eventId);
    error EventHasCheckIns(uint256 eventId);
    error AlreadyRefunded(uint256 ticketId);
    error NotTicketOwner(uint256 ticketId);
    error RefundFailed(uint256 ticketId);
    error WithdrawNotAllowed(uint256 eventId);
    error NothingToWithdraw(uint256 eventId);
    error WithdrawFailed(uint256 eventId);

    function checkIn(uint256 eventId, uint256 ticketId) external;
    function verifyTicket(uint256 ticketId) external view
        returns (bool exists, bool used, bool cancelled, uint256 eventId, address owner);
    function cancelEvent(uint256 eventId) external;
    function claimRefund(uint256 ticketId) external;
    
    /// @notice Ban to chuc rut doanh thu. Chi duoc rut khi su kien da bat dau soat ve,
    ///         vi luc do su kien khong the bi huy nua (tien hoan ve luon an toan).
    function withdrawRevenue(uint256 eventId) external;
    
}