const path = require('path')
const Module = require('module').Module
const old_findPath = Module._findPath

const ALIAS = {}
const _pathCache = {}
console.log(66666)
var wrap = Module.wrap

// Module.wrap = function(script) {
//   return wrap('require = 1212;\n' + script)
// }
// const _old_require = Module.prototype.require
// Module.prototype.require = function (path) {
//   ccc()
// }
module.constructor.wrap = function(script) {
  return wrap('require.context = 111;'+ script)
}
Module._findPath = function (request, paths, isMain) {
  // console.log('+++++++++++')
  // console.log(path.resolve(paths[0], request))
  const aaa = old_findPath(request, paths, isMain)
  console.log(222, aaa)
  return aaa
}
// const oldResolveFilename = Module._resolveFilename
// Module._resolveFilename = function (request, parentModule, isMain, options) {
//   // console.log(11111, parentModule)
//   // console.log(22222, this)
//   // console.log('------------')
//   const filename = oldResolveFilename.call(this, request, parentModule, isMain, options)
//   console.log(11111, filename)
//   return filename
// }
