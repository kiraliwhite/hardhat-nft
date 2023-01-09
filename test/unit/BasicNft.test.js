const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("BasicNft unit test", async () => {
      let deployer, basicNft;

      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        basicNft = await ethers.getContract("BasicNft", deployer);
      });

      describe("constructor", () => {
        it("Initializes the BasicNft correctly", async () => {
          const basicNftName = await basicNft.name();
          const basicNftSymbol = await basicNft.symbol();
          const tokenCounter = await basicNft.getTokenCounter();
          assert.equal(basicNftName.toString(), "Dogie");
          assert.equal(basicNftSymbol.toString(), "DOG");
          assert.equal(tokenCounter.toString(), "0");
        });
      });

      describe("mintNft", () => {
        beforeEach(async () => {
          //mint NFT之後要等待一個區塊時間，確認完成交易
          const txResponse = await basicNft.mintNft();
          await txResponse.wait(1);
        });
        it("Allows users to mint an NFT, and updates appropriately", async () => {
          //抓取tokenURI
          const tokenURI = await basicNft.tokenURI(0);
          //預期呼叫function得到的tokenURI要與basicNft的屬性TOKEN_URI相等,簡單說就是確保NFT屬性的tokenURI與function的一致,確保URI有更新成功
          assert.equal(tokenURI, await basicNft.TOKEN_URI());

          //確保mint過後的tokeCounter會是1,因為只mint過一次
          const tokenCounter = await basicNft.getTokenCounter();
          assert.equal(tokenCounter.toString(), "1");
        });
        it("Show the correct balance and owner of an NFT", async () => {
          //抓取deployer帳號擁有的NFT個數,應該為1
          const ownersNftAmount = await basicNft.balanceOf(deployer);
          assert.equal(ownersNftAmount.toString(), "1");

          //預期NFT的owner要與mint NFT的deployer帳戶相同
          //   const owner = await basicNft.ownerOf("1");
          //   assert.equal(owner, deployer);
        });
      });
    });
