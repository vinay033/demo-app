const path = require('path');
module.exports = require('./scripts/karma.base')({
  coverageDir: path.join(__dirname, './coverage/demo-app')
});
