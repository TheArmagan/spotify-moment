const express = require('express');
const app = express();
const port = 6282;
app.listen(port, () => { console.log(`EXPRESS IS READY! *:${port}`) });
const SpotifyWebApi = require('spotify-web-api-node');
const fs = require('fs');
const Jimp = require('Jimp');

const clientId = "85141f2dc2954c9a84de93ab57f3865f";
const clientSecret = "129fedf54dfd40d6b432a89407cf09de";
const redirectUri = "http://127.0.0.1:6282/auth/callback";
const requiredScopes = ["user-read-currently-playing", "user-read-recently-played", "user-read-playback-state", "user-modify-playback-state", "user-read-currently-playing"];
const authUrl = encodeURI(`https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${requiredScopes.join(" ")}`)

let authCode = "";
let lastTokenRefreshed = -1;
let spotify = new SpotifyWebApi({
  clientId,
  clientSecret,
  redirectUri
});

if (!fs.existsSync(__dirname + "/state")) {
  fs.mkdirSync(__dirname + "/state");
}

/** @type {SpotifyApi.CurrentPlaybackResponse}*/
let playbackState = {};

app.use(express.static(__dirname + "/public"));
app.use("/state", express.static(__dirname + "/state"));

app.get("/", (req, res) => {
  res.send(req.query.message || "please login");
});

app.get("/state", (req, res) => {
  res.send(playbackState);
})

app.get("/auth", (req, res) => {
  if (authCode) return res.send("already logged in!");
  res.redirect(authUrl);
});

app.get("/auth/callback", (req, res) => {
  if (authCode) return res.send("already logged in!");
  res.redirect("/");
  authCode = req.query.code;
  doEverythingElse()
})

let isLoaded = false;

async function doEverythingElse() {
  if (isLoaded) return;
  isLoaded = true;

  let authResponse = await spotify.authorizationCodeGrant(authCode);

  spotify.setAccessToken(authResponse.body.access_token);
  spotify.setRefreshToken(authResponse.body.refresh_token);

  accessToken = authResponse.body.access_token;
  lastTokenRefreshed = Date.now();

  console.log(authResponse.body);

  setInterval(async () => {
    const newState = (await spotify.getMyCurrentPlaybackState()).body;
    playbackState = newState;
    onStateChange(newState);
  }, 100);

}

let currentSongId = "";
let currentAlbumId = "";

let templateFileNames = fs.readdirSync(__dirname + "/state").filter(i => i.startsWith("template_") && i.endsWith(".txt"));

const keywords = [
  ["track-name", "$.item.name"],
  ["track-id", "$.item.id"],
  ["album-name", "$.item.album.name"],
  ["album-type", "$.item.album.album_type"],
  ["album-size", "$.item.album.total_tracks"],
  ["album-release-date", "$.item.album.release_date"],
  ["track-artist-names", "$.item.artists.map(i=>i.name).join(', ')"],
  ["is-track-explicit", "$.item.explicit"],
  ["album-artist-names", "$.item.album.artists.map(i=>i.name).join(', ')"],
  ["track-duration-ms", "$.item.duration_ms"],
]

// `[track-title] - [track-artist-names]`.replace(/\[([a-zA-Z-]+)\]/gm, (_, keyWord) => {
//   return `${keyWord}__`
// })
// TODO: Implement keyword parsing system (probably gonna use safe eval for parsing)

/**
 * 
 * @param {SpotifyApi.CurrentPlaybackResponse} state 
 */
async function onStateChange(state) {
  if (currentSongId != state.item.id) {
    currentSongId = state.item.id;

    templateFileNames.forEach((fileName) => {
      content = fs.promises.readFile
    })

  }

  if (currentAlbumId != state.item.album.id) {
    currentAlbumId = state.item.album.id;
    let img = await Jimp.read(state.item.album.images[0].url);
    await img.writeAsync(__dirname + "/state/artwork.jpg");
    img = 0;
  }
}


let currentlyRefreshing = false;
setInterval(async () => {
  if (lastTokenRefreshed != -1 && Date.now() - lastTokenRefreshed > 30 * 1000 * 60 && !currentlyRefreshing) {
    console.log("refreshing the token yay!");
    currentlyRefreshing = true;
    let refreshResponse = await spotify.refreshAccessToken();
    spotify.setAccessToken(refreshResponse.body.access_token);
    spotify.setRefreshToken(refreshResponse.body.refresh_token);
    console.log("auth token refreshed!");
    lastTokenRefreshed = Date.now();
    currentlyRefreshing = false;
  }
}, 1000);
