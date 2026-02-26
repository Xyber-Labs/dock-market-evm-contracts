// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

struct Transaction {
    address target;
    uint256 value;
    bytes data;
}

struct Permit {
    address holder;
    uint256 amount;
    uint256 deadline;
    uint8 v;
    bytes32 r;
    bytes32 s;
}

struct AgentProfile {
    bool isPaused;
    string agentName;
    string agentType;
    address onchainAddress;
    address creatorAddress;
}

struct AgentInfo {
    AgentState currentState;
    uint256 currentRound;
    string agentName;
    string agentType;
    address depositToken;
    address onchainAddress;
    address creatorAddress;
    uint256 sharePrice;
    uint256 baseMinShares;
    uint256 baseMaxShares;
    uint256 memberMinShares;
    uint256 memberMaxShares;
    uint256 sharesCap;
    bool isDistributionEnded;
    uint256 usersAmount;
    uint256 totalShares;
    uint256 depositedAmount;
    uint256 collectedAmount;
    address[] users;
}

struct AgentInfoByRound {
    bool isCurrentRound;
    bool isDistributionEnded;
    uint256 usersAmount;
    uint256 totalShares;
    uint256 depositedAmount;
    uint256 collectedAmount;
    address[] users;
}

struct UserInfo {
    uint256 sharesPurchased;
    uint256 deposited;
    uint256 collected;
    uint256 tokenId;
    bool isMember;
}

struct Distribution {
    address user;
    uint256 shares;
}

enum AgentState {
    Nonexistent,
    Deposit,
    Trading,
    Waiting,
    Distribution,
    Preparation
}
