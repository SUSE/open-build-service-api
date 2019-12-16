import xml2js = require("xml2js");

/**
 * @return A new
 * [`xml2js.Parser`](https://github.com/Leonidas-from-XIV/node-xml2js#promise-usage)
 * with some custom settings applied.
 */
export const newXmlParser = () =>
  new xml2js.Parser({ explicitArray: false, async: true });

/**
 * @return A new
 * [`xml2js.Builder`](https://github.com/Leonidas-from-XIV/node-xml2js#xml-builder-usage).
 */
export const newXmlBuilder = () => new xml2js.Builder();
