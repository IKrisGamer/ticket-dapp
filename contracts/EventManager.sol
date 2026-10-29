// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title EventManager
/// @notice Quan ly su kien va phan quyen (phan A).
/// @dev Hai vai tro:
///      - owner: vi deploy contract, cap hoac thu quyen ban to chuc.
///      - organizer: tao su kien.
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

    /// @notice Vi quan tri he thong (vi deploy).
    address public immutable owner;

    /// @notice Tong so su kien da tao. eventId chay tu 1 den eventCount.
    uint256 public eventCount;

    mapping(uint256 => Event) internal _events;

    /// @notice address => co quyen tao su kien hay khong.
    mapping(address => bool) public isOrganizer;
    
    /// @notice eventId => address => co quyen soat ve hay khong.
    mapping(uint256 => mapping(address => bool)) public isStaff;
    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error NotOwner();
    error NotOrganizerRole();
    error NotEventOrganizer(uint256 eventId);
    error NotStaff(uint256 eventId);
    error EventNotFound(uint256 eventId);
    error InvalidEventParams();
    error ZeroAddress();

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier eventExists(uint256 eventId) {
        if (eventId == 0 || eventId > eventCount) revert EventNotFound(eventId);
        _;
    }

    /// @dev Chi ban to chuc da tao su kien nay.
    modifier onlyOrganizer(uint256 eventId) {
        if (eventId == 0 || eventId > eventCount) revert EventNotFound(eventId);
        if (_events[eventId].organizer != msg.sender) revert NotEventOrganizer(eventId);
        _;
    }
    
    /// @dev Chi nhan vien duoc cap quyen soat ve cho su kien nay.
    modifier onlyStaff(uint256 eventId) {
        if (!isStaff[eventId][msg.sender]) revert NotStaff(eventId);
        _;
    }
    constructor() {
        owner = msg.sender;
        isOrganizer[msg.sender] = true;
    }

    // ------------------------------------------------------------------
    // Quan tri
    // ------------------------------------------------------------------

    /// @notice Cap hoac thu quyen ban to chuc. Chi owner.
    function setOrganizer(address account, bool allowed) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        isOrganizer[account] = allowed;
    }

    // ------------------------------------------------------------------
    // Su kien
    // ------------------------------------------------------------------

    /// @notice Tao su kien moi, mo ban ve ngay. Chi vi co quyen ban to chuc.
    function createEvent(
        string calldata name,
        string calldata venue,
        uint64 startTime,
        uint256 price,
        uint32 maxTickets
    ) external returns (uint256 eventId) {
        if (!isOrganizer[msg.sender]) revert NotOrganizerRole();
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
    
    /// @notice Cap hoac thu quyen soat ve cho mot vi. Chi ban to chuc cua su kien.
    function setStaff(uint256 eventId, address staff, bool allowed) external onlyOrganizer(eventId) {
        if (staff == address(0)) revert ZeroAddress();
        isStaff[eventId][staff] = allowed;
    }
    /// @notice Lay thong tin mot su kien.
    function getEventInfo(uint256 eventId) external view eventExists(eventId) returns (Event memory) {
        return _events[eventId];
    }
}