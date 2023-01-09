// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error RandomIpfsNft__RangeOutOfBounds();
error RandomIpfsNft__NeedMoreETHSent();
error RandomIpfsNft__TransferFailed();

contract RandomIpfsNft is VRFConsumerBaseV2, ERC721URIStorage, Ownable {
  //宣告自定義變數enum
  enum Rare {
    SR, //超稀有 0~9
    R, //稀有   10~29
    C //普通    30~99
  }

  //要請求隨機數，要使用VRFCoordinator的function，因此先宣告一個abi
  VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
  uint64 private immutable i_subscriptionId;
  uint32 private immutable i_callbackGasLimit;
  uint32 private constant NUM_WORDS = 1;
  uint16 private constant REQUEST_CONFIRMATIONS = 3;
  bytes32 private immutable i_keyHash;

  //mapping用戶呼叫請求隨機數之後，回傳的requestId屬於該地址，用於配發NFT給該請求隨機數的帳戶
  mapping(uint256 => address) public s_requestIdToSender;

  //宣告一個token Counter用於計算NFT的tokenId
  uint256 public s_tokenCounter;
  //宣告一個變數寫入100
  uint256 internal constant MAX_CHANCE_VALUE = 100;
  //宣告一個字串陣列存放tokenURI的字串
  string[] internal s_nftTokenUris;
  //宣告變數最低鑄造nft所需金額
  uint256 internal immutable i_mintFee;

  // Events
  event NftRequested(uint indexed requestId, address requester);
  event NftMinted(Rare nftRare, address minter);

  constructor(
    address _vrfCoordinatorV2,
    uint64 _subscriptionId,
    uint32 _callbackGasLimit,
    bytes32 _keyHash,
    string[3] memory _tokenUris,
    uint256 _mintFee
  ) VRFConsumerBaseV2(_vrfCoordinatorV2) ERC721("Random IPFS NFT", "RIN") {
    //用abi+地址就等於載入合約，就能夠呼叫鏈上(interface)的function
    i_vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinatorV2);
    i_subscriptionId = _subscriptionId;
    i_callbackGasLimit = _callbackGasLimit;
    i_keyHash = _keyHash;
    s_nftTokenUris = _tokenUris;
    i_mintFee = _mintFee;
  }

  function requestNft() public payable returns (uint256 requestId) {
    if (msg.value < i_mintFee) {
      revert RandomIpfsNft__NeedMoreETHSent();
    }
    requestId = i_vrfCoordinator.requestRandomWords(
      i_keyHash,
      i_subscriptionId,
      REQUEST_CONFIRMATIONS,
      i_callbackGasLimit,
      NUM_WORDS
    );
    s_requestIdToSender[requestId] = msg.sender;
    emit NftRequested(requestId, msg.sender);
  }

  function fulfillRandomWords(
    uint256 _requestId,
    uint256[] memory _randomWords
  ) internal override {
    address nftOwner = s_requestIdToSender[_requestId];
    uint256 newTokenId = s_tokenCounter;
    //取得隨機數之後,做餘數處理,將結果限制在0~99
    uint256 moddedRng = _randomWords[0] % MAX_CHANCE_VALUE;
    //透過function用隨機數取得對應的稀有度
    Rare nftRare = getRareFromModdedRng(moddedRng);
    //鑄造NFT
    _safeMint(nftOwner, newTokenId);
    //設定NFT的tokenURI,輸入tokenId,tokenURI string,
    //因為s_nftTokenUris是一個字串陣列,[]中的代表index,而這裡使用nftRare的稀有度轉回uint格式變成對應的index
    _setTokenURI(newTokenId, s_nftTokenUris[uint(nftRare)]);
    emit NftMinted(nftRare, nftOwner);
  }

  function withdraw() public onlyOwner {
    uint amount = address(this).balance;
    (bool success, ) = payable(msg.sender).call{value: amount}("");
    if (!success) {
      revert RandomIpfsNft__TransferFailed();
    }
  }

  //此function隨機數轉成對應的稀有度
  function getRareFromModdedRng(uint256 _moddedRng) public pure returns (Rare) {
    //宣告變數totalSum用來當作指針
    uint256 totalSum = 0;
    //function中,取出陣列中區分稀有度得值
    uint256[3] memory chanceArray = getChanceArray();

    //for迴圈用來遍歷該稀有度陣列
    for (uint256 i = 0; i < chanceArray.length; i++) {
      if (_moddedRng >= totalSum && _moddedRng < totalSum + chanceArray[i]) {
        return Rare(i);
      }
      totalSum += chanceArray[i];
    }
    revert RandomIpfsNft__RangeOutOfBounds();
  }

  //這個function會回傳一個陣列,存著三個值,這三個值會用來區分稀有度
  function getChanceArray() public pure returns (uint256[3] memory) {
    return [10, 30, MAX_CHANCE_VALUE];
  }

  function getMintFee() public view returns (uint) {
    return i_mintFee;
  }

  function getNftTokenUris(uint _index) public view returns (string memory) {
    return s_nftTokenUris[_index];
  }

  function getTokenCounter() public view returns (uint) {
    return s_tokenCounter;
  }
}
