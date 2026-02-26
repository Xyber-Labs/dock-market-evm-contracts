// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../TeeDataTypes.sol";
import "../EllipticCurve.sol";

interface ITeeVerifier {

    function rootCert() external view returns(ChunkedX509Cert memory rootCertificate);

    function mrEnclaveAuthorized(bytes32 mrEnclave) external view returns(bool isAuthorized);

    function verifyCert(ChunkedX509Cert memory cert, bytes memory publicKey) external pure returns(bool isValid);

    function ecdsaOnKeccak256r1(bytes memory message, bytes memory signature, bytes memory publicKey) external pure returns(bool isValid);

}   