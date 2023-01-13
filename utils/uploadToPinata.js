const pinataSDK = require("@pinata/sdk");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const pinataApiKey = process.env.PINATA_API_KEY;
const pinataApiSecret = process.env.PINATA_API_SECRET;
//抓取pinata的ApiKey和ApiSecret之後就可以使用pinataSDK
const pinata = new pinataSDK(pinataApiKey, pinataApiSecret);

//撰寫一個function 用來抓取特定路徑資料夾底下的所有檔案
async function storeImages(imagesFilePath) {
  //使用path套件,解析路徑位置
  const fullImagePath = path.resolve(imagesFilePath);
  //將特定路徑位置用fs.readdirsync讀取路徑下的每一個檔案,用filter確保只撈到png檔
  const files = fs.readdirSync(fullImagePath).filter((file) => file.includes(".png"));
  //這個空陣列用來存放pinata server回傳的資訊
  let response = [];
  console.log("Uploading to Pinata");
  //for迴圈fileIndex會根據讀取到的files有幾個檔案,自動計算fileIndex,從0開始數
  for (const fileIndex in files) {
    console.log(`Working on ${fullImagePath}/${files[fileIndex]} ...`);
    //用stream的方式讀取檔案,檔案的路徑會是"./images/randomNft/shiba-inu.png" 之類的
    const readableStreamForFile = fs.createReadStream(`${fullImagePath}/${files[fileIndex]}`);
    //宣告options,因為需要提供pinataMetadata.name
    const options = {
      pinataMetadata: {
        name: files[fileIndex],
      },
    };
    try {
      //   //呼叫pinata SDK將檔案以read stream的方式pin到IPFS上,簡單說就是上傳檔案
      //   const responseFromPinata = await pinata.pinFileToIPFS(readableStreamForFile, options);
      //   //將回傳的資訊存到response 陣列內
      //   response.push(responseFromPinata);

      /* 以下等同於上面兩行,但是更容易抓錯 */
      await pinata
        //先呼叫pinFileToIPFS,傳入變數
        .pinFileToIPFS(readableStreamForFile, options)
        //如果成功則結果存到response中
        .then((result) => {
          response.push(result);
        })
        //如果上傳失敗則抓錯輸出
        .catch((error) => {
          console.log(error);
        });
    } catch (error) {
      console.log(error);
    }
  }
  //呼叫這個function後回傳出response陣列中的內容,和所有抓到的png檔
  return { response, files };
  /* response的陣列內容: 
  [{
	  IpfsHash: axxx,
	  PinSize: axxx,
	  Timestamp: axxx,
  },
  {
	  IpfsHash: bxxx,
	  PinSize: bxxx,
	  Timestamp: bxxx,
  }, ...]
  */

  /* files的陣列內容:
   [
	pug.png,
	shiba-inu,
	st-bernard.png
   ]
  */
}

//將metadata(json檔)上傳到pinata上
async function storeTokenUriMetadata(metadata) {
  const options = { pinataMetadata: { name: metadata.name } };
  try {
    const response = await pinata.pinJSONToIPFS(metadata, options);
    return response;
  } catch (error) {
    console.log(error);
  }
  //因為try catch內要return response,所以外層要return null
  return null;
}

module.exports = { storeImages, storeTokenUriMetadata };

//快速測試pinata 是否串接成功
// pinata
//   .testAuthentication()
//   .then((result) => {
//     //handle successful authentication here
//     console.log(result);
//   })
//   .catch((err) => {
//     //handle error here
//     console.log(err);
//   });
