const axios = require('axios');
const { generateToken } = require('./apps/auth-service/src/utils/token.utils'); // wait, I can just use any valid token or skip it? No, need a valid token.
