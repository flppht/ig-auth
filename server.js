const express = require("express");
const fs = require("fs");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3001;
const redirectUri = `${process.env.BASE_URL}${process.env.REDIRECT_PATH}`;
let widgetClientId;

const filePath = "./data/token.json";

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

app.get("/auth", (req, res) => {
  let { id } = req.query;
  widgetClientId = id;
  const instagramAuthUrl = `https://api.instagram.com/oauth/authorize?client_id=${process.env.INSTAGRAM_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user_profile,user_media&response_type=code&state=1`;
  res.redirect(instagramAuthUrl);
});

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
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

    const { access_token, user_id } = tokenResponse.data;
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

    saveData(widgetClientId, longLivedToken, res);
    // res.json({ user_id, longLivedToken });
    // res.redirect(`${process.env.WEB_APP_URL}?token=${longLivedToken}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/token/:id", (req, res) => {
  const { id } = req.params;
  const data = readData();
  const entry = data.find((item) => item.widgetClientId === id);
  if (!entry) {
    return res.status(404).send("ID does not exists!");
  }
  res.json({ token: entry.longLivedToken });
});

function saveData(widgetClientId, longLivedToken, res) {
  if (!widgetClientId || !longLivedToken) {
    return res.status(400).send("Client ID and token are required!");
  }
  const data = readData();
  const index = data.findIndex(
    (item) => item.widgetClientId === widgetClientId
  );
  if (index != -1) {
    data[index].longLivedToken = longLivedToken;
  } else {
    data.push({ widgetClientId, longLivedToken });
  }

  writeData(data);
  res.send("Data saved");
}
//endpoint for refreshing token
// app.get("/auth/refreshtoken", async (req, res) => {
//   const { user_id, access_token } = req.query;
//   try {
//     const refreshedTokenResponse = await axios.get(
//       `https://graph.instagram.com/refresh_access_token`,
//       {
//         params: {
//           grant_type: "ig_refresh_token",
//           access_token,
//         },
//       }
//     );
//     const { access_token: refresh_access_token } = refreshedTokenResponse.data;

//     res.json({ user_id, refresh_access_token });
//   } catch (error) {}
// });

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
