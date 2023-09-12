const Caver = require("caver-js");
require("dotenv").config();

const privateKey = process.env.IU_PRIVATE_KEY;
const address = process.env.IU_ADDRESS;

async function updateAccountToFeepayerOnly() {
  const caver = new Caver(process.env.IU_RPC_ENDPOINT);
  const keyring = new caver.wallet.keyring.singleKeyring(address, privateKey);
  caver.wallet.add(keyring);

  let tx = caver.transaction.accountUpdate.create({
    from: address,
    gas: 50000,
    account: new caver.account(
      address,
      new caver.account.accountKey.accountKeyRoleBased([
        new caver.account.accountKey.accountKeyFail(),
        new caver.account.accountKey.accountKeyFail(),
        new caver.account.accountKey.accountKeyPublic(keyring.getPublicKey()),
      ]),
    ),
  });
  await caver.wallet.sign(address, tx);
  tx = await caver.rpc.klay.sendRawTransaction(tx);

  if (tx.transactionHash) {
    console.log("Succeed to submit transaction");
  }

  const account = await caver.klay.getAccount(address);

  if (
    account.account.key.keyType == 5 &&
    account.account.key.key[0].keyType == 3 &&
    account.account.key.key[1].keyType == 3 &&
    account.account.key.key[2].keyType == 2
  ) {
    console.log("Succeed to update account to feepayer only");
    return;
  }

  console.log("Failed to update account to feepayer only");
  process.exit(1);
}

async function feepayerSigningTest() {
  const caver = new Caver(process.env.IU_RPC_ENDPOINT);
  const a = caver.wallet.keyring.generate();
  caver.wallet.add(a);

  let tx = caver.transaction.feeDelegatedValueTransfer.create({
    from: a.address,
    to: address,
    value: 0,
    gas: 250000,
  });
  await caver.wallet.sign(a.address, tx);

  const keyring = new caver.wallet.keyring.singleKeyring(address, privateKey);
  caver.wallet.add(keyring);
  tx = await caver.wallet.signAsFeePayer(address, tx);
  tx = await caver.rpc.klay.sendRawTransaction(tx);

  if (tx.transactionHash && tx.feePayer && tx.status == "0x1") {
    console.log("Succeed to process fee delegation transaction");
    return;
  }
  console.log("Failed to process fee delegation transaction");
}

async function withdrawalFailureTest() {
  const caver = new Caver(process.env.IU_RPC_ENDPOINT);
  const keyring = new caver.wallet.keyring.singleKeyring(address, privateKey);
  caver.wallet.add(keyring);

  const a = caver.wallet.keyring.generate();

  let tx = caver.transaction.valueTransfer.create({
    from: address,
    to: a.address,
    value: 1,
    gas: 250000,
  });
  await caver.wallet.sign(address, tx);

  try {
    tx = await caver.rpc.klay.sendRawTransaction(tx);
    console.log("incorrectly updated account");
  } catch (e) {
    console.log("succeed to invalidate the signature");
  }
}

(async () => {
  await updateAccountToFeepayerOnly();
  await feepayerSigningTest();
  await withdrawalFailureTest();
  process.exit(0);
})();
