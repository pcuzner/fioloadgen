/*const copy = require("copy-webpack-plugin");
const extract = require("extract-text-webpack-plugin"); */

const webpack = require('webpack'); 
const dotenv = require('dotenv');
const path = require('path');

const MiniCssExtractPlugin = require('mini-css-extract-plugin')
/* const isDevelopment = process.env.NODE_ENV === 'development' */

module.exports = () => {
  // 1
  const env = dotenv.config().parsed;
  // const envKeys = Object.keys(env).reduce((prev, next) => {
  //   console.log(next + " = " + env[next]);
  //   prev[`process.env.${next}`] = JSON.stringify(env[next]);
  //   return prev;
  // }, {});

  return {
    entry: './src/index.jsx',
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: ['babel-loader']
        },
        {
          test: /\.(es6)$/,
          exclude: /node_modules/,
          use: ['babel-loader']
        },
        {
          test: /\.scss$/,
          use: [
            "style-loader",
            MiniCssExtractPlugin.loader,
            "css-loader",
            "sass-loader"
          ]
         },
      ]
    },
    resolve: {
      extensions: ['*', '.js', '.jsx', '*.scss']
    },
    // 2
    output: {
      path: __dirname + '/dist',
      publicPath: '/',
      filename: 'bundle.js'
    },
    devServer: {
	    static: {
		    directory: path.join(__dirname, 'dist'),
	    }
    },
    // 3
    //devServer: {
    //  contentBase: './dist'
    //},
    plugins: [ 
      new MiniCssExtractPlugin({
        filename: "css/style.css"
      }),
      // new webpack.DefinePlugin(envKeys),
      // new webpack.EnvironmentPlugin(['API_URL', 'port']),
      new webpack.DefinePlugin({
        "process.env": JSON.stringify(env)
      }),
    ]
  }
  
};

/*

    new webpack.EnvironmentPlugin(['API_URL']),
  plugins: [
    new MiniCssExtractPlugin({
      filename: isDevelopment ? '[name].css' : 'css/[name].css',
      chunkFilename: isDevelopment ? '[id].css' : '[id].css'
    })
  ]
*/

