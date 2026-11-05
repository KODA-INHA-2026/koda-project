// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Demo registry for detached PDF verification information.
/// @dev PDF bytes, customer data, BTC balances, and private keys never enter this contract.
contract DocumentRegistry is EIP712 {
    struct DocumentRecord {
        bytes32 documentHash;
        uint64 issuedAt;
    }

    bytes32 private constant DOCUMENT_TYPEHASH =
        keccak256("Document(bytes32 documentId,bytes32 documentHash,uint64 issuedAt)");

    address public immutable authorizedIssuer;
    mapping(bytes32 documentId => DocumentRecord record) public records;

    event DocumentRegistered(bytes32 indexed documentId, bytes32 documentHash, uint64 issuedAt);

    error InvalidIssuer();
    error Unauthorized();
    error InvalidDocumentId();
    error InvalidDocumentHash();
    error InvalidIssuedAt();
    error InvalidSignature();
    error AlreadyRegistered();

    constructor(address authorizedIssuer_)
        EIP712("KodaDocumentRegistryDemo", "1")
    {
        if (authorizedIssuer_ == address(0)) revert InvalidIssuer();
        authorizedIssuer = authorizedIssuer_;
    }

    function register(
        bytes32 documentId,
        bytes32 documentHash,
        uint64 issuedAt,
        bytes calldata signature
    ) external {
        if (msg.sender != authorizedIssuer) revert Unauthorized();
        if (documentId == bytes32(0)) revert InvalidDocumentId();
        if (documentHash == bytes32(0)) revert InvalidDocumentHash();
        if (issuedAt == 0) revert InvalidIssuedAt();
        if (records[documentId].documentHash != bytes32(0)) revert AlreadyRegistered();

        bytes32 structHash = keccak256(
            abi.encode(DOCUMENT_TYPEHASH, documentId, documentHash, issuedAt)
        );
        address recovered = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (recovered != msg.sender) revert InvalidSignature();

        records[documentId] = DocumentRecord({
            documentHash: documentHash,
            issuedAt: issuedAt
        });
        emit DocumentRegistered(documentId, documentHash, issuedAt);
    }
}
