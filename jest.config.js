const isCI = require("is-ci");

/** @type {Partial<import("@jest/types").Config.DefaultOptions>} */
module.exports = {
  preset: 'ts-jest',
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  testEnvironment: 'node',
  testRunner: "jest-circus/runner",
  "testMatch": [
    "**/test/**/*.+(test)\.ts",
  ],
  globals: {
    "ts-jest": {
        tsconfig: "<rootDir>/test/test.tsconfig.json",
        diagnostics: { warnOnly: !isCI },
    },
  },
};    
