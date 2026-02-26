const nativeAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const agentId = 1n;
const agentId3 = 3n;
const agentName = "First agent";
const agentName3 = "Second agent";
const agentTypeC = "Conservative";
const agentTypeA = "Aggressive";
const agentTypeI = "NFT Index fund";
const staticCallGasLimit = 50000n;
const defaultPerformanceFeeRate = 500n;
const defaultManagementFeeRate = 100n;
const defaultMaxDepositValue = 2000n * 10n ** 6n;
const zeroAgentId = "0x00000000000000000000000000000000";
const byteAgentId = "0x0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f";
const byteAgentId2 = "0xffffffffffffffffffffffffffffffff";
const transferGasLimit = 130000n;

module.exports = {
    nativeAddress, agentId, agentId3, agentName, agentName3, agentTypeC, agentTypeA, staticCallGasLimit, defaultPerformanceFeeRate,
    defaultManagementFeeRate, defaultMaxDepositValue, zeroAgentId, byteAgentId, byteAgentId2, transferGasLimit, agentTypeI
};