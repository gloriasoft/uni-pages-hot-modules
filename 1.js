// const Module = require('module').Module
// const _old_require = Module.prototype.require
// Module.prototype.require = function (path) {
//   ccc()
// }
require('./hackRequire')
// require('path')
console.log(5555,require.context)
require('./2')
// const callsites = require('callsites')
// console.log(callsites()[1].getFileName())
// module.exports = 444
// console.log(3333, module.exports)
// module.exports={}
