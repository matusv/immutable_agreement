const STELLAR_NETWORK = 'TESTNET';
const HORIZON_URL = STELLAR_NETWORK === 'PUBLIC'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org'

const IPFS_HOST = 'https://ipfs.infura.io:5001';
const IPFS_AUTH = '';

secret = ""

async function issueImmutableAgreement() {
    console.log("issueImmutableAgreement")

    const files = document.getElementById('Files').files

    console.log(files)

    ipfs_hashes = []

    for (file of files) {
        console.log(file)

        var data = new FormData()
        data.append('file', file)

        const urlIpfs = IPFS_HOST + '/api/v0/add';

        const response = await fetch(urlIpfs, {
            method: 'POST',
            auth: IPFS_AUTH,
            body: data
        }).then(async (res) => {
            console.log("res:", res)
            if (res.ok)
                return res.json()
            else
                throw await res.text()
        })

        console.log("response:", response)

        ipfs_hashes.push(response.Hash)
    }

    console.log("IPFS HASHES:", ipfs_hashes)

    const hashes_reserves = (ipfs_hashes.length * 0.5)
    console.log("HASHES RESERVES:", hashes_reserves)

    const startingBalance = (hashes_reserves + 1).toString()
    console.log("startingBalance:", startingBalance)


    const server = new StellarSdk.Server(HORIZON_URL);

    const keypair = StellarSdk.Keypair.fromSecret(secret)

    const publicKey = keypair.publicKey()
    const account = await server.loadAccount(publicKey);

    const fee = await getFee(server);

    const issuerKeypair = StellarSdk.Keypair.random();
    const nftAsset = new StellarSdk.Asset("IA", issuerKeypair.publicKey());

    let tx = new StellarSdk.TransactionBuilder(account, {
        fee,
        networkPassphrase: StellarSdk.Networks[STELLAR_NETWORK]
    });

    tx.addOperation(StellarSdk.Operation.createAccount({
        source: keypair.publicKey(),
        destination: issuerKeypair.publicKey(),
        startingBalance: startingBalance
    }))

    tx.addOperation(StellarSdk.Operation.changeTrust({
        source: keypair.publicKey(),
        asset: nftAsset,
        limit: '0.0000001'
    }))

    tx.addOperation(StellarSdk.Operation.payment({
        source: issuerKeypair.publicKey(),
        destination: keypair.publicKey(),
        asset: nftAsset,
        amount: '0.0000001'
    }));

    for (let i = 0; i < ipfs_hashes.length; i++) {
        tx.addOperation(StellarSdk.Operation.manageData({
            source: issuerKeypair.publicKey(),
            name: "ipfshash" + i,
            value: ipfs_hashes[i]
        }));
    }

    tx.addOperation(StellarSdk.Operation.setOptions({
        masterWeight: 0,
        source: issuerKeypair.publicKey()
    }));

    tx = tx.setTimeout(30).build();
    tx.sign(issuerKeypair);

    tx.sign(keypair);

    console.log(tx.toXDR())


    try {
        const txResult = await server.submitTransaction(tx);
        console.log(txResult)
    } catch (e) {
        console.log('An error has occured:');
        console.log(e);
        // console.log(e.response.data.extras.result_codes);
    }

}

async function getFee(server) {
  return server
  .feeStats()
  .then((feeStats) => feeStats?.fee_charged?.max || 100000)
  .catch(() => 100000)
};
