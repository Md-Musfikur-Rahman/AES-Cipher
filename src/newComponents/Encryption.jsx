import React, { useState } from "react";
import CopyIcon from "@mui/icons-material/FileCopy";
import { Box, Stack, TextField, Button, Typography, IconButton } from "@mui/material";
import CryptoJS from "crypto-js";

export default function Encryption() {
  const [plaintext, setPlaintext] = useState("");
  const [key, setKey] = useState("");
  const [ciphertext, setCiphertext] = useState("");
  const [showKeyLengthPopup, setShowKeyLengthPopup] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  const handlePlaintextChange = (event) => {
    setPlaintext(event.target.value);
  };

  const handleKeyChange = (event) => {
    const enteredKey = event.target.value;
    setKey(enteredKey);

    if (enteredKey.length !== 16) {
      setShowKeyLengthPopup(true);
    } else {
      setShowKeyLengthPopup(false);
    }
  };

  const handleEncryptClick = () => {
    const keySize = 128;
    const keyBytes = CryptoJS.enc.Utf8.parse(key);
    const encrypted = CryptoJS.AES.encrypt(plaintext, keyBytes, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
      keySize: keySize / 8,
    }).toString();
    setCiphertext(encrypted);
  };

  const handleCopyClick = () => {
    navigator.clipboard.writeText(ciphertext);
    setShowCopySuccess(true);
  };
  

  const handleClearClick = () => {
    setPlaintext("");
    setKey("");
    setCiphertext("");
    setShowCopySuccess(false);
  };

  return (
    <Box width="50%" m="auto">
      <Stack gap={2} alignItems="left">
        <TextField
          label="Plaintext"
          value={plaintext}
          onChange={handlePlaintextChange}
          variant="outlined"
          margin="normal"
        />
        <TextField
          label="Key"
          value={key}
          onChange={handleKeyChange}
          variant="outlined"
          margin="normal"
        />
          {showKeyLengthPopup && (
          <Typography variant="body2" color="error">
            The key size should be 16 characters long.
          </Typography>
        )}
        <Button
          sx={{
            m: "auto",
            width: "70%",
            borderRadius: "20px",
            fontSize: "1.2rem",
          }}
          variant="contained"
          onClick={handleEncryptClick}
        >
          Encrypt
        </Button>
        <Typography variant="h5" sx={{ fontWeight: "bold" }}>
          Encrypted Text:
        </Typography>
        <Stack direction="row" alignItems="center">
          <TextField
            label="Ciphertext"
            value={ciphertext}
            variant="outlined"
            margin="normal"
            sx={{ fontSize: "1.2rem", flexGrow: 1 }}
          />
          {ciphertext && (
            <IconButton aria-label="copy" onClick={handleCopyClick}>
              <CopyIcon />
            </IconButton>
          )}
        </Stack>
        {showCopySuccess ? (
  <Typography variant="subtitle1" align="center" color="success" p={2}>
    Text copied successfully!
  </Typography>        
): null }

      </Stack>

      <Stack my={3} alignItems="center" sx={{ width: "100%" }}>
        <Button
          variant="outlined"
          onClick={handleClearClick}
          sx={{ width: "70%" }}
        >
          Clear
        </Button>
      </Stack>
    </Box>
  );
}
