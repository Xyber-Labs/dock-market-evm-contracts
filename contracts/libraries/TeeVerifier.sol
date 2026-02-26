// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./interfaces/ITeeVerifier.sol";

contract TeeVerifier is ITeeVerifier {
    using EllipticCurve for *;

    /// @custom:storage-location erc7201:storage.TeeVerifier
    struct TeeVerifierStorage {
        // @notice Intel Root CA certificate
        ChunkedX509Cert _rootCert;
        mapping(bytes32 mrEnclave => bool authorized) _mrEnclaveAuthorized;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("storage.TeeVerifier")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant TEE_VERIFIER_STORAGE_LOCATION = 0xbd6a287fee5d758b3cb2fe75ce73ccf539b4ced6226b07230946dc29ff5a7000;

    error TeeVerifier__InvalidIntermediateCert();
    error TeeVerifier__InvalidLeafCert();
    error TeeVerifier__InvalidQeSignature();
    error TeeVerifier__InvalidQeReportDataHash();
    error TeeVerifier__InvalidEnclaveSignature();
    error TeeVerifier__ReportMustBe384Bytes(); 
    error TeeVerifier__SignatureMustBe64Bytes();

    event RootCertSet(address indexed caller);
    event MrEnclaveSet(bytes32 mrEnclave, bool isAuthorized, address indexed caller);

    function _setRootCert(ChunkedX509Cert memory newRootCert) internal {
        TeeVerifierStorage storage $ = _getTeeVerifierStorage();
        $._rootCert = newRootCert;

        emit RootCertSet(msg.sender);
    }

    function _setMrEnclave(bytes32 mrEnclave, bool isAuthorized) internal {
        TeeVerifierStorage storage $ = _getTeeVerifierStorage();
        $._mrEnclaveAuthorized[mrEnclave] = isAuthorized;

        emit MrEnclaveSet(mrEnclave, isAuthorized, msg.sender);
    }

    function rootCert() public view returns(ChunkedX509Cert memory rootCertificate) {
        TeeVerifierStorage storage $ = _getTeeVerifierStorage();
        return $._rootCert;
    }

    function mrEnclaveAuthorized(bytes32 mrEnclave) public view returns(bool isAuthorized) {
        TeeVerifierStorage storage $ = _getTeeVerifierStorage();
        return $._mrEnclaveAuthorized[mrEnclave];
    }

    function verifyCert(ChunkedX509Cert memory cert, bytes memory publicKey) public pure returns(bool isValid) {
        bytes memory certificateBody = abi.encodePacked(
            cert.bodyPartOne,
            cert.publicKey,
            cert.bodyPartTwo
        );

        return ecdsaOnKeccak256r1(certificateBody, cert.signature, publicKey);
    }

    function ecdsaOnKeccak256r1(
        bytes memory message,
        bytes memory signature,
        bytes memory publicKey
    ) public pure returns(bool isValid) {
        return EllipticCurve._ecdsaOnKeccak256r1(
            sha256(message),
            _formatBytesToUint(signature),
            _formatBytesToUint(publicKey)
        );
    }

    function _verifySessionKey(
        ChunkedX509Cert memory leaf,
        ChunkedX509Cert memory intermediate,
        ChunkedSGXQuote memory quote
    ) internal view returns(bytes32 dataHash, bytes32 mrEnclave) {
        TeeVerifierStorage storage $ = _getTeeVerifierStorage();

        // Verify that both the intermediate and leaf certificates are valid
        if (!verifyCert(intermediate, $._rootCert.publicKey)) {
            revert TeeVerifier__InvalidIntermediateCert();
        }

        if (!verifyCert(leaf, intermediate.publicKey)) {
            revert TeeVerifier__InvalidLeafCert();
        }

        // (1) Verify QE Report signature with PCK Certificate
        if (!ecdsaOnKeccak256r1(
            quote.qeReport,
            quote.qeReportSignature,
            abi.encodePacked(leaf.publicKey)
        )) {
            revert TeeVerifier__InvalidQeSignature();
        }

        // (2) Compare QE report data (first 32 bytes) with SHA256 hash
        SGXQuoteData memory parsedQeReport = _parseQuoteReport(quote.qeReport);
        if (parsedQeReport.dataHash != sha256(
            abi.encodePacked(quote.attestationKey, quote.qeAuthenticationData)
        )) {
            revert TeeVerifier__InvalidQeReportDataHash();
        }

        // (3) Verify ISV Enclaver Report signature with ECDSA Attestation Key
        if (!ecdsaOnKeccak256r1(
            abi.encodePacked(quote.header, quote.isvReport),
            quote.isvReportSignature,
            quote.attestationKey
        )) {
            revert TeeVerifier__InvalidEnclaveSignature();
        }

        // Check report data
        SGXQuoteData memory parsedIsvReport = _parseQuoteReport(quote.isvReport);
        return (parsedIsvReport.dataHash, parsedIsvReport.mrEnclave);
    }

    function _parseQuoteReport(bytes memory rawReport) internal pure returns(SGXQuoteData memory report) {
        if (rawReport.length != 384) revert TeeVerifier__ReportMustBe384Bytes();

        bytes32 mrSigner;
        bytes32 mrEnclave;
        bytes32 dataHash;

        assembly {
            mrSigner := mload(add(rawReport, QUOTE_MRSIGNER_OFFSET))
            mrEnclave := mload(add(rawReport, QUOTE_MRENCLAVE_OFFSET))
            dataHash := mload(add(rawReport, QUOTE_DATAHASH_OFFSET))
        }

        return SGXQuoteData(mrSigner, mrEnclave, dataHash);
    } 

    function _formatBytesToUint(bytes memory input) internal pure returns(uint256[2] memory output) {
        if (input.length != 64) revert TeeVerifier__SignatureMustBe64Bytes();

        assembly {
            let outputPointer := add(output, 0x00)
            mstore(outputPointer, mload(add(input, 0x20)))
            mstore(add(outputPointer, 0x20), mload(add(input, 0x40)))
        }
  
        return output;
    }

    function _getTeeVerifierStorage() private pure returns(TeeVerifierStorage storage $) {
        assembly {
            $.slot := TEE_VERIFIER_STORAGE_LOCATION
        }
    }
}
