// Shared Karma configuration factory used by all projects in this workspace.
// Each project's karma.conf.js calls this with its own coverageDir.
//
// Usage:
//   module.exports = require('../../scripts/karma.base')({
//     coverageDir: require('path').join(__dirname, '../../coverage/my-project')
//   });

'use strict';

const path = require('path');

/**
 * @param {{ coverageDir: string }} options
 * @returns {function} Karma config function
 */
module.exports = function makeKarmaConfig({ coverageDir }) {
  return function (config) {
    config.set({
      basePath: '',
      frameworks: ['jasmine', '@angular-devkit/build-angular'],
      plugins: [
        require('karma-jasmine'),
        require('karma-chrome-launcher'),
        require('karma-jasmine-html-reporter'),
        require('karma-coverage'),
        require('@angular-devkit/build-angular/plugins/karma')
      ],
      client: {
        jasmine: {
          // Configuration options: https://jasmine.github.io/api/edge/Configuration.html
          // e.g. disable random execution: random: false
          // or set a seed:                seed: 4321
        },
        clearContext: false // leave Jasmine Spec Runner output visible in browser
      },
      jasmineHtmlReporter: {
        suppressAll: true // removes duplicated traces
      },
      coverageReporter: {
        dir: coverageDir,
        subdir: '.',
        reporters: [
          { type: 'html' },
          { type: 'text-summary' },
          { type: 'lcov' }
        ]
      },
      reporters: ['progress', 'kjhtml'],
      port: 9876,
      colors: true,
      logLevel: config.LOG_INFO,
      autoWatch: true,
      browsers: ['Chrome'],
      customLaunchers: {
        ChromeHeadlessCI: {
          base: 'ChromeHeadless',
          flags: ['--no-sandbox', '--disable-gpu']
        }
      },
      singleRun: false,
      restartOnFileChange: true
    });
  };
};
