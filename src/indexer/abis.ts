// Minimal ABIs for events we care about

export const TIMELOCK_ABI = [
  'event CallScheduled(bytes32 indexed id, uint256 indexed index, address target, uint256 value, bytes data, bytes32 predecessor, uint256 delay)',
  'event CallExecuted(bytes32 indexed id, uint256 indexed index, address target, uint256 value, bytes data)',
  'event Cancelled(bytes32 indexed id)'
];

export const SAFE_ABI = [
  'event ExecutionSuccess(bytes32 indexed txHash, uint256 payment)',
  'event ExecutionFailure(bytes32 indexed txHash, uint256 payment)',
  'event ApproveHash(bytes32 indexed approvedHash, address indexed owner)'
];

export const GOVERNOR_ABI = [
  'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, string description)',
  'event ProposalExecuted(uint256 indexed proposalId)',
  'event ProposalCanceled(uint256 indexed proposalId)'
];
