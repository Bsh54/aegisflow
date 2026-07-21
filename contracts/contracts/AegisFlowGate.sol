// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IWeb2Json} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";

/**
 * @title AegisFlowGate
 * @notice Compliance gate for FXRP inflows on Flare.
 *
 * A user may only mint/receive FXRP through this gate if their source XRPL
 * address has passed a confidential AML screening. The screening runs inside a
 * TEE and its verdict is certified on-chain via the Flare Data Connector (FDC)
 * Web2Json attestation: ~100 independent data providers fetch the verifier's
 * deterministic /attest endpoint and agree on the result, so no single party
 * (not even the operator) can forge a verdict.
 *
 * Two submission paths:
 *  - `submitVerdictWithProof` (trustless, FDC-verified) — the real path.
 *  - `submitVerdict` (trusted attestor) — legacy/dev fallback, kept for local
 *    testing and as an operational escape hatch; will be removed post-hackathon.
 */
contract AegisFlowGate {
    /// @dev Risk classification returned by the confidential AML check.
    enum Verdict {
        Unknown, // 0 - never screened
        Clear,   // 1 - low risk, allowed
        Review,  // 2 - medium risk, manual review required
        Blocked  // 3 - sanctioned / high risk, denied
    }

    /// @dev Shape of the ABI-encoded data carried in the FDC Web2Json response.
    struct VerdictDto {
        string xrplAddress;
        uint256 verdict;
    }

    struct Screening {
        Verdict verdict;
        uint64 timestamp;
        bytes32 evidenceHash; // hash of the audit evidence (sealed off-chain)
        bool fdcVerified;     // true when recorded through an FDC proof
    }

    address public owner;

    /// @notice Address allowed to submit verdicts without FDC proof (dev path).
    address public attestor;

    /// @notice Base URL the FDC attestation must target: `<base><xrplAddress>`.
    string public attestBaseUrl;

    /// @notice keccak256(xrplAddress) => latest screening result.
    mapping(bytes32 => Screening) public screenings;

    event AttestorUpdated(address indexed previous, address indexed current);
    event AttestBaseUrlUpdated(string url);
    event Screened(
        bytes32 indexed xrplAddressHash,
        Verdict verdict,
        uint64 timestamp,
        bytes32 evidenceHash,
        bool fdcVerified
    );
    event MintAuthorized(bytes32 indexed xrplAddressHash, address indexed recipient);

    error NotOwner();
    error NotAttestor();
    error NotCompliant(Verdict verdict);
    error InvalidProof();
    error UrlMismatch();
    error InvalidVerdict(uint256 raw);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAttestor() {
        if (msg.sender != attestor) revert NotAttestor();
        _;
    }

    constructor(address _attestor, string memory _attestBaseUrl) {
        owner = msg.sender;
        attestor = _attestor;
        attestBaseUrl = _attestBaseUrl;
        emit AttestorUpdated(address(0), _attestor);
        emit AttestBaseUrlUpdated(_attestBaseUrl);
    }

    /// @notice Update the trusted attestor (dev path).
    function setAttestor(address _attestor) external onlyOwner {
        emit AttestorUpdated(attestor, _attestor);
        attestor = _attestor;
    }

    /// @notice Update the attestation base URL (e.g. if the verifier moves).
    function setAttestBaseUrl(string calldata _url) external onlyOwner {
        attestBaseUrl = _url;
        emit AttestBaseUrlUpdated(_url);
    }

    // ---------------------------------------------------------------------
    // Trustless path — FDC Web2Json proof
    // ---------------------------------------------------------------------

    /**
     * @notice Record a verdict backed by an FDC Web2Json attestation proof.
     * @param proof The FDC proof wrapping the verifier's /attest response.
     *
     * Requirements:
     *  - the Merkle proof must verify against the FDC relay (real consensus);
     *  - the attested URL must be exactly `attestBaseUrl + xrplAddress`, so a
     *    proof for some other API or address cannot be replayed here.
     */
    function submitVerdictWithProof(IWeb2Json.Proof calldata proof) external {
        if (!ContractRegistry.getFdcVerification().verifyWeb2Json(proof)) {
            revert InvalidProof();
        }

        VerdictDto memory dto =
            abi.decode(proof.data.responseBody.abiEncodedData, (VerdictDto));

        // Bind the proof to OUR verifier endpoint and THIS address.
        bytes memory expectedUrl =
            abi.encodePacked(attestBaseUrl, dto.xrplAddress);
        if (keccak256(expectedUrl) != keccak256(bytes(proof.data.requestBody.url))) {
            revert UrlMismatch();
        }

        if (dto.verdict == 0 || dto.verdict > uint256(type(Verdict).max)) {
            revert InvalidVerdict(dto.verdict);
        }

        bytes32 addrHash = keccak256(bytes(dto.xrplAddress));
        bytes32 evidence = keccak256(proof.data.responseBody.abiEncodedData);

        screenings[addrHash] = Screening({
            verdict: Verdict(dto.verdict),
            timestamp: uint64(block.timestamp),
            evidenceHash: evidence,
            fdcVerified: true
        });
        emit Screened(addrHash, Verdict(dto.verdict), uint64(block.timestamp), evidence, true);
    }

    // ---------------------------------------------------------------------
    // Legacy/dev path — trusted attestor
    // ---------------------------------------------------------------------

    /// @notice Record a verdict via the trusted attestor (no FDC proof).
    function submitVerdict(
        bytes32 xrplAddressHash,
        Verdict verdict,
        bytes32 evidenceHash
    ) external onlyAttestor {
        screenings[xrplAddressHash] = Screening({
            verdict: verdict,
            timestamp: uint64(block.timestamp),
            evidenceHash: evidenceHash,
            fdcVerified: false
        });
        emit Screened(xrplAddressHash, verdict, uint64(block.timestamp), evidenceHash, false);
    }

    // ---------------------------------------------------------------------
    // Views + gate
    // ---------------------------------------------------------------------

    /// @notice Whether a given XRPL address is currently cleared to mint.
    function isCompliant(bytes32 xrplAddressHash) public view returns (bool) {
        return screenings[xrplAddressHash].verdict == Verdict.Clear;
    }

    /// @notice Read the full screening record for an address.
    function getScreening(bytes32 xrplAddressHash)
        external
        view
        returns (Verdict verdict, uint64 timestamp, bytes32 evidenceHash, bool fdcVerified)
    {
        Screening memory s = screenings[xrplAddressHash];
        return (s.verdict, s.timestamp, s.evidenceHash, s.fdcVerified);
    }

    /**
     * @notice Gate the FXRP mint on a passing verdict.
     * @dev In the full system this triggers the FAssets mint for `recipient`.
     */
    function authorizeMint(bytes32 xrplAddressHash, address recipient) external {
        Verdict v = screenings[xrplAddressHash].verdict;
        if (v != Verdict.Clear) revert NotCompliant(v);
        emit MintAuthorized(xrplAddressHash, recipient);
        // TODO(post-FDC): call the FAssets AssetManager to mint FXRP to `recipient`.
    }
}
