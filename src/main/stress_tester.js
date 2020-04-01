/**
 * Web app to stress test the Monero network by generating transactions.
 */

// import dependencies
require("monero-javascript");
const MoneroTxGenerator = require("./MoneroTxGenerator");

// configuration
const DAEMON_RPC_URI = "http://localhost:38081";
const DAEMON_RPC_USERNAME = "superuser";
const DAEMON_RPC_PASSWORD = "abctesting123";
const MNEMONIC = "goblet went maze cylinder stockpile twofold fewest jaded lurk rally espionage grunt aunt puffin kickoff refer shyness tether building eleven lopped dawn tasked toolbox grunt";
const SEED_OFFSET = "";
const RESTORE_HEIGHT = 531333;
const PROXY_TO_WORKER = true;   // proxy core wallet and daemon to worker so main thread is not blocked (recommended)
const USE_FS = true;            // optionally save wallets to an in-memory file system, otherwise use empty paths
const FS = USE_FS ? require('memfs') : undefined;  // use in-memory file system for demo


// GUI variables
const FLEX_SRC = "img/muscleFlex.gif";
const RELAX_SRC = "img/muscleRelax.gif";


// Run application on main thread.
let isMain = self.document? true : false;
if (isMain) runApp();

/**
 * Run the application.
 */
async function runApp() {
  // Initialize GUI-displayed wallet statistics
  let txGenerated = 0;
  let totalFee = 0;	
  console.log("APPLICATION START");

  // Set the start/stop button image to RELAX
  $("#muscleButton").attr('src',RELAX_SRC);

  // Display a "working..." message on the page so the user knows
  // They can't start generating TXs yet
  $("#statusMessage").html("working...");
  
  // bool to track whether the stress test loop is running
  // This will help us know which muscle button animation to play
  // and whether to send a "start" or "stop" stignal to the
  // generator
  let isTestRunning = false;

  $("#wallet_balance").text("Wallet balance: Initializing...");
  
  // connect to daemon 
  let daemonConnection = new MoneroRpcConnection({uri: DAEMON_RPC_URI, user: DAEMON_RPC_USERNAME, pass: DAEMON_RPC_PASSWORD});
  //let daemon = new MoneroDaemonRpc(daemonConnection.getConfig()); // TODO: support passing connection
  let daemon = await MoneroDaemonRpc.create(Object.assign({PROXY_TO_WORKER: PROXY_TO_WORKER}, daemonConnection.getConfig()));
  
  // create a wallet from mnemonic
  let path = USE_FS ? GenUtils.uuidv4() : "";
  console.log("Creating core wallet" + (PROXY_TO_WORKER ? " in worker" : "") + (USE_FS ? " at path " + path : ""));
  let wallet = await MoneroWalletCore.createWalletFromMnemonic(path, "abctesting123", MoneroNetworkType.STAGENET, MNEMONIC, daemonConnection, RESTORE_HEIGHT, SEED_OFFSET, PROXY_TO_WORKER, FS);

  //Get the wallet address 
  let walletAddress = await wallet.getPrimaryAddress();
  let walletAddressLine1 = walletAddress.substring(0,walletAddress.length);
  let walletAddressLine2 = walletAddress.substring(walletAddress.length);
  //Display wallet address on page
  $("#walletAddress").html(walletAddressLine1 + "<br/>" + walletAddressLine2);

  console.log("Core wallet imported mnemonic: " + await wallet.getMnemonic());
  console.log("Core wallet imported address: " + walletAddress);

  // synchronize wallet
    $("#statusMessage").html("Syncronizing core wallet...");
  let result = await wallet.sync(new WalletSyncPrinter());  // synchronize and print progress
  $("#statusMessage").html("Done syncing. Result: " + result);
    $("#statusMessage").html("working...");
  
  // print balance and number of transactions
  console.log("Core wallet balance: " + await wallet.getBalance());
  
  /* commented out; currently does nothing
  // receive notifications when outputs are spent
  await wallet.addListener(new class extends MoneroWalletListener {
    onOutputSpent(output) {
      console.log("Output spent: " + output);
      // todo: get amount spent to add it to the total
      // (can we get the fee from the output object too?)
    }
  });
  */
  
  // start background syncing
  await wallet.startSyncing();
  
  // instantiate a transaction generator
  let txGenerator = new MoneroTxGenerator(daemon, wallet);
    $("#statusMessage").html("Ready to stress the system!");

  // give start/stop control over transaction generator to the muscle button
  // Listen for the start/stop button to be clicked
  $("#muscleButton").click(async function() {
    if (isTestRunning) {
	  isTestRunning = false;
      txGenerator.stop();  
      $("#muscleButton").attr('src',RELAX_SRC);
	} else {
	  isTestRunning = true;
      $("#muscleButton").attr('src',FLEX_SRC);
      await txGenerator.start();
	}
  })  

}

/**
 * Print sync progress every X blocks.
 */
class WalletSyncPrinter extends MoneroWalletListener {
  
  constructor(blockResolution) {
    super();
    this.blockResolution = blockResolution ? blockResolution : 2500;
  }
  
  onSyncProgress(height, startHeight, endHeight, percentDone, message) {
    if (percentDone === 1 || (startHeight - height) % this.blockResolution === 0) {
      let percentString = Math.floor(parseFloat(percentDone) * 100).toString() + "%";
      $("#progressBar").val(percentString);
      console.log("Percent string: " + percentString);
      console.log("onSyncProgress(" + height + ", " + startHeight + ", " + endHeight + ", " + percentDone + ", " + message + ")");
      $("#progressBar").attr("width", percentString);
    }
  }
}