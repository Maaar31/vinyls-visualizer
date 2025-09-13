require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

// Servir les fichiers statiques (votre front-end)
app.use(express.static(path.join(__dirname)));

function generateRandomString(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

app.get('/login', (req, res) => {
  const state = generateRandomString(16);
  const scope = 'user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-private';

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope,
    redirect_uri: process.env.REDIRECT_URI,
    state
  });

  res.redirect('https://accounts.spotify.com/authorize?' + params.toString());
});

app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  const error = req.query.error || null;

  if (error) {
    console.error('Callback error:', error);
    return res.redirect('/?error=' + encodeURIComponent(error));
  }

  if (!code) return res.redirect('/?error=missing_code');

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.REDIRECT_URI
      })
    });

    const tokenJson = await tokenRes.json();

    // Pour ce demo nous redirigeons vers la page d'accueil et plaçons les tokens dans le fragment
    // Ceci évite d'exposer tokens dans les logs du serveur, mais n'est pas le plus sécurisé pour une production
    const fragment = new URLSearchParams({
      access_token: tokenJson.access_token || '',
      refresh_token: tokenJson.refresh_token || '',
      expires_in: tokenJson.expires_in || ''
    }).toString();

    res.redirect('/#' + fragment);
  } catch (e) {
    console.error('Token exchange failed', e);
    res.redirect('/?error=token_error');
  }
});

// Endpoint pour rafraîchir le token avec le refresh_token
app.get('/refresh_token', async (req, res) => {
  const refresh_token = req.query.refresh_token;
  if (!refresh_token) return res.status(400).json({ error: 'missing_refresh_token' });

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token
      })
    });

    const tokenJson = await tokenRes.json();
    res.json(tokenJson);
  } catch (e) {
    console.error('Refresh failed', e);
    res.status(500).json({ error: 'refresh_failed' });
  }
});

app.listen(PORT, () => console.log(`Auth proxy listening on http://localhost:${PORT}`));
