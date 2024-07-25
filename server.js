const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;
const redirectUri = `${process.env.BASE_URL}${process.env.REDIRECT_PATH}`;

console.log(redirectUri);
app.get("/auth", (req, res) => {
  console.log("uslo u auth");
  const instagramAuthUrl = `https://api.instagram.com/oauth/authorize?client_id=${process.env.INSTAGRAM_CLIENT_ID}&redirect_uri=https://ig-auth.onrender.com/auth/callback&scope=user_profile,user_media&response_type=code&state=1`;
  res.redirect(instagramAuthUrl);
});

app.get("/auth/callback", async (req, res) => {
  console.log("uslo u callback");
  const { code } = req.query;
  console.log(code);
  try {
    // Exchange code for a short-lived access token
    console.log("uslo u try");
    const tokenResponse = await axios.post(
      "https://api.instagram.com/oauth/access_token",
      {
        client_id: process.env.INSTAGRAM_CLIENT_ID,
        client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
        grant_type: "authorization_code",
        redirect_uri: "https://ig-auth.onrender.com/auth/callback",
        code,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    console.log(tokenResponse);

    const { access_token } = tokenResponse.data;
    // Exchange short-lived access token for a long-lived token
    const longLivedTokenResponse = await axios.get(
      `https://graph.instagram.com/access_token`,
      {
        params: {
          grant_type: "ig_exchange_token",
          client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
          access_token,
        },
      }
    );

    const { access_token: longLivedToken } = longLivedTokenResponse.data;
    // Store the long-lived token and use it for further requests
    // Here, we're just sending it as a response for demonstration purposes
    res.json({ longLivedToken });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
