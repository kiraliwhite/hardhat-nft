const { network, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

module.exports = async function ({ getNamedAccounts }) {
  const { deployer } = await getNamedAccounts();

  // Basic NFT
  const basicNft = await ethers.getContract("BasicNft", deployer);
  // 鑄造NFT前的tokenCounter就是新的NFT的tokenID
  const basicNftCounter = await basicNft.getTokenCounter();
  const basicMintTx = await basicNft.mintNft();
  await basicMintTx.wait(1);
  console.log(
    `Basic NFT index ${basicNftCounter.toString()} has tokenURI: ${await basicNft.tokenURI(
      basicNftCounter.toString()
    )}`
  );

  // Random IPFS NFT
  //   const randomIpfsNft = await ethers.getContract("RandomIpfsNft", deployer);
  //   const mintFee = await randomIpfsNft.getMintFee();
  //   //需要建立Promise的原因是因為要等待選出隨機數後,才會繼續執行
  //   await new Promise(async (resolve, reject) => {
  //     setTimeout(() => reject("Timeout: 'NFTMinted' event did not fire"), 300000); // 5 min
  //     //使用contract.once監聽事件NftMinted,並等在這裡,若下方的requestNft執行後,
  //     //觸發了NftMinted event,則resolve,跳出這個promise
  //     randomIpfsNft.once("NftMinted", async function () {
  //       console.log(
  //         `Random IPFS NFT index ${randomIpfsNftCounter.toString()} tokenURI: ${await randomIpfsNft.tokenURI(
  //           randomIpfsNftCounter.toString()
  //         )}`
  //       );
  //       resolve();
  //     });
  //     // 鑄造NFT前的tokenCounter就是新的NFT的tokenID
  //     const randomIpfsNftCounter = await randomIpfsNft.getTokenCounter();
  //     const randomIpfsNftMintTx = await randomIpfsNft.requestNft({ value: mintFee.toString() });
  //     const randomIpfsNftMintTxReceipt = await randomIpfsNftMintTx.wait(1);
  //     //如果在測試網,因為沒有chainlink node取得隨機數,所以要使用mocks來取得隨機數
  //     if (developmentChains.includes(network.name)) {
  //       const requestId = randomIpfsNftMintTxReceipt.events[1].args.requestId.toString();
  //       const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
  //       await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, randomIpfsNft.address);
  //     }
  //   });

  // Dynamic SVG NFT
  const highValue = ethers.utils.parseEther("1000");
  const dynamicSvgNft = await ethers.getContract("DynamicSvgNft", deployer);
  // 鑄造NFT前的tokenCounter就是新的NFT的tokenID
  const dynamicSvgNftCounter = await dynamicSvgNft.getTokenCounter();
  const dynamicSvgNftMintTx = await dynamicSvgNft.mintNFT(highValue.toString());
  await dynamicSvgNftMintTx.wait(1);
  console.log(
    `Dynamic SVG NFT index ${dynamicSvgNftCounter.toString()} tokenURI: ${await dynamicSvgNft.tokenURI(
      dynamicSvgNftCounter.toString()
    )}`
  );
};

module.exports.tags = ["all", "mint"];
