// tests/carbon-credit-token_test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, stringUtf8CV, uintCV, noneCV, someCV, boolCV, principalCV, bufferCV, ClarityType } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INSUFFICIENT_BALANCE = 101;
const ERR_INVALID_AMOUNT = 102;
const ERR_INVALID_RECIPIENT = 103;
const ERR_PAUSED = 104;
const ERR_MINT_CAP_EXCEEDED = 105;
const ERR_INVALID_MEMO = 106;
const ERR_BLACKLISTED = 107;
const ERR_INVALID_DECIMALS = 108;
const ERR_INVALID_SYMBOL = 109;
const ERR_INVALID_NAME = 110;
const ERR_INVALID_URI = 111;
const ERR_ALREADY_INITIALIZED = 112;
const ERR_NOT_INITIALIZED = 113;
const ERR_INVALID_MINTER = 114;
const ERR_MAX_MINTERS_EXCEEDED = 115;
const ERR_INVALID_BURNER = 116;
const ERR_INVALID_PAUSER = 117;
const ERR_INVALID_BLACKLISTER = 118;

interface Result<T> {
  ok: boolean;
  value: T | number;
}

interface Event {
  event: string;
  [key: string]: any;
}

class CarbonCreditTokenMock {
  state: {
    tokenName: string;
    tokenSymbol: string;
    tokenDecimals: number;
    tokenUri: string | null;
    totalSupply: number;
    mintCap: number;
    contractOwner: string;
    isPaused: boolean;
    maxMinters: number;
    initialized: boolean;
    balances: Map<string, number>;
    minters: Map<string, boolean>;
    burners: Map<string, boolean>;
    pausers: Map<string, boolean>;
    blacklisters: Map<string, boolean>;
    blacklisted: Map<string, boolean>;
  } = {
    tokenName: "CarbonCredit",
    tokenSymbol: "CCT",
    tokenDecimals: 6,
    tokenUri: null,
    totalSupply: 0,
    mintCap: 100000000,
    contractOwner: "ST1TEST",
    isPaused: false,
    maxMinters: 10,
    initialized: false,
    balances: new Map(),
    minters: new Map(),
    burners: new Map(),
    pausers: new Map(),
    blacklisters: new Map(),
    blacklisted: new Map(),
  };
  caller: string = "ST1TEST";
  events: Event[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      tokenName: "CarbonCredit",
      tokenSymbol: "CCT",
      tokenDecimals: 6,
      tokenUri: null,
      totalSupply: 0,
      mintCap: 100000000,
      contractOwner: "ST1TEST",
      isPaused: false,
      maxMinters: 10,
      initialized: false,
      balances: new Map(),
      minters: new Map(),
      burners: new Map(),
      pausers: new Map(),
      blacklisters: new Map(),
      blacklisted: new Map(),
    };
    this.caller = "ST1TEST";
    this.events = [];
  }

  initialize(
    name: string,
    symbol: string,
    decimals: number,
    uri: string | null,
    initialSupply: number,
    cap: number
  ): Result<boolean> {
    if (this.state.initialized) return { ok: false, value: ERR_ALREADY_INITIALIZED };
    if (this.state.contractOwner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!name || name.length > 32) return { ok: false, value: ERR_INVALID_NAME };
    if (!symbol || symbol.length > 10) return { ok: false, value: ERR_INVALID_SYMBOL };
    if (decimals > 18) return { ok: false, value: ERR_INVALID_DECIMALS };
    if (uri && uri.length > 256) return { ok: false, value: ERR_INVALID_URI };
    if (initialSupply <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (cap <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    this.state.tokenName = name;
    this.state.tokenSymbol = symbol;
    this.state.tokenDecimals = decimals;
    this.state.tokenUri = uri;
    this.state.mintCap = cap;
    this.state.balances.set(this.caller, initialSupply);
    this.state.totalSupply = initialSupply;
    this.state.initialized = true;
    this.events.push({ event: "initialized", name, symbol });
    return { ok: true, value: true };
  }

  transfer(amount: number, sender: string, recipient: string, memo: Uint8Array | null): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (this.state.isPaused) return { ok: false, value: ERR_PAUSED };
    if (this.state.blacklisted.get(sender)) return { ok: false, value: ERR_BLACKLISTED };
    if (this.state.blacklisted.get(recipient)) return { ok: false, value: ERR_BLACKLISTED };
    if (this.caller !== sender) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (recipient === sender) return { ok: false, value: ERR_INVALID_RECIPIENT };
    if (memo && memo.length > 34) return { ok: false, value: ERR_INVALID_MEMO };
    const senderBal = this.state.balances.get(sender) || 0;
    if (senderBal < amount) return { ok: false, value: ERR_INSUFFICIENT_BALANCE };
    this.state.balances.set(sender, senderBal - amount);
    const recipientBal = this.state.balances.get(recipient) || 0;
    this.state.balances.set(recipient, recipientBal + amount);
    this.events.push({ event: "transfer", amount, sender, recipient, memo });
    return { ok: true, value: true };
  }

  mint(amount: number, recipient: string): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (this.state.isPaused) return { ok: false, value: ERR_PAUSED };
    if (!this.state.minters.get(this.caller)) return { ok: false, value: ERR_INVALID_MINTER };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (recipient === this.caller) return { ok: false, value: ERR_INVALID_RECIPIENT };
    if (this.state.blacklisted.get(recipient)) return { ok: false, value: ERR_BLACKLISTED };
    if (this.state.totalSupply + amount > this.state.mintCap) return { ok: false, value: ERR_MINT_CAP_EXCEEDED };
    const recipientBal = this.state.balances.get(recipient) || 0;
    this.state.balances.set(recipient, recipientBal + amount);
    this.state.totalSupply += amount;
    this.events.push({ event: "mint", amount, recipient });
    return { ok: true, value: true };
  }

  burn(amount: number, sender: string): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (this.state.isPaused) return { ok: false, value: ERR_PAUSED };
    if (!this.state.burners.get(this.caller)) return { ok: false, value: ERR_INVALID_BURNER };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (this.caller !== sender) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const senderBal = this.state.balances.get(sender) || 0;
    if (senderBal < amount) return { ok: false, value: ERR_INSUFFICIENT_BALANCE };
    this.state.balances.set(sender, senderBal - amount);
    this.state.totalSupply -= amount;
    this.events.push({ event: "burn", amount, sender });
    return { ok: true, value: true };
  }

  pauseContract(): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (!this.state.pausers.get(this.caller)) return { ok: false, value: ERR_INVALID_PAUSER };
    this.state.isPaused = true;
    this.events.push({ event: "paused" });
    return { ok: true, value: true };
  }

  unpauseContract(): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (!this.state.pausers.get(this.caller)) return { ok: false, value: ERR_INVALID_PAUSER };
    this.state.isPaused = false;
    this.events.push({ event: "unpaused" });
    return { ok: true, value: true };
  }

  addMinter(newMinter: string): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (this.state.contractOwner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.minters.size >= this.state.maxMinters) return { ok: false, value: ERR_MAX_MINTERS_EXCEEDED };
    this.state.minters.set(newMinter, true);
    this.events.push({ event: "minter-added", minter: newMinter });
    return { ok: true, value: true };
  }

  removeMinter(minter: string): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (this.state.contractOwner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.minters.delete(minter);
    this.events.push({ event: "minter-removed", minter });
    return { ok: true, value: true };
  }

  addBurner(newBurner: string): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (this.state.contractOwner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.burners.set(newBurner, true);
    this.events.push({ event: "burner-added", burner: newBurner });
    return { ok: true, value: true };
  }

  removeBurner(burner: string): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (this.state.contractOwner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.burners.delete(burner);
    this.events.push({ event: "burner-removed", burner });
    return { ok: true, value: true };
  }

  addPauser(newPauser: string): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (this.state.contractOwner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.pausers.set(newPauser, true);
    this.events.push({ event: "pauser-added", pauser: newPauser });
    return { ok: true, value: true };
  }

  removePauser(pauser: string): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (this.state.contractOwner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.pausers.delete(pauser);
    this.events.push({ event: "pauser-removed", pauser });
    return { ok: true, value: true };
  }

  addBlacklister(newBlacklister: string): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (this.state.contractOwner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.blacklisters.set(newBlacklister, true);
    this.events.push({ event: "blacklister-added", blacklister: newBlacklister });
    return { ok: true, value: true };
  }

  removeBlacklister(blacklister: string): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (this.state.contractOwner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.blacklisters.delete(blacklister);
    this.events.push({ event: "blacklister-removed", blacklister });
    return { ok: true, value: true };
  }

  blacklistAccount(account: string): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (!this.state.blacklisters.get(this.caller)) return { ok: false, value: ERR_INVALID_BLACKLISTER };
    this.state.blacklisted.set(account, true);
    this.events.push({ event: "account-blacklisted", account });
    return { ok: true, value: true };
  }

  unblacklistAccount(account: string): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (!this.state.blacklisters.get(this.caller)) return { ok: false, value: ERR_INVALID_BLACKLISTER };
    this.state.blacklisted.delete(account);
    this.events.push({ event: "account-unblacklisted", account });
    return { ok: true, value: true };
  }

  updateMintCap(newCap: number): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (this.state.contractOwner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newCap <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (newCap <= this.state.totalSupply) return { ok: false, value: ERR_INVALID_AMOUNT };
    this.state.mintCap = newCap;
    this.events.push({ event: "mint-cap-updated", cap: newCap });
    return { ok: true, value: true };
  }

  updateTokenUri(newUri: string | null): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (this.state.contractOwner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newUri && newUri.length > 256) return { ok: false, value: ERR_INVALID_URI };
    this.state.tokenUri = newUri;
    this.events.push({ event: "token-uri-updated", uri: newUri });
    return { ok: true, value: true };
  }

  transferOwnership(newOwner: string): Result<boolean> {
    if (!this.state.initialized) return { ok: false, value: ERR_NOT_INITIALIZED };
    if (this.state.contractOwner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.contractOwner = newOwner;
    this.events.push({ event: "ownership-transferred", newOwner });
    return { ok: true, value: true };
  }

  getName(): Result<string> {
    return { ok: true, value: this.state.tokenName };
  }

  getSymbol(): Result<string> {
    return { ok: true, value: this.state.tokenSymbol };
  }

  getDecimals(): Result<number> {
    return { ok: true, value: this.state.tokenDecimals };
  }

  getBalance(account: string): Result<number> {
    return { ok: true, value: this.state.balances.get(account) || 0 };
  }

  getTotalSupply(): Result<number> {
    return { ok: true, value: this.state.totalSupply };
  }

  getTokenUri(): Result<string | null> {
    return { ok: true, value: this.state.tokenUri };
  }

  getContractOwner(): Result<string> {
    return { ok: true, value: this.state.contractOwner };
  }

  isContractPaused(): Result<boolean> {
    return { ok: true, value: this.state.isPaused };
  }

  isMinter(account: string): Result<boolean> {
    return { ok: true, value: this.state.minters.get(account) || false };
  }

  isBurner(account: string): Result<boolean> {
    return { ok: true, value: this.state.burners.get(account) || false };
  }

  isPauser(account: string): Result<boolean> {
    return { ok: true, value: this.state.pausers.get(account) || false };
  }

  isBlacklister(account: string): Result<boolean> {
    return { ok: true, value: this.state.blacklisters.get(account) || false };
  }

  isBlacklistedAccount(account: string): Result<boolean> {
    return { ok: true, value: this.state.blacklisted.get(account) || false };
  }
}

describe("CarbonCreditToken", () => {
  let contract: CarbonCreditTokenMock;

  beforeEach(() => {
    contract = new CarbonCreditTokenMock();
    contract.reset();
  });

  it("initializes successfully", () => {
    const result = contract.initialize("CarbonToken", "CT", 8, "https://example.com", 1000, 1000000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.tokenName).toBe("CarbonToken");
    expect(contract.state.tokenSymbol).toBe("CT");
    expect(contract.state.tokenDecimals).toBe(8);
    expect(contract.state.tokenUri).toBe("https://example.com");
    expect(contract.state.totalSupply).toBe(1000);
    expect(contract.state.mintCap).toBe(1000000);
    expect(contract.state.initialized).toBe(true);
    expect(contract.getBalance("ST1TEST").value).toBe(1000);
    expect(contract.events[0]).toEqual({ event: "initialized", name: "CarbonToken", symbol: "CT" });
  });

  it("rejects initialization if already initialized", () => {
    contract.initialize("CarbonToken", "CT", 8, "https://example.com", 1000, 1000000);
    const result = contract.initialize("NewToken", "NT", 6, null, 500, 500000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ALREADY_INITIALIZED);
  });

  it("rejects initialization by non-owner", () => {
    contract.caller = "ST2FAKE";
    const result = contract.initialize("CarbonToken", "CT", 8, "https://example.com", 1000, 1000000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects invalid name in initialization", () => {
    const longName = "A".repeat(33);
    const result = contract.initialize(longName, "CT", 8, "https://example.com", 1000, 1000000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_NAME);
  });

  it("transfers successfully", () => {
    contract.initialize("CarbonToken", "CT", 8, null, 1000, 1000000);
    const result = contract.transfer(200, "ST1TEST", "ST2RECIP", null);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getBalance("ST1TEST").value).toBe(800);
    expect(contract.getBalance("ST2RECIP").value).toBe(200);
    expect(contract.events[1]).toEqual({ event: "transfer", amount: 200, sender: "ST1TEST", recipient: "ST2RECIP", memo: null });
  });

  it("rejects transfer if not initialized", () => {
    const result = contract.transfer(200, "ST1TEST", "ST2RECIP", null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_INITIALIZED);
  });

  it("rejects transfer if paused", () => {
    contract.initialize("CarbonToken", "CT", 8, null, 1000, 1000000);
    contract.addPauser("ST1TEST");
    contract.pauseContract();
    const result = contract.transfer(200, "ST1TEST", "ST2RECIP", null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PAUSED);
  });

  it("rejects transfer from blacklisted sender", () => {
    contract.initialize("CarbonToken", "CT", 8, null, 1000, 1000000);
    contract.addBlacklister("ST1TEST");
    contract.blacklistAccount("ST1TEST");
    const result = contract.transfer(200, "ST1TEST", "ST2RECIP", null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_BLACKLISTED);
  });

  it("rejects mint if cap exceeded", () => {
    contract.initialize("CarbonToken", "CT", 8, null, 1000, 1000);
    contract.addMinter("ST1TEST");
    const result = contract.mint(1, "ST3RECIP");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MINT_CAP_EXCEEDED);
  });

  it("rejects burn if insufficient balance", () => {
    contract.initialize("CarbonToken", "CT", 8, null, 1000, 1000000);
    contract.addBurner("ST1TEST");
    const result = contract.burn(1001, "ST1TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INSUFFICIENT_BALANCE);
  });

  it("pauses and unpauses successfully", () => {
    contract.initialize("CarbonToken", "CT", 8, null, 1000, 1000000);
    contract.addPauser("ST1TEST");
    let result = contract.pauseContract();
    expect(result.ok).toBe(true);
    expect(contract.state.isPaused).toBe(true);
    result = contract.unpauseContract();
    expect(result.ok).toBe(true);
    expect(contract.state.isPaused).toBe(false);
  });

  it("adds and removes minter successfully", () => {
    contract.initialize("CarbonToken", "CT", 8, null, 1000, 1000000);
    const result = contract.addMinter("ST4MINTER");
    expect(result.ok).toBe(true);
    expect(contract.isMinter("ST4MINTER").value).toBe(true);
    const removeResult = contract.removeMinter("ST4MINTER");
    expect(removeResult.ok).toBe(true);
    expect(contract.isMinter("ST4MINTER").value).toBe(false);
  });

  it("rejects add minter if max exceeded", () => {
    contract.initialize("CarbonToken", "CT", 8, null, 1000, 1000000);
    contract.state.maxMinters = 0;
    const result = contract.addMinter("ST4MINTER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_MINTERS_EXCEEDED);
  });

  it("blacklists and unblacklists account successfully", () => {
    contract.initialize("CarbonToken", "CT", 8, null, 1000, 1000000);
    contract.addBlacklister("ST1TEST");
    let result = contract.blacklistAccount("ST5BLACK");
    expect(result.ok).toBe(true);
    expect(contract.isBlacklistedAccount("ST5BLACK").value).toBe(true);
    result = contract.unblacklistAccount("ST5BLACK");
    expect(result.ok).toBe(true);
    expect(contract.isBlacklistedAccount("ST5BLACK").value).toBe(false);
  });

  it("updates mint cap successfully", () => {
    contract.initialize("CarbonToken", "CT", 8, null, 1000, 1000000);
    const result = contract.updateMintCap(2000000);
    expect(result.ok).toBe(true);
    expect(contract.state.mintCap).toBe(2000000);
  });

  it("rejects update mint cap if less than supply", () => {
    contract.initialize("CarbonToken", "CT", 8, null, 1000, 1000000);
    const result = contract.updateMintCap(999);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_AMOUNT);
  });

  it("updates token uri successfully", () => {
    contract.initialize("CarbonToken", "CT", 8, null, 1000, 1000000);
    const result = contract.updateTokenUri("https://newuri.com");
    expect(result.ok).toBe(true);
    expect(contract.state.tokenUri).toBe("https://newuri.com");
  });

  it("transfers ownership successfully", () => {
    contract.initialize("CarbonToken", "CT", 8, null, 1000, 1000000);
    const result = contract.transferOwnership("ST6NEWOWNER");
    expect(result.ok).toBe(true);
    expect(contract.state.contractOwner).toBe("ST6NEWOWNER");
  });
});