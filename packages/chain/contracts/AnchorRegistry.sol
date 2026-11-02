// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// Local demo only. Records commitments, never custody data or identity metadata.
contract AnchorRegistry {
    address public immutable writer;
    bytes32 public immutable instanceId;
    mapping(bytes32 => bool) private records;
    event Anchored(bytes32 indexed commitment);
    error Unauthorized();
    error InvalidCommitment();
    error AlreadyAnchored();

    constructor(address writer_, bytes32 instanceId_) {
        require(writer_ != address(0) && instanceId_ != bytes32(0));
        writer = writer_;
        instanceId = instanceId_;
    }
    function anchor(bytes32 commitment) external {
        if (msg.sender != writer) revert Unauthorized();
        if (commitment == bytes32(0)) revert InvalidCommitment();
        if (records[commitment]) revert AlreadyAnchored();
        records[commitment] = true;
        emit Anchored(commitment);
    }
    function isAnchored(bytes32 commitment) external view returns (bool) {
        return records[commitment];
    }
}
