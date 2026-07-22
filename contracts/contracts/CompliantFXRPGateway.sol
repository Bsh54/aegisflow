// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {AegisFlowGate} from "./AegisFlowGate.sol";

/**
 * @title CompliantFXRPGateway
 * @notice A minting/redemption gateway that only releases FXRP to callers whose
 *         source XRPL address passed AegisFlow's confidential AML screening.
 *
 * This is the piece that turns a *verdict* into an *action*: the gateway holds
 * FXRP (testnet) and hands it out only when `AegisFlowGate.isCompliant` returns
 * true for the requester's source address. A sanctioned source is refused at
 * the contract level — the conversion simply never happens.
 *
 * In production this logic lives inside the FAssets executor, which relays the
 * XRPL payment proof only for compliant sources. Here it is a self-contained,
 * on-chain-verifiable demonstration of the same enforcement.
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract CompliantFXRPGateway {
    /// @notice The FXRP (FAsset) token this gateway distributes.
    IERC20 public immutable fxrp;

    /// @notice The AegisFlow compliance gate consulted before every release.
    AegisFlowGate public immutable gate;

    address public owner;

    /// @notice Fixed amount of FXRP released per successful request (demo).
    uint256 public amountPerMint;

    event MintFulfilled(
        address indexed recipient,
        bytes32 indexed xrplAddressHash,
        uint256 amount
    );
    event MintRefused(
        address indexed recipient,
        bytes32 indexed xrplAddressHash,
        AegisFlowGate.Verdict verdict
    );

    error NotOwner();
    error NotCompliant(AegisFlowGate.Verdict verdict);
    error InsufficientLiquidity(uint256 available, uint256 requested);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _fxrp, address _gate, uint256 _amountPerMint) {
        owner = msg.sender;
        fxrp = IERC20(_fxrp);
        gate = AegisFlowGate(_gate);
        amountPerMint = _amountPerMint;
    }

    function setAmountPerMint(uint256 _amount) external onlyOwner {
        amountPerMint = _amount;
    }

    /// @notice Fund the gateway with FXRP to distribute (owner must approve first).
    function fund(uint256 amount) external onlyOwner {
        require(fxrp.transferFrom(msg.sender, address(this), amount), "fund failed");
    }

    /// @notice Withdraw FXRP liquidity back to the owner.
    function withdraw(uint256 amount) external onlyOwner {
        require(fxrp.transfer(owner, amount), "withdraw failed");
    }

    /**
     * @notice Request FXRP for `recipient`, gated by the source XRPL address's
     *         compliance verdict. Reverts (refuses the conversion) if the source
     *         is not currently CLEAR.
     * @param xrplAddressHash keccak256 of the source XRPL address.
     * @param recipient       Flare address to receive the FXRP.
     */
    function requestMint(bytes32 xrplAddressHash, address recipient) external {
        if (!gate.isCompliant(xrplAddressHash)) {
            (AegisFlowGate.Verdict v, , , ) = gate.getScreening(xrplAddressHash);
            emit MintRefused(recipient, xrplAddressHash, v);
            revert NotCompliant(v);
        }

        uint256 bal = fxrp.balanceOf(address(this));
        if (bal < amountPerMint) revert InsufficientLiquidity(bal, amountPerMint);

        require(fxrp.transfer(recipient, amountPerMint), "release failed");
        emit MintFulfilled(recipient, xrplAddressHash, amountPerMint);
    }

    /// @notice Read-only preview: would a mint for this source succeed right now?
    function canMint(bytes32 xrplAddressHash) external view returns (bool) {
        return
            gate.isCompliant(xrplAddressHash) &&
            fxrp.balanceOf(address(this)) >= amountPerMint;
    }
}
