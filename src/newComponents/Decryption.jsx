import React, { useState } from "react";
import CopyIcon from "@mui/icons-material/FileCopy";
import {
  Box,
  Stack,
  TextField,
  Button,
  Typography,
  IconButton,
} from "@mui/material";
import CryptoJS from "crypto-js";

export default function Decryption() {
  const [ciphertext, setCiphertext] = useState("");
  const [key, setKey] = useState("");
  const [decryptedText, setDecryptedText] = useState("");
  const [showKeyLengthPopup, setShowKeyLengthPopup] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  const handleCiphertextChange = (event) => {
    setCiphertext(event.target.value);
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

  const handleDecryptClick = () => {
    const keySize = 128;
    const keyBytes = CryptoJS.enc.Utf8.parse(key);
    const decrypted = CryptoJS.AES.decrypt(ciphertext, keyBytes, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
      keySize: keySize / 8,
    }).toString(CryptoJS.enc.Utf8);
    setDecryptedText(decrypted);
  };

  const handleCopyClick = () => {
    navigator.clipboard.writeText(decryptedText);
    setShowCopySuccess(true);
  };

  const handleClearClick = () => {
    setDecryptedText("");
    setKey("");
    setCiphertext("");
    setShowCopySuccess(false);
  };

  return (
    <Box m="auto">
      <Stack gap={2} alignItems="left">
        <TextField
          label="Ciphertext"
          value={ciphertext}
          onChange={handleCiphertextChange}
          variant="outlined"
          margin="normal"
        />
        <TextField
          label="Key"
          value={key}
          onChange={handleKeyChange}
          error={showKeyLengthPopup}
          helperText={showKeyLengthPopup ? "Key must be 16 characters" : ""}
          variant="outlined"
          margin="normal"
        />

        <Button
          sx={{
            m: "auto",
            width: "70%",
            borderRadius: "20px",
            fontSize: "1.2rem",
          }}
          variant="contained"
          onClick={handleDecryptClick}
        >
          Decrypt
        </Button>
        <Typography variant="h5" sx={{ fontWeight: "bold" }}>
          Decrypted Text:
        </Typography>
        <TextField
          label="Plaintext"
          value={decryptedText}
          variant="outlined"
          margin="normal"
          disabled
          multiline
          rows={4}
        />
        {decryptedText && (
          <Box display="flex" alignItems="center">
            <Typography variant="body1" mr={1}>
              Click the button to copy ciphertext:
            </Typography>
            <IconButton onClick={handleCopyClick} color="primary">
              <CopyIcon />
            </IconButton>
            {showCopySuccess && (
              <Typography variant="body2" color="primary">
                Copied to clipboard!
              </Typography>
            )}
          </Box>
        )}
      </Stack>

      <Stack my={3} alignItems="center" sx={{ width: "100%" }}>
        <Button
          variant="outlined"
          onClick={handleClearClick}
          sx={{ width: "25%" }}
        >
          Clear
        </Button>
      </Stack>
    </Box>
  );
}
