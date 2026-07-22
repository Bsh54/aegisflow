// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {AegisFlowGate} from "./AegisFlowGate.sol";

/**
 * @title AegisFlowComplianceModule
 * @notice An ERC-3643 (T-REX) compliance module backed by AegisFlow.
 *
 * ERC-3643 is the industry standard for permissioned / regulated tokens
 * (billions of RWA tokenized with it). Such tokens run every transfer through
 * a `ModularCompliance` contract, which asks each bound module `moduleCheck`.
 * By implementing that interface, AegisFlow becomes a drop-in compliance
 * module: any ERC-3643 token on Flare can plug it in and have its transfers
 * gated by our confidential, FDC-proven AML verdicts — not just FXRP.
 *
 * `moduleCheck` allows a transfer only if the receiver is currently compliant
 * in the AegisFlow gate (CLEAR and not expired). Unscreened or sanctioned
 * receivers are rejected — fail-closed, exactly as a regulated token requires.
 *
 * Conforms to ERC-3643 IModule
 * (TokenySolutions/T-REX .../modules/IModule.sol).
 */
contract AegisFlowComplianceModule {
    AegisFlowGate public immutable gate;

    mapping(address => bool) private _bound;

    event ComplianceBound(address indexed _compliance);
    event ComplianceUnbound(address indexed _compliance);

    error AlreadyBound();
    error NotBound();

    constructor(address _gate) {
        gate = AegisFlowGate(_gate);
    }

    // --- binding -----------------------------------------------------------

    function bindCompliance(address _compliance) external {
        if (_bound[_compliance]) revert AlreadyBound();
        _bound[_compliance] = true;
        emit ComplianceBound(_compliance);
    }

    function unbindCompliance(address _compliance) external {
        if (!_bound[_compliance]) revert NotBound();
        _bound[_compliance] = false;
        emit ComplianceUnbound(_compliance);
    }

    function isComplianceBound(address _compliance) external view returns (bool) {
        return _bound[_compliance];
    }

    function canComplianceBind(address) external pure returns (bool) {
        return true; // plug and play — no per-compliance configuration needed
    }

    function isPlugAndPlay() external pure returns (bool) {
        return true;
    }

    function name() external pure returns (string memory) {
        return "AegisFlowComplianceModule";
    }

    // --- state-change hooks (no internal state to update) ------------------

    function moduleTransferAction(address, address, uint256) external {}
    function moduleMintAction(address, uint256) external {}
    function moduleBurnAction(address, uint256) external {}

    // --- the compliance check ---------------------------------------------

    /**
     * @notice Allow the transfer only if the receiver passes AegisFlow.
     * @dev The receiver is keyed by `keyFor(_to)`; the same key is used when a
     *      verdict is recorded for that address (attestor or FDC path).
     */
    function moduleCheck(
        address /*_from*/,
        address _to,
        uint256 /*_value*/,
        address /*_compliance*/
    ) external view returns (bool) {
        return gate.isCompliant(keyFor(_to));
    }

    /// @notice On-chain key under which an EVM address's verdict is stored.
    function keyFor(address account) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(account));
    }
}
