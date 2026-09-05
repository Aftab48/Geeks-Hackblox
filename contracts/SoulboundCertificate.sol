// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title SoulboundCertificate
/// @notice Non-transferable ERC-721 credentials. Whitelisted issuers mint
///         certificates directly to a recipient's wallet; the token can never
///         move afterwards. Issuers can revoke a certificate without moving it,
///         and anyone can verify a wallet's credentials on-chain.
contract SoulboundCertificate is ERC721URIStorage, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    /// @dev Stored per token. `uri` lives in ERC721URIStorage.
    struct CertificateData {
        string recipientName;
        string courseName;
        uint64 issuedAt;
        address issuer;
        bool revoked;
    }

    /// @dev Flattened shape returned by the view functions, for the frontend.
    struct Certificate {
        uint256 tokenId;
        string recipientName;
        string courseName;
        uint64 issuedAt;
        address issuer;
        string issuerName;
        bool revoked;
        string uri;
    }

    uint256 private _nextTokenId = 1;

    mapping(uint256 tokenId => CertificateData) private _certs;
    mapping(address holder => uint256[] tokenIds) private _certsOf;

    /// @notice Human-readable name for a whitelisted issuer, e.g. "MIT".
    mapping(address issuer => string name) public issuerName;

    error SoulboundTransferNotAllowed();
    error SoulboundApprovalNotAllowed();
    error CertificateDoesNotExist();
    error NotCertificateIssuer();

    event CertificateIssued(
        uint256 indexed tokenId,
        address indexed recipient,
        address indexed issuer,
        string courseName
    );
    event CertificateRevoked(uint256 indexed tokenId, address indexed revokedBy);
    event IssuerAdded(address indexed account, string name);
    event IssuerRemoved(address indexed account);

    constructor(string memory genesisIssuerName)
        ERC721("Soulbound Certificate", "SBCERT")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
        issuerName[msg.sender] = genesisIssuerName;
        emit IssuerAdded(msg.sender, genesisIssuerName);
    }

    // --- Issuer management (admin only) ---------------------------------

    function addIssuer(address account, string calldata name)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _grantRole(ISSUER_ROLE, account);
        issuerName[account] = name;
        emit IssuerAdded(account, name);
    }

    function removeIssuer(address account)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _revokeRole(ISSUER_ROLE, account);
        emit IssuerRemoved(account);
    }

    function isIssuer(address account) external view returns (bool) {
        return hasRole(ISSUER_ROLE, account);
    }

    // --- Issuing and revoking -------------------------------------------

    /// @notice Mint a non-transferable certificate to `to`.
    function issueCertificate(
        address to,
        string calldata recipientName,
        string calldata courseName,
        string calldata uri
    ) external onlyRole(ISSUER_ROLE) returns (uint256 tokenId) {
        tokenId = _nextTokenId++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        _certs[tokenId] = CertificateData({
            recipientName: recipientName,
            courseName: courseName,
            issuedAt: uint64(block.timestamp),
            issuer: msg.sender,
            revoked: false
        });
        _certsOf[to].push(tokenId);

        emit CertificateIssued(tokenId, to, msg.sender, courseName);
    }

    /// @notice Mark a certificate invalid. The token stays in the holder's
    ///         wallet — revocation is a flag, not a transfer.
    /// @dev Callable by the issuer that minted it, or by an admin.
    function revoke(uint256 tokenId) external {
        if (_ownerOf(tokenId) == address(0)) revert CertificateDoesNotExist();

        CertificateData storage cert = _certs[tokenId];
        if (cert.issuer != msg.sender && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotCertificateIssuer();
        }

        cert.revoked = true;
        emit CertificateRevoked(tokenId, msg.sender);
    }

    // --- Verification views ----------------------------------------------

    function isValid(uint256 tokenId) public view returns (bool) {
        return _ownerOf(tokenId) != address(0) && !_certs[tokenId].revoked;
    }

    function getCertificate(uint256 tokenId)
        public
        view
        returns (Certificate memory)
    {
        if (_ownerOf(tokenId) == address(0)) revert CertificateDoesNotExist();
        return _toCertificate(tokenId);
    }

    /// @notice Every certificate held by `holder`, valid or revoked.
    function getCertificates(address holder)
        external
        view
        returns (Certificate[] memory certificates)
    {
        uint256[] storage ids = _certsOf[holder];
        certificates = new Certificate[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            certificates[i] = _toCertificate(ids[i]);
        }
    }

    function certificateCount(address holder) external view returns (uint256) {
        return _certsOf[holder].length;
    }

    function totalIssued() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function _toCertificate(uint256 tokenId)
        private
        view
        returns (Certificate memory)
    {
        CertificateData storage cert = _certs[tokenId];
        return Certificate({
            tokenId: tokenId,
            recipientName: cert.recipientName,
            courseName: cert.courseName,
            issuedAt: cert.issuedAt,
            issuer: cert.issuer,
            issuerName: issuerName[cert.issuer],
            revoked: cert.revoked,
            uri: tokenURI(tokenId)
        });
    }

    // --- Soulbound enforcement -------------------------------------------

    /// @dev Allows minting (from == 0) and blocks everything else: transfers,
    ///      safeTransfers and burns. A credential is permanent; use revoke().
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        if (_ownerOf(tokenId) != address(0)) revert SoulboundTransferNotAllowed();
        return super._update(to, tokenId, auth);
    }

    /// @dev Approvals are meaningless when nothing can move — fail loudly
    ///      instead of letting a marketplace list an unmovable token.
    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert SoulboundApprovalNotAllowed();
    }

    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert SoulboundApprovalNotAllowed();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
