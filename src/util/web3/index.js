import { EventEmitter } from 'events';

// Module
const startWeb3 = () => {

  // Tiny Crypto Place
  global.tinyCrypto = {

    warn: {},

    connected: false,
    providerConnected: false,
    protocol: null,

    constants: Object.freeze({
      HexZero: '0x0000000000000000000000000000000000000000000000000000000000000000'
    }),

    call: {},
    get: {},
    contracts: {},

    errors: Object.freeze({
      noWallet: () => { return new Error('No wallet connected detected.'); },
      noProvider: () => { return new Error('No provider connected detected.'); },
    }),

    decimals: Object.freeze({
      0: 'wei',
      3: 'kwei',
      6: 'mwei',
      9: 'gwei',
      12: 'microether',
      15: 'milliether',
      18: 'ether',
      21: 'kether',
      24: 'mether',
      27: 'gether',
      30: 'tether',
    }),

  };

  // Check if Web3 has been injected by the browser (Mist/MetaMask).
  if (typeof ethereum !== 'undefined' && window.ethereum.isMetaMask) {

    // Emitter
    class MyEmitter extends EventEmitter { }
    const myEmitter = new MyEmitter();

    window.tinyCrypto.on = (where, callback) => myEmitter.on(where, callback);

    window.tinyCrypto.once = (where, callback) => myEmitter.once(where, callback);

    window.tinyCrypto.on = Object.freeze(window.tinyCrypto.on);
    window.tinyCrypto.once = Object.freeze(window.tinyCrypto.once);

    // Calls

    // Account Change
    window.tinyCrypto.call.accountsChanged = new Promise((resolve, reject) => {
      window.tinyCrypto.get.signerAddress().then(address => {

        window.tinyCrypto.address = address;
        if (window.tinyCrypto.address) {

          if (localStorage) {
            localStorage.setItem('web3_address', window.tinyCrypto.address);
          }

          window.tinyCrypto.accounts = accounts;
          myEmitter.emit('accountsChanged', accounts);
          resolve(accounts);

        }

      }).catch(reject);

    });

    // Get Signer Address
    window.tinyCrypto.get.signerAddress = (index = 0) => new Promise((resolve, reject) => {
      window.tinyCrypto.call.requestAccounts().then(accounts => {

        if (Array.isArray(accounts) && accounts.length > 0 && typeof accounts[index] === 'string') {
          resolve(accounts[index]);
        }

        else {
          resolve(null);
        }

      }).catch(reject);
    });

    // Network Changed
    window.tinyCrypto.call.networkChanged = (networkId) => {

      window.tinyCrypto.networkId = networkId;

      if (localStorage) {
        localStorage.setItem('web3_network_id', networkId);
      }

      myEmitter.emit('networkChanged', networkId);

    };

    // Request Account
    window.tinyCrypto.call.requestAccounts = () => new Promise((resolve, reject) => {
      window.tinyCrypto.provider.eth.requestAccounts().then(accounts => {

        // Address
        if (Array.isArray(accounts) && accounts.length > 0) {
          for (const item in accounts) {
            accounts[item] = accounts[item].toLowerCase();
          }
        }

        window.tinyCrypto.accounts = accounts;
        window.tinyCrypto.connected = true;

        myEmitter.emit('requestAccounts', accounts);
        resolve(accounts);

      }).catch(err => {
        window.tinyCrypto.connected = false;
        reject(err);
      });
    });

    // Check Connection
    window.tinyCrypto.call.checkConnection = () => new Promise((resolve, reject) => {
      if (window.tinyCrypto.providerConnected) {
        window.tinyCrypto.provider.eth.getAccounts().then(accounts => {

          // Address
          if (Array.isArray(accounts) && accounts.length > 0) {
            for (const item in accounts) {
              accounts[item] = accounts[item].toLowerCase();
            }
          }

          window.tinyCrypto.accounts = accounts;

          // Check Address
          if (window.tinyCrypto.existAccounts()) {

            window.tinyCrypto.get.signerAddress().then(address => {

              window.tinyCrypto.address = address;

              myEmitter.emit('checkConnection', { address, accounts });
              resolve(address);

            }).catch(reject);

          }

          else {
            resolve(false);
          }

        });
      }
      else {
        reject(window.tinyCrypto.errors.noProvider());
      }

    });

    // Wait Address
    window.tinyCrypto.call.waitAddress = () => new Promise((resolve, reject) => {

      try {

        if (window.tinyCrypto.address) {
          resolve(window.tinyCrypto.address);
        }

        else {
          setTimeout(() => {
            window.tinyCrypto.call.waitAddress().then(data => { resolve(data); }).catch(reject);
          }, 500);
        }

      }

      catch (err) { reject(err); }

    });

    // Execute Contract
    window.tinyCrypto.call.executeContract = (contract, abi, data, gasLimit = 100000) => new Promise((resolve, reject) => {
      if (window.tinyCrypto.connected) {

        // Loading
        window.tinyCrypto.get.signerAddress().then(address => {
          window.tinyCrypto.address = address;
          window.tinyCrypto.provider.eth.getTransactionCount(address).then(nonce => {
            window.tinyCrypto.provider.eth.getGasPrice().then(currentGasPrice => {

              // construct the transaction data
              const tx = {

                nonce,
                gasLimit: window.tinyCrypto.provider.utils.toHex(gasLimit),

                // eslint-disable-next-line radix
                gasPrice: window.tinyCrypto.provider.utils.toHex(parseInt(currentGasPrice)),

                from: address,
                to: contract,
                value: window.tinyCrypto.constants.HexZero,
                data: window.tinyCrypto.provider.eth.abi.encodeFunctionCall(abi, data),

              };

              // Complete
              window.tinyCrypto.provider.eth.sendTransaction(tx).then(resolve).catch(reject);

            }).catch(reject);
          }).catch(reject);
        }).catch(reject);

      }

      else { reject(window.tinyCrypto.errors.noWallet()); }

    });

    // Read Contract
    window.tinyCrypto.call.readContract = (contract, functionName, data, abi) => new Promise((resolve, reject) => {

      if (!window.tinyCrypto.contracts[contract] && abi) {
        window.tinyCrypto.contracts[contract] = new window.tinyCrypto.provider.eth.Contract(abi, contract);
      }

      if (window.tinyCrypto.contracts[contract]) {
        window.tinyCrypto.contracts[contract].methods[functionName].apply(window.tinyCrypto.contracts[contract], data).call().then(resolve).catch(reject);
      }

      else {
        resolve(null);
      }

    });

    // Send Payment
    window.tinyCrypto.call.sendTransaction = (amount, address, contract = null, gasLimit = 100000) => new Promise((resolve, reject) => {

      if (window.tinyCrypto.connected) {

        // Result
        window.tinyCrypto.get.signerAddress().then(mainWallet => {

          // Address
          const tinyAddress = address.toLowerCase();

          // Token Mode
          if (contract) {

            // Contract Value
            let tinyContract = contract;

            // Connect to the contract
            if (typeof tinyContract === 'string') { tinyContract = { value: contract, decimals: 18 }; }
            if (typeof tinyContract.value !== 'string') { tinyContract.value = ''; }
            if (typeof tinyContract.decimals !== 'number') { tinyContract.decimals = 18; }

            // Transaction
            window.tinyCrypto.call.executeContract(tinyContract.value, {
              type: 'function',
              name: 'transfer',
              stateMutability: 'nonpayable',
              payable: false,
              constant: false,
              outputs: [{ type: 'uint8' }],
              inputs: [{
                name: '_to',
                type: 'address'
              }, {
                name: '_value',
                type: 'uint256'
              }]
            }, [
              tinyAddress,
              window.tinyCrypto.provider.utils.toWei(String(amount), window.tinyCrypto.decimals[tinyContract.decimals])
            ], gasLimit).then(resolve).catch(reject);

          }

          // Normal Mode
          else {
            window.tinyCrypto.provider.eth.sendTransaction({
              from: mainWallet,
              to: tinyAddress,
              value: window.tinyCrypto.provider.utils.toWei(String(amount)),
            }).then(resolve).catch(reject);
          }

        }).catch(reject);

      }

      else {
        reject(window.tinyCrypto.errors.noWallet());
      }

    });

    // Sign
    window.tinyCrypto.call.sign = (msg = '', password = '') => new Promise((resolve, reject) => {

      if (window.tinyCrypto.connected) {
        window.tinyCrypto.get.signerAddress().then(address => {

          window.tinyCrypto.address = address;
          if (address) {
            window.tinyCrypto.provider.eth.personal.sign(window.tinyCrypto.provider.utils.utf8ToHex(msg), address, password).then(resolve);
          }

          else {
            resolve(null);
          }

        }).catch(reject);
      }

      else {
        reject(window.tinyCrypto.errors.noWallet());
      }

    });

    // Data
    window.tinyCrypto.get.provider = () => window.tinyCrypto.provider;
    window.tinyCrypto.get.address = () => window.tinyCrypto.address;
    window.tinyCrypto.get.call = () => window.tinyCrypto.call;
    window.tinyCrypto.get.config = () => window.clone(window.tinyCrypto.config);

    // Exist Accounts
    window.tinyCrypto.existAccounts = () => Array.isArray(window.tinyCrypto.accounts) && window.tinyCrypto.accounts.length > 0;

    // Insert Provider
    // eslint-disable-next-line no-undef
    window.tinyCrypto.provider = new Web3(window.ethereum);
    window.tinyCrypto.providerConnected = true;

    // Insert Protocol
    window.tinyCrypto.protocol = 'metamask';

    // Change Account Detector
    window.ethereum.on('accountsChanged', accounts => {
      window.tinyCrypto.call.accountsChanged(accounts);
    });

    // Network Change
    window.ethereum.on('networkChanged', networkId => {
      window.tinyCrypto.call.networkChanged(networkId);
    });

    // Ready Provider and check the connection
    window.tinyCrypto.call.checkConnection().then(() => {
      myEmitter.emit('readyProvider');
    });

  }

  // Freeze
  window.tinyCrypto.call = Object.freeze(window.tinyCrypto.call);
  window.tinyCrypto.get = Object.freeze(window.tinyCrypto.get);

};

// Export Module
export { startWeb3 };
