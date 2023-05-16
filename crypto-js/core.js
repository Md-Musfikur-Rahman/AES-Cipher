/**
 * CryptoJS core components.
 */
var CryptoJS =
  CryptoJS ||
  (function (Math, undefined) {
    var crypto;

    // Native crypto from window (Browser)
    if (typeof window !== "undefined" && window.crypto) {
      crypto = window.crypto;
    }

    // Native crypto in web worker (Browser)
    if (typeof self !== "undefined" && self.crypto) {
      crypto = self.crypto;
    }

    // Native crypto from worker
    if (typeof globalThis !== "undefined" && globalThis.crypto) {
      crypto = globalThis.crypto;
    }

    // Native (experimental IE 11) crypto from window (Browser)
    if (!crypto && typeof window !== "undefined" && window.msCrypto) {
      crypto = window.msCrypto;
    }

    // Native crypto from global (NodeJS)
    if (!crypto && typeof global !== "undefined" && global.crypto) {
      crypto = global.crypto;
    }

    // Native crypto import via require (NodeJS)
    if (!crypto && typeof require === "function") {
      try {
        crypto = require("crypto");
      } catch (err) {}
    }

    /*
     * Cryptographically secure pseudorandom number generator
     *
     * As Math.random() is cryptographically not safe to use
     */
    var cryptoSecureRandomInt = function () {
      if (crypto) {
        // Use getRandomValues method (Browser)
        if (typeof crypto.getRandomValues === "function") {
          try {
            return crypto.getRandomValues(new Uint32Array(1))[0];
          } catch (err) {}
        }

        // Use randomBytes method (NodeJS)
        if (typeof crypto.randomBytes === "function") {
          try {
            return crypto.randomBytes(4).readInt32LE();
          } catch (err) {}
        }
      }

      throw new Error(
        "Native crypto module could not be used to get secure random number."
      );
    };

    /*
     * Local polyfill of Object.create

     */
    var create =
      Object.create ||
      (function () {
        function F() {}

        return function (obj) {
          var subtype;

          F.prototype = obj;

          subtype = new F();

          F.prototype = null;

          return subtype;
        };
      })();

    /**
     * CryptoJS namespace.
     */
    var C = {};

    /**
     * Library namespace.
     */
    var C_lib = (C.lib = {});

    /**
     * Base object for prototypal inheritance.
     */
    var Base = (C_lib.Base = (function () {
      return {
        extend: function (overrides) {
          // Spawn
          var subtype = create(this);

          // Augment
          if (overrides) {
            subtype.mixIn(overrides);
          }

          // Create default initializer
          if (!subtype.hasOwnProperty("init") || this.init === subtype.init) {
            subtype.init = function () {
              subtype.$super.init.apply(this, arguments);
            };
          }

          // Initializer's prototype is the subtype object
          subtype.init.prototype = subtype;

          // Reference supertype
          subtype.$super = this;

          return subtype;
        },

        create: function () {
          var instance = this.extend();
          instance.init.apply(instance, arguments);

          return instance;
        },

        init: function () {},

        mixIn: function (properties) {
          for (var propertyName in properties) {
            if (properties.hasOwnProperty(propertyName)) {
              this[propertyName] = properties[propertyName];
            }
          }

          // IE won't copy toString using the loop above
          if (properties.hasOwnProperty("toString")) {
            this.toString = properties.toString;
          }
        },

        clone: function () {
          return this.init.prototype.extend(this);
        },
      };
    })());

    var WordArray = (C_lib.WordArray = Base.extend({
      init: function (words, sigBytes) {
        words = this.words = words || [];

        if (sigBytes != undefined) {
          this.sigBytes = sigBytes;
        } else {
          this.sigBytes = words.length * 4;
        }
      },

      toString: function (encoder) {
        return (encoder || Hex).stringify(this);
      },

      concat: function (wordArray) {
        // Shortcuts
        var thisWords = this.words;
        var thatWords = wordArray.words;
        var thisSigBytes = this.sigBytes;
        var thatSigBytes = wordArray.sigBytes;

        // Clamp excess bits
        this.clamp();

        // Concat
        if (thisSigBytes % 4) {
          // Copy one byte at a time
          for (var i = 0; i < thatSigBytes; i++) {
            var thatByte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
            thisWords[(thisSigBytes + i) >>> 2] |=
              thatByte << (24 - ((thisSigBytes + i) % 4) * 8);
          }
        } else {
          // Copy one word at a time
          for (var j = 0; j < thatSigBytes; j += 4) {
            thisWords[(thisSigBytes + j) >>> 2] = thatWords[j >>> 2];
          }
        }
        this.sigBytes += thatSigBytes;

        // Chainable
        return this;
      },

      clamp: function () {
        // Shortcuts
        var words = this.words;
        var sigBytes = this.sigBytes;

        // Clamp
        words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
        words.length = Math.ceil(sigBytes / 4);
      },

      clone: function () {
        var clone = Base.clone.call(this);
        clone.words = this.words.slice(0);

        return clone;
      },

      random: function (nBytes) {
        var words = [];

        for (var i = 0; i < nBytes; i += 4) {
          words.push(cryptoSecureRandomInt());
        }

        return new WordArray.init(words, nBytes);
      },
    }));

    /**
     * Encoder namespace.
     */
    var C_enc = (C.enc = {});

    /**
     * Hex encoding strategy.
     */
    var Hex = (C_enc.Hex = {
      stringify: function (wordArray) {
        // Shortcuts
        var words = wordArray.words;
        var sigBytes = wordArray.sigBytes;

        // Convert
        var hexChars = [];
        for (var i = 0; i < sigBytes; i++) {
          var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
          hexChars.push((bite >>> 4).toString(16));
          hexChars.push((bite & 0x0f).toString(16));
        }

        return hexChars.join("");
      },

      parse: function (hexStr) {
        // Shortcut
        var hexStrLength = hexStr.length;

        // Convert
        var words = [];
        for (var i = 0; i < hexStrLength; i += 2) {
          words[i >>> 3] |=
            parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4);
        }

        return new WordArray.init(words, hexStrLength / 2);
      },
    });

    /**
     * Latin1 encoding strategy.
     */
    var Latin1 = (C_enc.Latin1 = {
      stringify: function (wordArray) {
        // Shortcuts
        var words = wordArray.words;
        var sigBytes = wordArray.sigBytes;

        // Convert
        var latin1Chars = [];
        for (var i = 0; i < sigBytes; i++) {
          var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
          latin1Chars.push(String.fromCharCode(bite));
        }

        return latin1Chars.join("");
      },

      parse: function (latin1Str) {
        // Shortcut
        var latin1StrLength = latin1Str.length;

        // Convert
        var words = [];
        for (var i = 0; i < latin1StrLength; i++) {
          words[i >>> 2] |=
            (latin1Str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
        }

        return new WordArray.init(words, latin1StrLength);
      },
    });

    /**
     * UTF-8 encoding strategy.
     */
    var Utf8 = (C_enc.Utf8 = {
      stringify: function (wordArray) {
        try {
          return decodeURIComponent(escape(Latin1.stringify(wordArray)));
        } catch (e) {
          throw new Error("Malformed UTF-8 data");
        }
      },

      parse: function (utf8Str) {
        return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
      },
    });

    var BufferedBlockAlgorithm = (C_lib.BufferedBlockAlgorithm = Base.extend({
      reset: function () {
        // Initial values
        this._data = new WordArray.init();
        this._nDataBytes = 0;
      },

      _append: function (data) {
        // Convert string to WordArray, else assume WordArray already
        if (typeof data == "string") {
          data = Utf8.parse(data);
        }

        // Append
        this._data.concat(data);
        this._nDataBytes += data.sigBytes;
      },

      _process: function (doFlush) {
        var processedWords;

        // Shortcuts
        var data = this._data;
        var dataWords = data.words;
        var dataSigBytes = data.sigBytes;
        var blockSize = this.blockSize;
        var blockSizeBytes = blockSize * 4;

        // Count blocks ready
        var nBlocksReady = dataSigBytes / blockSizeBytes;
        if (doFlush) {
          // Round up to include partial blocks
          nBlocksReady = Math.ceil(nBlocksReady);
        } else {
          // Round down to include only full blocks,
          // less the number of blocks that must remain in the buffer
          nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
        }

        // Count words ready
        var nWordsReady = nBlocksReady * blockSize;

        // Count bytes ready
        var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);

        // Process blocks
        if (nWordsReady) {
          for (var offset = 0; offset < nWordsReady; offset += blockSize) {
            // Perform concrete-algorithm logic
            this._doProcessBlock(dataWords, offset);
          }

          // Remove processed words
          processedWords = dataWords.splice(0, nWordsReady);
          data.sigBytes -= nBytesReady;
        }

        // Return processed words
        return new WordArray.init(processedWords, nBytesReady);
      },

      clone: function () {
        var clone = Base.clone.call(this);
        clone._data = this._data.clone();

        return clone;
      },

      _minBufferSize: 0,
    }));

    var Hasher = (C_lib.Hasher = BufferedBlockAlgorithm.extend({
      cfg: Base.extend(),

      init: function (cfg) {
        // Apply config defaults
        this.cfg = this.cfg.extend(cfg);

        // Set initial values
        this.reset();
      },

      reset: function () {
        // Reset data buffer
        BufferedBlockAlgorithm.reset.call(this);

        // Perform concrete-hasher logic
        this._doReset();
      },

      update: function (messageUpdate) {
        // Append
        this._append(messageUpdate);

        // Update the hash
        this._process();

        // Chainable
        return this;
      },

      finalize: function (messageUpdate) {
        // Final message update
        if (messageUpdate) {
          this._append(messageUpdate);
        }

        // Perform concrete-hasher logic
        var hash = this._doFinalize();

        return hash;
      },

      blockSize: 512 / 32,

      _createHelper: function (hasher) {
        return function (message, cfg) {
          return new hasher.init(cfg).finalize(message);
        };
      },

      _createHmacHelper: function (hasher) {
        return function (message, key) {
          return new C_algo.HMAC.init(hasher, key).finalize(message);
        };
      },
    }));

    /**
     * Algorithm namespace.
     */
    var C_algo = (C.algo = {});

    return C;
  })(Math);
