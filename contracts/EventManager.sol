// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title EventManager
/// @notice Quan ly su kien va phan quyen (phan A).
/// @dev Phien ban dau: luu su kien va tao su kien moi.
contract EventManager {
    // ------------------------------------------------------------------
    // Du lieu
    // ------------------------------------------------------------------

    struct Event {
        address organizer;
        string name;
        string venue;
        uint64 startTime;   // unix timestamp
        uint256 price;      // gia moi ve (wei)
        uint32 maxTickets;  // so ve toi da
        uint32 ticketsSold; // so ve da ban, TicketSale cap nhat
        bool saleOpen;
    }

    /// @notice Tong so su kien da tao. eventId chay tu 1 den eventCount.
    uint256 public eventCount;

    mapping(uint256 => Event) internal _events;

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error EventNotFound(uint256 eventId);
    error InvalidEventParams();

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------

    modifier eventExists(uint256 eventId) {
        if (eventId == 0 || eventId > eventCount) revert EventNotFound(eventId);
        _;
    }

    // ------------------------------------------------------------------
    // Su kien
    // ------------------------------------------------------------------

    /// @notice Tao su kien moi, mo ban ve ngay. Nguoi tao la ban to chuc.
    function createEvent(
        string calldata name,
        string calldata venue,
        uint64 startTime,
        uint256 price,
        uint32 maxTickets
    ) external returns (uint256 eventId) {
        if (bytes(name).length == 0 || maxTickets == 0 || startTime <= block.timestamp) {
            revert InvalidEventParams();
        }

        eventId = ++eventCount;
        _events[eventId] = Event({
            organizer: msg.sender,
            name: name,
            venue: venue,
            startTime: startTime,
            price: price,
            maxTickets: maxTickets,
            ticketsSold: 0,
            saleOpen: true
        });
    }

    /// @notice Lay thong tin mot su kien.
    function getEventInfo(uint256 eventId) external view eventExists(eventId) returns (Event memory) {
        return _events[eventId];
    }
}