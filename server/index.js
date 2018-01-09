// npm packages
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const morgan = require('morgan');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;

const db = require('../db');

/*
This block below allows both express-http requests &
socket.io socket connections to be simultaneously served:
*/
const app = express();

const http = require('http').Server(app);
const io = require('socket.io')(http);
const socket = require('./sockets');

socket(io);

const DIST_DIR = path.join(__dirname, '../dist');
const CLIENT_DIR = path.join(__dirname, '../src/');

const CLIENT_SECRET = global.CLIENT_SECRET ? global.CLIENT_SECRET : require('./secrets/secrets.js'); // eslint-disable-line

const port = process.env.PORT || 3000;
const APP_DOMAIN = process.env.DOMAIN || `http://localhost:${port}`;

const sessionOptions = {
  saveUninitialized: false,
  resave: false,
  // store: sessionStore,
  secret: 'Was zum Teufel!',
};

app.use(express.static(DIST_DIR));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session(sessionOptions));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  console.log('user from serialization: ', user);
  done(null, user.facebook_id);
});

passport.deserializeUser((facebookId, done) => {
  console.log('user from deserialization: ', facebookId);
  db.getUserByFacebookId(facebookId)
    .then((foundUser) => {
      console.log('res deserialization: ', foundUser);
      done(null, foundUser);
    })
    .catch((e) => {
      console.error('Error deserializing user!: ', e);
    });
});

passport.use(new FacebookStrategy({
  clientID: '158163551574274',
  clientSecret: CLIENT_SECRET,
  callbackURL: `${APP_DOMAIN}/auth/facebook/callback`,
  profileFields: ['first_name', 'last_name', 'email', 'picture.type(large)'],
  enableProof: true,
}, (accessToken, refreshToken, profile, done) => {
  console.log('new profile!: ', profile);
  const facebookId = profile.id;
  const { familyName: lastName, givenName: firstName } = profile.name;
  const email = profile.emails[0].value;
  const pictureUrl = profile.photos[0].value;
  const userInfo = {
    firstName,
    lastName,
    email,
    facebookId,
    pictureUrl,
  };
  db.findOrCreateUser(userInfo)
    .then((result) => {
      done(null, result);
    });
}));

/* --------- GET Handlers ---------- */

app.get('*', (req, res, next) => {
  console.log('req.user: ', req.user);
  console.log('req.session: ', req.session);
  next();
});

app.get('/src/styles/styles.css', (req, res) => {
  res.sendFile(path.join(CLIENT_DIR, 'styles/styles.css'));
});

app.get('/src/styles/leaflet.css', (req, res) => {
  res.sendFile(path.join(CLIENT_DIR, 'styles/leaflet.css'));
});

app.get('/auth/facebook', passport.authenticate(
  'facebook',
  {
    authType: 'rerequest',
    scope: ['email', 'public_profile'],
  },
));

app.get('/auth/facebook/callback', passport.authenticate(
  'facebook',
  { failureRedirect: '/login' },
), (req, res) => { res.redirect('/'); });

app.get('/hahah', (req, res) => {
  res.send('bahahaha').end('hahaha');
});

app.get('/login', (req, res) => {
  res.send('lol wrong').end('lolol wrong');
});

/* --------- API Routes ---------- */

app.get('/api/leaderboard', (req, res) => {
  const leaders = [
    {
      name: 'Bob',
      score: 1,
    }, {
      name: 'Bobby',
      score: 2,
    }, {
      name: 'Rob',
      score: 10,
    }, {
      name: 'Robert',
      score: 12,
    }, {
      name: 'Bobbina',
      score: 14,
    }, {
      name: 'Bobber',
      score: 119,
    }, {
      name: 'Billy Bob',
      score: 205,
    }, {
      name: 'Bob the Builder',
      score: 1000,
    },
  ].sort((a, b) => b.score - a.score);
  const stringifiedLeaders = JSON.stringify(leaders);
  res.send(stringifiedLeaders).status(201).end();
});

app.get('/api/getUserInfo', (req, res) => {
  const { id } = req.body;
  db.getUserInfo(id)
    .then((user) => { res.send(user); })
    .catch((e) => { console.error(e); });
});

app.get('/api/getAllUsers', (req, res) => {
  db.getAllUsers()
    .then((users) => { res.send(users); })
    .catch((e) => { console.error(e); });
});


/* --------- POST Handlers ---------- */


// Default route fallback (allows React Router to handle all other routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});


http.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
