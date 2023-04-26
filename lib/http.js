const axios = require('axios');
const url = require('url');
const debug = require('debug')('node-regon');

const VERSION = require('../package.json').version;

/**
 * A class representing the http client
 * @param {Object} [options] Options object. It allows the customization of
 * `axios` module
 *
 * @constructor
 */
function HttpClient(options) {
  this._axios = axios.create(options);
}

/**
 * Build the HTTP request (method, uri, headers, ...)
 * @param {String} rurl The resource url
 * @param {Object|String} data The payload
 * @param {Object} exheaders Extra http headers
 * @param {Object} exoptions Extra options
 * @returns {Object} The http request object for the `axios` module
 */
HttpClient.prototype.buildRequest = function(rurl, data, exheaders, exoptions) {
  const curl = url.parse(rurl);
  const secure = curl.protocol === 'https:';
  const host = curl.hostname;
  const port = parseInt(curl.port, 10);
  const path = [curl.pathname || '/', curl.search || '', curl.hash || ''].join('');
  const method = data ? 'POST' : 'GET';

  const headers = {
    'User-Agent': 'node-regon/' + VERSION,
    'Accept': 'text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
    'Accept-Encoding': 'none',
    'Accept-Charset': 'utf-8',
    'Connection': 'close',
    'Host': host + (isNaN(port) ? '' : ':' + port)
  };

  if (typeof data === 'string') {
    headers['Content-Length'] = Buffer.byteLength(data, 'utf8');
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  exheaders = exheaders || {};
  for (let attr in exheaders) {
    headers[attr] = exheaders[attr];
  }

  const options = {
    url: curl.href,
    method: method,
    headers: headers,
    maxRedirects: 20
  };

  options.data = data;

  exoptions = exoptions || {};
  for (let attr in exoptions) {
    options[attr] = exoptions[attr];
  }

  debug('Http request: %j', options);
  return options;
};

/**
 * Handle the http response
 * @param {Object} The req object
 * @param {Object} res The res object
 * @param {Object} body The http body
 * @param {Object} The parsed body
 */
HttpClient.prototype.handleResponse = function(req, res, body) {
  debug('Http response body: %j', body);
  if (typeof body === 'string') {
    // Remove any extra characters that appear before or after the SOAP
    // envelope.
    const match = body.match(/(?:<\?[^?]*\?>[\s]*)?<([^:]*):Envelope([\S\s]*)<\/\1:Envelope>/i);
    if (match) {
      body = match[0];
    }
  }
  return body;
};

HttpClient.prototype.request = function(rurl, data, callback, exheaders, exoptions) {
  const self = this;
  const options = self.buildRequest(rurl, data, exheaders, exoptions);
  let req;

  try {
    req = self._axios.request(options)
      .then(response => {
        const res = Object.assign({}, response);
        return self.handleResponse(req, res, response.data);
      })
      .then(body => {
        callback(null, res, body);
      });
  } catch (err) {
    return callback(err);
  }

  return req;
};

module.exports = HttpClient;
