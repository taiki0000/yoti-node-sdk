require('dotenv').config();
const express = require('express');
const https = require('https');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const YotiClient = require('yoti');

const app = express();
const port = process.env.PORT || 9443;

// The application ID and .pem file are generated by https://www.yoti.com/dashboard when you create your app
// The client SDK ID is generated by https://www.yoti.com/dashboard when you publish your app
const config = {
  APPLICATION_ID: process.env.YOTI_APPLICATION_ID, // Your Yoti Application ID
  CLIENT_SDK_ID: process.env.YOTI_CLIENT_SDK_ID, // Your Yoti Client SDK ID
  PEM_KEY: fs.readFileSync(process.env.YOTI_KEY_FILE_PATH), // The content of your Yoti .pem key
};

function saveImage(selfieDate) {
  return new Promise((res, rej) => {
    try {
      const base64Data = selfieDate.replace(/^data:image\/jpeg;base64,/, '');

      fs.writeFileSync(
        path.join(__dirname, 'static', 'YotiSelfie.jpeg'),
        base64Data,
        'base64',
      );
      res();
    } catch (error) {
      rej(error);
    }
  });
}
const yoti = new YotiClient(config.CLIENT_SDK_ID, config.PEM_KEY);

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/static', express.static('static'));

const router = express.Router();

router.get('/', (req, res) => {
  res.render('pages/index', {
    yotiApplicationId: config.APPLICATION_ID,
  });
});

router.get('/profile', (req, res) => {
  const { token } = req.query;
  if (!token) {
    res.render('pages/error', {
      error: 'No token has been provided.',
    });
    return;
  }

  const promise = yoti.getActivityDetails(token);
  promise.then((activityDetails) => {
    const profile = activityDetails.getUserProfile();
    const { selfie } = profile;

    if (typeof selfie !== 'undefined') {
      saveImage(selfie)
        .then(() => {
          res.render('pages/profile', {
            userId: activityDetails.getUserId(),
            // This key uses the  format: age[Over|Under]:[1-999] and is dynamically
            // generated based on the dashboard attribute Age / Verify Condition
            ageVerified: profile['ageOver:18'],
            profile,
          });
        });
    }
  }).catch((err) => {
    console.error(err);
    res.render('pages/error', {
      error: err,
    });
  });
});

app.use('/', router);

// START THE SERVER
// =============================================================================
https.createServer({
  key: fs.readFileSync(path.join(__dirname, 'keys', 'server-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'keys', 'server-cert.pem')),
}, app).listen(port);

console.log(`Server running on https://localhost:${port}`);