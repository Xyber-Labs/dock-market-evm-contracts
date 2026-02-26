const { zeroAgentId, nativeAddress } = require("./GlobalConstants");
const { expect } = require("chai");

const zeroHash = ethers.ZeroHash;
const zeroAddress = ethers.ZeroAddress;
const AbiCoder = new ethers.AbiCoder();
const withDecimals = ethers.parseEther;

async function createWallet(dockMarketRouter, creator, userAddress, agentId) {
    if (userAddress == zeroAddress) {
        await expect(dockMarketRouter.connect(creator).createWallet(
            userAddress,
            agentId
        )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__ZeroAddress");

        return "DockMarketRouter__ZeroAddress";
    }

    if ((await dockMarketRouter.getAgentProfile(agentId))[3] == zeroAddress) {
        await expect(dockMarketRouter.connect(creator).createWallet(
            userAddress,
            agentId
        )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__ZeroAddress");

        return "DockMarketRouter__ZeroAddress";
    }

    if ((await dockMarketRouter.getAgentProfile(agentId))[0]) {
        await expect(dockMarketRouter.connect(creator).createWallet(
            userAddress,
            agentId
        )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__AgentPaused");

        return "DockMarketRouter__AgentPaused";
    }

    const walletData = await dockMarketRouter.getWalletAddress(userAddress, agentId);

    if (walletData[1]) {
        await expect(dockMarketRouter.connect(creator).createWallet(
            userAddress,
            agentId
        )).to.not.emit(dockMarketRouter, "WalletCreated");
    } else {
        await expect(dockMarketRouter.connect(creator).createWallet(
            userAddress,
            agentId
        )).to.emit(dockMarketRouter, "WalletCreated").withArgs(
            userAddress,
            agentId,
            (await dockMarketRouter.getAgentProfile(agentId))[2],
            walletData[0]
        );
    }

    const newWalletData = await dockMarketRouter.getWalletAddress(userAddress, agentId);

    expect(newWalletData[0]).to.equal(walletData[0]);
    expect(newWalletData[1]).to.equal(true);

    const deployedWallet = await ethers.getContractAt("DockMarketWallet", walletData[0]);

    expect(await deployedWallet.owner()).to.equal(userAddress);
    expect(await deployedWallet.getAgentId()).to.equal(agentId);
    expect(await deployedWallet.getAgentProfile()).to.eql(await dockMarketRouter.getAgentProfile(agentId));

    expect(await dockMarketRouter.getOwnerByWallet(deployedWallet.target)).to.eql([userAddress, await dockMarketRouter.getAgentProfile(agentId)]);

    await expect(deployedWallet.connect(creator).initialize(
        creator.address,
        agentId
    )).to.be.revertedWithCustomError(deployedWallet, "InvalidInitialization");

    if (walletData[1]) {
        expect(walletData).to.eql(newWalletData);

        return "Success_WithoutEvent";
    } else {
        return "Success_WithEvent";
    }
};

async function deposit(dockMarketRouter, depositor, receiver, agentId, tokenAddress, amount) {
    let token;

    if (tokenAddress != nativeAddress) {
        token = await ethers.getContractAt("ERC20Mock", tokenAddress);
    }

    if (
        tokenAddress != nativeAddress &&
        tokenAddress != await dockMarketRouter.USDC_ADDRESS() &&
        tokenAddress != await dockMarketRouter.WETH_ADDRESS()
    ) {
        await expect(dockMarketRouter.connect(depositor).deposit(
            receiver,
            agentId,
            tokenAddress,
            amount
        )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__UnallowedToken");

        return "DockMarketRouter__UnallowedToken";
    }

    if (tokenAddress != nativeAddress) {
        await expect(dockMarketRouter.connect(depositor).deposit(
            receiver,
            agentId,
            tokenAddress,
            amount,
            { value: 1n }
        )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__InvalidMsgValue");
    }

    const walletData = await dockMarketRouter.getWalletAddress(receiver, agentId);

    if (amount == 0n && walletData[1]) {
        const deployedWallet = await ethers.getContractAt("DockMarketWallet", walletData[0]);

        if (tokenAddress == nativeAddress) {
            await expect(dockMarketRouter.connect(depositor).deposit(
                receiver,
                agentId,
                tokenAddress,
                amount,
                { value: amount }
            )).to.be.revertedWithCustomError(deployedWallet, "DockMarketWallet__ZeroAmount");
        } else {
            await expect(dockMarketRouter.connect(depositor).deposit(
                receiver,
                agentId,
                tokenAddress,
                amount
            )).to.be.revertedWithCustomError(deployedWallet, "DockMarketWallet__ZeroAmount");
        }

        return "DockMarketWallet__ZeroAmount";
    }

    if (tokenAddress == nativeAddress && amount >= withDecimals("0.6")) {
        await expect(dockMarketRouter.connect(depositor).deposit(
            receiver,
            agentId,
            tokenAddress,
            amount,
            { value: amount }
        )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__DepositAmountExceeded");

        return "DockMarketRouter__DepositAmountExceeded_ETH";
    }

    if (tokenAddress == await dockMarketRouter.WETH_ADDRESS() && amount >= withDecimals("0.6")) {
        await expect(dockMarketRouter.connect(depositor).deposit(
            receiver,
            agentId,
            tokenAddress,
            amount
        )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__DepositAmountExceeded");

        return "DockMarketRouter__DepositAmountExceeded_WETH";
    }

    if (tokenAddress == await dockMarketRouter.USDC_ADDRESS() && amount > 2000_000000n) {
        await expect(dockMarketRouter.connect(depositor).deposit(
            receiver,
            agentId,
            tokenAddress,
            amount
        )).to.be.revertedWithCustomError(dockMarketRouter, "DockMarketRouter__DepositAmountExceeded");

        return "DockMarketRouter__DepositAmountExceeded_USDC";
    }

    const ethWalletBalanceBefore = await ethers.provider.getBalance(walletData[0]);

    let tokenWalletBalanceBefore = 0n;

    if (tokenAddress != nativeAddress) {
        tokenWalletBalanceBefore = await token.balanceOf(walletData[0]);
    }

    let totalDepositedBefore = 0n;

    if (walletData[1]) {
        const deployedWallet = await ethers.getContractAt("DockMarketWallet", walletData[0]);

        totalDepositedBefore = await deployedWallet.totalDeposited(tokenAddress);
    }

    if (tokenAddress == nativeAddress && !walletData[1]) {
        await expect(dockMarketRouter.connect(depositor).deposit(
            receiver,
            agentId,
            tokenAddress,
            999n,
            { value: amount }
        )).to.emit(dockMarketRouter, "WalletCreated").withArgs(
            receiver,
            agentId,
            (await dockMarketRouter.getAgentProfile(agentId))[2],
            walletData[0]
        ).to.emit(dockMarketRouter, "Deposited").withArgs(
            walletData[0],
            receiver,
            agentId,
            tokenAddress,
            amount
        );

        expect(await ethers.provider.getBalance(dockMarketRouter.target)).to.equal(0n);
        expect(await ethers.provider.getBalance(walletData[0])).to.equal(ethWalletBalanceBefore + amount);

        if (walletData[1]) {
            expect(await dockMarketRouter.totalDeposited(receiver, agentId, tokenAddress)).to.equal(totalDepositedBefore + amount);
        } else {
            expect(await dockMarketRouter.totalDeposited(receiver, agentId, tokenAddress)).to.equal(amount);
        }

        return "Success_Created_ETH";
    }

    if (tokenAddress == nativeAddress && walletData[1]) {
        await expect(dockMarketRouter.connect(depositor).deposit(
            receiver,
            agentId,
            tokenAddress,
            999n,
            { value: amount }
        )).to.emit(dockMarketRouter, "Deposited").withArgs(
            walletData[0],
            receiver,
            agentId,
            tokenAddress,
            amount
        ).to.not.emit(dockMarketRouter, "WalletCreated");

        expect(await ethers.provider.getBalance(dockMarketRouter.target)).to.equal(0n);
        expect(await ethers.provider.getBalance(walletData[0])).to.equal(ethWalletBalanceBefore + amount);

        if (walletData[1]) {
            expect(await dockMarketRouter.totalDeposited(receiver, agentId, tokenAddress)).to.equal(totalDepositedBefore + amount);
        } else {
            expect(await dockMarketRouter.totalDeposited(receiver, agentId, tokenAddress)).to.equal(amount);
        }

        return "Success_Existed_ETH";
    }

    await token.connect(depositor).approve(dockMarketRouter.target, amount);

    if (tokenAddress != nativeAddress && !walletData[1]) {
        await expect(dockMarketRouter.connect(depositor).deposit(
            receiver,
            agentId,
            tokenAddress,
            amount
        )).to.emit(dockMarketRouter, "WalletCreated").withArgs(
            receiver,
            agentId,
            (await dockMarketRouter.getAgentProfile(agentId))[2],
            walletData[0]
        ).to.emit(dockMarketRouter, "Deposited").withArgs(
            walletData[0],
            receiver,
            agentId,
            tokenAddress,
            amount
        ).to.emit(token, "Transfer").withArgs(
            depositor,
            walletData[0],
            amount
        );

        expect(await ethers.provider.getBalance(dockMarketRouter.target)).to.equal(0n);
        expect(await token.balanceOf(walletData[0])).to.equal(tokenWalletBalanceBefore + amount);

        if (walletData[1]) {
            expect(await dockMarketRouter.totalDeposited(receiver, agentId, tokenAddress)).to.equal(totalDepositedBefore + amount);
        } else {
            expect(await dockMarketRouter.totalDeposited(receiver, agentId, tokenAddress)).to.equal(amount);
        }

        return "Success_Created_Token";
    }

    if (tokenAddress != nativeAddress && walletData[1]) {
        await expect(dockMarketRouter.connect(depositor).deposit(
            receiver,
            agentId,
            tokenAddress,
            amount
        )).to.emit(dockMarketRouter, "Deposited").withArgs(
            walletData[0],
            receiver,
            agentId,
            tokenAddress,
            amount
        ).to.emit(token, "Transfer").withArgs(
            depositor,
            walletData[0],
            amount
        ).to.not.emit(dockMarketRouter, "WalletCreated");

        expect(await ethers.provider.getBalance(dockMarketRouter.target)).to.equal(0n);
        expect(await token.balanceOf(walletData[0])).to.equal(tokenWalletBalanceBefore + amount);

        if (walletData[1]) {
            expect(await dockMarketRouter.totalDeposited(receiver, agentId, tokenAddress)).to.equal(totalDepositedBefore + amount);
        } else {
            expect(await dockMarketRouter.totalDeposited(receiver, agentId, tokenAddress)).to.equal(amount);
        }

        return "Success_Existed_Token";
    }
};

async function registerAgent(
    dockMarketSimpleRouter,
    caller,
    agentId,
    agentName,
    agentType,
    depositToken,
    onchainAddress,
    creatorAddress,
    sharePrice,
    baseMinShares,
    baseMaxShares,
    memberMinShares,
    memberMaxShares,
    sharesCap
) {
    if (!(await dockMarketSimpleRouter.hasRole(await dockMarketSimpleRouter.MANAGER_ROLE(), caller.address))) {
        await expect(dockMarketSimpleRouter.connect(caller).registerAgent(
            agentId,
            agentName,
            agentType,
            depositToken,
            onchainAddress,
            creatorAddress,
            sharePrice,
            baseMinShares,
            baseMaxShares,
            memberMinShares,
            memberMaxShares,
            sharesCap
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "AccessControlUnauthorizedAccount");

        return "AccessControlUnauthorizedAccount";
    }

    const currentAgentInfo = await dockMarketSimpleRouter.getAgentInfo(agentId);

    if (currentAgentInfo[0] != 0n) {
        await expect(dockMarketSimpleRouter.connect(caller).registerAgent(
            agentId,
            agentName,
            agentType,
            depositToken,
            onchainAddress,
            creatorAddress,
            sharePrice,
            baseMinShares,
            baseMaxShares,
            memberMinShares,
            memberMaxShares,
            sharesCap
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

        return "DockMarketSimpleRouter__IncorrectAgentState";
    }

    if (agentId == zeroAgentId) {
        await expect(dockMarketSimpleRouter.connect(caller).registerAgent(
            agentId,
            agentName,
            agentType,
            depositToken,
            onchainAddress,
            creatorAddress,
            sharePrice,
            baseMinShares,
            baseMaxShares,
            memberMinShares,
            memberMaxShares,
            sharesCap
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

        return "DockMarketSimpleRouter__ZeroData: agentId";
    }

    if (agentName == "") {
        await expect(dockMarketSimpleRouter.connect(caller).registerAgent(
            agentId,
            agentName,
            agentType,
            depositToken,
            onchainAddress,
            creatorAddress,
            sharePrice,
            baseMinShares,
            baseMaxShares,
            memberMinShares,
            memberMaxShares,
            sharesCap
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

        return "DockMarketSimpleRouter__ZeroData: agentName";
    }

    if (agentType == "") {
        await expect(dockMarketSimpleRouter.connect(caller).registerAgent(
            agentId,
            agentName,
            agentType,
            depositToken,
            onchainAddress,
            creatorAddress,
            sharePrice,
            baseMinShares,
            baseMaxShares,
            memberMinShares,
            memberMaxShares,
            sharesCap
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

        return "DockMarketSimpleRouter__ZeroData: agentType";
    }

    if (depositToken == zeroAddress) {
        await expect(dockMarketSimpleRouter.connect(caller).registerAgent(
            agentId,
            agentName,
            agentType,
            depositToken,
            onchainAddress,
            creatorAddress,
            sharePrice,
            baseMinShares,
            baseMaxShares,
            memberMinShares,
            memberMaxShares,
            sharesCap
        )).to.be.revertedWithoutReason();

        return "DockMarketSimpleRouter__ZeroData: depositToken";
    }

    const token = await ethers.getContractAt("ERC20Mock", depositToken);

    if (await token.totalSupply() == 0) {
        await expect(dockMarketSimpleRouter.connect(caller).registerAgent(
            agentId,
            agentName,
            agentType,
            depositToken,
            onchainAddress,
            creatorAddress,
            sharePrice,
            baseMinShares,
            baseMaxShares,
            memberMinShares,
            memberMaxShares,
            sharesCap
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

        return "DockMarketSimpleRouter__ZeroData: depositToken 2";
    }

    if (onchainAddress == zeroAddress) {
        await expect(dockMarketSimpleRouter.connect(caller).registerAgent(
            agentId,
            agentName,
            agentType,
            depositToken,
            onchainAddress,
            creatorAddress,
            sharePrice,
            baseMinShares,
            baseMaxShares,
            memberMinShares,
            memberMaxShares,
            sharesCap
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

        return "DockMarketSimpleRouter__ZeroData: onchainAddress";
    }

    if (sharePrice == 0n) {
        await expect(dockMarketSimpleRouter.connect(caller).registerAgent(
            agentId,
            agentName,
            agentType,
            depositToken,
            onchainAddress,
            creatorAddress,
            sharePrice,
            baseMinShares,
            baseMaxShares,
            memberMinShares,
            memberMaxShares,
            sharesCap
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

        return "DockMarketSimpleRouter__ZeroData: sharePrice";
    }

    if (baseMinShares > baseMaxShares) {
        await expect(dockMarketSimpleRouter.connect(caller).registerAgent(
            agentId,
            agentName,
            agentType,
            depositToken,
            onchainAddress,
            creatorAddress,
            sharePrice,
            baseMinShares,
            baseMaxShares,
            memberMinShares,
            memberMaxShares,
            sharesCap
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

        return "DockMarketSimpleRouter__ZeroData: baseShares";
    }

    if (memberMinShares > memberMaxShares) {
        await expect(dockMarketSimpleRouter.connect(caller).registerAgent(
            agentId,
            agentName,
            agentType,
            depositToken,
            onchainAddress,
            creatorAddress,
            sharePrice,
            baseMinShares,
            baseMaxShares,
            memberMinShares,
            memberMaxShares,
            sharesCap
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

        return "DockMarketSimpleRouter__ZeroData: memberShares";
    }

    if (sharesCap == 0n) {
        await expect(dockMarketSimpleRouter.connect(caller).registerAgent(
            agentId,
            agentName,
            agentType,
            depositToken,
            onchainAddress,
            creatorAddress,
            sharePrice,
            baseMinShares,
            baseMaxShares,
            memberMinShares,
            memberMaxShares,
            sharesCap
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

        return "DockMarketSimpleRouter__ZeroData: sharesCap";
    }

    await expect(dockMarketSimpleRouter.connect(caller).registerAgent(
        agentId,
        agentName,
        agentType,
        depositToken,
        onchainAddress,
        creatorAddress,
        sharePrice,
        baseMinShares,
        baseMaxShares,
        memberMinShares,
        memberMaxShares,
        sharesCap
    )).to.emit(dockMarketSimpleRouter, "AgentRegistered").withArgs(
        agentId,
        agentName,
        agentType,
        depositToken,
        onchainAddress,
        creatorAddress,
        sharePrice,
        baseMinShares,
        baseMaxShares,
        memberMinShares,
        memberMaxShares,
        sharesCap,
        caller.address
    ).to.emit(dockMarketSimpleRouter, "AgentStateUpdated").withArgs(
        agentId,
        1n,
        1n,
        caller.address
    );

    const newAgentInfo = await dockMarketSimpleRouter.getAgentInfo(agentId);
    const newAgentInfoByRound0 = await dockMarketSimpleRouter.getAgentInfoByRound(agentId, 0n);
    const newAgentInfoByRound1 = await dockMarketSimpleRouter.getAgentInfoByRound(agentId, 1n);
    const newAgentInfoByRound2 = await dockMarketSimpleRouter.getAgentInfoByRound(agentId, 2n);

    expect(newAgentInfo).to.eql([
        1n,
        1n,
        agentName,
        agentType,
        depositToken,
        onchainAddress,
        creatorAddress,
        sharePrice,
        baseMinShares,
        baseMaxShares,
        memberMinShares,
        memberMaxShares,
        sharesCap,
        false,
        0n,
        0n,
        0n,
        0n,
        []
    ]);
    expect(newAgentInfoByRound0).to.eql([false, false, 0n, 0n, 0n, 0n, []]);
    expect(newAgentInfoByRound1).to.eql([true, false, 0n, 0n, 0n, 0n, []]);
    expect(newAgentInfoByRound2).to.eql([false, false, 0n, 0n, 0n, 0n, []]);

    return "Success";
};

async function depositSimple(
    dockMarketSimpleRouter,
    depositor,
    agentId,
    sharesAmount,
    receiver
) {
    const currentAgentInfo = await dockMarketSimpleRouter.getAgentInfo(agentId);

    if (currentAgentInfo[0] != 1n) {
        await expect(dockMarketSimpleRouter.connect(depositor).deposit(
            agentId,
            sharesAmount,
            receiver
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

        return "DockMarketSimpleRouter__IncorrectAgentState";
    }

    if (receiver == zeroAddress) {
        await expect(dockMarketSimpleRouter.connect(depositor).deposit(
            agentId,
            sharesAmount,
            receiver
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

        return "DockMarketSimpleRouter__ZeroData: receiver zero address";
    }

    if (sharesAmount == 0n) {
        await expect(dockMarketSimpleRouter.connect(depositor).deposit(
            agentId,
            sharesAmount,
            receiver
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

        return "DockMarketSimpleRouter__ZeroData: zero shares";
    }

    const currentUserInfo = await dockMarketSimpleRouter.getUserInfo(agentId, currentAgentInfo[1], receiver);

    if (currentUserInfo[4]) {
        if (sharesAmount + currentUserInfo[0] > currentAgentInfo[11]) {
            await expect(dockMarketSimpleRouter.connect(depositor).deposit(
                agentId,
                sharesAmount,
                receiver
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__DepositCapacityExceeded");

            return "DockMarketSimpleRouter__DepositCapacityExceeded: memberShares";
        }

        if (currentAgentInfo[10] > sharesAmount + currentUserInfo[0]) {
            await expect(dockMarketSimpleRouter.connect(depositor).deposit(
                agentId,
                sharesAmount,
                receiver
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__DepositCapacityUnachieved");

            return "DockMarketSimpleRouter__DepositCapacityUnachieved: memberShares";
        }
    } else {
        if (sharesAmount + currentUserInfo[0] > currentAgentInfo[9]) {
            await expect(dockMarketSimpleRouter.connect(depositor).deposit(
                agentId,
                sharesAmount,
                receiver
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__DepositCapacityExceeded");

            return "DockMarketSimpleRouter__DepositCapacityExceeded: baseShares";
        }

        if (currentAgentInfo[8] > sharesAmount + currentUserInfo[0]) {
            await expect(dockMarketSimpleRouter.connect(depositor).deposit(
                agentId,
                sharesAmount,
                receiver
            )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__DepositCapacityUnachieved");

            return "DockMarketSimpleRouter__DepositCapacityUnachieved: baseShares";
        }
    }

    if (sharesAmount + currentAgentInfo[15] > currentAgentInfo[12]) {
        await expect(dockMarketSimpleRouter.connect(depositor).deposit(
            agentId,
            sharesAmount,
            receiver
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__DepositCapacityExceeded");

        return "DockMarketSimpleRouter__DepositCapacityExceeded: totalShares";
    }

    const depositToken = await ethers.getContractAt("ERC20Mock", currentAgentInfo[4]);
    const depositTokenBalanceBefore = await depositToken.balanceOf(dockMarketSimpleRouter.target);

    if (currentAgentInfo[7] * sharesAmount > await depositToken.allowance(depositor.address, dockMarketSimpleRouter.target)) {
        await expect(dockMarketSimpleRouter.connect(depositor).deposit(
            agentId,
            sharesAmount,
            receiver
        )).to.be.revertedWithCustomError(depositToken, "ERC20InsufficientAllowance");

        return "DepositToken__ERC20InsufficientAllowance";
    }

    await expect(dockMarketSimpleRouter.connect(depositor).deposit(
        agentId,
        sharesAmount,
        receiver
    )).to.emit(dockMarketSimpleRouter, "Deposited").withArgs(
        depositor.address,
        receiver,
        agentId,
        currentAgentInfo[1],
        depositToken.target,
        currentAgentInfo[7] * sharesAmount
    ).to.emit(depositToken, "Transfer").withArgs(
        depositor.address,
        dockMarketSimpleRouter.target,
        currentAgentInfo[7] * sharesAmount
    );

    const newAgentInfo = await dockMarketSimpleRouter.getAgentInfo(agentId);
    const newAgentInfoByRound = await dockMarketSimpleRouter.getAgentInfoByRound(agentId, currentAgentInfo[1]);
    const newUserInfo = await dockMarketSimpleRouter.getUserInfo(agentId, currentAgentInfo[1], receiver);
    const newUsers = currentAgentInfo[18].toArray();
    if (!newUsers.includes(receiver)) newUsers.push(receiver);

    expect(newAgentInfo).to.eql([
        1n,
        currentAgentInfo[1],
        currentAgentInfo[2],
        currentAgentInfo[3],
        depositToken.target,
        currentAgentInfo[5],
        currentAgentInfo[6],
        currentAgentInfo[7],
        currentAgentInfo[8],
        currentAgentInfo[9],
        currentAgentInfo[10],
        currentAgentInfo[11],
        currentAgentInfo[12],
        currentAgentInfo[13],
        currentAgentInfo[14] + 1n,
        currentAgentInfo[15] + sharesAmount,
        currentAgentInfo[16] + currentAgentInfo[7] * sharesAmount,
        0n,
        newUsers
    ]);

    expect(newAgentInfoByRound).to.eql([
        true,
        false,
        currentAgentInfo[14] + 1n,
        currentAgentInfo[15] + sharesAmount,
        currentAgentInfo[16] + currentAgentInfo[7] * sharesAmount,
        0n,
        newUsers
    ]);

    expect(newUserInfo).to.eql([
        currentUserInfo[0] + sharesAmount,
        currentUserInfo[1] + currentAgentInfo[7] * sharesAmount,
        currentUserInfo[2],
        currentUserInfo[3],
        currentUserInfo[4]
    ]);

    expect(depositTokenBalanceBefore + currentAgentInfo[7] * sharesAmount).to.equal(await depositToken.balanceOf(dockMarketSimpleRouter.target));

    return "Success";
};

async function depositMemberSimple(
    dockMarketSimpleRouter,
    depositor,
    agentId,
    sharesAmount,
    tokenId,
    signer
) {
    const currentAgentInfo = await dockMarketSimpleRouter.getAgentInfo(agentId);

    const messageHash = ethers.solidityPackedKeccak256(
        ["uint256", "address", "bytes16", "uint256", "address", "uint256"],
        [31337n, dockMarketSimpleRouter.target, agentId, currentAgentInfo[1], depositor.address, tokenId]
    );
    const signature = await signer.signMessage(ethers.getBytes(messageHash));

    await expect(dockMarketSimpleRouter.connect(depositor).depositMember(
        zeroAgentId,
        sharesAmount,
        tokenId,
        signature
    )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__InvalidCaller");

    await expect(dockMarketSimpleRouter.connect(depositor).depositMember(
        agentId,
        sharesAmount,
        tokenId + 1n,
        signature
    )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__InvalidCaller");

    if (signer.address != depositor.address) {
        await expect(dockMarketSimpleRouter.connect(signer).depositMember(
            agentId,
            sharesAmount,
            tokenId,
            signature
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__InvalidCaller");
    }

    if (!(await dockMarketSimpleRouter.hasRole(await dockMarketSimpleRouter.SIGNER_ROLE(), signer.address))) {
        await expect(dockMarketSimpleRouter.connect(depositor).depositMember(
            agentId,
            sharesAmount,
            tokenId,
            signature
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__InvalidCaller");

        return "DockMarketSimpleRouter__InvalidCaller";
    }

    if ((await dockMarketSimpleRouter.getTokenIdUsed(agentId, currentAgentInfo[1], tokenId)) != zeroAddress) {
        await expect(dockMarketSimpleRouter.connect(depositor).depositMember(
            agentId,
            sharesAmount,
            tokenId,
            signature
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__TokenIdUsed");

        return "DockMarketSimpleRouter__TokenIdUsed";
    }

    const currentUserInfo = await dockMarketSimpleRouter.getUserInfo(agentId, currentAgentInfo[1], depositor.address);

    if (currentUserInfo[4]) {
        await expect(dockMarketSimpleRouter.connect(depositor).depositMember(
            agentId,
            sharesAmount,
            tokenId,
            signature
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__MembershipIssued");

        return "DockMarketSimpleRouter__MembershipIssued";
    }

    if (currentAgentInfo[0] != 1n) {
        await expect(dockMarketSimpleRouter.connect(depositor).depositMember(
            agentId,
            sharesAmount,
            tokenId,
            signature
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__IncorrectAgentState");

        return "DockMarketSimpleRouter__IncorrectAgentState";
    }

    if (sharesAmount == 0n) {
        await expect(dockMarketSimpleRouter.connect(depositor).depositMember(
            agentId,
            sharesAmount,
            tokenId,
            signature
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__ZeroData");

        return "DockMarketSimpleRouter__ZeroData";
    }

    if (sharesAmount + currentUserInfo[0] > currentAgentInfo[11]) {
        await expect(dockMarketSimpleRouter.connect(depositor).depositMember(
            agentId,
            sharesAmount,
            tokenId,
            signature
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__DepositCapacityExceeded");

        return "DockMarketSimpleRouter__DepositCapacityExceeded: memberShares";
    }

    if (currentAgentInfo[10] > sharesAmount + currentUserInfo[0]) {
        await expect(dockMarketSimpleRouter.connect(depositor).depositMember(
            agentId,
            sharesAmount,
            tokenId,
            signature
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__DepositCapacityUnachieved");

        return "DockMarketSimpleRouter__DepositCapacityUnachieved: memberShares";
    }

    if (sharesAmount + currentAgentInfo[15] > currentAgentInfo[12]) {
        await expect(dockMarketSimpleRouter.connect(depositor).depositMember(
            agentId,
            sharesAmount,
            tokenId,
            signature
        )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__DepositCapacityExceeded");

        return "DockMarketSimpleRouter__DepositCapacityExceeded: totalShares";
    }

    const depositToken = await ethers.getContractAt("ERC20Mock", currentAgentInfo[4]);
    const depositTokenBalanceBefore = await depositToken.balanceOf(dockMarketSimpleRouter.target);

    if (currentAgentInfo[7] * sharesAmount > await depositToken.allowance(depositor.address, dockMarketSimpleRouter.target)) {
        await expect(dockMarketSimpleRouter.connect(depositor).depositMember(
            agentId,
            sharesAmount,
            tokenId,
            signature
        )).to.be.revertedWithCustomError(depositToken, "ERC20InsufficientAllowance");

        return "DepositToken__ERC20InsufficientAllowance";
    }

    await expect(dockMarketSimpleRouter.connect(depositor).depositMember(
        agentId,
        sharesAmount,
        tokenId,
        signature
    )).to.emit(dockMarketSimpleRouter, "Deposited").withArgs(
        depositor.address,
        depositor.address,
        agentId,
        currentAgentInfo[1],
        depositToken.target,
        currentAgentInfo[7] * sharesAmount
    ).to.emit(depositToken, "Transfer").withArgs(
        depositor.address,
        dockMarketSimpleRouter.target,
        currentAgentInfo[7] * sharesAmount
    );

    const newAgentInfo = await dockMarketSimpleRouter.getAgentInfo(agentId);
    const newAgentInfoByRound = await dockMarketSimpleRouter.getAgentInfoByRound(agentId, currentAgentInfo[1]);
    const newUserInfo = await dockMarketSimpleRouter.getUserInfo(agentId, currentAgentInfo[1], depositor.address);
    const newUsers = currentAgentInfo[18].toArray();
    if (!newUsers.includes(depositor.address)) newUsers.push(depositor.address);

    expect(newAgentInfo).to.eql([
        1n,
        currentAgentInfo[1],
        currentAgentInfo[2],
        currentAgentInfo[3],
        depositToken.target,
        currentAgentInfo[5],
        currentAgentInfo[6],
        currentAgentInfo[7],
        currentAgentInfo[8],
        currentAgentInfo[9],
        currentAgentInfo[10],
        currentAgentInfo[11],
        currentAgentInfo[12],
        currentAgentInfo[13],
        currentAgentInfo[14] + 1n,
        currentAgentInfo[15] + sharesAmount,
        currentAgentInfo[16] + currentAgentInfo[7] * sharesAmount,
        0n,
        newUsers
    ]);

    expect(newAgentInfoByRound).to.eql([
        true,
        false,
        currentAgentInfo[14] + 1n,
        currentAgentInfo[15] + sharesAmount,
        currentAgentInfo[16] + currentAgentInfo[7] * sharesAmount,
        0n,
        newUsers
    ]);

    expect(newUserInfo).to.eql([
        currentUserInfo[0] + sharesAmount,
        currentUserInfo[1] + currentAgentInfo[7] * sharesAmount,
        currentUserInfo[2],
        tokenId,
        true
    ]);

    expect(depositTokenBalanceBefore + currentAgentInfo[7] * sharesAmount).to.equal(await depositToken.balanceOf(dockMarketSimpleRouter.target));
    expect(await dockMarketSimpleRouter.getTokenIdUsed(agentId, currentAgentInfo[1], tokenId)).to.equal(depositor.address);

    await expect(dockMarketSimpleRouter.connect(depositor).depositMember(
        agentId,
        sharesAmount,
        tokenId,
        signature
    )).to.be.revertedWithCustomError(dockMarketSimpleRouter, "DockMarketSimpleRouter__TokenIdUsed");

    return "Success";
};

module.exports = { createWallet, deposit, registerAgent, depositSimple, depositMemberSimple, zeroHash, zeroAddress, AbiCoder, withDecimals };