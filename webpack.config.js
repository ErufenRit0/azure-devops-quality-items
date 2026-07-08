const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: {
    "form-group/quality-item-panel": "./src/form-group/quality-item-panel.ts",
    "hub/quality-items-hub": "./src/hub/quality-items-hub.ts",
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: "src/form-group/quality-item-panel.html", to: "form-group/quality-item-panel.html" },
        { from: "src/hub/quality-items-hub.html", to: "hub/quality-items-hub.html" },
      ],
    }),
  ],
  devtool: "source-map",
};
