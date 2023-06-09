/**
 * Cipher core components.
 */
CryptoJS.lib.Cipher ||
  (function (undefined) {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var Base = C_lib.Base;
    var WordArray = C_lib.WordArray;
    var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm;
    var C_enc = C.enc;
    var Utf8 = C_enc.Utf8;
    var Base64 = C_enc.Base64;
    var C_algo = C.algo;
    var EvpKDF = C_algo.EvpKDF;

    var Cipher = (C_lib.Cipher = BufferedBlockAlgorithm.extend({
      cfg: Base.extend(),

      createEncryptor: function (key, cfg) {
        return this.create(this._ENC_XFORM_MODE, key, cfg);
      },

      createDecryptor: function (key, cfg) {
        return this.create(this._DEC_XFORM_MODE, key, cfg);
      },

      init: function (xformMode, key, cfg) {
        // Apply config defaults
        this.cfg = this.cfg.extend(cfg);

        // Store transform mode and key
        this._xformMode = xformMode;
        this._key = key;

        // Set initial values
        this.reset();
      },

      reset: function () {
        // Reset data buffer
        BufferedBlockAlgorithm.reset.call(this);

        // Perform concrete-cipher logic
        this._doReset();
      },

      process: function (dataUpdate) {
        // Append
        this._append(dataUpdate);

        // Process available blocks
        return this._process();
      },

      finalize: function (dataUpdate) {
        // Final data update
        if (dataUpdate) {
          this._append(dataUpdate);
        }

        // Perform concrete-cipher logic
        var finalProcessedData = this._doFinalize();

        return finalProcessedData;
      },

      keySize: 128 / 32,

      ivSize: 128 / 32,

      _ENC_XFORM_MODE: 1,

      _DEC_XFORM_MODE: 2,

      _createHelper: (function () {
        function selectCipherStrategy(key) {
          if (typeof key == "string") {
            return PasswordBasedCipher;
          } else {
            return SerializableCipher;
          }
        }

        return function (cipher) {
          return {
            encrypt: function (message, key, cfg) {
              return selectCipherStrategy(key).encrypt(
                cipher,
                message,
                key,
                cfg
              );
            },

            decrypt: function (ciphertext, key, cfg) {
              return selectCipherStrategy(key).decrypt(
                cipher,
                ciphertext,
                key,
                cfg
              );
            },
          };
        };
      })(),
    }));

    var StreamCipher = (C_lib.StreamCipher = Cipher.extend({
      _doFinalize: function () {
        // Process partial blocks
        var finalProcessedBlocks = this._process(!!"flush");

        return finalProcessedBlocks;
      },

      blockSize: 1,
    }));

    /**
     * Mode namespace.
     */
    var C_mode = (C.mode = {});

    /**
     * Abstract base block cipher mode template.
     */
    var BlockCipherMode = (C_lib.BlockCipherMode = Base.extend({
      createEncryptor: function (cipher, iv) {
        return this.Encryptor.create(cipher, iv);
      },

      createDecryptor: function (cipher, iv) {
        return this.Decryptor.create(cipher, iv);
      },

      init: function (cipher, iv) {
        this._cipher = cipher;
        this._iv = iv;
      },
    }));

    /**
     * Cipher Block Chaining mode.
     */
    var CBC = (C_mode.CBC = (function () {
      /**
       * Abstract base CBC mode.
       */
      var CBC = BlockCipherMode.extend();

      /**
       * CBC encryptor.
       */
      CBC.Encryptor = CBC.extend({
        processBlock: function (words, offset) {
          // Shortcuts
          var cipher = this._cipher;
          var blockSize = cipher.blockSize;

          // XOR and encrypt
          xorBlock.call(this, words, offset, blockSize);
          cipher.encryptBlock(words, offset);

          // Remember this block to use with next block
          this._prevBlock = words.slice(offset, offset + blockSize);
        },
      });

      /**
       * CBC decryptor.
       */
      CBC.Decryptor = CBC.extend({
        processBlock: function (words, offset) {
          // Shortcuts
          var cipher = this._cipher;
          var blockSize = cipher.blockSize;

          // Remember this block to use with next block
          var thisBlock = words.slice(offset, offset + blockSize);

          // Decrypt and XOR
          cipher.decryptBlock(words, offset);
          xorBlock.call(this, words, offset, blockSize);

          // This block becomes the previous block
          this._prevBlock = thisBlock;
        },
      });

      function xorBlock(words, offset, blockSize) {
        var block;

        // Shortcut
        var iv = this._iv;

        // Choose mixing block
        if (iv) {
          block = iv;

          // Remove IV for subsequent blocks
          this._iv = undefined;
        } else {
          block = this._prevBlock;
        }

        // XOR blocks
        for (var i = 0; i < blockSize; i++) {
          words[offset + i] ^= block[i];
        }
      }

      return CBC;
    })());

    /**
     * Padding namespace.
     */
    var C_pad = (C.pad = {});

    /**
     * PKCS #5/7 padding strategy.
     */
    var Pkcs7 = (C_pad.Pkcs7 = {
      pad: function (data, blockSize) {
        // Shortcut
        var blockSizeBytes = blockSize * 4;

        // Count padding bytes
        var nPaddingBytes = blockSizeBytes - (data.sigBytes % blockSizeBytes);

        // Create padding word
        var paddingWord =
          (nPaddingBytes << 24) |
          (nPaddingBytes << 16) |
          (nPaddingBytes << 8) |
          nPaddingBytes;

        // Create padding
        var paddingWords = [];
        for (var i = 0; i < nPaddingBytes; i += 4) {
          paddingWords.push(paddingWord);
        }
        var padding = WordArray.create(paddingWords, nPaddingBytes);

        // Add padding
        data.concat(padding);
      },
      unpad: function (data) {
        // Get number of padding bytes from last byte
        var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

        // Remove padding
        data.sigBytes -= nPaddingBytes;
      },
    });

    var BlockCipher = (C_lib.BlockCipher = Cipher.extend({
      cfg: Cipher.cfg.extend({
        mode: CBC,
        padding: Pkcs7,
      }),

      reset: function () {
        var modeCreator;

        // Reset cipher
        Cipher.reset.call(this);

        // Shortcuts
        var cfg = this.cfg;
        var iv = cfg.iv;
        var mode = cfg.mode;

        // Reset block mode
        if (this._xformMode == this._ENC_XFORM_MODE) {
          modeCreator = mode.createEncryptor;
        } /* if (this._xformMode == this._DEC_XFORM_MODE) */ else {
          modeCreator = mode.createDecryptor;
          // Keep at least one block in the buffer for unpadding
          this._minBufferSize = 1;
        }

        if (this._mode && this._mode.__creator == modeCreator) {
          this._mode.init(this, iv && iv.words);
        } else {
          this._mode = modeCreator.call(mode, this, iv && iv.words);
          this._mode.__creator = modeCreator;
        }
      },

      _doProcessBlock: function (words, offset) {
        this._mode.processBlock(words, offset);
      },

      _doFinalize: function () {
        var finalProcessedBlocks;

        // Shortcut
        var padding = this.cfg.padding;

        // Finalize
        if (this._xformMode == this._ENC_XFORM_MODE) {
          // Pad data
          padding.pad(this._data, this.blockSize);

          // Process final blocks
          finalProcessedBlocks = this._process(!!"flush");
        } /* if (this._xformMode == this._DEC_XFORM_MODE) */ else {
          // Process final blocks
          finalProcessedBlocks = this._process(!!"flush");

          // Unpad data
          padding.unpad(finalProcessedBlocks);
        }

        return finalProcessedBlocks;
      },

      blockSize: 128 / 32,
    }));
    var CipherParams = (C_lib.CipherParams = Base.extend({
      init: function (cipherParams) {
        this.mixIn(cipherParams);
      },

      toString: function (formatter) {
        return (formatter || this.formatter).stringify(this);
      },
    }));

    /**
     * Format namespace.
     */
    var C_format = (C.format = {});

    /**
     * OpenSSL formatting strategy.
     */
    var OpenSSLFormatter = (C_format.OpenSSL = {
      stringify: function (cipherParams) {
        var wordArray;

        // Shortcuts
        var ciphertext = cipherParams.ciphertext;
        var salt = cipherParams.salt;

        // Format
        if (salt) {
          wordArray = WordArray.create([0x53616c74, 0x65645f5f])
            .concat(salt)
            .concat(ciphertext);
        } else {
          wordArray = ciphertext;
        }

        return wordArray.toString(Base64);
      },

      parse: function (openSSLStr) {
        var salt;

        // Parse base64
        var ciphertext = Base64.parse(openSSLStr);

        // Shortcut
        var ciphertextWords = ciphertext.words;

        // Test for salt
        if (
          ciphertextWords[0] == 0x53616c74 &&
          ciphertextWords[1] == 0x65645f5f
        ) {
          // Extract salt
          salt = WordArray.create(ciphertextWords.slice(2, 4));

          // Remove salt from ciphertext
          ciphertextWords.splice(0, 4);
          ciphertext.sigBytes -= 16;
        }

        return CipherParams.create({ ciphertext: ciphertext, salt: salt });
      },
    });

    /**
     * A cipher wrapper that returns ciphertext as a serializable cipher params object.
     */
    var SerializableCipher = (C_lib.SerializableCipher = Base.extend({
      /**
       * Configuration options.
       *
       * @property {Formatter} format The formatting strategy to convert cipher param objects to and from a string. Default: OpenSSL
       */
      cfg: Base.extend({
        format: OpenSSLFormatter,
      }),

      encrypt: function (cipher, message, key, cfg) {
        // Apply config defaults
        cfg = this.cfg.extend(cfg);

        // Encrypt
        var encryptor = cipher.createEncryptor(key, cfg);
        var ciphertext = encryptor.finalize(message);

        // Shortcut
        var cipherCfg = encryptor.cfg;

        // Create and return serializable cipher params
        return CipherParams.create({
          ciphertext: ciphertext,
          key: key,
          iv: cipherCfg.iv,
          algorithm: cipher,
          mode: cipherCfg.mode,
          padding: cipherCfg.padding,
          blockSize: cipher.blockSize,
          formatter: cfg.format,
        });
      },

      decrypt: function (cipher, ciphertext, key, cfg) {
        // Apply config defaults
        cfg = this.cfg.extend(cfg);

        // Convert string to CipherParams
        ciphertext = this._parse(ciphertext, cfg.format);

        // Decrypt
        var plaintext = cipher
          .createDecryptor(key, cfg)
          .finalize(ciphertext.ciphertext);

        return plaintext;
      },

      _parse: function (ciphertext, format) {
        if (typeof ciphertext == "string") {
          return format.parse(ciphertext, this);
        } else {
          return ciphertext;
        }
      },
    }));

    /**
     * Key derivation function namespace.
     */
    var C_kdf = (C.kdf = {});

    /**
     * OpenSSL key derivation function.
     */
    var OpenSSLKdf = (C_kdf.OpenSSL = {
      execute: function (password, keySize, ivSize, salt, hasher) {
        // Generate random salt
        if (!salt) {
          salt = WordArray.random(64 / 8);
        }

        // Derive key and IV
        if (!hasher) {
          var key = EvpKDF.create({ keySize: keySize + ivSize }).compute(
            password,
            salt
          );
        } else {
          var key = EvpKDF.create({
            keySize: keySize + ivSize,
            hasher: hasher,
          }).compute(password, salt);
        }

        // Separate key and IV
        var iv = WordArray.create(key.words.slice(keySize), ivSize * 4);
        key.sigBytes = keySize * 4;

        // Return params
        return CipherParams.create({ key: key, iv: iv, salt: salt });
      },
    });

    var PasswordBasedCipher = (C_lib.PasswordBasedCipher =
      SerializableCipher.extend({
        cfg: SerializableCipher.cfg.extend({
          kdf: OpenSSLKdf,
        }),

        encrypt: function (cipher, message, password, cfg) {
          // Apply config defaults
          cfg = this.cfg.extend(cfg);

          // Derive key and other params
          var derivedParams = cfg.kdf.execute(
            password,
            cipher.keySize,
            cipher.ivSize,
            cfg.salt,
            cfg.hasher
          );

          // Add IV to config
          cfg.iv = derivedParams.iv;

          // Encrypt
          var ciphertext = SerializableCipher.encrypt.call(
            this,
            cipher,
            message,
            derivedParams.key,
            cfg
          );

          // Mix in derived params
          ciphertext.mixIn(derivedParams);

          return ciphertext;
        },

        decrypt: function (cipher, ciphertext, password, cfg) {
          // Apply config defaults
          cfg = this.cfg.extend(cfg);

          // Convert string to CipherParams
          ciphertext = this._parse(ciphertext, cfg.format);

          // Derive key and other params
          var derivedParams = cfg.kdf.execute(
            password,
            cipher.keySize,
            cipher.ivSize,
            ciphertext.salt,
            cfg.hasher
          );

          // Add IV to config
          cfg.iv = derivedParams.iv;

          // Decrypt
          var plaintext = SerializableCipher.decrypt.call(
            this,
            cipher,
            ciphertext,
            derivedParams.key,
            cfg
          );

          return plaintext;
        },
      }));
  })();
