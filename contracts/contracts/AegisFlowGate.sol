// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AegisFlowGate
 * @notice Compliance gate for FXRP inflows on Flare.
 *
 * A user may only mint/receive FXRP through this gate if their source XRPL
 * address has passed a confidential AML screening. The screening itself runs
 * inside a TEE (Phala) and its verdict is certified on-chain via the Flare
 * Data Connector (FDC). This contract stores the verdicts and enforces access.
 *
 * NOTE: For Step 1 of the roadmap the verdict is written by a trusted
 * `attestor` role (the TEE operator). In Step 4 this is replaced by verifying
 * an FDC Web2Json proof directly, removing the trust in the attestor.
 */
contract AegisFlowGate {
    /// @dev Risk classification returned by the confidential AML check.
    enum Verdict {
        Unknown, // 0 - never screened
        Clear,   // 1 - low risk, allowed
        Review,  // 2 - medium risk, manual review required
        Blocked  // 3 - sanctioned / high risk, denied
    }

    struct Screening {
        Verdict verdict;
        uint64 timestamp;
        bytes32 evidenceHash; // hash of the private audit report (kept off-chain)
    }

    address public owner;

    /// @notice Address allowed to submit verdicts (the TEE attestor, Step 1).
    address public attestor;

    /// @notice keccak256(xrplAddress) => latest screening result.
    mapping(bytes32 => Screening) public screenings;

    event AttestorUpdated(address indexed previous, address indexed current);
    event Screened(
        bytes32 indexed xrplAddressHash,
        Verdict verdict,
        uint64 timestamp,
        bytes32 evidenceHash
    );
    event MintAuthorized(bytes32 indexed xrplAddressHash, address indexed recipient);

    error NotOwner();
    error NotAttestor();
    error NotCompliant(Verdict verdict);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAttestor() {
        if (msg.sender != attestor) revert NotAttestor();
        _;
    }

    constructor(address _attestor) {
        owner = msg.sender;
        attestor = _attestor;
        emit AttestorUpdated(address(0), _attestor);
    }

    /// @notice Update the trusted attestor (TEE operator).
    function setAttestor(address _attestor) external onlyOwner {
        emit AttestorUpdated(attestor, _attestor);
        attestor = _attestor;
    }

    /**
     * @notice Record a confidential AML verdict for an XRPL address.
     * @param xrplAddressHash keccak256 of the source XRPL address.
     * @param verdict         Risk classification from the TEE.
     * @param evidenceHash    Hash of the sealed audit report (proof it was checked).
     *
     * In Step 4 this function is superseded by `submitWithFdcProof`, which
     * verifies an FDC Web2Json attestation instead of trusting `attestor`.
     */
    function submitVerdict(
        bytes32 xrplAddressHash,
        Verdict verdict,
        bytes32 evidenceHash
    ) external onlyAttestor {
        screenings[xrplAddressHash] = Screening({
            verdict: verdict,
            timestamp: uint64(block.timestamp),
            evidenceHash: evidenceHash
        });
        emit Screened(xrplAddressHash, verdict, uint64(block.timestamp), evidenceHash);
    }

    /// @notice Whether a given XRPL address is currently cleared to mint.
    function isCompliant(bytes32 xrplAddressHash) public view returns (bool) {
        return screenings[xrplAddressHash].verdict == Verdict.Clear;
    }

    /// @notice Read the full screening record for an address.
    function getScreening(bytes32 xrplAddressHash)
        external
        view
        returns (Verdict verdict, uint64 timestamp, bytes32 evidenceHash)
    {
        Screening memory s = screenings[xrplAddressHash];
        return (s.verdict, s.timestamp, s.evidenceHash);
    }

    /**
     * @notice Gate the FXRP mint on a passing verdict.
     * @dev In the full system this triggers the FAssets mint for `recipient`.
     *      For the skeleton it just enforces the check and emits an event.
     */
    function authorizeMint(bytes32 xrplAddressHash, address recipient) external {
        Verdict v = screenings[xrplAddressHash].verdict;
        if (v != Verdict.Clear) revert NotCompliant(v);
        emit MintAuthorized(xrplAddressHash, recipient);
        // TODO(step-4+): call the FAssets AssetManager to mint FXRP to `recipient`.
    }
}
