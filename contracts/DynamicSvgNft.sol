// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "base64-sol/base64.sol";

contract DynamicSvgNft is ERC721 {
  uint256 private s_tokenCounter;
  string private s_lowImageURI;
  string private s_highImageURI;

  AggregatorV3Interface internal immutable i_priceFeed;
  //這個mapping是用於將tokenId 與 以太幣價做mapping
  mapping(uint256 => int256) public s_tokenIdToHighValue;

  event CreateNFT(uint256 indexed tokenId, int256 highValue);

  constructor(
    address _priceFeedAddress,
    string memory _lowSvg,
    string memory _highSvg
  ) ERC721("Dynamic SVF NFT", "DSN") {
    s_tokenCounter = 0;
    s_lowImageURI = svgToImageURI(_lowSvg); //將svg轉為imageURI之後,存成變數,該imageURI類似這樣 data:image/svg+xml;base64,PD94bWwgdxxx...
    s_highImageURI = svgToImageURI(_highSvg);
    i_priceFeed = AggregatorV3Interface(_priceFeedAddress);
  }

  //傳進此function的svg code,將會做base64 encode,且連接前綴字串,return長這樣 data:image/svg+xml;base64,PD94bxxx...
  function svgToImageURI(string memory _svg) public pure returns (string memory) {
    //先寫一個變數,內容是base64的前綴,這個前綴與base64組合,就能夠在網頁上顯示image
    string memory base64EncodedSvgPrefix = "data:image/svg+xml;base64,";
    //abi.encodePacked 先將輸入string轉為binary格式,再透過字串轉回bytes格式,使用base64 encode
    string memory svgBase64Encoded = Base64.encode(bytes(string(abi.encodePacked(_svg))));
    //連接字串 "data:image/svg+xml;base64," 與 base64
    return string(abi.encodePacked(base64EncodedSvgPrefix, svgBase64Encoded));
  }

  //用戶鑄造NFT時,會觸發此function,用戶自訂一個價格,例如:1300美元,則用戶鑄造的NFT 在以太幣價 達到1300美元時 就會顯示笑臉
  function mintNFT(int256 _highValue) public {
    s_tokenIdToHighValue[s_tokenCounter] = _highValue;
    _safeMint(msg.sender, s_tokenCounter);
    s_tokenCounter = s_tokenCounter + 1;
    emit CreateNFT(s_tokenCounter, _highValue);
  }

  //設定_baseURI,此function屬於ERC721合約中的,因此使用override覆蓋,用意為,每一個tokenURI都會加上前綴,"data:application/json;base64,"
  function _baseURI() internal pure override returns (string memory) {
    return "data:application/json;base64,";
  }

  //此function用意為設定NFT的tokenURI,傳入tokenID後,會回傳一個tokenURI,這串東西貼在瀏覽器上,就會顯示NFT的圖片
  function tokenURI(uint256 _tokenId) public view virtual override returns (string memory) {
    //檢查該NFT是否有鑄造者
    require(_exists(_tokenId), "URI Query for nonexistent token");
    //string memory imageURI = "hi!";

    //抓取當下以太幣價
    (, int256 price, , , ) = i_priceFeed.latestRoundData();
    int ethPrice = price * 1e10; //####重要
    //預設為哭臉的ImageURI
    string memory imageURI = s_lowImageURI;
    //當以太幣價大於用戶鑄造NFT時,所設定的指定金額,該NFT顯示笑臉
    if (ethPrice >= s_tokenIdToHighValue[_tokenId]) {
      imageURI = s_highImageURI;
    }
    //以下做的事情是,先手動建立一個metaData json檔的文字template,然後填入name(),imageURI, 在用abi.encodePacked將字串連接起來,
    //連接好的字串轉成bytes格式後,在做Base64 encode (目的是,瀏覽器可以直接解析base64的json檔,瀏覽器解析後,就可以直接顯示NFT的圖案svg)
    //為了讓瀏覽器顯示base64的json,要先加上前綴,"data:application/json;base64," 所以用abi.encode將其與前綴連接
    //最後這整體是一個bytes物件,轉成string格式return
    //看起來長這樣 data:application/json;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdxxx...
    //這串直接貼到網頁上 就會顯示NFT的image圖檔
    return
      string(
        abi.encodePacked(
          _baseURI(),
          Base64.encode(
            bytes(
              abi.encodePacked(
                '{"name":"',
                name(),
                '", "description":"An NFT that changes based on the Chainlink Feed", ',
                '"attributes": [{"trait_type": "coolness", "value": 100}], "image":"',
                imageURI,
                '"}'
              )
            )
          )
        )
      );
  }

  function getLowSVG() public view returns (string memory) {
    return s_lowImageURI;
  }

  function getHighSVG() public view returns (string memory) {
    return s_highImageURI;
  }

  function getPriceFeed() public view returns (AggregatorV3Interface) {
    return i_priceFeed;
  }

  function getTokenCounter() public view returns (uint256) {
    return s_tokenCounter;
  }

  //顯示以太幣價
  function getPrice() public view returns (uint256) {
    (, int256 ethPrice, , , ) = i_priceFeed.latestRoundData();
    return uint256(ethPrice * 1e10);
  }
}
