const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");
const { storeImages, storeTokenUriMetadata } = require("../utils/uploadToPinata");

//要上傳到pinata的image資料夾路徑
const imagesLocation = "./images/randomNft";

//nft的metadata template,這會用在nft的tokenURI上(json)
const metadataTemplate = {
  name: "",
  description: "",
  image: "",
  attributes: [
    {
      trait_type: "Cuteness",
      value: 100,
      HP: 10,
      ATTACK: 3,
    },
  ],
};

let tokenUris = [
  "ipfs://QmSZj7HtQWQ99yNQbLnX5KJLDQLWiZ4Z8eDx2aaTVymV5Y",
  "ipfs://QmfTUW7hf25uM7j37vgU9k86v4x5CFQCRFbKojiFCosvSP",
  "ipfs://QmcdDK3fwPFq7jdovYEkHxsYFEcxJ1DWqMwJ6rvU9LDwhY",
];

//資助訂閱時會用到的變數,用來指定幾個代幣
const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("30");

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;

  //如果.env檔中的字串UPLOAD_TO_PINATA為true時,call function
  if (process.env.UPLOAD_TO_PINATA == "true") {
    tokenUris = await handleTokenUris();
  }

  let vrfCoordinatorV2Address, subscriptionId;

  //如果部署在localhost
  if (developmentChains.includes(network.name)) {
    //先抓取部署過的合約getContract VRFCoordinatorV2Mock
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    //將該VRFCoordinatorV2Mock的地址存為變數
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
    //呼叫VRFCoordinatorV2Mock 註冊取得subscription
    const tx = await vrfCoordinatorV2Mock.createSubscription();
    const txReceipt = await tx.wait(1);
    //透過transaction抓取subscriptionId
    subscriptionId = txReceipt.events[0].args.subId;
    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
  } else {
    //如果部署在測試網或主網
    //抓取chainId 對應的地址與subscriptionId
    vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2;
    subscriptionId = networkConfig[chainId].subscriptionId;
  }
  log("--------------------------");

  const args = [
    vrfCoordinatorV2Address,
    subscriptionId,
    networkConfig[chainId].callbackGasLimit,
    networkConfig[chainId]["gasLane"], //與上述寫法二選一都可以
    tokenUris,
    networkConfig[chainId].mintFee,
  ];

  const randomIpfsNft = await deploy("RandomIpfsNft", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  });
  log("--------------------------");

  //----------------------------
  // 部署在本地網,請求隨機數時,因為是mocks,需要額外將部署出來的合約加入addConsumer 才能呼叫隨機數
  if (developmentChains.includes(network.name)) {
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    await vrfCoordinatorV2Mock.addConsumer(subscriptionId, randomIpfsNft.address);
  }

  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    log("Verifying...");
    await verify(randomIpfsNft.address, args);
  }
};

/** 這個function的目的是,透過上傳image到pinata之後,得到回傳的IpfsHash(CID),拼湊出metaData(json檔)
 * 在把metaData(json檔)上傳到pinata成為tokenURI
 */
async function handleTokenUris() {
  tokenUris = [];
  //storageImage這個function會回傳兩個變數response,files,將其提取出來,response改名為imageUploadResponses
  //response內會包含上傳到pinata之後回傳的IpfsHash,這個會拿來填入到json檔內
  //response本身是一個陣列,files也是一個陣列
  const { response: imageUploadResponses, files } = await storeImages(imagesLocation);
  for (const imageUploadResponsesIndex in imageUploadResponses) {
    //...是javascript的語法糖,代表解開/複製這個變數的內容
    let tokenUriMetadata = { ...metadataTemplate };
    //用各自不同的nft屬性填入到template中,因為上傳image的順序(files)與得到response的順序是一樣的,
    //所以可以直接拿index來用
    //抓出檔名,把.png去掉,填入到設計好的metadataTemplate中,當作name屬性
    tokenUriMetadata.name = files[imageUploadResponsesIndex].replace(".png", "");
    //把template的description填入描述
    tokenUriMetadata.description = `A cute ${tokenUriMetadata.name} dog!`;
    //把template的image屬性,填入上傳到pinata時,response獲得的IpfsHash
    tokenUriMetadata.image = `ipfs://${imageUploadResponses[imageUploadResponsesIndex].IpfsHash}`;
    console.log(`Uploading ${tokenUriMetadata.name} MetaData to Pinata...`);
    //將拼湊好的metadata(json檔)上傳到pinata,並取得回傳的IpfsHash,拿到tokenURI
    const metadataUploadResponse = await storeTokenUriMetadata(tokenUriMetadata);
    //將取得的tokenURI塞到陣列中,tokenUris陣列內容會是 [ ipfs://aaa, ipfs://bbb, ...]
    tokenUris.push(`ipfs://${metadataUploadResponse.IpfsHash}`);
  }
  console.log("Token URIs Uploaded! They are:");
  console.log(tokenUris);
  return tokenUris;
}

module.exports.tags = ["all", "randomipfs", "main"];
