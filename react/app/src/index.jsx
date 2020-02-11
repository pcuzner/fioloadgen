/* import 'dotenv/config'; */
import React from 'react';
import './app.scss';
import ReactDOM from 'react-dom';
import App from './components/main.jsx';

ReactDOM.render(
  <App />,
  document.getElementById('app')
);
console.log("hello from testapp with access to env vars");

