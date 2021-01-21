console.log(`[SYSTEM:MAIN] Spotify Moment is starting..`);
process.title = `Spotify Moment | Loading..`;
const express = require('express');
const app = express();
const port = 6282;
const SpotifyWebApi = require('spotify-web-api-node');
const fs = require('fs');
const Jimp = require('Jimp');
const safeEval = require('safe-eval');
const dayjs = require('dayjs');
const dayjs_plugin_duration = require('dayjs/plugin/duration');
dayjs.extend(dayjs_plugin_duration);

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

app.get("/state", (req, res) => {
  res.send(playbackState);
})

app.get("/auth", (req, res) => {
  if (authCode) return res.redirect("/");
  console.log(`[SYSTEM:AUTH] Redirecting to Spotify's auth page..`);
  res.redirect(authUrl);
});

app.get("/auth/state", (req, res) => {
  res.send({ state: !!authCode });
});

app.get("/auth/callback", (req, res) => {
  if (authCode) return res.send("already logged in!");
  console.log(`[SYSTEM:AUTH] Auth callback called!`);
  res.redirect("/");
  authCode = req.query.code;
  doEverythingElse()
})

app.listen(port, () => {
  console.log(`[SYSTEM:MAIN] Spotify Moment is started!`);
  console.log(`[SYSTEM:MAIN] Web server is ready! Listening on port ${port}`);
  console.log(`[SYSTEM:AUTH] Waiting for auth! http://127.0.0.1:${port}/auth`);
  process.title = `Spotify Moment | Waiting for auth..`;
});

let isLoaded = false;

async function doEverythingElse() {
  if (isLoaded) return;
  isLoaded = true;

  console.log(`[SYSTEM:AUTH] Authorization is granting..`);
  let authResponse = await spotify.authorizationCodeGrant(authCode);
  console.log(`[SYSTEM:AUTH] Authorization is granted!`);

  spotify.setAccessToken(authResponse.body.access_token);
  spotify.setRefreshToken(authResponse.body.refresh_token);

  accessToken = authResponse.body.access_token;
  lastTokenRefreshed = Date.now();

  process.title = `Spotify Moment | Waiting for state update..`;
  console.log(`[SYSTEM:MAIN] State updater is started!`);
  setInterval(async () => {
    let newState = {};
    try {
      newState = (await spotify.getMyCurrentPlaybackState()).body;
    } catch (e) { console.log(e) };

    if (newState.hasOwnProperty("is_playing")) {
      playbackState = newState;
    }

    if (newState.hasOwnProperty("item")) {
      onStateChange(playbackState);
    }
  }, 998);

}

let currentSongId = "";
let currentAlbumId = "";

const keywords = [
  ["track-name", "$.item.name"],
  ["track-id", "$.item.id"],
  ["album-name", "$.item.album.name"],
  ["album-type", "$.item.album.album_type"],
  ["album-size", "$.item.album.total_tracks"],
  ["album-release-date", "$.item.album.release_date"],
  ["track-artist-names", "$.item.artists.map(i=>i.name).join(', ')"],
  ["album-artist-names", "$.item.album.artists.map(i=>i.name).join(', ')"],
  ["track-duration-ms", "$.item.duration_ms"],
  ["track-duration-formatted", `dayjs.duration($.item.duration_ms).format('m:s')`],
  ["track-progress-ms", `$.progress_ms`],
  ["track-progress-formatted", `dayjs.duration($.progress_ms).format('m:s')`],
  ["when-playing", "$.is_playing ? keys[1] : keys[2]"],
  ["when-explicit", "$.item.explicit ? keys[1] : keys[2]"],
]

/**
 * @param {String} text 
 * @param {Any} $ 
 * @returns {String}
 */
function parseKeywords(text = "", $ = {}) {
  return text.replace(/\[([^\[\]]+)\]/gm, (_, keyword) => {
    const keys = keyword.split(";");
    let keyData = keywords.find(i => i[0] == keys[0]);
    if (keyData) {
      try {
        return safeEval(keyData[1], { $, dayjs, keyword, keys });
      } catch (e) {
        console.log(require("util").inspect(e, true, 6));
      }
    } else {
      return `[${keyword}]`;
    }
  })
}

console.log(`[SYSTEM:MAIN] Reading template files..`);
let templateFiles = fs.readdirSync(__dirname + "/state")
  .filter(i => i.startsWith("template_") && i.endsWith(".txt"))
  .map(templateFileName => {
    const template = fs.readFileSync(__dirname + "/state/" + templateFileName, "utf-8");
    console.log(`[SYSTEM:MAIN] ${templateFileName} template file is loaded!`);
    const fileName = templateFileName.slice(9).replace("cwp_", "");
    const clearWhenPaused = templateFileName.includes("cwp_")
    return { template, fileName, clearWhenPaused }
  });

let _lastDurationStateUpdate = Date.now();
let lastPlayingState = false;

/**
 * 
 * @param {SpotifyApi.CurrentPlaybackResponse} $ 
 */
async function onStateChange($) {
  if (!$.hasOwnProperty("item")) return;

  process.title = `Spotify Moment | ${dayjs.duration($?.progress_ms).format('mm:ss')}/${dayjs.duration($?.item?.duration_ms).format('mm:ss')} | ${$?.is_playing ? `${$?.item?.name} - ${$?.item?.artists?.map(i => i?.name).join(', ')}` : "Paused"}`;

  if (currentSongId != $.item.id) {
    currentSongId = $.item.id;
    console.log(`[SYSTEM:STATE] Song changed! (${$.item.id})`);
    templateFiles.forEach(async (d) => {
      const parsed = parseKeywords(d.template, $);
      fs.promises.writeFile(__dirname + "/state/" + d.fileName, parsed, "utf-8");
    })
  }

  if (currentAlbumId != $?.item?.album?.id) {
    currentAlbumId = $.item.album.id;
    Jimp.read($.item.album.images[0].url).then(async img => {
      await img.writeAsync(__dirname + "/state/artwork.png");
      await img.writeAsync(__dirname + "/state/artwork_cwp.png");
      img = 0;
    })
    console.log(`[SYSTEM:STATE] Artwork changed! (${$.item.album.id})`);
  }

  if (Date.now() - _lastDurationStateUpdate > 1000) {
    templateFiles.forEach(async (d) => {
      const parsed = parseKeywords(d.template, $);
      fs.promises.writeFile(__dirname + "/state/" + d.fileName, parsed, "utf-8");
    })
    _lastDurationStateUpdate = Date.now();
  }


  if (lastPlayingState != $.is_playing) {
    console.log(`[SYSTEM:STATE] Playing state changed! (${$.is_playing})`);
    lastPlayingState = $.is_playing;
    templateFiles.filter(i => i.clearWhenPaused).forEach(async (d) => {
      fs.promises.writeFile(__dirname + "/state/" + d.fileName, "", "utf-8");
    });
    if ($.is_playing) {
      Jimp.read($.item.album.images[0].url).then(async img => {
        await img.writeAsync(__dirname + "/state/artwork_cwp.png");
        img = 0;
      })
    } else {
      Jimp.create(640, 640, Jimp.rgbaToInt(0, 0, 0, 0)).then(async img => {
        await img.writeAsync(__dirname + "/state/artwork_cwp.png");
        img = 0;
      })
    }

  }

}


let currentlyRefreshing = false;
setInterval(async () => {
  if (lastTokenRefreshed != -1 && Date.now() - lastTokenRefreshed > 15 * 1000 * 60 && !currentlyRefreshing) {
    console.log(`[SYSTEM:AUTH] Refreshing auth token..`);
    currentlyRefreshing = true;
    let refreshResponse = await spotify.refreshAccessToken();
    spotify.setAccessToken(refreshResponse.body.access_token);
    console.log(`[SYSTEM:AUTH] Auth token refreshed!`);
    lastTokenRefreshed = Date.now();
    currentlyRefreshing = false;
  }
}, 1000);
