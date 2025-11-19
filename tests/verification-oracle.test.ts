import { describe, it, expect, beforeEach } from "vitest";
import { uintCV, stringUtf8CV, buffCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INSUFFICIENT_STAKE = 122;
const ERR_INVALID_PROOF = 102;
const ERR_INVALID_NONCE = 103;
const ERR_INVALID_THRESHOLD = 104;
const ERR_ORACLE_ALREADY_EXISTS = 105;
const ERR_ORACLE_NOT_FOUND = 106;
const ERR_INVALID_TIMESTAMP = 107;
const ERR_AUTHORITY_NOT_VERIFIED = 108;
const ERR_INVALID_DISPUTE_FEE = 109;
const ERR_INVALID_SLASH_RATE = 110;
const ERR_INVALID_LOCATION = 111;
const ERR_INVALID_CURRENCY = 112;
const ERR_INVALID_STATUS = 113;
const ERR_MAX_ORACLES_EXCEEDED = 114;
const ERR_INVALID_ORACLE_TYPE = 115;
const ERR_INVALID_REWARD_RATE = 116;
const ERR_INVALID_GRACE_PERIOD = 117;
const ERR_DISPUTE_ALREADY_EXISTS = 118;
const ERR_DISPUTE_NOT_FOUND = 119;
const ERR_INVALID_VOTE = 120;
const ERR_VOTING_CLOSED = 121;
const ERR_PROOF_EXPIRED = 123;
const ERR_INVALID_CONSENSUS = 124;
const ERR_INVALID_UPDATE_PARAM = 125;

interface Oracle {
  owner: string;
  stake: number;
  oracleType: string;
  location: string;
  currency: string;
  status: boolean;
  timestamp: number;
  rewardBalance: number;
}

interface Proof {
  proof: Buffer;
  submitter: string;
  timestamp: number;
  votes: number;
  consensusReached: boolean;
}

interface Dispute {
  disputer: string;
  feePaid: number;
  votesFor: number;
  votesAgainst: number;
  resolved: boolean;
  timestamp: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class VerificationOracleMock {
  state: {
    nextOracleId: number;
    maxOracles: number;
    stakingRequirement: number;
    disputeFee: number;
    slashRate: number;
    consensusThreshold: number;
    rewardRate: number;
    authorityContract: string | null;
    oracles: Map<number, Oracle>;
    oraclesByOwner: Map<string, number>;
    proofs: Map<string, Proof>;
    disputes: Map<Buffer, Dispute>;
    oracleNonces: Map<string, number>;
  } = {
    nextOracleId: 0,
    maxOracles: 500,
    stakingRequirement: 10000,
    disputeFee: 500,
    slashRate: 10,
    consensusThreshold: 51,
    rewardRate: 5,
    authorityContract: null,
    oracles: new Map(),
    oraclesByOwner: new Map(),
    proofs: new Map(),
    disputes: new Map(),
    oracleNonces: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextOracleId: 0,
      maxOracles: 500,
      stakingRequirement: 10000,
      disputeFee: 500,
      slashRate: 10,
      consensusThreshold: 51,
      rewardRate: 5,
      authorityContract: null,
      oracles: new Map(),
      oraclesByOwner: new Map(),
      proofs: new Map(),
      disputes: new Map(),
      oracleNonces: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setStakingRequirement(newStake: number): Result<boolean> {
    if (newStake <= 0) return { ok: false, value: ERR_INVALID_STAKE_AMOUNT };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.stakingRequirement = newStake;
    return { ok: true, value: true };
  }

  setDisputeFee(newFee: number): Result<boolean> {
    if (newFee <= 0) return { ok: false, value: ERR_INVALID_DISPUTE_FEE };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.disputeFee = newFee;
    return { ok: true, value: true };
  }

  setSlashRate(newRate: number): Result<boolean> {
    if (newRate > 50) return { ok: false, value: ERR_INVALID_SLASH_RATE };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.slashRate = newRate;
    return { ok: true, value: true };
  }

  setConsensusThreshold(newThreshold: number): Result<boolean> {
    if (newThreshold <= 0 || newThreshold > 100) return { ok: false, value: ERR_INVALID_THRESHOLD };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.consensusThreshold = newThreshold;
    return { ok: true, value: true };
  }

  setRewardRate(newRate: number): Result<boolean> {
    if (newRate > 20) return { ok: false, value: ERR_INVALID_REWARD_RATE };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.rewardRate = newRate;
    return { ok: true, value: true };
  }

  setMaxOracles(newMax: number): Result<boolean> {
    if (newMax <= 0) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.maxOracles = newMax;
    return { ok: true, value: true };
  }

  registerOracle(
    oracleType: string,
    location: string,
    currency: string
  ): Result<number> {
    if (this.state.nextOracleId >= this.state.maxOracles) return { ok: false, value: ERR_MAX_ORACLES_EXCEEDED };
    if (!["iot", "satellite", "manual"].includes(oracleType)) return { ok: false, value: ERR_INVALID_ORACLE_TYPE };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (this.state.oraclesByOwner.has(this.caller)) return { ok: false, value: ERR_ORACLE_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.stakingRequirement, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextOracleId;
    const oracle: Oracle = {
      owner: this.caller,
      stake: this.state.stakingRequirement,
      oracleType,
      location,
      currency,
      status: true,
      timestamp: this.blockHeight,
      rewardBalance: 0,
    };
    this.state.oracles.set(id, oracle);
    this.state.oraclesByOwner.set(this.caller, id);
    this.state.nextOracleId++;
    return { ok: true, value: id };
  }

  submitProof(
    dataHash: Buffer,
    proof: Buffer,
    nonce: number
  ): Result<boolean> {
    const oracleId = this.state.oraclesByOwner.get(this.caller);
    if (oracleId === undefined) return { ok: false, value: ERR_ORACLE_NOT_FOUND };
    if (proof.length !== 32) return { ok: false, value: ERR_INVALID_PROOF };
    if (nonce <= 0) return { ok: false, value: ERR_INVALID_NONCE };
    const currentNonce = this.state.oracleNonces.get(this.caller) ?? 0;
    if (nonce !== currentNonce + 1) return { ok: false, value: ERR_INVALID_NONCE };

    const key = `${dataHash.toString('hex')}-${nonce}`;
    this.state.proofs.set(key, {
      proof,
      submitter: this.caller,
      timestamp: this.blockHeight,
      votes: 1,
      consensusReached: false,
    });
    this.state.oracleNonces.set(this.caller, nonce);
    return { ok: true, value: true };
  }

  voteOnProof(
    dataHash: Buffer,
    nonce: number,
    agree: boolean
  ): Result<boolean> {
    const oracleId = this.state.oraclesByOwner.get(this.caller);
    if (oracleId === undefined) return { ok: false, value: ERR_ORACLE_NOT_FOUND };
    const key = `${dataHash.toString('hex')}-${nonce}`;
    const proof = this.state.proofs.get(key);
    if (!proof) return { ok: false, value: ERR_PROOF_EXPIRED };
    if (proof.consensusReached) return { ok: false, value: ERR_VOTING_CLOSED };

    const newVotes = agree ? proof.votes + 1 : proof.votes;
    const updatedProof = { ...proof, votes: newVotes };
    if (newVotes >= this.state.consensusThreshold) {
      updatedProof.consensusReached = true;
    }
    this.state.proofs.set(key, updatedProof);
    return { ok: true, value: true };
  }

  initiateDispute(
    proofHash: Buffer
  ): Result<boolean> {
    if (this.state.disputes.has(proofHash)) return { ok: false, value: ERR_DISPUTE_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.disputeFee, from: this.caller, to: this.state.authorityContract });

    this.state.disputes.set(proofHash, {
      disputer: this.caller,
      feePaid: this.state.disputeFee,
      votesFor: 0,
      votesAgainst: 0,
      resolved: false,
      timestamp: this.blockHeight,
    });
    return { ok: true, value: true };
  }

  voteOnDispute(
    proofHash: Buffer,
    voteFor: boolean
  ): Result<boolean> {
    const oracleId = this.state.oraclesByOwner.get(this.caller);
    if (oracleId === undefined) return { ok: false, value: ERR_ORACLE_NOT_FOUND };
    const dispute = this.state.disputes.get(proofHash);
    if (!dispute) return { ok: false, value: ERR_DISPUTE_NOT_FOUND };
    if (dispute.resolved) return { ok: false, value: ERR_VOTING_CLOSED };

    const newFor = voteFor ? dispute.votesFor + 1 : dispute.votesFor;
    const newAgainst = !voteFor ? dispute.votesAgainst + 1 : dispute.votesAgainst;
    const updatedDispute = { ...dispute, votesFor: newFor, votesAgainst: newAgainst };
    const totalVotes = newFor + newAgainst;
    if (totalVotes >= this.state.consensusThreshold) {
      updatedDispute.resolved = true;
      this.state.disputes.set(proofHash, updatedDispute);
      if (newFor > newAgainst) {
        this.slashOracle(proofHash);
      }
    } else {
      this.state.disputes.set(proofHash, updatedDispute);
    }
    return { ok: true, value: true };
  }

  private slashOracle(proofHash: Buffer): void {
    const key = `${proofHash.toString('hex')}-0`;
    const proof = this.state.proofs.get(key);
    if (proof) {
      const submitter = proof.submitter;
      const oracleId = this.state.oraclesByOwner.get(submitter);
      if (oracleId !== undefined) {
        const oracle = this.state.oracles.get(oracleId);
        if (oracle) {
          const slashAmount = (oracle.stake * this.state.slashRate) / 100;
          const updatedOracle = { ...oracle, stake: oracle.stake - slashAmount };
          this.state.oracles.set(oracleId, updatedOracle);
        }
      }
    }
  }

  claimReward(oracleId: number): Result<number> {
    const oracle = this.state.oracles.get(oracleId);
    if (!oracle) return { ok: false, value: ERR_ORACLE_NOT_FOUND };
    if (oracle.owner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const reward = oracle.rewardBalance;
    if (reward <= 0) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    const updatedOracle = { ...oracle, rewardBalance: 0 };
    this.state.oracles.set(oracleId, updatedOracle);
    return { ok: true, value: reward };
  }

  updateOracle(
    oracleId: number,
    newLocation: string,
    newCurrency: string
  ): Result<boolean> {
    const oracle = this.state.oracles.get(oracleId);
    if (!oracle) return { ok: false, value: ERR_ORACLE_NOT_FOUND };
    if (oracle.owner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!newLocation || newLocation.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "USD", "BTC"].includes(newCurrency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    const updatedOracle = {
      ...oracle,
      location: newLocation,
      currency: newCurrency,
      timestamp: this.blockHeight,
    };
    this.state.oracles.set(oracleId, updatedOracle);
    return { ok: true, value: true };
  }

  getOracleCount(): Result<number> {
    return { ok: true, value: this.state.nextOracleId };
  }

  validateProof(
    dataHash: Buffer,
    nonce: number,
    proof: Buffer
  ): Result<boolean> {
    const key = `${dataHash.toString('hex')}-${nonce}`;
    const proofEntry = this.state.proofs.get(key);
    if (!proofEntry) return { ok: false, value: ERR_PROOF_EXPIRED };
    if (!proofEntry.consensusReached) return { ok: false, value: ERR_INVALID_CONSENSUS };
    if (!proofEntry.proof.equals(proof)) return { ok: false, value: ERR_INVALID_PROOF };
    return { ok: true, value: true };
  }
}

describe("VerificationOracle", () => {
  let contract: VerificationOracleMock;

  beforeEach(() => {
    contract = new VerificationOracleMock();
    contract.reset();
  });

  it("registers an oracle successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerOracle("iot", "LocationX", "STX");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const oracle = contract.state.oracles.get(0);
    expect(oracle?.owner).toBe("ST1TEST");
    expect(oracle?.stake).toBe(10000);
    expect(oracle?.oracleType).toBe("iot");
    expect(oracle?.location).toBe("LocationX");
    expect(oracle?.currency).toBe("STX");
    expect(contract.stxTransfers).toEqual([{ amount: 10000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate oracle registration", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerOracle("iot", "LocationX", "STX");
    const result = contract.registerOracle("satellite", "LocationY", "USD");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ORACLE_ALREADY_EXISTS);
  });

  it("rejects registration without authority contract", () => {
    const result = contract.registerOracle("iot", "LocationX", "STX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid oracle type", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerOracle("invalid", "LocationX", "STX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_ORACLE_TYPE);
  });

  it("submits proof successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerOracle("iot", "LocationX", "STX");
    const dataHash = Buffer.alloc(32);
    const proof = Buffer.alloc(32);
    const result = contract.submitProof(dataHash, proof, 1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
  });

  it("rejects proof submission from non-oracle", () => {
    const dataHash = Buffer.alloc(32);
    const proof = Buffer.alloc(32);
    const result = contract.submitProof(dataHash, proof, 1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ORACLE_NOT_FOUND);
  });

  it("votes on proof successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerOracle("iot", "LocationX", "STX");
    const dataHash = Buffer.alloc(32);
    const proof = Buffer.alloc(32);
    contract.submitProof(dataHash, proof, 1);
    const result = contract.voteOnProof(dataHash, 1, true);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
  });

  it("initiates dispute successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const proofHash = Buffer.alloc(32);
    const result = contract.initiateDispute(proofHash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("votes on dispute successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerOracle("iot", "LocationX", "STX");
    const proofHash = Buffer.alloc(32);
    contract.initiateDispute(proofHash);
    const result = contract.voteOnDispute(proofHash, true);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
  });

  it("updates oracle successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerOracle("iot", "OldLocation", "STX");
    const result = contract.updateOracle(0, "NewLocation", "USD");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const oracle = contract.state.oracles.get(0);
    expect(oracle?.location).toBe("NewLocation");
    expect(oracle?.currency).toBe("USD");
  });

  it("validates proof successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerOracle("iot", "LocationX", "STX");
    const dataHash = Buffer.alloc(32);
    const proof = Buffer.alloc(32);
    contract.submitProof(dataHash, proof, 1);
    contract.state.consensusThreshold = 1;
    contract.voteOnProof(dataHash, 1, true);
    const result = contract.validateProof(dataHash, 1, proof);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
  });

  it("rejects invalid proof validation", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerOracle("iot", "LocationX", "STX");
    const dataHash = Buffer.alloc(32);
    const proof = Buffer.alloc(32);
    contract.submitProof(dataHash, proof, 1);
    const invalidProof = Buffer.alloc(32, 1);
    const result = contract.validateProof(dataHash, 1, invalidProof);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CONSENSUS);
  });

  it("sets staking requirement successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setStakingRequirement(20000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.stakingRequirement).toBe(20000);
  });

  it("rejects staking requirement change without authority", () => {
    const result = contract.setStakingRequirement(20000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("gets oracle count correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerOracle("iot", "LocationX", "STX");
    contract.caller = "ST3TEST";
    contract.registerOracle("satellite", "LocationY", "USD");
    const result = contract.getOracleCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("rejects max oracles exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxOracles = 1;
    contract.registerOracle("iot", "LocationX", "STX");
    const result = contract.registerOracle("satellite", "LocationY", "USD");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_ORACLES_EXCEEDED);
  });

  it("claims reward successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerOracle("iot", "LocationX", "STX");
    const oracle = contract.state.oracles.get(0)!;
    oracle.rewardBalance = 100;
    const result = contract.claimReward(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(100);
    expect(contract.state.oracles.get(0)?.rewardBalance).toBe(0);
  });

  it("rejects claim by non-owner", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerOracle("iot", "LocationX", "STX");
    contract.caller = "ST3FAKE";
    const result = contract.claimReward(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });
});