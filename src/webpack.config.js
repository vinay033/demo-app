const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");

module.exports = {
  // ...
  plugins: [
    new ModuleFederationPlugin({
      name: "root",
      remotes: {
        subapp1: "subapp1@http://localhost:4201/remoteEntry.js",
        subapp2: "subapp2@http://localhost:4202/remoteEntry.js",
      },
    }),
  ],
};
