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
/// @dev Three tiers. The admin appoints registrars, a registrar appoints the
///      issuers under it, and an issuer mints. `_setRoleAdmin` wires the
///      middle link so AccessControl itself enforces the hierarchy, including
///      on the raw `grantRole` path.
contract SoulboundCertificate is ERC721URIStorage, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

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

    /// @notice Human-readable name for a whitelisted issuer or registrar,
    ///         e.g. "Department of Computer Science".
    mapping(address account => string name) public issuerName;

    /// @notice The registrar that appointed an issuer. Zero for the genesis
    ///         issuer and for anyone granted through the raw `grantRole` path.
    mapping(address issuer => address registrar) public appointedBy;

    error SoulboundTransferNotAllowed();
    error SoulboundApprovalNotAllowed();
    error CertificateDoesNotExist();
    error NotCertificateIssuer();
    error NotAnIssuer();
    error NotTheAppointingRegistrar();
    error RegisterEntryTaken(uint256 nextTokenId);

    event CertificateIssued(
        uint256 indexed tokenId,
        address indexed recipient,
        address indexed issuer,
        string courseName
    );
    event CertificateRevoked(uint256 indexed tokenId, address indexed revokedBy);
    event IssuerAdded(address indexed account, string name, address indexed appointedBy);
    event IssuerRemoved(address indexed account, address indexed removedBy);
    event RegistrarAdded(address indexed account, string name);
    event RegistrarRemoved(address indexed account);

    constructor(string memory genesisIssuerName)
        ERC721("Soulbound Certificate", "SBCERT")
    {
        _setRoleAdmin(ISSUER_ROLE, REGISTRAR_ROLE);
        _setRoleAdmin(REGISTRAR_ROLE, DEFAULT_ADMIN_ROLE);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
        issuerName[msg.sender] = genesisIssuerName;

        emit RegistrarAdded(msg.sender, genesisIssuerName);
        emit IssuerAdded(msg.sender, genesisIssuerName, msg.sender);
    }

    // --- Registrars (admin only) -----------------------------------------

    function addRegistrar(address account, string calldata name)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _grantRole(REGISTRAR_ROLE, account);
        issuerName[account] = name;
        emit RegistrarAdded(account, name);
    }

    /// @dev Issuers this registrar appointed keep their role; strip them
    ///      first if that is not what you want.
    function removeRegistrar(address account)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _revokeRole(REGISTRAR_ROLE, account);
        emit RegistrarRemoved(account);
    }

    function isRegistrar(address account) external view returns (bool) {
        return hasRole(REGISTRAR_ROLE, account);
    }

    // --- Issuers (registrars, and the admins above them) ------------------

    function addIssuer(address account, string calldata name)
        external
        onlyRole(REGISTRAR_ROLE)
    {
        _grantRole(ISSUER_ROLE, account);
        issuerName[account] = name;
        appointedBy[account] = msg.sender;
        emit IssuerAdded(account, name, msg.sender);
    }

    /// @notice Strip an issuer. A registrar can only remove issuers it
    ///         appointed; an admin can remove any of them.
    function removeIssuer(address account) external {
        if (!hasRole(ISSUER_ROLE, account)) revert NotAnIssuer();

        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            bool appointer = hasRole(REGISTRAR_ROLE, msg.sender) &&
                appointedBy[account] == msg.sender;
            if (!appointer) revert NotTheAppointingRegistrar();
        }

        _revokeRole(ISSUER_ROLE, account);
        delete appointedBy[account];
        emit IssuerRemoved(account, msg.sender);
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
    ) external onlyRole(ISSUER_ROLE) returns (uint256) {
        return _issue(to, recipientName, courseName, uri);
    }

    /// @notice Same as `issueCertificate`, but reverts unless the certificate
    ///         lands on `expectedTokenId`.
    /// @dev The frontend prints the register number onto the artwork and pins
    ///      it before anything is signed, which means guessing `totalIssued()
    ///      + 1`. Two issuers minting in the same block would make that guess
    ///      wrong and the printed number a lie. This turns the guess into a
    ///      condition: the mint either matches the artwork or fails, and the
    ///      revert carries the real next id so the caller can rebuild and try
    ///      again without another round trip.
    function issueCertificateAt(
        address to,
        string calldata recipientName,
        string calldata courseName,
        string calldata uri,
        uint256 expectedTokenId
    ) external onlyRole(ISSUER_ROLE) returns (uint256) {
        if (_nextTokenId != expectedTokenId) revert RegisterEntryTaken(_nextTokenId);
        return _issue(to, recipientName, courseName, uri);
    }

    /// @notice The register number the next certificate will take.
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    function _issue(
        address to,
        string calldata recipientName,
        string calldata courseName,
        string calldata uri
    ) private returns (uint256 tokenId) {
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
    ///         wallet: revocation is a flag, not a transfer.
    /// @dev Callable by the issuer that minted it, by the registrar that
    ///      appointed that issuer, or by an admin.
    function revoke(uint256 tokenId) external {
        if (_ownerOf(tokenId) == address(0)) revert CertificateDoesNotExist();

        CertificateData storage cert = _certs[tokenId];
        bool allowed = cert.issuer == msg.sender ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
            (hasRole(REGISTRAR_ROLE, msg.sender) &&
                appointedBy[cert.issuer] == msg.sender);
        if (!allowed) revert NotCertificateIssuer();

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

    /// @dev Approvals are meaningless when nothing can move, so fail loudly
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
