const express = require("express");
const fs = require("fs");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3001;
const redirectUri = `${process.env.BASE_URL}${process.env.REDIRECT_PATH}`;

const filePath = path.join(__dirname, "data", "token.json");

if (!fs.existsSync(path.dirname(filePath))) {
  fs.mkdirSync(path.dirname(filePath));
}

const readData = () => {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const data = fs.readFileSync(filePath, "utf8");
  return JSON.parse(data);
};

const writeData = (data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

function saveData(userId, longLivedToken, expiresIn, res) {
  if (!userId || !longLivedToken) {
    return res.status(400).send("Client ID and token are required!");
  }
  const data = readData();
  const index = data.findIndex((item) => item.userId === userId);
  if (index != -1) {
    data[index].longLivedToken = longLivedToken;
    data[index].expiresIn = expiresIn;
  } else {
    data.push({ userId, longLivedToken, expiresIn });
  }

  writeData(data);
  res.send("Data saved");
}

app.use(function (req, res, next) {
  // Website you wish to allow to connect
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Request methods you wish to allow
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );

  // Request headers you wish to allow
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type"
  );

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader("Access-Control-Allow-Credentials", true);

  // Pass to next layer of middleware
  next();
});

app.get("/auth", (req, res) => {
  let { id } = req.query;
  const state = encodeURIComponent(JSON.stringify({ userId: id }));
  const instagramAuthUrl = `https://api.instagram.com/oauth/authorize?client_id=${process.env.INSTAGRAM_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user_profile,user_media&response_type=code&state=${state}`;
  res.redirect(instagramAuthUrl);
});

app.get("/auth/callback", async (req, res) => {
  const { code, state } = req.query;
  let userId = JSON.parse(state).userId;

  try {
    // Exchange code for a short-lived access token
    const tokenResponse = await axios.post(
      "https://api.instagram.com/oauth/access_token",
      {
        client_id: process.env.INSTAGRAM_CLIENT_ID,
        client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

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

    const { access_token: longLivedToken, expires_in } =
      longLivedTokenResponse.data;

    const expiresIn = new Date();
    expiresIn.setSeconds(expiresIn.getSeconds() + expires_in);

    saveData(userId, longLivedToken, expiresIn.getTime(), res);
    // res.json({ user_id, longLivedToken });
    // res.redirect(`${process.env.WEB_APP_URL}?token=${longLivedToken}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/token/:id", (req, res) => {
  const { id } = req.params;
  const data = readData();
  const entry = data.find((item) => item.userId === id);
  if (!entry) {
    return res.status(404).send("ID does not exists!");
  }
  res.json({
    token: entry.longLivedToken,
    expiresIn: entry.expiresIn,
    userId: entry.userId,
  });
});

//endpoint for refreshing token
app.get("/refreshtoken", async (req, res) => {
  const { userId } = req.query;
  const data = readData();
  const entry = data.find((item) => item.userId === userId);
  if (!entry) {
    return res.status(404).send("ID does not exists!");
  }
  try {
    const refreshedTokenResponse = await axios.get(
      `https://graph.instagram.com/refresh_access_token`,
      {
        params: {
          grant_type: "ig_refresh_token",
          access_token: entry.longLivedToken,
        },
      }
    );
    const { access_token: refreshToken, expires_in } =
      refreshedTokenResponse.data;

    const expiresIn = new Date();
    expiresIn.setSeconds(expiresIn.getSeconds() + expires_in);

    saveData(userId, refreshToken, expiresIn.getTime(), res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
