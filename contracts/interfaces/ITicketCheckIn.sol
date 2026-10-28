// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
interface ITicketCheckIn {
    event TicketUsed(uint256 indexed ticketId, uint256 indexed eventId,
                     address indexed staff, uint256 timestamp);
    event EventCancelled(uint256 indexed eventId, uint256 timestamp);
    event Refunded(uint256 indexed ticketId, address indexed owner, uint256 amount);

    error TicketNotFound(uint256 ticketId);
    error TicketAlreadyUsed(uint256 ticketId);
    error WrongEvent(uint256 ticketId, uint256 eventId);
    error EventIsCancelled(uint256 eventId);
    error EventNotCancelled(uint256 eventId);
    error EventHasCheckIns(uint256 eventId);
    error AlreadyRefunded(uint256 ticketId);
    error NotTicketOwner(uint256 ticketId);
    error RefundFailed(uint256 ticketId);

    function checkIn(uint256 eventId, uint256 ticketId) external;
    function verifyTicket(uint256 ticketId) external view
        returns (bool exists, bool used, bool cancelled, uint256 eventId, address owner);
    function cancelEvent(uint256 eventId) external;
    function claimRefund(uint256 ticketId) external;
}