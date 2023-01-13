const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { assert, expect } = require("chai");

//如果在本地區塊鏈,才需要執行測試
!developmentChains.includes(network.name)
  ? describe.skip
  : describe("RandomIpfsNft Unit Tests", async () => {
      let deployer, randomIpfsNft, vrfCoordinatorV2Mock, mintFee;
      const chainId = network.config.chainId;

      beforeEach(async () => {
        //抓取account deployer
        deployer = (await getNamedAccounts()).deployer;
        //用fixture,部署tag帶有randomipfs,mocks的deploy合約
        await deployments.fixture(["randomipfs", "mocks"]);
        //抓取randomIpfsNft合約
        randomIpfsNft = await ethers.getContract("RandomIpfsNft", deployer);
        //抓取vrfCoordinatorV2Mock合約
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
        mintFee = await randomIpfsNft.getMintFee();
      });

      describe("constructor", () => {
        it("Initializes the RandomIpfsNft correctly", async () => {
          const gasLane = await randomIpfsNft.getGasLane();
          const contractTokenUri0 = await randomIpfsNft.getNftTokenUris(0);
          const contractTokenUri1 = await randomIpfsNft.getNftTokenUris(1);
          const contractTokenUri2 = await randomIpfsNft.getNftTokenUris(2);
          let tokenUris = [
            "ipfs://QmSZj7HtQWQ99yNQbLnX5KJLDQLWiZ4Z8eDx2aaTVymV5Y",
            "ipfs://QmfTUW7hf25uM7j37vgU9k86v4x5CFQCRFbKojiFCosvSP",
            "ipfs://QmcdDK3fwPFq7jdovYEkHxsYFEcxJ1DWqMwJ6rvU9LDwhY",
          ];
          const ipfsNftName = await randomIpfsNft.name();
          const ipfsNftSymbol = await randomIpfsNft.symbol();
          const tokenCounter = await randomIpfsNft.getTokenCounter();
          //預期gasLane與設定檔內相同
          assert.equal(gasLane.toString(), networkConfig[chainId]["gasLane"]);
          //預期合約中的tokenUri與部署合約中相同
          assert.equal(contractTokenUri0, tokenUris[0]);
          assert.equal(contractTokenUri1, tokenUris[1]);
          assert.equal(contractTokenUri2, tokenUris[2]);
          //預期ERC721,name,symbol相同
          assert.equal(ipfsNftName.toString(), "Random IPFS NFT");
          assert.equal(ipfsNftSymbol.toString(), "RIN");
          //檢查tokenCounter初始為0
          assert.equal(tokenCounter.toString(), "0");
          assert.equal(mintFee.toString(), networkConfig[chainId]["mintFee"]);
        });
      });

      describe("requestNft", () => {
        //若沒有入金足夠金額,則預期revert
        it("expected reverts when you don't pay enough", async () => {
          await expect(randomIpfsNft.requestNft()).to.be.revertedWith(
            "RandomIpfsNft__NeedMoreETHSent"
          );
        });
        it("emits event to enter", async () => {
          //若有入金足夠金額,會觸發NftRequested event
          await expect(randomIpfsNft.requestNft({ value: mintFee })).to.emit(
            randomIpfsNft,
            "NftRequested"
          );
        });
        it("check requestId, and requestId mapping address is correct", async () => {
          const txResponse = await randomIpfsNft.requestNft({ value: mintFee });
          //因為要等交易成功觸發結束後,才會return requestId,這個requestId,藏在回傳的transaction的event中
          const txReceipt = await txResponse.wait(1);
          //console.log(txReceipt.events); //可以列出event 其中就有寫requestId的位置
          const requestId = txReceipt.events[1].args.requestId;
          const miner = await randomIpfsNft.getAddressFromRequestId(requestId);
          //檢查requestId,有存在的話一定大於0
          assert(requestId.toNumber() > 0);
          //因為發起requestNft,的帳戶是miner,所以檢查匹配requestId的帳戶應該也是miner
          assert.equal(miner, deployer);
        });
      });

      describe("fulfillRandomWords", () => {
        it("can only be called after requestNft", async () => {
          //使用偽造的0,1這些的requestId,預計也會失敗,可以測試所有requestId的組合,但有點不切實際,需要用到稱為fuzz的測試功能
          //為什麼是檢查vrfCoordinatorV2Mock.fulfillRandomWords,是因為如果有執行requestNft時,會產生requestId
          //給chainLink節點,該節點會呼叫vrfCoordinatorV2Mock.fulfillRandomWords,
          //如果沒有先執行requestNft function就不會有requestId
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, randomIpfsNft.address)
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, randomIpfsNft.address)
          ).to.be.revertedWith("nonexistent request");
        });

        it("mints NFT after random number is returned", async () => {
          //使用Promise監聽事件
          await new Promise(async (resolve, reject) => {
            //contract.once,監聽NftMinted event
            randomIpfsNft.once("NftMinted", async () => {
              console.log("Found event NftMinted");
              try {
                //ERC721中的function tokenURI,應該要有ipfs地址,這邊只檢查index 0
                const tokenUri = await randomIpfsNft.tokenURI("0");
                const tokenCounter = await randomIpfsNft.getTokenCounter();
                //tokenURI地址應該是ipfs://,且有東西
                assert.equal(tokenUri.toString().includes("ipfs://"), true);
                assert.equal(tokenCounter.toString(), "1");
                //nft被鑄造後,錢包中nft數量應該為1
                const endOwnersNftAmount = await randomIpfsNft.balanceOf(deployer);
                assert.equal(endOwnersNftAmount.toString(), "1");
                resolve();
              } catch (error) {
                console.log(error);
                reject(error);
              }
            });
            //這段try catch在contract.once外面,用於設置好event監聽器之後,在執行入金觸發event
            try {
              //帳戶入金前的nft數量應為0
              const startOwnersNftAmount = await randomIpfsNft.balanceOf(deployer);
              //入金,鑄造NFT
              const txResponse = await randomIpfsNft.requestNft({ value: mintFee });
              const txReceipt = await txResponse.wait(1);
              //呼叫vrfCoordinatorV2Mock透過入金後取得的requestId取得隨機數(觸發NftMinted event)
              await vrfCoordinatorV2Mock.fulfillRandomWords(
                txReceipt.events[1].args.requestId,
                randomIpfsNft.address
              );
              assert.equal(startOwnersNftAmount.toString(), "0");
            } catch (error) {
              console.log(error);
              reject(error);
            }
          });
        });
      });

      //檢查隨機數確實有對應到稀有度
      describe("getRareFromModdedRng", () => {
        //若取得的隨機數小於10,應該得到pug(SR),0指是合約中enum的index0
        it("should return pug if moddedRng < 10", async function () {
          const expectedValue = await randomIpfsNft.getRareFromModdedRng(7);
          assert.equal(0, expectedValue);
        });
        //若取得的隨機數為10~29,應該得到shiba-inu(R),1指是合約中enum的index1
        it("should return shiba-inu if moddedRng is between 10 - 29", async function () {
          const expectedValue = await randomIpfsNft.getRareFromModdedRng(21);
          assert.equal(1, expectedValue);
        });
        //若取得的隨機數為30~99,應該得到st. bernard(C),1指是合約中enum的index2
        it("should return st. bernard if moddedRng is between 30 - 99", async function () {
          const expectedValue = await randomIpfsNft.getRareFromModdedRng(77);
          assert.equal(2, expectedValue);
        });
        //若取得的隨機數大於99預期出現revert
        it("should revert if moddedRng > 99", async () => {
          await expect(randomIpfsNft.getRareFromModdedRng(100)).to.be.revertedWith(
            "RandomIpfsNft__RangeOutOfBounds"
          );
        });
      });
    });
